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

stakingRouter.get('/my-stakes', async (req: AuthRequest, res: Response) => {
  try {
    const stakes = await staking.myStakes(req.user!.id);
    const driverTier = await staking.getTier(req.user!.id, 'driver');
    const merchantTier = await staking.getTier(req.user!.id, 'merchant');
    res.json({
      status: 'success',
      data: {
        stakes: stakes.rows,
        tiers: { driver: driverTier, merchant: merchantTier },
        enabled: staking.isEnabled(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
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
