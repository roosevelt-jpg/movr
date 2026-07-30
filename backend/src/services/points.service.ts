import { DatabaseService } from './database.service';

export class PointsService {
  constructor(private db: DatabaseService) {}

  async award(
    userId: string,
    activityType: string,
    description?: string,
    overridePoints?: number
  ) {
    let points = overridePoints;
    if (points == null) {
      const cfg = await this.db.query(
        `SELECT points_per_action FROM points_conversion_config
         WHERE activity_type = $1
         ORDER BY effective_from DESC LIMIT 1`,
        [activityType]
      );
      points = Number(cfg.rows[0]?.points_per_action || 0);
    }
    if (!points) return null;

    const row = await this.db.query(
      `INSERT INTO points_ledger (user_id, activity_type, points_earned, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, activityType, points, description || null]
    );

    await this.db.query(
      `INSERT INTO wallets (user_id, balance_fiat, balance_points, points_balance, currency)
       VALUES ($1, 0, $2, $2, 'GHS')
       ON CONFLICT (user_id) DO UPDATE SET
         balance_points = wallets.balance_points + $2,
         points_balance = COALESCE(wallets.points_balance, 0) + $2,
         last_updated = NOW()`,
      [userId, points]
    );

    return row.rows[0];
  }

  async getBalance(userId: string) {
    const sum = await this.db.query(
      `SELECT COALESCE(SUM(points_earned), 0) AS total FROM points_ledger WHERE user_id = $1`,
      [userId]
    );
    return Number(sum.rows[0]?.total || 0);
  }

  async getHistory(userId: string) {
    const byActivity = await this.db.query(
      `SELECT activity_type, COALESCE(SUM(points_earned), 0) AS points, COUNT(*)::int AS events
       FROM points_ledger WHERE user_id = $1
       GROUP BY activity_type ORDER BY points DESC`,
      [userId]
    );
    const recent = await this.db.query(
      `SELECT * FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return { byActivity: byActivity.rows, recent: recent.rows };
  }

  async estimatedDvt(userId: string) {
    const balance = await this.getBalance(userId);
    const rate = await this.db.query(
      `SELECT dvt_conversion_rate FROM points_global_config WHERE id = 1`
    );
    const conversionRate = Number(rate.rows[0]?.dvt_conversion_rate || 0.01);
    return {
      points: balance,
      conversionRate,
      estimatedDvt: balance * conversionRate,
    };
  }
}
