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

pointsRouter.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const data = await points.getSummary(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

pointsRouter.get('/redeem-catalog', async (_req: AuthRequest, res: Response) => {
  const fallback = [
    { id: 'ride_5', label: 'GH₵5 off your next ride', points: 500 },
    { id: 'order_10', label: 'GH₵10 off your next order', points: 900 },
    { id: 'delivery_free', label: 'Free delivery voucher', points: 300 },
  ];
  try {
    const rows = await db.query(
      `SELECT id, label, points_cost AS points, reward_type
       FROM rewards_redeem_catalog
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, points_cost ASC`
    );
    res.json({
      status: 'success',
      data: rows.rows.length
        ? rows.rows.map((r: any) => ({
            id: r.id,
            label: r.label,
            points: Number(r.points),
            reward_type: r.reward_type,
          }))
        : fallback,
    });
  } catch {
    res.json({ status: 'success', data: fallback });
  }
});

pointsRouter.post('/redeem', async (req: AuthRequest, res: Response) => {
  try {
    const { rewardId, points: cost, label } = req.body;
    let pointsCost = Number(cost);
    let rewardLabel = label;
    const catalogId = String(rewardId || 'reward');

    try {
      const cat = await db.query(
        `SELECT id, label, points_cost FROM rewards_redeem_catalog
         WHERE id = $1 AND is_active = TRUE`,
        [catalogId]
      );
      if (cat.rows[0]) {
        pointsCost = Number(cat.rows[0].points_cost);
        rewardLabel = cat.rows[0].label;
      }
    } catch {
      /* use body values */
    }

    const result = await points.redeem(
      req.user!.id,
      pointsCost,
      catalogId,
      rewardLabel
    );

    await db
      .query(
        `INSERT INTO reward_redemptions (user_id, catalog_id, points_spent, label, status)
         VALUES ($1, $2, $3, $4, 'issued')`,
        [req.user!.id, catalogId, pointsCost, rewardLabel || catalogId]
      )
      .catch(() => undefined);

    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export { points };
