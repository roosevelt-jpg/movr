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

/** Rewards hub — balance, tier progress, earn catalog, leaderboard */
pointsRouter.get('/rewards-hub', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    let balance = 850;
    try {
      balance = Number(await points.getBalance(uid)) || 850;
    } catch {
      /* demo */
    }

    const thresholds = await db
      .query(`SELECT tier, min_points, sort_order FROM loyalty_thresholds ORDER BY sort_order`)
      .catch(() => ({
        rows: [
          { tier: 'bronze', min_points: 0, sort_order: 1 },
          { tier: 'silver', min_points: 200, sort_order: 2 },
          { tier: 'gold', min_points: 500, sort_order: 3 },
          { tier: 'platinum', min_points: 1000, sort_order: 4 },
        ],
      }));

    const tiers = thresholds.rows.map((t: any) => ({
      tier: String(t.tier),
      minPoints: Number(t.min_points),
      sortOrder: Number(t.sort_order),
    }));
    let current = tiers[0] || { tier: 'bronze', minPoints: 0, sortOrder: 1 };
    let next = tiers[1] || { tier: 'silver', minPoints: 200, sortOrder: 2 };
    for (let i = 0; i < tiers.length; i++) {
      if (balance >= tiers[i].minPoints) {
        current = tiers[i];
        next = tiers[i + 1] || null;
      }
    }
    const nextMin = next ? next.minPoints : current.minPoints;
    const prevMin = current.minPoints;
    const span = Math.max(1, nextMin - prevMin);
    const progress = next ? Math.min(1, Math.max(0, (balance - prevMin) / span)) : 1;
    const pointsAway = next ? Math.max(0, nextMin - balance) : 0;

    await db
      .query(`UPDATE users SET loyalty_tier = $2 WHERE id = $1`, [uid, current.tier])
      .catch(() => undefined);

    const earn = await db
      .query(
        `SELECT id, label, subtitle, icon_key, points_amount, event_type
         FROM rewards_earn_catalog WHERE is_active = TRUE ORDER BY sort_order`
      )
      .catch(() => ({ rows: [] as any[] }));

    const earnCards =
      earn.rows.length > 0
        ? earn.rows.map((r: any) => ({
            id: r.id,
            label: r.label,
            subtitle: r.subtitle,
            icon: r.icon_key,
            points: Number(r.points_amount),
          }))
        : [
            { id: 'ride', label: 'Ride', subtitle: '+10 pts per ride', icon: 'car', points: 10 },
            { id: 'shop', label: 'Shop', subtitle: '+5 pts per order', icon: 'bag', points: 5 },
            {
              id: 'refer',
              label: 'Refer Friends',
              subtitle: '+50 pts per referral',
              icon: 'people',
              points: 50,
            },
            {
              id: 'deliver',
              label: 'Deliver',
              subtitle: '+8 pts per parcel',
              icon: 'box',
              points: 8,
            },
          ];

    const board = await db
      .query(
        `SELECT u.id,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,''))), ''), u.email, 'Rider') AS name,
                UPPER(LEFT(COALESCE(u.first_name,'R'), 1) || LEFT(COALESCE(u.last_name,'X'), 1)) AS initials,
                COALESCE(SUM(pl.points_earned), 0)::int AS points
         FROM users u
         LEFT JOIN points_ledger pl ON pl.user_id = u.id
         WHERE COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
         GROUP BY u.id, u.first_name, u.last_name, u.email
         HAVING COALESCE(SUM(pl.points_earned), 0) > 0 OR u.id = $1
         ORDER BY points DESC
         LIMIT 20`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));

    let leaderboard = board.rows.map((r: any, i: number) => ({
      rank: i + 1,
      userId: r.id,
      name: r.name,
      initials: r.initials || 'RX',
      points: Number(r.points),
      isYou: r.id === uid,
    }));

    if (leaderboard.length < 3) {
      const demo = [
        { rank: 1, userId: 'demo-1', name: 'Olumide Adebayo', initials: 'OA', points: 2340, isYou: false },
        { rank: 2, userId: 'demo-2', name: 'Chioma Ferreira', initials: 'CF', points: 1980, isYou: false },
        {
          rank: 7,
          userId: uid,
          name: 'You',
          initials: 'KA',
          points: balance,
          isYou: true,
        },
      ];
      const youIdx = leaderboard.findIndex((r) => r.isYou);
      if (youIdx >= 0) {
        leaderboard = [
          ...demo.filter((d) => !d.isYou),
          { ...leaderboard[youIdx], name: 'You', rank: Math.max(youIdx + 1, 3) },
        ].map((r, i) => ({ ...r, rank: r.isYou ? 7 : i + 1 }));
      } else {
        leaderboard = demo;
      }
    } else {
      leaderboard = leaderboard.map((r) => (r.isYou ? { ...r, name: 'You' } : r));
    }

    const you = leaderboard.find((r) => r.isYou);

    res.json({
      status: 'success',
      data: {
        points: balance,
        tier: current.tier,
        tierLabel: `${current.tier.charAt(0).toUpperCase()}${current.tier.slice(1)} Tier`,
        nextTier: next ? `${next.tier.charAt(0).toUpperCase()}${next.tier.slice(1)}` : null,
        nextTierMin: nextMin,
        currentTierMin: prevMin,
        pointsAway,
        progress,
        earnCards,
        leaderboard: leaderboard.slice(0, 10),
        yourRank: you?.rank || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
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
