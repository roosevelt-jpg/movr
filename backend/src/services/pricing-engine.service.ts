import axios from 'axios';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';
import getLogger from '../utils/logger';

export interface PricingInput {
  lat: number;
  lng: number;
  rideId?: string;
  at?: Date;
}

export interface PricingBreakdown {
  zoneId: string | null;
  demandMultiplier: number;
  timeMultiplier: number;
  dayMultiplier: number;
  weatherMultiplier: number;
  trafficMultiplier: number;
  eventMultiplier: number;
  finalMultiplier: number;
  cappedAt: number;
  reasonSummary: string | null;
  factors: Array<{ type: string; multiplier: number; label: string }>;
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
    const zone = await this.findZone(input.lat, input.lng);
    const cap = zone ? Number(zone.max_surge_cap) : 2.0;

    const empty: PricingBreakdown = {
      zoneId: zone?.id || null,
      demandMultiplier: 1,
      timeMultiplier: 1,
      dayMultiplier: 1,
      weatherMultiplier: 1,
      trafficMultiplier: 1,
      eventMultiplier: 1,
      finalMultiplier: 1,
      cappedAt: cap,
      reasonSummary: null,
      factors: [],
    };

    if (!zone) return empty;

    const factors = await this.db.query(
      `SELECT * FROM pricing_factors WHERE zone_id = $1 AND is_active = TRUE`,
      [zone.id]
    );
    const byType = new Map(factors.rows.map((f: any) => [f.factor_type, f]));

    const demand = await this.demandMultiplier(zone.id, byType.get('demand'));
    const time = this.timeOfDayMultiplier(at, byType.get('time_of_day'));
    const day = this.dayOfWeekMultiplier(at, byType.get('day_of_week'));
    const weather = await this.weatherMultiplier(input.lat, input.lng, byType.get('weather'));
    const traffic = await this.trafficMultiplier(input.lat, input.lng, byType.get('traffic'));
    const event = await this.eventMultiplier(zone.id);

    const raw =
      demand.mult * time.mult * day.mult * weather.mult * traffic.mult * event.mult;
    const final = Math.min(Math.max(raw, 1), cap);

    const active = [demand, time, day, weather, traffic, event].filter((f) => f.mult > 1);
    const reasonSummary =
      final > 1
        ? `Fares are higher due to ${active.map((a) => a.label).join(', ') || 'local conditions'}`
        : null;

    const breakdown: PricingBreakdown = {
      zoneId: zone.id,
      demandMultiplier: demand.mult,
      timeMultiplier: time.mult,
      dayMultiplier: day.mult,
      weatherMultiplier: weather.mult,
      trafficMultiplier: traffic.mult,
      eventMultiplier: event.mult,
      finalMultiplier: Math.round(final * 1000) / 1000,
      cappedAt: cap,
      reasonSummary,
      factors: active.map((a) => ({ type: a.type, multiplier: a.mult, label: a.label })),
    };

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

    return breakdown;
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
        return { type: 'time_of_day', mult: Number(b.mult) || 1, label: 'rush hour' };
      }
    }
    return { type: 'time_of_day', mult: 1, label: 'off-peak' };
  }

  private dayOfWeekMultiplier(at: Date, factor?: any) {
    const cfg = factor?.weight_or_config_json || {};
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const key = keys[at.getDay()];
    const mult = Number(cfg[key] ?? cfg.default ?? 1) || 1;
    return {
      type: 'day_of_week',
      mult,
      label: mult > 1 ? 'weekend / peak day' : 'weekday',
    };
  }

  private async weatherMultiplier(lat: number, lng: number, factor?: any) {
    const cfg = factor?.weight_or_config_json || {};
    try {
      const apiKey = await this.integrations.getCredential('openweathermap', 'api_key');
      if (!apiKey) return { type: 'weather', mult: 1, label: 'clear' };
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}`;
      const res = await axios.get(url, { timeout: 2500 });
      const main = res.data?.weather?.[0]?.main || 'Clear';
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

  private async trafficMultiplier(lat: number, lng: number, factor?: any) {
    const cfg = factor?.weight_or_config_json || { threshold: 1.3, mult: 1.15 };
    try {
      // Placeholder: without a live traffic provider, use time-of-day heuristic only.
      // Real Google Maps Distance Matrix traffic can be wired via integrations hub later.
      const hour = new Date().getHours();
      const congested = (hour >= 7 && hour < 9) || (hour >= 17 && hour < 20);
      if (congested) {
        return {
          type: 'traffic',
          mult: Number(cfg.mult) || 1.15,
          label: 'heavy traffic',
        };
      }
      void lat;
      void lng;
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
