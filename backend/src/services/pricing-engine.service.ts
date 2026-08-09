import axios from 'axios';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';
import getLogger from '../utils/logger';

export interface PricingInput {
  lat: number;
  lng: number;
  rideId?: string;
  at?: Date;
  destLat?: number;
  destLng?: number;
  fareMode?: string;
}

export interface PricingBreakdown {
  zoneId: string | null;
  demandMultiplier: number;
  timeMultiplier: number;
  dayMultiplier: number;
  weatherMultiplier: number;
  trafficMultiplier: number;
  eventMultiplier: number;
  /** Context product (may be <1 for off-peak). */
  finalMultiplier: number;
  /** Rider-facing multiplier after mode + floor/cap. */
  riderMultiplier: number;
  /** Driver-facing multiplier (never below context peak floor of 1 for payouts). */
  driverMultiplier: number;
  cappedAt: number;
  minRiderMult: number;
  reasonSummary: string | null;
  riderReason: string | null;
  driverReason: string | null;
  factors: Array<{ type: string; multiplier: number; label: string }>;
  fareMode: string;
  driverIncentiveFlat: number;
  destinationBonusFlat: number;
}

export interface DualFareQuote {
  baseBeforeSurge: number;
  riderFare: number;
  driverPayout: number;
  platformSubsidy: number;
  surgeBonus: number;
  dvtReward: number;
  breakdown: PricingBreakdown;
  fareMode: {
    code: string;
    name: string;
    description: string | null;
    etaExtraMinutes: number;
    walkMeters: number;
  };
}

/**
 * Phase 25 — contextual pricing (demand, time, day, weather, traffic, events).
 * Weather/traffic failures fall back to 1.0x so fare calc never fails.
 */
export class PricingEngineService {
  private logger = getLogger('pricing-engine');
  private integrations: IntegrationsService;

  constructor(
    private db: DatabaseService,
    private redis?: any
  ) {
    this.integrations = new IntegrationsService(db);
  }

  async findZone(lat: number, lng: number) {
    const zones = await this.db.query(
      `SELECT * FROM pricing_zones WHERE is_active = TRUE`
    );
    let best: any = null;
    let bestDist = Infinity;
    for (const z of zones.rows) {
      const dKm =
        Math.sqrt(Math.pow(lat - Number(z.center_lat), 2) + Math.pow(lng - Number(z.center_lng), 2)) *
        111;
      if (dKm <= Number(z.radius_km) && dKm < bestDist) {
        best = z;
        bestDist = dKm;
      }
    }
    return best;
  }

  async calculateMultiplier(input: PricingInput): Promise<PricingBreakdown> {
    const at = input.at || new Date();
    const fareModeCode = String(input.fareMode || 'now').toLowerCase();
    const zone = await this.findZone(input.lat, input.lng);
    const cap = zone ? Number(zone.max_surge_cap) : 2.0;
    const minRider = zone ? Number(zone.min_rider_mult ?? 0.7) : 0.7;
    const driverIncentiveFlat = zone ? Number(zone.driver_incentive_flat || 0) : 0;
    const driverIncentiveMult = zone ? Number(zone.driver_incentive_mult || 1) : 1;
    const destinationBonusFlat = zone ? Number(zone.destination_bonus_flat || 0) : 0;

    const empty: PricingBreakdown = {
      zoneId: zone?.id || null,
      demandMultiplier: 1,
      timeMultiplier: 1,
      dayMultiplier: 1,
      weatherMultiplier: 1,
      trafficMultiplier: 1,
      eventMultiplier: 1,
      finalMultiplier: 1,
      riderMultiplier: 1,
      driverMultiplier: 1,
      cappedAt: cap,
      minRiderMult: minRider,
      reasonSummary: null,
      riderReason: null,
      driverReason: null,
      factors: [],
      fareMode: fareModeCode,
      driverIncentiveFlat,
      destinationBonusFlat,
    };

    const mode = await this.getFareMode(fareModeCode);

    if (!zone) {
      empty.riderMultiplier = Math.max(minRider, Math.min(cap, Number(mode.rider_mult) || 1));
      empty.driverMultiplier = Math.max(1, Number(mode.driver_keep_mult) || 1) * driverIncentiveMult;
      empty.fareMode = mode.code;
      return empty;
    }

    const factors = await this.db.query(
      `SELECT * FROM pricing_factors WHERE zone_id = $1 AND is_active = TRUE`,
      [zone.id]
    );
    const byType = new Map(factors.rows.map((f: any) => [f.factor_type, f]));

    const demand = await this.demandMultiplier(zone.id, byType.get('demand'));
    const time = this.timeOfDayMultiplier(at, byType.get('time_of_day'));
    const day = this.dayOfWeekMultiplier(at, byType.get('day_of_week'));
    const weather = await this.weatherMultiplier(input.lat, input.lng, byType.get('weather'));
    const traffic = await this.trafficMultiplier(
      input.lat,
      input.lng,
      byType.get('traffic'),
      input.destLat != null && input.destLng != null
        ? { lat: input.destLat, lng: input.destLng }
        : undefined
    );
    const event = await this.eventMultiplier(zone.id);

    const raw =
      demand.mult * time.mult * day.mult * weather.mult * traffic.mult * event.mult;
    // Context may be <1 (off-peak) or >1 (peak); clamp to [minRider, cap]
    const context = Math.min(Math.max(raw, minRider), cap);

    const riderRaw = context * Number(mode.rider_mult || 1);
    const riderMultiplier = Math.min(Math.max(riderRaw, minRider), cap);

    // Drivers never earn below "fair peak floor": max(context, 1) × incentives × mode keep
    const driverContext = Math.max(context, 1);
    const driverMultiplier =
      Math.round(driverContext * driverIncentiveMult * Number(mode.driver_keep_mult || 1) * 1000) /
      1000;

    const active = [demand, time, day, weather, traffic, event].filter(
      (f) => Math.abs(f.mult - 1) > 0.001
    );
    const up = active.filter((f) => f.mult > 1);
    const down = active.filter((f) => f.mult < 1);

    let reasonSummary: string | null = null;
    if (up.length) {
      reasonSummary = `Fares are higher due to ${up.map((a) => a.label).join(', ')}`;
    } else if (down.length) {
      reasonSummary = `Cheaper fares from ${down.map((a) => a.label).join(', ')}`;
    }

    let riderReason = reasonSummary;
    if (mode.code !== 'now' && Number(mode.rider_mult) < 1) {
      riderReason = [
        reasonSummary,
        `${mode.name}: save ~${Math.round((1 - Number(mode.rider_mult)) * 100)}%`,
      ]
        .filter(Boolean)
        .join(' · ');
    }

    const driverReasonParts: string[] = [];
    if (driverContext > 1) driverReasonParts.push(`demand ${driverContext.toFixed(2)}x`);
    if (driverIncentiveMult > 1) driverReasonParts.push(`zone incentive ${driverIncentiveMult}x`);
    if (driverIncentiveFlat > 0) driverReasonParts.push(`+${driverIncentiveFlat} flat`);
    if (destinationBonusFlat > 0 && input.destLat != null) {
      driverReasonParts.push(`+${destinationBonusFlat} destination bonus`);
    }
    if (Number(mode.driver_keep_mult) > 1) {
      driverReasonParts.push(`${mode.name} driver boost`);
    }
    const driverReason = driverReasonParts.length
      ? `Driver earnings boosted: ${driverReasonParts.join(', ')}`
      : null;

    const breakdown: PricingBreakdown = {
      zoneId: zone.id,
      demandMultiplier: demand.mult,
      timeMultiplier: time.mult,
      dayMultiplier: day.mult,
      weatherMultiplier: weather.mult,
      trafficMultiplier: traffic.mult,
      eventMultiplier: event.mult,
      finalMultiplier: Math.round(context * 1000) / 1000,
      riderMultiplier: Math.round(riderMultiplier * 1000) / 1000,
      driverMultiplier,
      cappedAt: cap,
      minRiderMult: minRider,
      reasonSummary,
      riderReason,
      driverReason,
      factors: active.map((a) => ({ type: a.type, multiplier: a.mult, label: a.label })),
      fareMode: mode.code,
      driverIncentiveFlat,
      destinationBonusFlat,
    };

    await this.db
      .query(
        `INSERT INTO pricing_multiplier_log (
           ride_id, zone_id, demand_multiplier, time_multiplier, day_multiplier,
           weather_multiplier, traffic_multiplier, event_multiplier, final_multiplier, reason_summary,
           rider_multiplier, driver_multiplier, fare_mode
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          input.rideId || null,
          zone.id,
          breakdown.demandMultiplier,
          breakdown.timeMultiplier,
          breakdown.dayMultiplier,
          breakdown.weatherMultiplier,
          breakdown.trafficMultiplier,
          breakdown.eventMultiplier,
          breakdown.finalMultiplier,
          breakdown.reasonSummary,
          breakdown.riderMultiplier,
          breakdown.driverMultiplier,
          breakdown.fareMode,
        ]
      )
      .catch(async () => {
        await this.db.query(
          `INSERT INTO pricing_multiplier_log (
             ride_id, zone_id, demand_multiplier, time_multiplier, day_multiplier,
             weather_multiplier, traffic_multiplier, event_multiplier, final_multiplier, reason_summary
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            input.rideId || null,
            zone.id,
            breakdown.demandMultiplier,
            breakdown.timeMultiplier,
            breakdown.dayMultiplier,
            breakdown.weatherMultiplier,
            breakdown.trafficMultiplier,
            breakdown.eventMultiplier,
            breakdown.finalMultiplier,
            breakdown.reasonSummary,
          ]
        );
      });

    return breakdown;
  }

  async getFareMode(code: string) {
    const c = String(code || 'now').toLowerCase();
    try {
      const row = await this.db.query(
        `SELECT * FROM fare_modes WHERE code = $1 AND is_active = TRUE LIMIT 1`,
        [c]
      );
      if (row.rows[0]) return row.rows[0];
    } catch {
      /* table may be missing until migrate */
    }
    return {
      code: 'now',
      name: 'Go now',
      description: 'Standard pickup',
      rider_mult: 1,
      driver_keep_mult: 1,
      eta_extra_minutes: 0,
      walk_meters: 0,
    };
  }

  async listFareModes() {
    try {
      return (
        await this.db.query(
          `SELECT * FROM fare_modes WHERE is_active = TRUE ORDER BY sort_order, code`
        )
      ).rows;
    } catch {
      return [
        {
          code: 'now',
          name: 'Go now',
          rider_mult: 1,
          driver_keep_mult: 1,
          eta_extra_minutes: 0,
          walk_meters: 0,
        },
      ];
    }
  }

  /**
   * Dual-sided quote: rider pays riderFare; driver earns driverPayout (may be higher via subsidy).
   */
  async quoteDualFare(
    baseBeforeSurge: number,
    input: PricingInput
  ): Promise<DualFareQuote> {
    const breakdown = await this.calculateMultiplier(input);
    const mode = await this.getFareMode(input.fareMode || breakdown.fareMode || 'now');

    const riderFare = Math.round(baseBeforeSurge * breakdown.riderMultiplier * 100) / 100;
    let driverPayout =
      Math.round(baseBeforeSurge * breakdown.driverMultiplier * 100) / 100 +
      Number(breakdown.driverIncentiveFlat || 0);

    if (input.destLat != null && input.destLng != null) {
      driverPayout += Number(breakdown.destinationBonusFlat || 0);
    }

    // Movr 0% take-rate: if rider pays less than driver payout, platform subsidizes the gap
    const platformSubsidy = Math.max(0, Math.round((driverPayout - riderFare) * 100) / 100);
    const surgeBonus = Math.max(
      0,
      Math.round((driverPayout - baseBeforeSurge) * 100) / 100
    );
    const dvtReward = Math.round(Math.max(driverPayout, riderFare) * 0.04 * 100) / 100;

    // Best-effort enrich log with amounts
    if (breakdown.zoneId) {
      await this.db
        .query(
          `UPDATE pricing_multiplier_log SET
             rider_fare = $1, driver_payout = $2, platform_subsidy = $3
           WHERE id = (
             SELECT id FROM pricing_multiplier_log
             WHERE zone_id = $4
             ORDER BY calculated_at DESC LIMIT 1
           )`,
          [riderFare, driverPayout, platformSubsidy, breakdown.zoneId]
        )
        .catch(() => undefined);
    }

    return {
      baseBeforeSurge,
      riderFare,
      driverPayout,
      platformSubsidy,
      surgeBonus,
      dvtReward,
      breakdown,
      fareMode: {
        code: mode.code,
        name: mode.name,
        description: mode.description || null,
        etaExtraMinutes: Number(mode.eta_extra_minutes || 0),
        walkMeters: Number(mode.walk_meters || 0),
      },
    };
  }

  private async demandMultiplier(zoneId: string, factor?: any) {
    const cfg = factor?.weight_or_config_json || { high: 1.5, medium: 1.2, low: 1.0 };
    let activeRides = 0;
    let availableDrivers = 1;
    try {
      if (this.redis?.getCounter) {
        activeRides = (await this.redis.getCounter('active:rides')) || 0;
        availableDrivers = (await this.redis.getCounter('available:drivers')) || 1;
      }
    } catch {
      // ignore
    }

    const snap = await this.db.query(
      `SELECT active_rides, available_drivers FROM zone_demand_snapshots
       WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [zoneId]
    );
    if (snap.rows[0]) {
      activeRides = Number(snap.rows[0].active_rides);
      availableDrivers = Math.max(1, Number(snap.rows[0].available_drivers));
    }

    const ratio = activeRides / Math.max(availableDrivers, 1);
    let mult = Number(cfg.low) || 1;
    let label = 'normal demand';
    if (ratio > 2) {
      mult = Number(cfg.high) || 1.5;
      label = 'high demand';
    } else if (ratio > 1) {
      mult = Number(cfg.medium) || 1.2;
      label = 'elevated demand';
    }
    return { type: 'demand', mult, label };
  }

  private timeOfDayMultiplier(at: Date, factor?: any) {
    const bands = factor?.weight_or_config_json?.bands || [];
    const hour = at.getHours();
    for (const b of bands) {
      if (hour >= Number(b.start) && hour < Number(b.end)) {
        const mult = Number(b.mult) || 1;
        const label =
          b.label ||
          (mult > 1 ? 'rush hour' : mult < 1 ? 'off-peak / shoulder discount' : 'standard hours');
        return { type: 'time_of_day', mult, label };
      }
    }
    return { type: 'time_of_day', mult: 1, label: 'standard hours' };
  }

  private dayOfWeekMultiplier(at: Date, factor?: any) {
    const cfg = factor?.weight_or_config_json || {};
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const key = keys[at.getDay()];
    const mult = Number(cfg[key] ?? cfg.default ?? 1) || 1;
    return {
      type: 'day_of_week',
      mult,
      label: mult > 1 ? 'weekend / peak day' : mult < 1 ? 'weekday discount' : 'weekday',
    };
  }

  private async weatherMultiplier(lat: number, lng: number, factor?: any) {
    const cfg = factor?.weight_or_config_json || {};
    const cacheKey = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}`;
    try {
      if (this.redis?.get) {
        const cached = await this.redis.get(cacheKey);
        if (cached?.main) {
          const mult = Number(cfg[cached.main] ?? cfg.Clear ?? 1) || 1;
          return {
            type: 'weather',
            mult,
            label: mult > 1 ? `${String(cached.main).toLowerCase()} weather` : 'clear weather',
          };
        }
      }
      const apiKey = await this.integrations.getCredential('openweathermap', 'api_key');
      if (!apiKey) return { type: 'weather', mult: 1, label: 'clear' };
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}`;
      const res = await axios.get(url, { timeout: 2500 });
      const main = res.data?.weather?.[0]?.main || 'Clear';
      try {
        if (this.redis?.set) await this.redis.set(cacheKey, { main }, 20 * 60);
      } catch {
        /* ignore */
      }
      const mult = Number(cfg[main] ?? cfg.Clear ?? 1) || 1;
      return {
        type: 'weather',
        mult,
        label: mult > 1 ? `${main.toLowerCase()} weather` : 'clear weather',
      };
    } catch (err: any) {
      this.logger.warn('weather API fallback 1.0x', { error: err.message });
      return { type: 'weather', mult: 1, label: 'weather unavailable' };
    }
  }

  private async trafficMultiplier(
    lat: number,
    lng: number,
    factor?: any,
    dest?: { lat: number; lng: number }
  ) {
    const cfg = factor?.weight_or_config_json || { threshold: 1.3, mult: 1.15 };
    try {
      const mapsKey =
        (await this.integrations.getCredential('google_maps', 'api_key').catch(() => null)) ||
        process.env.GOOGLE_MAPS_API_KEY;
      if (mapsKey && dest) {
        const url =
          `https://maps.googleapis.com/maps/api/directions/json` +
          `?origin=${lat},${lng}&destination=${dest.lat},${dest.lng}` +
          `&departure_time=now&traffic_model=best_guess&key=${mapsKey}`;
        const res = await axios.get(url, { timeout: 3000 });
        const leg = res.data?.routes?.[0]?.legs?.[0];
        const trafficSec = Number(leg?.duration_in_traffic?.value || leg?.duration?.value || 0);
        const freeSec = Number(leg?.duration?.value || 0);
        if (freeSec > 0 && trafficSec / freeSec >= Number(cfg.threshold || 1.3)) {
          return {
            type: 'traffic',
            mult: Number(cfg.mult) || 1.15,
            label: 'heavy traffic',
          };
        }
        return { type: 'traffic', mult: 1, label: 'normal traffic' };
      }
      // Soft fallback when Directions API unavailable
      const hour = new Date().getHours();
      const congested = (hour >= 7 && hour < 9) || (hour >= 17 && hour < 20);
      if (congested) {
        return {
          type: 'traffic',
          mult: Number(cfg.mult) || 1.15,
          label: 'heavy traffic',
        };
      }
      return { type: 'traffic', mult: 1, label: 'normal traffic' };
    } catch {
      return { type: 'traffic', mult: 1, label: 'traffic unavailable' };
    }
  }

  private async eventMultiplier(zoneId: string) {
    const now = new Date();
    const row = await this.db.query(
      `SELECT * FROM pricing_events
       WHERE zone_id = $1 AND is_active = TRUE
         AND starts_at <= $2 AND ends_at >= $2
       ORDER BY multiplier DESC LIMIT 1`,
      [zoneId, now]
    );
    if (row.rows[0]) {
      return {
        type: 'event',
        mult: Number(row.rows[0].multiplier) || 1,
        label: row.rows[0].name || 'local event',
      };
    }
    return { type: 'event', mult: 1, label: 'no event' };
  }

  async listZones() {
    return (await this.db.query(`SELECT * FROM pricing_zones ORDER BY name`)).rows;
  }

  async listFactors(zoneId?: string) {
    if (zoneId) {
      return (
        await this.db.query(`SELECT * FROM pricing_factors WHERE zone_id = $1 ORDER BY factor_type`, [
          zoneId,
        ])
      ).rows;
    }
    return (await this.db.query(`SELECT * FROM pricing_factors ORDER BY factor_type`)).rows;
  }

  async setFactorActive(factorId: string, isActive: boolean) {
    return (
      await this.db.query(
        `UPDATE pricing_factors SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [isActive, factorId]
      )
    ).rows[0];
  }

  async updateFactorConfig(factorId: string, config: any, isActive?: boolean) {
    return (
      await this.db.query(
        `UPDATE pricing_factors SET
           weight_or_config_json = COALESCE($1::jsonb, weight_or_config_json),
           is_active = COALESCE($2, is_active),
           updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [config ? JSON.stringify(config) : null, isActive ?? null, factorId]
      )
    ).rows[0];
  }

  async createZone(input: {
    name: string;
    countryCode?: string;
    centerLat: number;
    centerLng: number;
    radiusKm?: number;
    maxSurgeCap?: number;
    minRiderMult?: number;
    driverIncentiveFlat?: number;
    driverIncentiveMult?: number;
    destinationBonusFlat?: number;
  }) {
    return (
      await this.db.query(
        `INSERT INTO pricing_zones (
           name, country_code, center_lat, center_lng, radius_km, max_surge_cap,
           min_rider_mult, driver_incentive_flat, driver_incentive_mult, destination_bonus_flat
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          input.name,
          input.countryCode || 'GH',
          input.centerLat,
          input.centerLng,
          input.radiusKm ?? 5,
          input.maxSurgeCap ?? 2,
          input.minRiderMult ?? 0.7,
          input.driverIncentiveFlat ?? 50,
          input.driverIncentiveMult ?? 1.05,
          input.destinationBonusFlat ?? 30,
        ]
      )
    ).rows[0];
  }

  async updateZone(
    id: string,
    input: Partial<{
      name: string;
      centerLat: number;
      centerLng: number;
      radiusKm: number;
      maxSurgeCap: number;
      isActive: boolean;
      minRiderMult: number;
      driverIncentiveFlat: number;
      driverIncentiveMult: number;
      destinationBonusFlat: number;
    }>
  ) {
    return (
      await this.db.query(
        `UPDATE pricing_zones SET
           name = COALESCE($1, name),
           center_lat = COALESCE($2, center_lat),
           center_lng = COALESCE($3, center_lng),
           radius_km = COALESCE($4, radius_km),
           max_surge_cap = COALESCE($5, max_surge_cap),
           is_active = COALESCE($6, is_active),
           min_rider_mult = COALESCE($7, min_rider_mult),
           driver_incentive_flat = COALESCE($8, driver_incentive_flat),
           driver_incentive_mult = COALESCE($9, driver_incentive_mult),
           destination_bonus_flat = COALESCE($10, destination_bonus_flat)
         WHERE id = $11 RETURNING *`,
        [
          input.name ?? null,
          input.centerLat ?? null,
          input.centerLng ?? null,
          input.radiusKm ?? null,
          input.maxSurgeCap ?? null,
          input.isActive ?? null,
          input.minRiderMult ?? null,
          input.driverIncentiveFlat ?? null,
          input.driverIncentiveMult ?? null,
          input.destinationBonusFlat ?? null,
          id,
        ]
      )
    ).rows[0];
  }

  async upsertEvent(input: {
    zoneId: string;
    name: string;
    startsAt: string;
    endsAt: string;
    multiplier: number;
  }) {
    return (
      await this.db.query(
        `INSERT INTO pricing_events (zone_id, name, starts_at, ends_at, multiplier)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [input.zoneId, input.name, input.startsAt, input.endsAt, input.multiplier]
      )
    ).rows[0];
  }

  async listEvents(zoneId?: string) {
    if (zoneId) {
      return (
        await this.db.query(
          `SELECT * FROM pricing_events WHERE zone_id = $1 ORDER BY starts_at DESC`,
          [zoneId]
        )
      ).rows;
    }
    return (await this.db.query(`SELECT * FROM pricing_events ORDER BY starts_at DESC LIMIT 50`))
      .rows;
  }

  async snapshotDemand(zoneId: string, activeRides: number, availableDrivers: number) {
    await this.db.query(
      `INSERT INTO zone_demand_snapshots (zone_id, active_rides, available_drivers)
       VALUES ($1,$2,$3)`,
      [zoneId, activeRides, availableDrivers]
    );
  }

  async currentBreakdown(lat: number, lng: number) {
    return this.calculateMultiplier({ lat, lng });
  }
}
