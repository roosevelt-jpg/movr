import { DatabaseService } from './database.service';
import getLogger from '../utils/logger';

export type RankEntityType = 'store' | 'driver' | 'rider' | 'merchant';

export type RankedEntity = {
  id: string;
  type: RankEntityType;
  name: string;
  score: number;
  rating: number;
  rank: number;
  badge?: string;
  href?: string;
  meta?: Record<string, any>;
};

/**
 * Quality ranking — ratings, activity, payment/booking behaviour.
 * Top stores/merchants surface first in marketplace and AI recommendations.
 */
export class RankingService {
  private logger = getLogger('ranking');

  constructor(private db: DatabaseService) {}

  /** Recompute and cache scores for stores (+ merchant mirror), drivers, riders. */
  async refreshAll(limit = 200) {
    const [stores, drivers, riders] = await Promise.all([
      this.scoreStores(limit),
      this.scoreDrivers(limit),
      this.scoreRiders(limit),
    ]);
    return { stores: stores.length, drivers: drivers.length, riders: riders.length };
  }

  async top(type: RankEntityType, limit = 10): Promise<RankedEntity[]> {
    if (type === 'store' || type === 'merchant') {
      return this.topStores(limit);
    }
    if (type === 'driver') return this.topDrivers(limit);
    return this.topRiders(limit);
  }

  async topStores(limit = 10): Promise<RankedEntity[]> {
    await this.scoreStores(Math.max(limit * 3, 50)).catch(() => undefined);
    const rows = await this.db.query(
      `SELECT s.id, s.name, s.category, s.rating, s.review_count, s.image_url,
              COALESCE(q.score, COALESCE(s.rating, 0) * 20) AS score,
              COALESCE(q.rating_component, 0) AS rating_component,
              COALESCE(q.activity_component, 0) AS activity_component,
              COALESCE(q.behaviour_component, 0) AS behaviour_component,
              COALESCE(s.response_score, 70) AS response_score,
              COALESCE(s.service_score, 70) AS service_score
       FROM stores s
       LEFT JOIN entity_quality_scores q
         ON q.entity_type = 'store' AND q.entity_id = s.id
       WHERE COALESCE(s.status, 'active') = 'active' AND COALESCE(s.is_active, TRUE) = TRUE
       ORDER BY score DESC NULLS LAST, s.rating DESC NULLS LAST, s.review_count DESC NULLS LAST
       LIMIT $1`,
      [limit]
    ).catch(() => ({ rows: [] }));

    return (rows.rows || []).map((r: any, i: number) => ({
      id: r.id,
      type: 'store' as const,
      name: r.name,
      score: Number(r.score || 0),
      rating: Number(r.rating || 0),
      rank: i + 1,
      badge: this.badgeForScore(Number(r.score || 0)),
      href: `/store/${r.id}`,
      meta: {
        category: r.category,
        reviewCount: Number(r.review_count || 0),
        responseScore: Number(r.response_score || 0),
        serviceScore: Number(r.service_score || 0),
        imageUrl: r.image_url,
      },
    }));
  }

  async topDrivers(limit = 10): Promise<RankedEntity[]> {
    await this.scoreDrivers(Math.max(limit * 3, 50)).catch(() => undefined);
    const rows = await this.db.query(
      `SELECT d.id, d.user_id, d.rating, d.is_online,
              COALESCE(u.first_name, 'Driver') AS name,
              COALESCE(q.score, COALESCE(d.rating, 0) * 20) AS score
       FROM drivers d
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN entity_quality_scores q
         ON q.entity_type = 'driver' AND q.entity_id = d.id
       WHERE COALESCE(d.is_active, TRUE) = TRUE OR d.id IS NOT NULL
       ORDER BY score DESC NULLS LAST, d.rating DESC NULLS LAST
       LIMIT $1`,
      [limit]
    ).catch(() => ({ rows: [] }));

    return (rows.rows || []).map((r: any, i: number) => ({
      id: r.id,
      type: 'driver' as const,
      name: r.name,
      score: Number(r.score || 0),
      rating: Number(r.rating || 0),
      rank: i + 1,
      badge: this.badgeForScore(Number(r.score || 0)),
      meta: { online: Boolean(r.is_online), userId: r.user_id },
    }));
  }

  async topRiders(limit = 10): Promise<RankedEntity[]> {
    await this.scoreRiders(Math.max(limit * 3, 50)).catch(() => undefined);
    const rows = await this.db.query(
      `SELECT u.id, COALESCE(u.first_name, 'Rider') AS name,
              COALESCE(q.score, 50) AS score,
              COALESCE((q.meta->>'avg_rating')::float, 0) AS rating
       FROM users u
       LEFT JOIN entity_quality_scores q
         ON q.entity_type = 'rider' AND q.entity_id = u.id
       WHERE u.user_type = 'customer' AND COALESCE(u.is_active, TRUE) = TRUE
       ORDER BY score DESC NULLS LAST
       LIMIT $1`,
      [limit]
    ).catch(() => ({ rows: [] }));

    return (rows.rows || []).map((r: any, i: number) => ({
      id: r.id,
      type: 'rider' as const,
      name: r.name,
      score: Number(r.score || 0),
      rating: Number(r.rating || 0),
      rank: i + 1,
      badge: this.badgeForScore(Number(r.score || 0)),
    }));
  }

  /** Quality score used to boost marketplace placement. */
  async scoreForStore(storeId: string): Promise<number> {
    const row = await this.db.query(
      `SELECT score FROM entity_quality_scores WHERE entity_type = 'store' AND entity_id = $1`,
      [storeId]
    ).catch(() => ({ rows: [] }));
    if (row.rows[0]) return Number(row.rows[0].score);
    return 0;
  }

  private badgeForScore(score: number) {
    if (score >= 85) return 'Top rated';
    if (score >= 70) return 'Highly recommended';
    if (score >= 55) return 'Rising';
    return 'Verified';
  }

  private async upsert(
    type: RankEntityType,
    id: string,
    score: number,
    rating: number,
    activity: number,
    behaviour: number,
    meta: Record<string, any> = {}
  ) {
    await this.db.query(
      `INSERT INTO entity_quality_scores
         (entity_type, entity_id, score, rating_component, activity_component, behaviour_component, meta, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
       ON CONFLICT (entity_type, entity_id) DO UPDATE SET
         score = EXCLUDED.score,
         rating_component = EXCLUDED.rating_component,
         activity_component = EXCLUDED.activity_component,
         behaviour_component = EXCLUDED.behaviour_component,
         meta = EXCLUDED.meta,
         updated_at = NOW()`,
      [type, id, score, rating, activity, behaviour, JSON.stringify(meta)]
    ).catch((err) => this.logger.warn('upsert quality score failed', { error: err?.message }));
  }

  private async scoreStores(limit: number) {
    const rows = await this.db.query(
      `SELECT s.id, s.merchant_id, s.name,
              COALESCE(s.rating, 0)::float AS rating,
              COALESCE(s.review_count, 0)::int AS review_count,
              COALESCE(s.response_score, 70)::float AS response_score,
              COALESCE(s.service_score, 70)::float AS service_score,
              (
                SELECT COUNT(*)::int FROM orders o
                WHERE o.store_id = s.id AND o.created_at > NOW() - INTERVAL '30 days'
              ) AS orders_30d,
              (
                SELECT COUNT(*)::int FROM orders o
                WHERE o.store_id = s.id AND o.status = 'completed'
                  AND o.created_at > NOW() - INTERVAL '30 days'
              ) AS completed_30d,
              (
                SELECT COUNT(*)::int FROM orders o
                WHERE o.store_id = s.id AND o.status IN ('cancelled', 'canceled')
                  AND o.created_at > NOW() - INTERVAL '30 days'
              ) AS cancelled_30d
       FROM stores s
       WHERE COALESCE(s.is_active, TRUE) = TRUE
       LIMIT $1`,
      [limit]
    ).catch(() => ({ rows: [] }));

    for (const s of rows.rows || []) {
      const ratingC = Math.min(100, Number(s.rating || 0) * 20);
      const activityC = Math.min(100, Number(s.orders_30d || 0) * 4 + Math.min(30, Number(s.review_count || 0)));
      const completion =
        Number(s.orders_30d || 0) > 0
          ? (Number(s.completed_30d || 0) / Number(s.orders_30d || 1)) * 100
          : 60;
      const cancelPenalty = Math.min(40, Number(s.cancelled_30d || 0) * 5);
      const service = Number(s.service_score || 70);
      const response = Number(s.response_score || 70);
      const behaviourC = Math.max(0, completion * 0.5 + service * 0.25 + response * 0.25 - cancelPenalty);
      const score = Number((ratingC * 0.4 + activityC * 0.25 + behaviourC * 0.35).toFixed(2));
      await this.upsert('store', s.id, score, ratingC, activityC, behaviourC, {
        name: s.name,
        orders30d: s.orders_30d,
      });
      if (s.merchant_id) {
        await this.upsert('merchant', s.merchant_id, score, ratingC, activityC, behaviourC, {
          storeId: s.id,
          name: s.name,
        });
      }
    }
    return rows.rows || [];
  }

  private async scoreDrivers(limit: number) {
    const rows = await this.db.query(
      `SELECT d.id, d.user_id, COALESCE(d.rating, 0)::float AS rating, COALESCE(d.is_online, FALSE) AS is_online,
              (
                SELECT COUNT(*)::int FROM rides r
                WHERE r.driver_id = d.id AND r.completed_at > NOW() - INTERVAL '30 days'
                  AND r.status = 'completed'
              ) AS trips_30d,
              (
                SELECT COUNT(*)::int FROM rides r
                WHERE r.driver_id = d.id AND r.status IN ('cancelled', 'canceled')
                  AND r.created_at > NOW() - INTERVAL '30 days'
              ) AS cancelled_30d,
              COALESCE((
                SELECT AVG(rr.rating)::float FROM ride_ratings rr
                WHERE rr.driver_id = d.id OR rr.ride_id IN (
                  SELECT id FROM rides WHERE driver_id = d.id
                )
              ), d.rating, 0) AS avg_rating
       FROM drivers d
       LIMIT $1`,
      [limit]
    ).catch(() => ({ rows: [] }));

    for (const d of rows.rows || []) {
      const ratingC = Math.min(100, Number(d.avg_rating || d.rating || 0) * 20);
      const activityC = Math.min(100, Number(d.trips_30d || 0) * 3 + (d.is_online ? 15 : 0));
      const behaviourC = Math.max(0, 85 - Number(d.cancelled_30d || 0) * 8);
      const score = Number((ratingC * 0.45 + activityC * 0.3 + behaviourC * 0.25).toFixed(2));
      await this.upsert('driver', d.id, score, ratingC, activityC, behaviourC, {
        trips30d: d.trips_30d,
        online: d.is_online,
      });
    }
    return rows.rows || [];
  }

  private async scoreRiders(limit: number) {
    const rows = await this.db.query(
      `SELECT u.id, COALESCE(u.first_name, 'Rider') AS name,
              (
                SELECT COUNT(*)::int FROM rides r
                WHERE r.user_id = u.id AND r.created_at > NOW() - INTERVAL '30 days'
              ) AS rides_30d,
              (
                SELECT COUNT(*)::int FROM rides r
                WHERE r.user_id = u.id AND r.status = 'completed'
                  AND r.completed_at > NOW() - INTERVAL '30 days'
              ) AS completed_30d,
              (
                SELECT COUNT(*)::int FROM wallet_transactions_v2 wt
                JOIN wallets_v2 w ON w.id = wt.wallet_id
                WHERE w.user_id = u.id AND wt.type IN ('topup', 'payment', 'ride_payment')
                  AND wt.created_at > NOW() - INTERVAL '90 days'
              ) AS payments_90d
       FROM users u
       WHERE u.user_type = 'customer'
       LIMIT $1`,
      [limit]
    ).catch(() => ({ rows: [] }));

    for (const u of rows.rows || []) {
      const ratingC = 70;
      const activityC = Math.min(100, Number(u.rides_30d || 0) * 5);
      const payBoost = Math.min(40, Number(u.payments_90d || 0) * 4);
      const completion =
        Number(u.rides_30d || 0) > 0
          ? (Number(u.completed_30d || 0) / Number(u.rides_30d || 1)) * 100
          : 50;
      const behaviourC = Math.min(100, completion * 0.7 + payBoost);
      const score = Number((ratingC * 0.2 + activityC * 0.35 + behaviourC * 0.45).toFixed(2));
      await this.upsert('rider', u.id, score, ratingC, activityC, behaviourC, {
        name: u.name,
        avg_rating: ratingC / 20,
        rides30d: u.rides_30d,
      });
    }
    return rows.rows || [];
  }
}
