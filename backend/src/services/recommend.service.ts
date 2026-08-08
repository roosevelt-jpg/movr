import { DatabaseService } from './database.service';
import { RankingService } from './ranking.service';

/**
 * Personalized store/product recommendations — history + quality scores.
 */
export class RecommendService {
  private ranking: RankingService;

  constructor(private db: DatabaseService) {
    this.ranking = new RankingService(db);
  }

  async forUser(input: {
    userId?: string;
    lat?: number;
    lng?: number;
    limit?: number;
  }) {
    const limit = Math.min(12, Math.max(3, Number(input.limit || 6)));
    const stores = await this.personalizedStores(input.userId, limit);
    const products = await this.personalizedProducts(input.userId, limit);
    const corridors = await this.rideCorridors(input.userId, 3);
    const reason = input.userId
      ? 'Based on your recent orders and top-rated nearby shops'
      : 'Top-rated stores near you — sign in for personal picks';

    return {
      reason,
      stores,
      products,
      corridors,
      cards: [
        ...stores.slice(0, 4).map((s: any) => ({
          kind: 'store' as const,
          title: s.name,
          subtitle: s.reason || s.category || 'Recommended',
          badge: s.score != null ? `★ ${Number(s.score).toFixed(1)}` : 'For you',
          href: `/store/${s.id}`,
          meta: { storeId: s.id },
        })),
        ...products.slice(0, 2).map((p: any) => ({
          kind: 'info' as const,
          title: p.name,
          subtitle: p.store_name || 'Popular item',
          price: p.price,
          href: p.store_id ? `/store/${p.store_id}` : '/marketplace',
          meta: { productId: p.id },
        })),
      ],
    };
  }

  private async personalizedStores(userId: string | undefined, limit: number) {
    if (userId) {
      const hist = await this.db
        .query(
          `SELECT s.id, s.name, s.category, s.banner_url,
                  COUNT(*)::int AS orders,
                  COALESCE(MAX(q.score), s.rating, 4)::float AS score
           FROM marketplace_orders o
           JOIN stores s ON s.id = o.store_id
           LEFT JOIN entity_quality_scores q ON q.entity_type = 'store' AND q.entity_id = s.id
           WHERE o.user_id = $1 AND o.created_at > NOW() - INTERVAL '90 days'
           GROUP BY s.id, s.name, s.category, s.banner_url, s.rating
           ORDER BY orders DESC, score DESC
           LIMIT $2`,
          [userId, limit]
        )
        .catch(() => ({ rows: [] as any[] }));
      if (hist.rows.length) {
        return hist.rows.map((r) => ({
          ...r,
          reason: `Because you ordered here ${r.orders}×`,
        }));
      }
    }
    const top = await this.ranking.top('store', limit).catch(() => [] as any[]);
    if (Array.isArray(top) && top.length) {
      return top.map((r: any) => ({
        id: r.id,
        name: r.name,
        category: r.meta?.category,
        score: r.score,
        banner_url: r.meta?.imageUrl || r.meta?.bannerUrl || null,
        reason: 'Top rated on Movr',
      }));
    }
    const fallback = await this.db
      .query(
        `SELECT id, name, category, rating AS score, banner_url
         FROM stores WHERE COALESCE(is_active, TRUE) = TRUE
         ORDER BY rating DESC NULLS LAST LIMIT $1`,
        [limit]
      )
      .catch(() => ({ rows: [] as any[] }));
    return fallback.rows.map((r) => ({ ...r, reason: 'Popular nearby' }));
  }

  private async personalizedProducts(userId: string | undefined, limit: number) {
    if (userId) {
      const rows = await this.db
        .query(
          `SELECT p.id, p.name, p.price, p.base_price, s.id AS store_id, s.name AS store_name,
                  COUNT(*)::int AS buys
           FROM marketplace_order_items oi
           JOIN marketplace_orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           JOIN stores s ON s.id = o.store_id
           WHERE o.user_id = $1 AND o.created_at > NOW() - INTERVAL '90 days'
           GROUP BY p.id, p.name, p.price, p.base_price, s.id, s.name
           ORDER BY buys DESC
           LIMIT $2`,
          [userId, limit]
        )
        .catch(() => ({ rows: [] as any[] }));
      if (rows.rows.length) {
        return rows.rows.map((p) => ({
          ...p,
          price: Number(p.price || p.base_price || 0),
        }));
      }
    }
    const popular = await this.db
      .query(
        `SELECT p.id, p.name, COALESCE(p.price, p.base_price, 0)::float AS price,
                s.id AS store_id, s.name AS store_name
         FROM products p
         JOIN stores s ON s.id = p.store_id
         WHERE COALESCE(p.is_popular, p.is_featured, FALSE) = TRUE
            OR COALESCE(p.in_stock, TRUE) = TRUE
         ORDER BY COALESCE(p.is_popular, FALSE) DESC, p.created_at DESC NULLS LAST
         LIMIT $1`,
        [limit]
      )
      .catch(() => ({ rows: [] as any[] }));
    return popular.rows;
  }

  private async rideCorridors(userId: string | undefined, limit: number) {
    if (!userId) return [];
    const rows = await this.db
      .query(
        `SELECT pickup_address AS origin, dropoff_address AS destination, COUNT(*)::int AS trips
         FROM rides
         WHERE customer_id = $1 AND status = 'completed'
           AND created_at > NOW() - INTERVAL '120 days'
           AND pickup_address IS NOT NULL AND dropoff_address IS NOT NULL
         GROUP BY pickup_address, dropoff_address
         ORDER BY trips DESC
         LIMIT $2`,
        [userId, limit]
      )
      .catch(() => ({ rows: [] as any[] }));
    return rows.rows;
  }
}
