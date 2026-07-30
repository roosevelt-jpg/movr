import winston from 'winston';
import { DatabaseService } from './database.service';

export type DriverTier = 'lite' | 'pro' | 'premium';

export class DriverPerformanceService {
  private logger = winston.createLogger({
    defaultMeta: { service: 'driver-performance' },
    transports: [new winston.transports.Console()],
  });

  constructor(private db: DatabaseService) {}

  async recalculateMetrics(driverId: string) {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const stats = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'cancelled' AND driver_id = $1)::int AS cancelled,
         COUNT(*) FILTER (WHERE status IN ('accepted','in_progress','completed','cancelled'))::int AS touched,
         COUNT(*) FILTER (WHERE status = 'completed' AND (
           estimated_duration_minutes IS NULL OR
           EXTRACT(EPOCH FROM (completed_at - created_at))/60 <= estimated_duration_minutes * 1.2
         ))::int AS on_time
       FROM rides
       WHERE driver_id = $1 AND created_at >= $2`,
      [driverId, periodStart]
    );

    const s = stats.rows[0] || {};
    const completed = Number(s.completed || 0);
    const cancelled = Number(s.cancelled || 0);
    const touched = Number(s.touched || 0);
    const onTime = Number(s.on_time || 0);
    const offered = Math.max(touched, completed + cancelled, 1);

    const acceptanceRate = Math.round(((touched - cancelled) / offered) * 10000) / 100;
    const cancellationRate = Math.round((cancelled / offered) * 10000) / 100;
    const onTimeRate = completed
      ? Math.round((onTime / completed) * 10000) / 100
      : 100;

    const tier = await this.evaluateTier({
      acceptanceRate,
      cancellationRate,
      onTimeRate,
      ridesCompleted: completed,
    });

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const row = await this.db.query(
      `INSERT INTO driver_metrics (
         driver_id, acceptance_rate, cancellation_rate, on_time_rate,
         rides_completed, rides_accepted, rides_cancelled, rides_offered,
         current_tier, period_start, period_end, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::driver_tier,$10,$11,NOW())
       ON CONFLICT (driver_id, period_start) DO UPDATE SET
         acceptance_rate = EXCLUDED.acceptance_rate,
         cancellation_rate = EXCLUDED.cancellation_rate,
         on_time_rate = EXCLUDED.on_time_rate,
         rides_completed = EXCLUDED.rides_completed,
         rides_accepted = EXCLUDED.rides_accepted,
         rides_cancelled = EXCLUDED.rides_cancelled,
         rides_offered = EXCLUDED.rides_offered,
         current_tier = EXCLUDED.current_tier,
         updated_at = NOW()
       RETURNING *`,
      [
        driverId,
        acceptanceRate,
        cancellationRate,
        onTimeRate,
        completed,
        touched - cancelled,
        cancelled,
        offered,
        tier,
        periodStart,
        periodEnd,
      ]
    );

    this.logger.info('driver metrics recalculated', { driverId, tier });
    return row.rows[0];
  }

  async evaluateTier(metrics: {
    acceptanceRate: number;
    cancellationRate: number;
    onTimeRate: number;
    ridesCompleted: number;
  }): Promise<DriverTier> {
    const thresholds = await this.db.query(
      `SELECT * FROM tier_thresholds ORDER BY min_rides DESC`
    );

    for (const t of thresholds.rows) {
      if (
        metrics.acceptanceRate >= Number(t.min_acceptance_rate) &&
        metrics.cancellationRate <= Number(t.max_cancellation_rate) &&
        metrics.onTimeRate >= Number(t.min_on_time_rate) &&
        metrics.ridesCompleted >= Number(t.min_rides)
      ) {
        return t.tier as DriverTier;
      }
    }
    return 'lite';
  }

  async getPerformance(driverId: string) {
    let metrics = await this.db.query(
      `SELECT * FROM driver_metrics WHERE driver_id = $1
       ORDER BY period_start DESC LIMIT 1`,
      [driverId]
    );
    if (!metrics.rows[0]) {
      await this.recalculateMetrics(driverId);
      metrics = await this.db.query(
        `SELECT * FROM driver_metrics WHERE driver_id = $1
         ORDER BY period_start DESC LIMIT 1`,
        [driverId]
      );
    }

    const thresholds = await this.db.query(`SELECT * FROM tier_thresholds ORDER BY min_rides ASC`);
    const current = metrics.rows[0];
    const order = ['lite', 'pro', 'premium'];
    const idx = order.indexOf(current.current_tier);
    const nextTier = thresholds.rows.find((t) => t.tier === order[idx + 1]);

    return {
      metrics: current,
      thresholds: thresholds.rows,
      nextTier: nextTier || null,
      progressToNext: nextTier
        ? {
            ridesNeeded: Math.max(0, Number(nextTier.min_rides) - Number(current.rides_completed)),
            acceptanceGap: Math.max(
              0,
              Number(nextTier.min_acceptance_rate) - Number(current.acceptance_rate)
            ),
            cancellationGap: Math.max(
              0,
              Number(current.cancellation_rate) - Number(nextTier.max_cancellation_rate)
            ),
            onTimeGap: Math.max(
              0,
              Number(nextTier.min_on_time_rate) - Number(current.on_time_rate)
            ),
          }
        : null,
    };
  }

  async getTierDiscountPct(driverId: string): Promise<number> {
    const perf = await this.getPerformance(driverId);
    const tier = perf.metrics?.current_tier || 'lite';
    const row = perf.thresholds.find((t: any) => t.tier === tier);
    return Number(row?.subscription_discount_pct || 0);
  }

  async getMatchingWeight(driverId: string): Promise<number> {
    const perf = await this.getPerformance(driverId);
    const tier = perf.metrics?.current_tier || 'lite';
    const row = perf.thresholds.find((t: any) => t.tier === tier);
    return Number(row?.matching_priority_weight || 1);
  }

  async recalculateAllActiveDrivers() {
    const drivers = await this.db.query(
      `SELECT DISTINCT driver_id AS id FROM rides WHERE driver_id IS NOT NULL
       UNION
       SELECT user_id AS id FROM users WHERE user_type = 'driver' AND is_active = TRUE`
    );
    for (const d of drivers.rows) {
      try {
        await this.recalculateMetrics(d.id);
      } catch (error: any) {
        this.logger.warn('recalculate failed', { driverId: d.id, error: error.message });
      }
    }
  }
}
