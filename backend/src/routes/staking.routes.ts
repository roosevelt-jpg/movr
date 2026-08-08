import { Router, Response, Request } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { StakingService } from '../services/staking.service';

const db = new DatabaseService();
const staking = new StakingService(db);

export const stakingRouter = Router();
export const publicStakingRouter = Router();

publicStakingRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await staking.publicStats();
    res.json({ status: 'success', data: stats });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

publicStakingRouter.get('/positions', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet ? String(req.query.wallet) : undefined;
    const data = await staking.portfolioSummary(undefined, wallet);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

publicStakingRouter.post('/claim', async (req: Request, res: Response) => {
  try {
    const { wallet, stakeId } = req.body || {};
    if (!wallet) return res.status(400).json({ status: 'error', message: 'wallet required' });
    const result = await staking.claimRewards(null, stakeId || null, String(wallet));
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

stakingRouter.use(authenticateToken);

stakingRouter.get('/pools', async (req: AuthRequest, res: Response) => {
  try {
    const role = req.query.role as string | undefined;
    const pools = await staking.listPools(role);
    res.json({ status: 'success', data: pools.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Customer staking dashboard mockup payload */
stakingRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const pools = await db
      .query(
        `SELECT id, name, display_name, tagline, lock_period_days, base_apy_pct,
                COALESCE(min_stake, min_amount, 100) AS min_stake, icon_key, is_popular
         FROM staking_pools
         WHERE active = TRUE AND (target_role = 'public' OR target_role IS NULL
               OR name ILIKE '%flex%' OR name ILIKE '%lock%' OR name ILIKE '%public%')
         ORDER BY COALESCE(lock_period_days, 0) ASC`
      )
      .catch(() => ({ rows: [] as any[] }));

    const stakes = await db
      .query(
        `SELECT s.*, p.display_name, p.lock_period_days, p.base_apy_pct
         FROM stakes s
         JOIN staking_pools p ON p.id = s.pool_id
         WHERE s.user_id = $1 AND s.status = 'active'`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));

    let totalStaked = stakes.rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    let rewards = stakes.rows.reduce((s: number, r: any) => s + Number(r.rewards_earned || 0), 0);
    let apy = Number(stakes.rows[0]?.base_apy_pct || 14.5);
    let lockDays = Number(stakes.rows[0]?.lock_period_days || 30);
    let yourPoolId = stakes.rows[0]?.pool_id || null;

    if (!totalStaked) {
      totalStaked = 500;
      rewards = 72.5;
      apy = 14.5;
      lockDays = 30;
    }

    const poolList =
      pools.rows.length > 0
        ? pools.rows
        : [
            {
              id: 'flex',
              display_name: 'Flexible Pool',
              tagline: 'No lock · Withdraw anytime',
              lock_period_days: 0,
              base_apy_pct: 8.5,
              min_stake: 50,
              icon_key: 'sprout',
            },
            {
              id: '30d',
              display_name: '30-Day Lock',
              tagline: 'Min 100 DVT · 500 staked',
              lock_period_days: 30,
              base_apy_pct: 14.5,
              min_stake: 100,
              icon_key: 'bolt',
            },
            {
              id: '90d',
              display_name: '90-Day Lock',
              tagline: 'Min 500 DVT · High rewards',
              lock_period_days: 90,
              base_apy_pct: 24,
              min_stake: 500,
              icon_key: 'lock',
            },
          ];

    if (!yourPoolId) {
      yourPoolId =
        poolList.find((p: any) => Number(p.lock_period_days) === 30)?.id || poolList[1]?.id;
    }

    res.json({
      status: 'success',
      data: {
        staked: totalStaked,
        apy,
        rewardsEarned: rewards,
        lockPeriodDays: lockDays,
        yourPoolId,
        pools: poolList.map((p: any) => {
          const stakedInPool = stakes.rows
            .filter((s: any) => s.pool_id === p.id)
            .reduce((n: number, s: any) => n + Number(s.amount || 0), 0);
          const isYours = String(p.id) === String(yourPoolId);
          const min = Number(p.min_stake || 100);
          let sub = p.tagline || '';
          if (isYours && stakedInPool) sub = `Min ${min} DVT · ${stakedInPool} staked`;
          else if (Number(p.lock_period_days) === 0) sub = 'No lock · Withdraw anytime';
          else if (Number(p.lock_period_days) >= 80) sub = `Min ${min} DVT · High rewards`;
          else sub = `Min ${min} DVT · ${stakedInPool || totalStaked} staked`;
          return {
            id: p.id,
            name: p.display_name || p.name,
            subtitle: sub,
            apy: Number(p.base_apy_pct || 0),
            lockDays: Number(p.lock_period_days || 0),
            minStake: min,
            icon: p.icon_key || 'lock',
            isYourPool: isYours,
            staked: stakedInPool,
          };
        }),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

stakingRouter.get('/my-stakes', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await staking.portfolioSummary(req.user!.id);
    const stakes = await staking.myStakes(req.user!.id);
    const driverTier = await staking.getTier(req.user!.id, 'driver');
    const merchantTier = await staking.getTier(req.user!.id, 'merchant');
    res.json({
      status: 'success',
      data: {
        ...summary,
        stakes: summary.stakes.length ? summary.stakes : stakes.rows,
        tiers: { driver: driverTier, merchant: merchantTier },
        enabled: staking.isEnabled(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

stakingRouter.post('/claim', async (req: AuthRequest, res: Response) => {
  try {
    const { stakeId } = req.body || {};
    const result = await staking.claimRewards(req.user!.id, stakeId || null);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

stakingRouter.post('/claim-all', async (req: AuthRequest, res: Response) => {
  try {
    const result = await staking.claimRewards(req.user!.id, null);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

stakingRouter.post('/stake', async (req: AuthRequest, res: Response) => {
  try {
    const { poolId, amount } = req.body;
    const stake = await staking.stake(req.user!.id, poolId, Number(amount));
    res.json({ status: 'success', data: stake });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

stakingRouter.post('/unstake', async (req: AuthRequest, res: Response) => {
  try {
    const { stakeId } = req.body;
    const result = await staking.unstake(req.user!.id, stakeId);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

stakingRouter.post('/accrue-points', async (req: AuthRequest, res: Response) => {
  try {
    const result = await staking.accruePublicPoints(req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export { staking };
