import crypto from 'crypto';
import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { RewardsEngineService } from '../services/rewards-engine.service';

const db = new DatabaseService();
const rewards = new RewardsEngineService(db);

export const referralsRouter = Router();

function makeCode(): string {
  return `MOVR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

referralsRouter.use(authenticateToken);

referralsRouter.get('/my-code', async (req: AuthRequest, res: Response) => {
  try {
    let row = await db.query(`SELECT * FROM referral_codes WHERE user_id = $1`, [req.user!.id]);
    if (!row.rows[0]) {
      row = await db.query(
        `INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) RETURNING *`,
        [req.user!.id, makeCode()]
      );
    }
    res.json({
      status: 'success',
      data: {
        code: row.rows[0].code,
        shareLink: `https://movr.io/r/${row.rows[0].code}`,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

referralsRouter.post('/apply', async (req: AuthRequest, res: Response) => {
  try {
    const code = String(req.body.code || '').toUpperCase();
    const ref = await db.query(`SELECT * FROM referral_codes WHERE UPPER(code) = $1`, [code]);
    if (!ref.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Invalid referral code' });
    }
    if (ref.rows[0].user_id === req.user!.id) {
      return res.status(400).json({ status: 'error', message: 'Cannot refer yourself' });
    }

    const existing = await db.query(`SELECT id FROM referrals WHERE referee_id = $1`, [
      req.user!.id,
    ]);
    if (existing.rows[0]) {
      return res.status(400).json({ status: 'error', message: 'Referral already applied' });
    }

    const row = await db.query(
      `INSERT INTO referrals (referrer_id, referee_id, code, status)
       VALUES ($1, $2, $3, 'signed_up') RETURNING *`,
      [ref.rows[0].user_id, req.user!.id, code]
    );

    res.status(201).json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

referralsRouter.get('/progress', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT r.*, u.first_name, u.email
       FROM referrals r
       JOIN users u ON u.id = r.referee_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [req.user!.id]
    );
    const totalRewards = rows.rows.reduce(
      (s: number, r: any) => s + Number(r.reward_points || 0),
      0
    );
    res.json({ status: 'success', data: { referrals: rows.rows, totalRewards } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export async function advanceReferralMilestone(
  refereeId: string,
  event: 'first_ride_completed' | 'order_completed' | 'qualified'
) {
  const ref = await db.query(`SELECT * FROM referrals WHERE referee_id = $1`, [refereeId]);
  const row = ref.rows[0];
  if (!row) return null;

  let next = row.status;
  if (row.status === 'signed_up' && event === 'first_ride_completed') {
    next = 'first_ride_completed';
  } else if (
    (row.status === 'first_ride_completed' || row.status === 'signed_up') &&
    (event === 'order_completed' || event === 'qualified')
  ) {
    next = 'qualified';
  } else if (row.status === 'first_ride_completed' && event === 'first_ride_completed') {
    next = 'qualified';
  }

  if (next === row.status) return row;

  const updated = await db.query(
    `UPDATE referrals SET status = $1,
       confirmed_at = CASE WHEN $1 = 'qualified' THEN NOW() ELSE confirmed_at END
     WHERE id = $2 RETURNING *`,
    [next, row.id]
  );

  if (next === 'qualified' && row.status !== 'qualified') {
    const result = await rewards.emitActivityEvent(row.referrer_id, 'referral_qualified', {
      description: `Referral ${row.code} qualified`,
      code: row.code,
    });
    await db.query(`UPDATE referrals SET reward_points = $1 WHERE id = $2`, [
      Number(result.points || 0),
      row.id,
    ]);
  }

  return updated.rows[0];
}
