import winston from 'winston';
import { DatabaseService } from './database.service';

const NHTSA = 'https://vpic.nhtsa.dot.gov/api/vehicles';

type MakeRow = {
  id: string;
  name: string;
  nhtsa_make_id?: number | null;
};

type ModelRow = {
  id: string;
  make_id: string;
  name: string;
  body_style?: string | null;
  year_start?: number | null;
  year_end?: number | null;
  make_name?: string;
};

function norm(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Global automobile catalog — local cache + NHTSA vPIC (makes, models, years, VIN/chassis decode).
 */
export class VehicleCatalogService {
  private logger = winston.createLogger({
    defaultMeta: { service: 'vehicle-catalog' },
    transports: [new winston.transports.Console()],
  });

  private makesSyncedAt = 0;

  constructor(private db: DatabaseService) {}

  private async nhtsaJson(path: string): Promise<any> {
    const url = path.startsWith('http') ? path : `${NHTSA}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`NHTSA ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Ensure popular/global makes are present (seed + optional NHTSA refresh). */
  async ensureMakesCached(force = false) {
    const count = await this.db.query(`SELECT COUNT(*)::int AS n FROM vehicle_makes`);
    const n = Number(count.rows[0]?.n || 0);
    if (!force && n >= 20 && Date.now() - this.makesSyncedAt < 24 * 60 * 60 * 1000) {
      return;
    }
    try {
      const json = await this.nhtsaJson('/GetAllMakes?format=json');
      const results: any[] = Array.isArray(json?.Results) ? json.Results : [];
      for (const row of results) {
        const name = String(row.Make_Name || '').trim();
        if (!name || name.length > 120) continue;
        await this.db.query(
          `INSERT INTO vehicle_makes (name, name_norm, nhtsa_make_id, source)
           VALUES ($1, $2, $3, 'nhtsa')
           ON CONFLICT (name_norm) DO UPDATE SET
             nhtsa_make_id = COALESCE(EXCLUDED.nhtsa_make_id, vehicle_makes.nhtsa_make_id),
             updated_at = NOW()`,
          [name, norm(name), row.Make_ID || null]
        );
      }
      this.makesSyncedAt = Date.now();
      this.logger.info(`Synced ${results.length} makes from NHTSA`);
    } catch (e: any) {
      this.logger.warn(`NHTSA makes sync skipped: ${e.message}`);
    }
  }

  async searchMakes(q = '', limit = 25): Promise<MakeRow[]> {
    await this.ensureMakesCached().catch(() => undefined);
    const query = norm(q);
    const rows = await this.db.query(
      `SELECT id, name, nhtsa_make_id
       FROM vehicle_makes
       WHERE is_active = TRUE
         AND ($1 = '' OR name_norm LIKE $1 || '%' OR name_norm LIKE '% ' || $1 || '%')
       ORDER BY
         CASE WHEN name_norm = $1 THEN 0 WHEN name_norm LIKE $1 || '%' THEN 1 ELSE 2 END,
         length(name), name
       LIMIT $2`,
      [query, Math.min(50, Math.max(1, limit))]
    );
    return rows.rows;
  }

  async ensureModelsForMake(makeName: string) {
    const make = await this.db.query(
      `SELECT id, name, name_norm FROM vehicle_makes WHERE name_norm = $1 LIMIT 1`,
      [norm(makeName)]
    );
    if (!make.rows[0]) return null;
    const makeId = make.rows[0].id as string;

    const existing = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM vehicle_models WHERE make_id = $1`,
      [makeId]
    );
    if (Number(existing.rows[0]?.n || 0) >= 3) return make.rows[0];

    try {
      const enc = encodeURIComponent(make.rows[0].name);
      const json = await this.nhtsaJson(`/GetModelsForMake/${enc}?format=json`);
      const results: any[] = Array.isArray(json?.Results) ? json.Results : [];
      for (const row of results) {
        const name = String(row.Model_Name || '').trim();
        if (!name) continue;
        await this.db.query(
          `INSERT INTO vehicle_models (make_id, name, name_norm, nhtsa_model_id, source)
           VALUES ($1, $2, $3, $4, 'nhtsa')
           ON CONFLICT (make_id, name_norm) DO UPDATE SET
             nhtsa_model_id = COALESCE(EXCLUDED.nhtsa_model_id, vehicle_models.nhtsa_model_id),
             updated_at = NOW()`,
          [makeId, name, norm(name), row.Model_ID || null]
        );
      }
    } catch (e: any) {
      this.logger.warn(`NHTSA models sync skipped for ${makeName}: ${e.message}`);
    }
    return make.rows[0];
  }

  async searchModels(makeName: string, q = '', year?: number, limit = 40): Promise<ModelRow[]> {
    const make = await this.ensureModelsForMake(makeName);
    if (!make) return [];
    const query = norm(q);
    const rows = await this.db.query(
      `SELECT vm.id, vm.make_id, vm.name, vm.body_style, vm.year_start, vm.year_end,
              m.name AS make_name
       FROM vehicle_models vm
       JOIN vehicle_makes m ON m.id = vm.make_id
       WHERE vm.make_id = $1 AND vm.is_active = TRUE
         AND ($2 = '' OR vm.name_norm LIKE $2 || '%' OR vm.name_norm LIKE '% ' || $2 || '%')
         AND (
           $3::int IS NULL
           OR (vm.year_start IS NULL AND vm.year_end IS NULL)
           OR (COALESCE(vm.year_start, 1950) <= $3 AND COALESCE(vm.year_end, 2100) >= $3)
           OR EXISTS (
             SELECT 1 FROM vehicle_model_years y WHERE y.model_id = vm.id AND y.year = $3
           )
         )
       ORDER BY
         CASE WHEN vm.name_norm = $2 THEN 0 WHEN vm.name_norm LIKE $2 || '%' THEN 1 ELSE 2 END,
         vm.name
       LIMIT $4`,
      [make.id, query, year || null, Math.min(80, Math.max(1, limit))]
    );
    return rows.rows;
  }

  async listYears(makeName: string, modelName?: string): Promise<number[]> {
    const makeN = norm(makeName);
    const modelN = norm(modelName || '');
    if (modelN) {
      const fromDb = await this.db.query(
        `SELECT y.year
         FROM vehicle_model_years y
         JOIN vehicle_models vm ON vm.id = y.model_id
         JOIN vehicle_makes m ON m.id = vm.make_id
         WHERE m.name_norm = $1 AND vm.name_norm = $2
         ORDER BY y.year DESC`,
        [makeN, modelN]
      );
      if (fromDb.rows.length) return fromDb.rows.map((r: any) => Number(r.year));

      const range = await this.db.query(
        `SELECT year_start, year_end FROM vehicle_models vm
         JOIN vehicle_makes m ON m.id = vm.make_id
         WHERE m.name_norm = $1 AND vm.name_norm = $2 LIMIT 1`,
        [makeN, modelN]
      );
      if (range.rows[0]?.year_start) {
        const start = Number(range.rows[0].year_start);
        const end = Number(range.rows[0].year_end || new Date().getFullYear());
        const years: number[] = [];
        for (let y = end; y >= start; y--) years.push(y);
        return years;
      }
    }

    // NHTSA year list for make
    try {
      const enc = encodeURIComponent(makeName);
      const json = await this.nhtsaJson(`/GetVehicleVariableValuesList/Model%20Year?format=json`).catch(
        () => null
      );
      void json;
      const current = new Date().getFullYear() + 1;
      const years: number[] = [];
      for (let y = current; y >= 1980; y--) years.push(y);

      // Prefer make+year models probe for recent years only when model known later
      if (makeName) {
        const sample = await this.nhtsaJson(
          `/GetModelsForMakeYear/make/${enc}/modelyear/${current - 1}?format=json`
        ).catch(() => null);
        if (sample?.Results?.length) return years;
      }
      return years;
    } catch {
      const current = new Date().getFullYear() + 1;
      return Array.from({ length: current - 1979 }, (_, i) => current - i);
    }
  }

  /**
   * Decode VIN / chassis via NHTSA — autofills make, model, year, body, plant, etc.
   */
  async decodeVin(vinRaw: string) {
    const vin = String(vinRaw || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (vin.length < 11) {
      return { ok: false as const, message: 'Enter a valid VIN / chassis (at least 11 characters)' };
    }

    try {
      const json = await this.nhtsaJson(`/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
      const r = json?.Results?.[0] || {};
      const make = String(r.Make || '').trim();
      const model = String(r.Model || '').trim();
      const year = Number(r.ModelYear) || null;
      const body =
        String(r.BodyClass || r.VehicleType || '')
          .trim()
          .replace(/^Incomplete.*$/i, '') || null;
      const errorCode = String(r.ErrorCode || '0');
      if (!make && errorCode !== '0') {
        return {
          ok: false as const,
          message: r.ErrorText || 'Could not decode this VIN / chassis',
          vin,
        };
      }

      let makeId: string | null = null;
      let modelId: string | null = null;
      if (make) {
        await this.db.query(
          `INSERT INTO vehicle_makes (name, name_norm, source)
           VALUES ($1, $2, 'nhtsa')
           ON CONFLICT (name_norm) DO UPDATE SET updated_at = NOW()`,
          [make, norm(make)]
        );
        const m = await this.db.query(
          `SELECT id FROM vehicle_makes WHERE name_norm = $1 LIMIT 1`,
          [norm(make)]
        );
        makeId = m.rows[0]?.id || null;
        if (makeId && model) {
          await this.db.query(
            `INSERT INTO vehicle_models (make_id, name, name_norm, body_style, year_start, year_end, source)
             VALUES ($1, $2, $3, $4, $5, $5, 'nhtsa')
             ON CONFLICT (make_id, name_norm) DO UPDATE SET
               body_style = COALESCE(vehicle_models.body_style, EXCLUDED.body_style),
               updated_at = NOW()`,
            [makeId, model, norm(model), body, year]
          );
          const md = await this.db.query(
            `SELECT id FROM vehicle_models WHERE make_id = $1 AND name_norm = $2 LIMIT 1`,
            [makeId, norm(model)]
          );
          modelId = md.rows[0]?.id || null;
          if (modelId && year) {
            await this.db
              .query(
                `INSERT INTO vehicle_model_years (model_id, year) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [modelId, year]
              )
              .catch(() => undefined);
          }
        }
      }

      return {
        ok: true as const,
        vin,
        make,
        model,
        year,
        makeId,
        modelId,
        bodyStyle: body,
        vehicleType: String(r.VehicleType || '').trim() || null,
        driveType: String(r.DriveType || '').trim() || null,
        fuelType: String(r.FuelTypePrimary || '').trim() || null,
        transmission: String(r.TransmissionStyle || '').trim() || null,
        doors: r.Doors ? Number(r.Doors) : null,
        manufacturer: String(r.Manufacturer || '').trim() || null,
        plantCountry: String(r.PlantCountry || '').trim() || null,
        trim: String(r.Trim || '').trim() || null,
        series: String(r.Series || '').trim() || null,
        errorText: r.ErrorText || null,
      };
    } catch (e: any) {
      return { ok: false as const, message: e.message || 'VIN decode failed', vin };
    }
  }

  /** Combined typeahead: "Toyota Cor" → make+model suggestions. */
  async suggest(q: string, limit = 20) {
    const query = norm(q);
    if (!query) {
      const makes = await this.searchMakes('', Math.min(limit, 15));
      return makes.map((m) => ({
        kind: 'make' as const,
        make: m.name,
        makeId: m.id,
        model: null as string | null,
        modelId: null as string | null,
        label: m.name,
      }));
    }

    const parts = query.split(/\s+/);
    const maybeMake = parts[0];
    const rest = parts.slice(1).join(' ');

    const makeHits = await this.searchMakes(query, 8);
    const out: Array<{
      kind: 'make' | 'model';
      make: string;
      makeId: string;
      model: string | null;
      modelId: string | null;
      label: string;
      bodyStyle?: string | null;
    }> = makeHits.map((m) => ({
      kind: 'make',
      make: m.name,
      makeId: m.id,
      model: null,
      modelId: null,
      label: m.name,
    }));

    // Also search models under first token as make
    const models = await this.searchModels(maybeMake, rest || query, undefined, limit);
    for (const md of models) {
      out.push({
        kind: 'model',
        make: md.make_name || maybeMake,
        makeId: md.make_id,
        model: md.name,
        modelId: md.id,
        label: `${md.make_name || maybeMake} ${md.name}`,
        bodyStyle: md.body_style,
      });
    }

    // Dedupe by label
    const seen = new Set<string>();
    return out
      .filter((x) => {
        const k = x.label.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, limit);
  }

  mapBodyToVehicleType(body?: string | null): string {
    const b = String(body || '').toLowerCase();
    if (/motor|bike|cycle/.test(b)) return 'Motorcycle';
    if (/tricycle|keke|tuk/.test(b)) return 'Tricycle';
    if (/pickup|truck|cargo/.test(b)) return 'Pickup';
    if (/van|minivan|bus/.test(b)) return 'Van';
    if (/suv|crossover|mpv|utility/.test(b)) return 'SUV';
    if (/hatch/.test(b)) return 'Hatchback';
    if (/coupe|convertible|roadster/.test(b)) return 'Luxury';
    if (/sedan|saloon|passenger/.test(b)) return 'Sedan';
    return 'Sedan';
  }
}
