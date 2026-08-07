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
    const wallet = await this.db.query(
      `SELECT COALESCE(points_balance, balance_points, 0) AS pts
       FROM wallets WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (wallet.rows[0]) {
      return Number(wallet.rows[0].pts || 0);
    }
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
    const byActivityMonth = await this.db.query(
      `SELECT activity_type, COALESCE(SUM(points_earned), 0) AS points, COUNT(*)::int AS events
       FROM points_ledger
       WHERE user_id = $1
         AND created_at >= date_trunc('month', NOW())
         AND points_earned > 0
       GROUP BY activity_type ORDER BY points DESC`,
      [userId]
    );
    const recent = await this.db.query(
      `SELECT * FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return {
      byActivity: byActivity.rows,
      byActivityMonth: byActivityMonth.rows,
      recent: recent.rows,
    };
  }

  async getSummary(userId: string) {
    const balance = await this.getBalance(userId);
    const estimate = await this.estimatedDvt(userId);
    const history = await this.getHistory(userId);
    const labelMap: Record<string, string> = {
      ride_completed: 'Rides',
      ride: 'Rides',
      order_completed: 'Orders',
      order: 'Orders',
      delivery_completed: 'Orders',
      referral_qualified: 'Referrals',
      referral_confirmed: 'Referrals',
      referral: 'Referrals',
      staking_accrual: 'Staking pool',
      staking: 'Staking pool',
      stake_created: 'Staking pool',
    };
    const buckets: Record<string, number> = {
      Rides: 0,
      Orders: 0,
      Referrals: 0,
      'Staking pool': 0,
    };
    for (const r of history.byActivityMonth) {
      const label = labelMap[String(r.activity_type || '').toLowerCase()];
      if (label && label in buckets) buckets[label] += Number(r.points || 0);
    }
    return {
      totalPoints: balance,
      estimatedDvt: estimate.estimatedDvt,
      conversionRate: estimate.conversionRate,
      breakdown: [
        { category: 'Rides', points: buckets.Rides, timeframe: 'This month' },
        { category: 'Orders', points: buckets.Orders, timeframe: 'This month' },
        { category: 'Referrals', points: buckets.Referrals, timeframe: 'This month' },
        { category: 'Staking pool', points: buckets['Staking pool'], timeframe: 'This month' },
      ],
    };
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

  /** Redeem points for a catalog reward (negative ledger entry). */
  async redeem(userId: string, pointsCost: number, rewardId: string, label?: string) {
    const balance = await this.getBalance(userId);
    if (pointsCost <= 0) throw new Error('Invalid points cost');
    if (balance < pointsCost) throw new Error('Insufficient points');

    const row = await this.db.query(
      `INSERT INTO points_ledger (user_id, activity_type, points_earned, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, `redeem:${rewardId}`, -pointsCost, label || `Redeemed ${rewardId}`]
    );

    await this.db.query(
      `UPDATE wallets SET
         balance_points = GREATEST(0, COALESCE(balance_points, 0) - $2),
         points_balance = GREATEST(0, COALESCE(points_balance, 0) - $2),
         last_updated = NOW()
       WHERE user_id = $1`,
      [userId, pointsCost]
    );

    return { ledger: row.rows[0], balance: balance - pointsCost, rewardId };
  }
}
