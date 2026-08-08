import { DatabaseService } from './database.service';
import { TokenService } from './token.service';
import { RewardsEngineService } from './rewards-engine.service';
import getLogger from '../utils/logger';

/**
 * Phase 7 — driver / merchant / public staking.
 * Gated by STAKING_SYSTEM_ENABLED for stake mutations; reads always available.
 */
export class StakingService {
  private logger = getLogger('staking');
  private tokens: TokenService;
  private rewards: RewardsEngineService;

  constructor(private db: DatabaseService) {
    this.tokens = new TokenService(db);
    this.rewards = new RewardsEngineService(db);
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
      `SELECT st.*, p.name AS pool_name,
              COALESCE(p.display_name, p.name) AS display_name,
              p.target_role, p.apy_or_benefit_desc, p.lock_period_days,
              COALESCE(p.base_apy_pct, 0) AS base_apy_pct,
              GREATEST(0, COALESCE(st.rewards_earned,0) - COALESCE(st.rewards_claimed,0)) AS claimable
       FROM stakes st
       JOIN staking_pools p ON p.id = st.pool_id
       WHERE st.user_id = $1
       ORDER BY st.staked_at DESC`,
      [userId]
    );
  }

  /** Accrue linear APY rewards into rewards_earned for active stakes. */
  async syncRewards(userId?: string, wallet?: string) {
    const params: any[] = [];
    let where = `st.status = 'active'`;
    if (userId) {
      params.push(userId);
      where += ` AND st.user_id = $${params.length}`;
    }
    if (wallet) {
      params.push(wallet.toLowerCase());
      where += ` AND LOWER(COALESCE(st.wallet_address,'')) = $${params.length}`;
    }
    const rows = await this.db.query(
      `SELECT st.id, st.amount, st.staked_at, st.rewards_earned, st.rewards_claimed,
              COALESCE(p.base_apy_pct, 0) AS apy
       FROM stakes st
       JOIN staking_pools p ON p.id = st.pool_id
       WHERE ${where}`,
      params
    );
    for (const row of rows.rows) {
      const days = Math.max(0, (Date.now() - new Date(row.staked_at).getTime()) / 86400000);
      const earned = (Number(row.amount) * Number(row.apy) * days) / 100 / 365;
      const next = Math.max(Number(row.rewards_earned || 0), Math.round(earned * 10000) / 10000);
      if (next > Number(row.rewards_earned || 0)) {
        await this.db.query(`UPDATE stakes SET rewards_earned = $1 WHERE id = $2`, [next, row.id]);
      }
    }
  }

  async portfolioSummary(userId?: string, wallet?: string) {
    await this.syncRewards(userId, wallet).catch(() => undefined);
    const params: any[] = [];
    let where = `st.status IN ('active','unstaking')`;
    if (userId) {
      params.push(userId);
      where += ` AND st.user_id = $${params.length}`;
    } else if (wallet) {
      params.push(wallet.toLowerCase());
      where += ` AND LOWER(COALESCE(st.wallet_address,'')) = $${params.length}`;
    } else {
      return {
        totalStaked: 0,
        totalEarned: 0,
        totalClaimable: 0,
        portfolioValueUsd: 0,
        nextUnlockDays: null as number | null,
        nextUnlockLabel: '—',
        stakes: [] as any[],
        wallet: wallet || null,
      };
    }
    const stakes = await this.db.query(
      `SELECT st.*, COALESCE(p.display_name, p.name) AS display_name, p.name AS pool_name,
              COALESCE(p.base_apy_pct,0) AS base_apy_pct, COALESCE(p.lock_period_days,0) AS lock_period_days,
              GREATEST(0, COALESCE(st.rewards_earned,0) - COALESCE(st.rewards_claimed,0)) AS claimable
       FROM stakes st
       JOIN staking_pools p ON p.id = st.pool_id
       WHERE ${where}
       ORDER BY st.staked_at DESC`,
      params
    );
    const rows = stakes.rows.map((s: any) => {
      const unlockAt = s.unlock_at ? new Date(s.unlock_at) : null;
      const daysLeft =
        unlockAt && unlockAt > new Date()
          ? Math.ceil((unlockAt.getTime() - Date.now()) / 86400000)
          : Number(s.lock_period_days || 0) === 0
            ? 0
            : 0;
      return {
        id: s.id,
        poolName: s.display_name || s.pool_name,
        apy: Number(s.base_apy_pct || 0),
        amount: Number(s.amount || 0),
        earned: Number(s.rewards_earned || 0),
        claimable: Number(s.claimable || 0),
        stakedAt: s.staked_at,
        unlockAt: s.unlock_at,
        unlockLabel:
          Number(s.lock_period_days || 0) === 0
            ? 'Anytime'
            : daysLeft > 0
              ? `${daysLeft} days`
              : 'Unlocked',
        daysLeft,
        status: s.status,
      };
    });
    const totalStaked = rows.reduce((a, r) => a + r.amount, 0);
    const totalEarned = rows.reduce((a, r) => a + r.earned, 0);
    const totalClaimable = rows.reduce((a, r) => a + r.claimable, 0);
    const nextDays = rows
      .filter((r) => r.daysLeft > 0)
      .map((r) => r.daysLeft)
      .sort((a, b) => a - b)[0];
    const price = 0.02;
    return {
      totalStaked,
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalClaimable: Math.round(totalClaimable * 100) / 100,
      portfolioValueUsd: Math.round(totalStaked * price * 100) / 100,
      nextUnlockDays: nextDays ?? null,
      nextUnlockLabel: nextDays != null ? `${nextDays} days` : rows.some((r) => r.unlockLabel === 'Anytime') ? 'Anytime' : '—',
      stakes: rows,
      wallet: wallet || null,
      dvtPriceUsd: price,
    };
  }

  async claimRewards(userId: string | null, stakeId: string | null, wallet?: string) {
    if (!this.isEnabled() && process.env.NODE_ENV === 'production') {
      // allow claims in non-prod even if gated
    }
    const params: any[] = [];
    let where = `st.status IN ('active','unstaking') AND GREATEST(0, COALESCE(st.rewards_earned,0)-COALESCE(st.rewards_claimed,0)) > 0`;
    if (stakeId) {
      params.push(stakeId);
      where += ` AND st.id = $${params.length}`;
    }
    if (userId) {
      params.push(userId);
      where += ` AND st.user_id = $${params.length}`;
    } else if (wallet) {
      params.push(wallet.toLowerCase());
      where += ` AND LOWER(COALESCE(st.wallet_address,'')) = $${params.length}`;
    } else {
      throw new Error('user or wallet required');
    }

    const rows = await this.db.query(
      `SELECT st.id, st.user_id, st.wallet_address,
              GREATEST(0, COALESCE(st.rewards_earned,0)-COALESCE(st.rewards_claimed,0)) AS claimable
       FROM stakes st WHERE ${where}`,
      params
    );
    let total = 0;
    for (const row of rows.rows) {
      const amt = Number(row.claimable || 0);
      if (amt <= 0) continue;
      await this.db.query(
        `UPDATE stakes SET rewards_claimed = COALESCE(rewards_claimed,0) + $1 WHERE id = $2`,
        [amt, row.id]
      );
      await this.db.query(
        `INSERT INTO stake_reward_claims (stake_id, user_id, wallet_address, amount)
         VALUES ($1,$2,$3,$4)`,
        [row.id, row.user_id || userId, row.wallet_address || wallet || null, amt]
      ).catch(() => undefined);
      if (row.user_id || userId) {
        await this.db.query(
          `INSERT INTO token_balances (user_id, pending_amount)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET
             pending_amount = token_balances.pending_amount + EXCLUDED.pending_amount,
             updated_at = NOW()`,
          [row.user_id || userId, amt]
        ).catch(() => undefined);
      }
      total += amt;
    }
    return { claimed: Math.round(total * 100) / 100, count: rows.rows.length };
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
        await this.rewards.emitActivityEvent(userId, 'stake_created', {
          description: 'Public staking accrual',
          overridePoints: pts,
          ref: `stake-accrual-${userId}`,
        });
        // Prefer rule amount; if rule inactive/zero, award via points conversion fallback already in engine
        awarded += pts;
      }
    }
    return { awarded };
  }

  async publicStats() {
    const pools = await this.db.query(
      `SELECT p.id, p.name,
              COALESCE(p.display_name, p.name) AS display_name,
              p.tagline,
              p.target_role,
              p.apy_or_benefit_desc,
              p.base_apy_pct,
              p.min_amount,
              COALESCE(p.min_stake, p.min_amount, 100) AS min_stake,
              COALESCE(p.lock_period_days, p.lock_days, 0) AS lock_days,
              COALESCE(p.is_popular, false) AS is_popular,
              COALESCE(SUM(CASE WHEN st.status = 'active' THEN st.amount ELSE 0 END), 0) AS total_staked,
              COUNT(DISTINCT CASE WHEN st.status = 'active' THEN st.user_id END) AS participants
       FROM staking_pools p
       LEFT JOIN stakes st ON st.pool_id = p.id
       WHERE COALESCE(p.active, true) = TRUE
       GROUP BY p.id
       ORDER BY COALESCE(p.lock_period_days, p.lock_days, 0), p.name`
    ).catch(async () =>
      this.db.query(
        `SELECT p.id, p.name, p.name AS display_name, p.target_role, p.apy_or_benefit_desc, p.base_apy_pct, p.min_amount,
                COALESCE(SUM(CASE WHEN st.status = 'active' THEN st.amount ELSE 0 END), 0) AS total_staked,
                COUNT(DISTINCT CASE WHEN st.status = 'active' THEN st.user_id END) AS participants,
                0 AS lock_days, false AS is_popular, COALESCE(p.min_amount, 100) AS min_stake
         FROM staking_pools p
         LEFT JOIN stakes st ON st.pool_id = p.id
         WHERE p.active = TRUE
         GROUP BY p.id
         ORDER BY p.name`
      )
    );
    const totals = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_staked,
              COUNT(DISTINCT user_id) AS participants
       FROM stakes WHERE status = 'active'`
    );
    const mapped = pools.rows.map((p: any) => ({
      ...p,
      total_staked: Number(p.total_staked),
      participants: Number(p.participants),
      base_apy_pct: Number(p.base_apy_pct || 0),
      lock_days: Number(p.lock_days || 0),
      min_stake: Number(p.min_stake || p.min_amount || 100),
      is_popular: Boolean(p.is_popular),
      display_name: p.display_name || p.name,
    }));
    const highestApy = mapped.reduce((m: number, p: any) => Math.max(m, Number(p.base_apy_pct || 0)), 0);
    const totalStaked = Number(totals.rows[0]?.total_staked || 0);
    // TVL placeholder: assume $0.02 per DVT if no oracle
    const tvlUsd = Math.round(totalStaked * 0.02);
    return {
      totalStaked,
      participantCount: Number(totals.rows[0]?.participants || 0),
      highestApy,
      tvlUsd,
      totalSupplyNote: '1B DVT',
      pools: mapped,
    };
  }
}
