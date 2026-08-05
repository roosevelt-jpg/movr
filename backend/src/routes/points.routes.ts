import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { PointsService } from '../services/points.service';

const db = new DatabaseService();
const points = new PointsService(db);

export const pointsRouter = Router();

pointsRouter.use(authenticateToken);

pointsRouter.get('/balance', async (req: AuthRequest, res: Response) => {
  try {
    const balance = await points.getBalance(req.user!.id);
    res.json({ status: 'success', data: { balance } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

pointsRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const history = await points.getHistory(req.user!.id);
    res.json({ status: 'success', data: history });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

pointsRouter.get('/estimated-dvt', async (req: AuthRequest, res: Response) => {
  try {
    const estimate = await points.estimatedDvt(req.user!.id);
    res.json({ status: 'success', data: estimate });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

pointsRouter.get('/redeem-catalog', async (_req: AuthRequest, res: Response) => {
  res.json({
    status: 'success',
    data: [
      { id: 'ride_5', label: 'GH₵5 off your next ride', points: 500 },
      { id: 'order_10', label: 'GH₵10 off your next order', points: 900 },
      { id: 'delivery_free', label: 'Free delivery voucher', points: 300 },
    ],
  });
});

pointsRouter.post('/redeem', async (req: AuthRequest, res: Response) => {
  try {
    const { rewardId, points: cost, label } = req.body;
    const result = await points.redeem(
      req.user!.id,
      Number(cost),
      String(rewardId || 'reward'),
      label
    );
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export { points };
