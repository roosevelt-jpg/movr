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

export { points };
