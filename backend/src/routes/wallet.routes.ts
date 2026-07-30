import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';

const db = new DatabaseService();
export const walletRouter = Router();

walletRouter.use(authenticateToken);

walletRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let wallet = await db.query(
      `SELECT id, user_id, balance_fiat AS balance, COALESCE(points_balance, balance_points, 0) AS points_balance,
              balance_tokens, currency, last_updated
       FROM wallets WHERE user_id = $1`,
      [userId]
    );

    if (!wallet.rows[0]) {
      await db.query(
        `INSERT INTO wallets (user_id, balance_fiat, balance_points, points_balance, currency)
         VALUES ($1, 0, 0, 0, 'GHS')`,
        [userId]
      );
      wallet = await db.query(
        `SELECT id, user_id, balance_fiat AS balance, COALESCE(points_balance, balance_points, 0) AS points_balance,
                balance_tokens, currency, last_updated
         FROM wallets WHERE user_id = $1`,
        [userId]
      );
    }

    const txs = await db.query(
      `SELECT id, type, amount, reference, created_at
       FROM wallet_transactions_v2
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [wallet.rows[0].id]
    );

    res.json({
      status: 'success',
      data: {
        ...wallet.rows[0],
        rewardsBalance: wallet.rows[0].points_balance,
        transactions: txs.rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletRouter.get('/addresses', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, label, address, lat, lng FROM saved_addresses WHERE user_id = $1 ORDER BY label`,
      [req.user!.id]
    );
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletRouter.post('/addresses', async (req: AuthRequest, res: Response) => {
  try {
    const { label, address, lat, lng } = req.body;
    const result = await db.query(
      `INSERT INTO saved_addresses (user_id, label, address, lat, lng)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, label) DO UPDATE SET
         address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng
       RETURNING *`,
      [req.user!.id, label, address, lat, lng]
    );
    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});
