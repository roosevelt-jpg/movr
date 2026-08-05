import { DatabaseService } from './database.service';
import { TokenService } from './token.service';
import { PointsService } from './points.service';
import getLogger from '../utils/logger';

/**
 * Phase 7 — driver / merchant / public staking.
 * Gated by STAKING_SYSTEM_ENABLED for stake mutations; reads always available.
 */
export class StakingService {
  private logger = getLogger('staking');
  private tokens: TokenService;
  private points: PointsService;

  constructor(private db: DatabaseService) {
    this.tokens = new TokenService(db);
    this.points = new PointsService(db);
  }

  isEnabled() {
    return process.env.STAKING_SYSTEM_ENABLED === 'true';
  }

  async listPools(role?: string) {
    if (role) {
      return this.db.query(
        `SELECT * FROM staking_pools WHERE active = TRUE AND target_role = $1 ORDER BY name`,
        [role]
      );
    }
    return this.db.query(`SELECT * FROM staking_pools WHERE active = TRUE ORDER BY target_role, name`);
  }

  async myStakes(userId: string) {
    return this.db.query(
      `SELECT st.*, p.name AS pool_name, p.target_role, p.apy_or_benefit_desc, p.lock_period_days
       FROM stakes st
       JOIN staking_pools p ON p.id = st.pool_id
       WHERE st.user_id = $1
       ORDER BY st.staked_at DESC`,
      [userId]
    );
  }

  async getActiveStakeTotal(userId: string, role?: string) {
    const params: any[] = [userId];
    let sql = `
      SELECT COALESCE(SUM(st.amount), 0) AS total
      FROM stakes st
      JOIN staking_pools p ON p.id = st.pool_id
      WHERE st.user_id = $1 AND st.status = 'active'
    `;
    if (role) {
      params.push(role);
      sql += ` AND p.target_role = $${params.length}`;
    }
    const row = await this.db.query(sql, params);
    return Number(row.rows[0]?.total || 0);
  }

  async getTier(userId: string, role: 'driver' | 'merchant') {
    const total = await this.getActiveStakeTotal(userId, role);
    const tiers = await this.db.query(
      `SELECT * FROM staking_tiers WHERE target_role = $1 ORDER BY min_stake DESC`,
      [role]
    );
    const tier = tiers.rows.find((t) => total >= Number(t.min_stake)) || null;
    return {
      totalStaked: total,
      tier: tier?.tier_name || null,
      priorityWeight: Number(tier?.priority_weight || 1),
      feeDiscountPct: Number(tier?.fee_discount_pct || 0),
    };
  }

  async stake(userId: string, poolId: string, amount: number) {
    if (!this.isEnabled()) throw new Error('Staking system disabled');
    if (amount <= 0) throw new Error('Amount must be positive');

    const pool = await this.db.query(`SELECT * FROM staking_pools WHERE id = $1 AND active = TRUE`, [
      poolId,
    ]);
    if (!pool.rows[0]) throw new Error('Pool not found');
    if (amount < Number(pool.rows[0].min_amount)) {
      throw new Error(`Minimum stake is ${pool.rows[0].min_amount}`);
    }

    const bal = await this.tokens.getBalance(userId);
    if (bal.total < amount) throw new Error('Insufficient DVT balance');

    const unlock = new Date();
    unlock.setDate(unlock.getDate() + Number(pool.rows[0].lock_period_days));

    return this.db.transaction(async (client) => {
      const tb = (
        await client.query(`SELECT * FROM token_balances WHERE user_id = $1 FOR UPDATE`, [userId])
      ).rows[0];
      const available = Number(tb?.pending_amount || 0) + Number(tb?.onchain_amount || 0);
      if (available < amount) throw new Error('Insufficient DVT balance');

      let remaining = amount;
      const fromPending = Math.min(Number(tb.pending_amount), remaining);
      remaining -= fromPending;
      await client.query(
        `UPDATE token_balances SET
           pending_amount = pending_amount - $1,
           onchain_amount = onchain_amount - $2,
           updated_at = NOW()
         WHERE user_id = $3`,
        [fromPending, remaining, userId]
      );

      await client.query(
        `INSERT INTO token_activity_log (user_id, activity_type, dvt_amount, status, metadata)
         VALUES ($1, 'stake', $2, 'confirmed', $3::jsonb)`,
        [userId, -amount, JSON.stringify({ poolId })]
      );

      const stake = await client.query(
        `INSERT INTO stakes (user_id, pool_id, amount, status, unlock_at)
         VALUES ($1, $2, $3, 'active', $4) RETURNING *`,
        [userId, poolId, amount, unlock.toISOString()]
      );

      return stake.rows[0];
    });
  }

  async unstake(userId: string, stakeId: string) {
    if (!this.isEnabled()) throw new Error('Staking system disabled');

    return this.db.transaction(async (client) => {
      const stake = (
        await client.query(
          `SELECT * FROM stakes WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [stakeId, userId]
        )
      ).rows[0];
      if (!stake) throw new Error('Stake not found');
      if (stake.status !== 'active' && stake.status !== 'unstaking') {
        throw new Error('Stake not withdrawable');
      }
      if (new Date(stake.unlock_at) > new Date()) {
        await client.query(`UPDATE stakes SET status = 'unstaking' WHERE id = $1`, [stakeId]);
        throw new Error(`Locked until ${stake.unlock_at}`);
      }

      await client.query(
        `UPDATE stakes SET status = 'withdrawn', withdrawn_at = NOW() WHERE id = $1`,
        [stakeId]
      );
      await client.query(
        `INSERT INTO token_balances (user_id, pending_amount)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           pending_amount = token_balances.pending_amount + EXCLUDED.pending_amount,
           updated_at = NOW()`,
        [userId, stake.amount]
      );
      await client.query(
        `INSERT INTO token_activity_log (user_id, activity_type, dvt_amount, status, metadata)
         VALUES ($1, 'unstake', $2, 'confirmed', $3::jsonb)`,
        [userId, stake.amount, JSON.stringify({ stakeId })]
      );

      return { stakeId, amount: Number(stake.amount), status: 'withdrawn' };
    });
  }

  /** Accrue public-pool points based on active stake * APY (daily job / on-demand). */
  async accruePublicPoints(userId: string) {
    const rows = await this.db.query(
      `SELECT st.amount, p.base_apy_pct
       FROM stakes st
       JOIN staking_pools p ON p.id = st.pool_id
       WHERE st.user_id = $1 AND st.status = 'active' AND p.target_role = 'public'`,
      [userId]
    );
    let awarded = 0;
    for (const row of rows.rows) {
      const daily = (Number(row.amount) * Number(row.base_apy_pct)) / 100 / 365;
      const pts = Math.max(1, Math.round(daily));
      if (pts > 0) {
        await this.points.award(userId, 'staking', 'Public staking accrual', pts);
        awarded += pts;
      }
    }
    return { awarded };
  }

  async publicStats() {
    const pools = await this.db.query(
      `SELECT p.id, p.name, p.target_role, p.apy_or_benefit_desc, p.base_apy_pct, p.min_amount,
              COALESCE(SUM(CASE WHEN st.status = 'active' THEN st.amount ELSE 0 END), 0) AS total_staked,
              COUNT(DISTINCT CASE WHEN st.status = 'active' THEN st.user_id END) AS participants
       FROM staking_pools p
       LEFT JOIN stakes st ON st.pool_id = p.id
       WHERE p.active = TRUE
       GROUP BY p.id
       ORDER BY p.target_role, p.name`
    );
    const totals = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_staked,
              COUNT(DISTINCT user_id) AS participants
       FROM stakes WHERE status = 'active'`
    );
    return {
      totalStaked: Number(totals.rows[0]?.total_staked || 0),
      participantCount: Number(totals.rows[0]?.participants || 0),
      pools: pools.rows.map((p) => ({
        ...p,
        total_staked: Number(p.total_staked),
        participants: Number(p.participants),
        base_apy_pct: Number(p.base_apy_pct),
      })),
    };
  }
}
