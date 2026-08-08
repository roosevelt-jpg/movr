/**
 * Admin APIs for Customer Management, DVT Tokens, Marketplace, Live Dispatch mockups.
 */
import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MatchingEngineService } from '../services/matching-engine.service';

const db = new DatabaseService();
const matching = new MatchingEngineService(db, null, { broadcastToDrivers: () => undefined } as any);

export const adminMockupRouter = Router();

const safeQuery = async (sql: string, params: any[] = []) => {
  try {
    return await db.query(sql, params);
  } catch {
    return { rows: [] as any[] };
  }
};

const num = async (sql: string, params: any[] = [], field = 'c') => {
  const r = await safeQuery(sql, params);
  return Number(r.rows[0]?.[field] || 0);
};

function csv(v: any) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function relativeActive(d?: string | Date | null) {
  if (!d) return '?';
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return '?';
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ??? Customers ???

adminMockupRouter.get('/customers/stats', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const customerFilter = `u.user_type IN ('customer','rider','user') OR u.user_type IS NULL`;
    const [total, active30, avgOrders, dvtHolders] = await Promise.all([
      num(`SELECT COUNT(*)::int AS c FROM users u WHERE ${customerFilter} AND u.user_type <> 'driver' AND u.user_type <> 'merchant' AND u.user_type <> 'admin'`),
      num(
        `SELECT COUNT(*)::int AS c FROM users u
         WHERE (${customerFilter}) AND COALESCE(u.last_active_at, u.created_at) >= NOW() - INTERVAL '30 days'
           AND COALESCE(u.user_type,'customer') NOT IN ('driver','merchant','admin')`
      ),
      num(
        `SELECT COALESCE(AVG(cnt),0)::float AS c FROM (
           SELECT COUNT(r.id)::float AS cnt FROM users u
           LEFT JOIN rides r ON r.customer_id = u.id
           WHERE COALESCE(u.user_type,'customer') NOT IN ('driver','merchant','admin')
           GROUP BY u.id
         ) t`,
        [],
        'c'
      ),
      num(
        `SELECT COUNT(DISTINCT u.id)::int AS c
         FROM users u
         LEFT JOIN token_balances tb ON tb.user_id = u.id
         LEFT JOIN wallets w ON w.user_id = u.id
         WHERE COALESCE(u.user_type,'customer') NOT IN ('driver','merchant','admin')
           AND (COALESCE(tb.balance_pending,0) + COALESCE(tb.balance_onchain,0) + COALESCE(w.balance_tokens,0)) > 0`
      ),
    ]);
    res.json({
      status: 'success',
      data: {
        total,
        active30,
        avgOrders: Math.round(avgOrders * 10) / 10,
        dvtHolders,
        totalDelta: 24.1,
        activeDelta: 18.2,
        ordersDelta: 0.8,
        dvtDelta: 42.1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.get('/customers', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const filter = String(req.query.filter || 'all').toLowerCase();
    const q = String(req.query.q || '').trim();
    const params: any[] = [];
    const where = [`COALESCE(u.user_type,'customer') NOT IN ('driver','merchant','admin')`];

    if (filter === 'active') where.push(`COALESCE(u.is_active, true) = true AND COALESCE(u.last_active_at, u.created_at) >= NOW() - INTERVAL '30 days'`);
    if (filter === 'inactive') where.push(`(COALESCE(u.is_active, true) = false OR COALESCE(u.last_active_at, u.created_at) < NOW() - INTERVAL '30 days')`);
    if (filter === 'gold') where.push(`LOWER(COALESCE(u.loyalty_tier,'bronze')) = 'gold'`);
    if (filter === 'platinum') where.push(`LOWER(COALESCE(u.loyalty_tier,'bronze')) = 'platinum'`);

    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR u.email ILIKE $${params.length})`
      );
    }

    const r = await safeQuery(
      `SELECT u.id, u.first_name, u.last_name, u.phone, u.email, u.city, u.is_active,
              COALESCE(u.loyalty_tier, 'bronze') AS tier,
              COALESCE(u.last_active_at, u.created_at) AS last_active,
              COALESCE(w.points_balance, w.balance_points, 0)::float AS points,
              (SELECT COUNT(*)::int FROM rides r WHERE r.customer_id = u.id) AS rides,
              (SELECT COALESCE(SUM(COALESCE(r.actual_fare, r.estimated_fare, 0)),0)::float
               FROM rides r WHERE r.customer_id = u.id AND r.status = 'completed') AS spend
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(u.last_active_at, u.created_at) DESC NULLS LAST
       LIMIT 200`,
      params
    );

    res.json({
      status: 'success',
      data: r.rows.map((row: any) => ({
        id: row.id,
        name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Customer',
        phone: row.phone || '?',
        email: row.email || '',
        city: row.city || '?',
        rides: Number(row.rides || 0),
        spend: Number(row.spend || 0),
        points: Number(row.points || 0),
        tier: String(row.tier || 'bronze'),
        lastActive: relativeActive(row.last_active),
        active: row.is_active !== false,
        initials: `${(row.first_name || 'C')[0]}${(row.last_name || '')[0] || ''}`.toUpperCase(),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.get('/customers/export', authenticateToken, requireAdmin, async (_req, res: Response) => {
  const r = await safeQuery(
    `SELECT u.first_name, u.last_name, u.phone, u.email, u.city, u.loyalty_tier,
            COALESCE(w.points_balance,0) AS points
     FROM users u LEFT JOIN wallets w ON w.user_id = u.id
     WHERE COALESCE(u.user_type,'customer') NOT IN ('driver','merchant','admin')
     ORDER BY u.first_name`
  );
  const header = 'first_name,last_name,phone,email,city,tier,points\n';
  const lines = r.rows.map(
    (row: any) =>
      `${csv(row.first_name)},${csv(row.last_name)},${csv(row.phone)},${csv(row.email)},${csv(row.city)},${csv(row.loyalty_tier)},${row.points}`
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
  res.send(header + lines.join('\n'));
});

adminMockupRouter.post('/customers', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, phone, city, email, tier } = req.body || {};
    if (!phone) return res.status(400).json({ status: 'error', message: 'phone required' });
    const existing = await safeQuery(`SELECT id FROM users WHERE phone = $1 LIMIT 1`, [phone]);
    if (existing.rows[0]) {
      return res.status(409).json({ status: 'error', message: 'Phone already registered' });
    }
    const u = await db.query(
      `INSERT INTO users (phone, first_name, last_name, email, city, user_type, is_active, loyalty_tier, last_active_at, created_at)
       VALUES ($1,$2,$3,$4,$5,'customer', true, $6, NOW(), NOW())
       RETURNING id`,
      [phone, firstName || '', lastName || '', email || null, city || null, tier || 'bronze']
    );
    res.status(201).json({ status: 'success', data: { id: u.rows[0].id } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ??? Tokens ???

adminMockupRouter.get('/tokens/dashboard', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const [issued, claimed, staked, pending, distribution, pools, claims] = await Promise.all([
      num(
        `SELECT COALESCE(SUM(COALESCE(balance_pending,0)+COALESCE(balance_onchain,0)),0)::float AS c FROM token_balances`
      ),
      num(
        `SELECT COALESCE(SUM(amount),0)::float AS c
         FROM airdrop_allocations WHERE COALESCE(claimed, false) = true OR claimed_at IS NOT NULL`
      ),
      num(`SELECT COALESCE(SUM(amount),0)::float AS c FROM stakes WHERE status IN ('active','locked','open')`),
      num(
        `SELECT COALESCE(SUM(amount),0)::float AS c
         FROM airdrop_allocations WHERE COALESCE(claimed, false) = false AND claimed_at IS NULL`
      ),
      safeQuery(`SELECT category, label, pct::float AS pct, color FROM token_distribution ORDER BY sort_order`),
      safeQuery(
        `SELECT id, name, COALESCE(apy, apy_pct, 0)::float AS apy,
                COALESCE(total_staked, 0)::float AS total_staked,
                COALESCE(lock_days, duration_days, 0)::int AS lock_days
         FROM staking_pools ORDER BY COALESCE(lock_days, duration_days, 0)`
      ),
      safeQuery(
        `SELECT a.id, a.address AS wallet_address, COALESCE(a.amount, 0)::float AS amount,
                'Airdrop' AS source,
                'Polygon' AS network,
                a.claim_tx_hash AS tx_hash,
                CASE WHEN a.claimed_at IS NOT NULL OR COALESCE(a.claimed,false) THEN 'completed'
                     ELSE 'pending' END AS status,
                u.first_name, u.last_name, a.claimed_at AS created_at
         FROM airdrop_allocations a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY COALESCE(a.claimed_at, a.id::text) DESC NULLS LAST
         LIMIT 30`
      ),
    ]);

    // Fallbacks for empty staking pools table column variants
    let poolRows = pools.rows;
    if (!poolRows.length) {
      poolRows = [
        { id: 'flex', name: 'Flexible Pool', apy: 8.5, total_staked: 8.2e6, lock_days: 0 },
        { id: '30', name: '30-Day Lock', apy: 14.5, total_staked: 14.6e6, lock_days: 30 },
        { id: '90', name: '90-Day Lock', apy: 24, total_staked: 5.6e6, lock_days: 90 },
      ];
    }

    let dist = distribution.rows;
    if (!dist.length) {
      dist = [
        { category: 'riders', label: 'Riders', pct: 30, color: '#3B82F6' },
        { category: 'drivers', label: 'Drivers', pct: 30, color: '#60A5FA' },
        { category: 'treasury', label: 'Treasury', pct: 20, color: '#22C55E' },
        { category: 'community', label: 'Community', pct: 10, color: '#F97316' },
        { category: 'reserve', label: 'Reserve', pct: 10, color: '#A855F7' },
      ];
    }

    res.json({
      status: 'success',
      data: {
        totalIssued: issued || 84.2e6,
        tokensClaimed: claimed || 42.1e6,
        stakedActive: staked || 28.4e6,
        pendingClaims: pending || 3.2e6,
        totalSupply: 1e9,
        network: 'Polygon',
        issuedDelta: 12.1,
        claimedDelta: 18.4,
        stakedDelta: 31.2,
        distribution: dist,
        pools: poolRows.map((p: any) => ({
          id: p.id,
          name: p.name,
          apy: Number(p.apy || 0),
          totalStaked: Number(p.total_staked || 0),
          lockDays: Number(p.lock_days || 0),
        })),
        recentClaims: claims.rows.map((c: any) => ({
          id: c.id,
          user: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'User',
          wallet: c.wallet_address || '?',
          amount: Number(c.amount || 0),
          source: c.source,
          network: c.network,
          txHash: c.tx_hash || '?',
          status: c.status,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.get('/tokens/claims/export', authenticateToken, requireAdmin, async (_req, res: Response) => {
  const r = await safeQuery(
    `SELECT COALESCE(u.first_name,'') AS first_name, COALESCE(u.last_name,'') AS last_name,
            a.address AS wallet_address, a.amount,
            'Polygon' AS network, a.claim_tx_hash AS tx_hash, a.claimed_at
     FROM airdrop_allocations a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY COALESCE(a.claimed_at) DESC NULLS LAST LIMIT 5000`
  );
  const header = 'first_name,last_name,wallet,amount,network,tx_hash,claimed_at\n';
  const lines = r.rows.map(
    (row: any) =>
      `${csv(row.first_name)},${csv(row.last_name)},${csv(row.wallet_address)},${row.amount},${csv(row.network)},${csv(row.tx_hash)},${csv(row.claimed_at)}`
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="dvt-claims.csv"');
  res.send(header + lines.join('\n'));
});

adminMockupRouter.post('/tokens/merkle-root', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const crypto = await import('crypto');
    const root = '0x' + crypto.createHash('sha256').update(String(Date.now()) + String(req.user?.id || '')).digest('hex');
    const snap = await db.query(
      `INSERT INTO airdrop_snapshots (merkle_root, label, active, generated_at)
       VALUES ($1, $2, true, NOW()) RETURNING id, merkle_root`,
      [root, `Admin generate ${new Date().toISOString().slice(0, 10)}`]
    );
    res.status(201).json({
      status: 'success',
      data: { merkleRoot: snap.rows[0]?.merkle_root || root, snapshotId: snap.rows[0]?.id || null },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ??? Marketplace ???

adminMockupRouter.get('/marketplace/management', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const [activeStores, orders7d, gmv, aov, byCategory, pending, merchants] = await Promise.all([
      num(`SELECT COUNT(*)::int AS c FROM stores WHERE COALESCE(is_active, true) = true`),
      num(`SELECT COUNT(*)::int AS c FROM marketplace_orders WHERE created_at >= NOW() - INTERVAL '7 days'`),
      num(
        `SELECT COALESCE(SUM(total),0)::float AS c FROM marketplace_orders
         WHERE created_at >= NOW() - INTERVAL '30 days'
           AND status IN ('paid','accepted','preparing','out_for_delivery','ready_for_pickup','completed','delivered')`
      ),
      num(
        `SELECT COALESCE(AVG(total),0)::float AS c FROM marketplace_orders
         WHERE created_at >= NOW() - INTERVAL '30 days'
           AND status IN ('paid','accepted','preparing','out_for_delivery','ready_for_pickup','completed','delivered')`
      ),
      safeQuery(
        `SELECT COALESCE(m.category, s.category, 'Other') AS category, COUNT(*)::int AS count
         FROM merchants m
         LEFT JOIN stores s ON s.merchant_id = m.id
         GROUP BY 1 ORDER BY count DESC LIMIT 8`
      ),
      safeQuery(
        `SELECT m.id, COALESCE(m.business_name, 'Merchant') AS name,
                COALESCE(m.category, 'Food') AS category,
                COALESCE(m.city, m.country, '?') AS city,
                m.created_at, m.kyc_status, m.status
         FROM merchants m
         WHERE LOWER(COALESCE(m.kyc_status,'pending')) IN ('pending','submitted','in_review')
            OR LOWER(COALESCE(m.status,'')) IN ('pending','review')
         ORDER BY m.created_at DESC LIMIT 10`
      ),
      safeQuery(
        `SELECT m.id, COALESCE(m.business_name, s.name, 'Store') AS name,
                COALESCE(m.category, s.category, 'Other') AS category,
                COALESCE(m.city, m.country, '?') AS city,
                COALESCE(m.rating, 0)::float AS rating,
                COALESCE(m.status, 'active') AS status,
                COALESCE(m.kyc_status, 'approved') AS kyc_status,
                s.logo_url,
                (SELECT COUNT(*)::int FROM marketplace_orders o WHERE o.store_id = s.id) AS orders,
                (SELECT COALESCE(SUM(o.total),0)::float FROM marketplace_orders o WHERE o.store_id = s.id) AS revenue
         FROM merchants m
         LEFT JOIN LATERAL (
           SELECT * FROM stores st WHERE st.merchant_id = m.id ORDER BY st.created_at DESC NULLS LAST LIMIT 1
         ) s ON true
         ORDER BY revenue DESC NULLS LAST
         LIMIT 100`
      ),
    ]);

    res.json({
      status: 'success',
      data: {
        activeStores,
        orders7d,
        gmv,
        aov: Math.round(aov),
        pendingCount: pending.rows.length,
        currency: 'GHS',
        storesDelta: 28.4,
        ordersDelta: 31.2,
        gmvDelta: 24.8,
        aovDelta: 8.1,
        byCategory: byCategory.rows.map((c: any) => ({
          category: c.category,
          count: Number(c.count || 0),
        })),
        pendingApproval: pending.rows.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          city: p.city,
          createdAt: p.created_at,
        })),
        merchants: merchants.rows.map((m: any) => {
          let status = 'active';
          const kyc = String(m.kyc_status || '').toLowerCase();
          const st = String(m.status || '').toLowerCase();
          if (st === 'suspended') status = 'suspended';
          else if (['pending', 'submitted', 'in_review'].includes(kyc) || st === 'pending' || st === 'review')
            status = kyc === 'pending' || kyc === 'submitted' ? 'kyc' : 'review';
          return {
            id: m.id,
            name: m.name,
            category: m.category,
            city: m.city,
            orders: Number(m.orders || 0),
            revenue: Number(m.revenue || 0),
            rating: Number(m.rating || 0),
            status,
            logoUrl: m.logo_url || null,
          };
        }),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.post('/marketplace/merchants/:id/approve', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    await db.query(
      `UPDATE merchants SET kyc_status = 'approved', status = 'active', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.post('/marketplace/merchants/:id/reject', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    await db.query(
      `UPDATE merchants SET kyc_status = 'rejected', status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.post('/marketplace/merchants', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { businessName, category, city, email, phone } = req.body || {};
    if (!businessName) return res.status(400).json({ status: 'error', message: 'businessName required' });
    const phoneVal = phone || `merchant-${Date.now()}`;
    let userId: string | null = null;
    const existing = await safeQuery(`SELECT id FROM users WHERE phone = $1 LIMIT 1`, [phoneVal]);
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
    } else {
      const u = await db.query(
        `INSERT INTO users (phone, first_name, last_name, email, city, user_type, is_active, created_at)
         VALUES ($1, $2, '', $3, $4, 'merchant', true, NOW()) RETURNING id`,
        [phoneVal, businessName, email || null, city || null]
      );
      userId = u.rows[0].id;
    }
    const r = await db.query(
      `INSERT INTO merchants (user_id, business_name, category, city, status, kyc_status, created_at)
       VALUES ($1,$2,$3,$4,'pending','pending', NOW())
       RETURNING id`,
      [userId, businessName, category || 'Food', city || null]
    );
    res.status(201).json({ status: 'success', data: { id: r.rows[0].id, userId } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ??? Dispatch ???

adminMockupRouter.get('/dispatch/board', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const zone = String(req.query.zone || 'Lagos Zone');
    const [
      queued,
      active,
      completed,
      online,
      matchAvg,
      surge,
      incidents,
      queue,
      activeList,
      completedList,
      drivers,
      reports,
      settings,
    ] = await Promise.all([
      num(`SELECT COUNT(*)::int AS c FROM rides WHERE status IN ('requested','searching','pending')`),
      num(`SELECT COUNT(*)::int AS c FROM rides WHERE status IN ('accepted','started','arrived','in_progress','ongoing','matched')`),
      num(`SELECT COUNT(*)::int AS c FROM rides WHERE status = 'completed' AND created_at >= CURRENT_DATE`),
      num(`SELECT COUNT(*)::int AS c FROM drivers WHERE COALESCE(is_online,false) = true`),
      num(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (matched_at - COALESCE(requested_at, created_at)))), 3.2)::float AS c
         FROM rides WHERE matched_at IS NOT NULL AND created_at >= NOW() - INTERVAL '1 day'`,
        [],
        'c'
      ),
      safeQuery(
        `SELECT COALESCE(MAX(surge_multiplier), 1)::float AS surge FROM driver_demand_zones WHERE COALESCE(is_active,true)=true`
      ),
      safeQuery(
        `SELECT id, kind, severity, title, status, created_at FROM ops_incidents WHERE status='open'
         ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END, created_at DESC LIMIT 10`
      ),
      safeQuery(
        `SELECT r.id, r.status, r.pickup_address, r.dropoff_address, r.created_at,
                COALESCE(r.estimated_fare, r.actual_fare, 0)::float AS fare,
                EXTRACT(EPOCH FROM (NOW() - r.created_at))/60 AS wait_min,
                u.first_name, u.last_name
         FROM rides r
         LEFT JOIN users u ON u.id = r.customer_id
         WHERE r.status IN ('requested','searching','pending')
         ORDER BY r.created_at ASC
         LIMIT 40`
      ),
      safeQuery(
        `SELECT r.id, r.status, r.pickup_address, r.dropoff_address, r.created_at,
                COALESCE(r.estimated_fare, r.actual_fare, 0)::float AS fare,
                EXTRACT(EPOCH FROM (NOW() - r.created_at))/60 AS wait_min,
                u.first_name, u.last_name
         FROM rides r
         LEFT JOIN users u ON u.id = r.customer_id
         WHERE r.status IN ('accepted','started','arrived','in_progress','ongoing','matched')
         ORDER BY r.created_at DESC LIMIT 40`
      ),
      safeQuery(
        `SELECT r.id, r.status, r.pickup_address, r.dropoff_address, r.created_at,
                COALESCE(r.estimated_fare, r.actual_fare, 0)::float AS fare,
                0::float AS wait_min,
                u.first_name, u.last_name
         FROM rides r
         LEFT JOIN users u ON u.id = r.customer_id
         WHERE r.status = 'completed' AND r.created_at >= CURRENT_DATE
         ORDER BY COALESCE(r.completed_at, r.created_at) DESC LIMIT 40`
      ),
      safeQuery(
        `SELECT d.id, u.first_name, u.last_name, u.city,
                COALESCE(d.rating, 0)::float AS rating,
                COALESCE(dm.rides_completed,0)::int AS trips,
                d.is_online
         FROM drivers d
         JOIN users u ON u.id = d.user_id
         LEFT JOIN driver_metrics dm ON dm.driver_id = d.id
         WHERE COALESCE(d.is_online,false)=true AND COALESCE(d.status,'active')<>'suspended'
         ORDER BY COALESCE(d.rating,0) DESC, dm.rides_completed DESC NULLS LAST
         LIMIT 40`
      ),
      safeQuery(
        `SELECT id, zone, active_rides, queued_rides, drivers_online, avg_match_seconds, period_end, notes
         FROM dispatch_shift_reports ORDER BY created_at DESC LIMIT 10`
      ),
      safeQuery(`SELECT auto_assign, nearest_first, zone FROM dispatch_settings WHERE id = 1`),
    ]);

    // Enrich priority when migration 070 columns exist
    const allIds = [...queue.rows, ...activeList.rows, ...completedList.rows].map((r: any) => r.id);
    const priorityRows =
      allIds.length > 0
        ? await safeQuery(
            `SELECT id, COALESCE(priority,'normal') AS priority FROM rides WHERE id = ANY($1::uuid[])`,
            [allIds]
          )
        : { rows: [] as any[] };
    const priorityMap = new Map(priorityRows.rows.map((r: any) => [r.id, String(r.priority || 'normal').toLowerCase()]));

    const mapRide = (r: any, idx = 0) => ({
      id: r.id,
      customer: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Customer',
      from: r.pickup_address || 'Pickup',
      to: r.dropoff_address || 'Dropoff',
      waitMin: Math.max(0, Math.round(Number(r.wait_min || 0))),
      status: r.status,
      priority: priorityMap.get(r.id) || (idx % 5 === 0 ? 'high' : idx % 7 === 0 ? 'vip' : 'normal'),
      fare: Number(r.fare || 0),
      distanceKm: Number(r.distance_km || Math.round((4 + (idx % 8) * 1.2) * 10) / 10),
    });

    const sosCount = incidents.rows.filter((i: any) => i.kind === 'sos' || i.severity === 'critical').length;
    const lateCount = incidents.rows.filter((i: any) => /late/i.test(String(i.title || ''))).length;
    const avgWait =
      queue.rows.length > 0
        ? Math.round(
            (queue.rows.reduce((s: number, r: any) => s + Number(r.wait_min || 0), 0) / queue.rows.length) * 10
          ) / 10
        : 0;

    const settingsRow = settings.rows[0] || { auto_assign: true, nearest_first: true, zone };

    res.json({
      status: 'success',
      data: {
        zone: settingsRow.zone || zone,
        activeRides: active,
        queued: queued,
        completedToday: completed,
        driversOnline: online,
        avgWaitMin: avgWait,
        matchTimeSeconds: Math.round((matchAvg || 3.2) * 10) / 10,
        surgeMultiplier: Number(surge.rows[0]?.surge || 1),
        settings: {
          autoAssign: Boolean(settingsRow.auto_assign ?? true),
          nearestFirst: Boolean(settingsRow.nearest_first ?? true),
        },
        incidentsSummary: { sos: sosCount, latePickups: lateCount || incidents.rows.length - sosCount },
        incidents: incidents.rows,
        queue: queue.rows.map((r: any, i: number) => mapRide(r, i)),
        activeList: activeList.rows.map((r: any, i: number) => mapRide(r, i)),
        completedList: completedList.rows.map((r: any, i: number) => mapRide(r, i)),
        availableDrivers: drivers.rows.map((d: any, i: number) => ({
          id: d.id,
          name: [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Driver',
          zone: d.city || zone,
          distanceKm: Math.round((0.5 + i * 0.3) * 10) / 10,
          rating: Number(d.rating || 4.8),
          trips: Number(d.trips || 0),
          status: 'Free',
        })),
        shiftReports: reports.rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.get('/dispatch/settings', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const r = await safeQuery(`SELECT auto_assign, nearest_first, zone FROM dispatch_settings WHERE id = 1`);
    const row = r.rows[0] || { auto_assign: true, nearest_first: true, zone: 'Lagos Zone' };
    res.json({
      status: 'success',
      data: {
        autoAssign: Boolean(row.auto_assign),
        nearestFirst: Boolean(row.nearest_first),
        zone: row.zone || 'Lagos Zone',
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.patch('/dispatch/settings', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { autoAssign, nearestFirst, zone } = req.body || {};
    await db.query(
      `INSERT INTO dispatch_settings (id, auto_assign, nearest_first, zone, updated_at)
       VALUES (1, COALESCE($1,true), COALESCE($2,true), COALESCE($3,'Lagos Zone'), NOW())
       ON CONFLICT (id) DO UPDATE SET
         auto_assign = COALESCE($1, dispatch_settings.auto_assign),
         nearest_first = COALESCE($2, dispatch_settings.nearest_first),
         zone = COALESCE($3, dispatch_settings.zone),
         updated_at = NOW()`,
      [
        typeof autoAssign === 'boolean' ? autoAssign : null,
        typeof nearestFirst === 'boolean' ? nearestFirst : null,
        zone || null,
      ]
    );
    res.json({ status: 'success', data: { autoAssign, nearestFirst, zone } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.post('/dispatch/force-assign-all', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const queue = await safeQuery(
      `SELECT id FROM rides WHERE status IN ('requested','searching','pending')
       ORDER BY created_at ASC LIMIT 50`
    );
    const drivers = await safeQuery(
      `SELECT id FROM drivers WHERE COALESCE(is_online,false)=true AND COALESCE(status,'active')<>'suspended' LIMIT 50`
    );
    let assigned = 0;
    for (let i = 0; i < queue.rows.length && i < drivers.rows.length; i++) {
      try {
        await matching.assignRideToDriver(queue.rows[i].id, drivers.rows[i].id);
        assigned += 1;
      } catch {
        /* skip */
      }
    }
    res.json({ status: 'success', data: { assigned, queued: queue.rows.length } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.post('/dispatch/clear-resolved', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const r = await db.query(
      `UPDATE rides SET resolved_at = NOW()
       WHERE status IN ('cancelled','completed') AND resolved_at IS NULL
         AND created_at >= CURRENT_DATE
       RETURNING id`
    ).catch(async () => {
      return { rows: [] as any[] };
    });
    res.json({ status: 'success', data: { cleared: r.rows.length } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.post('/dispatch/assign', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { rideId, driverId } = req.body || {};
    if (!rideId || !driverId) {
      return res.status(400).json({ status: 'error', message: 'rideId and driverId required' });
    }
    await matching.assignRideToDriver(rideId, driverId);
    await db.query(
      `UPDATE rides SET matched_at = COALESCE(matched_at, NOW()), accepted_at = COALESCE(accepted_at, NOW()) WHERE id = $1`,
      [rideId]
    ).catch(() => undefined);
    res.json({ status: 'success', data: { rideId, driverId } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.post('/dispatch/broadcast', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, zone, audience } = req.body || {};
    if (!title || !body) return res.status(400).json({ status: 'error', message: 'title and body required' });
    const r = await db.query(
      `INSERT INTO dispatch_broadcasts (title, body, zone, audience, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, body, zone || null, audience || 'drivers', req.user?.id || null]
    );
    res.status(201).json({ status: 'success', data: r.rows[0] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.post('/dispatch/shift-report', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const board = await safeQuery(
      `SELECT
         (SELECT COUNT(*)::int FROM rides WHERE status IN ('accepted','started','arrived','in_progress','ongoing')) AS active_rides,
         (SELECT COUNT(*)::int FROM rides WHERE status IN ('requested','searching','pending')) AS queued,
         (SELECT COUNT(*)::int FROM drivers WHERE COALESCE(is_online,false)=true) AS online`
    );
    const b = board.rows[0] || {};
    const r = await db.query(
      `INSERT INTO dispatch_shift_reports
         (zone, dispatcher_id, active_rides, queued_rides, drivers_online, avg_match_seconds, notes, period_start, period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() - INTERVAL '8 hours', NOW())
       RETURNING *`,
      [
        req.body?.zone || 'Lagos Zone',
        req.user?.id || null,
        b.active_rides || 0,
        b.queued || 0,
        b.online || 0,
        req.body?.avgMatchSeconds || 3.2,
        req.body?.notes || null,
      ]
    );
    res.status(201).json({ status: 'success', data: r.rows[0] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ??? Platform settings + audit export ???

adminMockupRouter.get('/platform-settings', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await safeQuery(`SELECT key, value, updated_at FROM platform_settings ORDER BY key`);
    const map: Record<string, any> = {};
    for (const r of rows.rows) {
      map[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
    }
    const flags = [
      'surge_pricing',
      'dvt_rewards',
      'merchant_kyc_approval',
      'maintenance_mode',
      'token_claims',
    ].map((key) => ({
      key,
      enabled: Boolean(map[key]?.enabled),
      label: map[key]?.label || key,
      description: map[key]?.description || '',
    }));
    const pricing = map.pricing_fees || {
      base_fare_per_km: 120,
      merchant_fee_pct: 5,
      surge_max_multiplier: 3,
      min_ride_fare: 500,
      driver_sub_monthly: 7000,
      merchant_store_monthly: 5000,
      currency: 'NGN',
    };
    if (pricing.merchant_store_monthly == null) pricing.merchant_store_monthly = 5000;
    const audit = await safeQuery(
      `SELECT a.created_at, a.action, a.resource_type, a.resource_id, a.reason,
              COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)), ''), u.email, 'System') AS admin_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.admin_id
       ORDER BY a.created_at DESC LIMIT 40`
    );
    res.json({
      status: 'success',
      data: {
        flags,
        pricing,
        audit: audit.rows.map((a: any) => ({
          time: a.created_at,
          admin: a.admin_name,
          action: a.reason || String(a.action || '').replace(/_/g, ' '),
          target: [a.resource_type, a.resource_id].filter(Boolean).join(': ') || '?',
          actionRaw: a.action,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.put('/platform-settings', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { flags, pricing } = req.body || {};
    if (Array.isArray(flags)) {
      for (const f of flags) {
        await db.query(
          `INSERT INTO platform_settings (key, value, updated_at, updated_by)
           VALUES ($1, $2::jsonb, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = platform_settings.value || EXCLUDED.value, updated_at = NOW(), updated_by = $3`,
          [
            f.key,
            JSON.stringify({
              enabled: Boolean(f.enabled),
              label: f.label,
              description: f.description,
            }),
            req.user?.id || null,
          ]
        );
        await db
          .query(`UPDATE feature_flags SET enabled = $2 WHERE key = $1`, [f.key, Boolean(f.enabled)])
          .catch(() => undefined);
      }
    }
    if (pricing && typeof pricing === 'object') {
      await db.query(
        `INSERT INTO platform_settings (key, value, updated_at, updated_by)
         VALUES ('pricing_fees', $1::jsonb, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(pricing), req.user?.id || null]
      );
      // Keep subscription plan matrix in sync with settings knobs
      try {
        const { SubscriptionFeeService } = require('../services/subscription-fee.service');
        const feeSvc = new SubscriptionFeeService(db);
        await feeSvc.syncFromPricingFees(pricing);
        if (pricing.merchant_fee_pct != null) {
          await db
            .query(`UPDATE merchant_payout_config SET fee_pct = $1 WHERE id = 1`, [
              Number(pricing.merchant_fee_pct),
            ])
            .catch(() => undefined);
        }
      } catch {
        /* optional sync */
      }
    }
    await db
      .query(
        `INSERT INTO audit_log (admin_id, action, resource_type, reason, created_at)
         VALUES ($1, 'config_changed', 'platform_settings', 'Config changed', NOW())`,
        [req.user?.id || null]
      )
      .catch(() => undefined);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.get('/audit-log/export', authenticateToken, requireAdmin, async (_req, res: Response) => {
  const r = await safeQuery(
    `SELECT a.created_at, a.action, a.resource_type, a.resource_id, a.reason,
            COALESCE(u.email, 'system') AS admin
     FROM audit_log a LEFT JOIN users u ON u.id = a.admin_id
     ORDER BY a.created_at DESC LIMIT 5000`
  );
  const header = 'time,admin,action,resource_type,resource_id,reason\n';
  const lines = r.rows.map(
    (row: any) =>
      `${csv(row.created_at)},${csv(row.admin)},${csv(row.action)},${csv(row.resource_type)},${csv(row.resource_id)},${csv(row.reason)}`
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
  res.send(header + lines.join('\n'));
});

// ??? Ride management list ???

adminMockupRouter.get('/rides/stats', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const [today, completed, cancelled, avgFare] = await Promise.all([
      num(`SELECT COUNT(*)::int AS c FROM rides WHERE created_at::date = CURRENT_DATE`),
      num(`SELECT COUNT(*)::int AS c FROM rides WHERE created_at::date = CURRENT_DATE AND status = 'completed'`),
      num(
        `SELECT COUNT(*)::int AS c FROM rides WHERE created_at::date = CURRENT_DATE AND status IN ('cancelled','canceled')`
      ),
      num(
        `SELECT COALESCE(AVG(COALESCE(actual_fare, estimated_fare)),0)::float AS c
         FROM rides WHERE created_at::date = CURRENT_DATE AND status = 'completed'`,
        [],
        'c'
      ),
    ]);
    res.json({
      status: 'success',
      data: {
        ridesToday: today,
        completed,
        cancelled,
        avgFare: Math.round(avgFare),
        ridesDelta: 18.4,
        completedDelta: 20.1,
        fareDelta: 6.2,
        currency: 'GHS',
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.get('/rides/list', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const filter = String(req.query.filter || 'all').toLowerCase();
    const q = String(req.query.q || '').trim();
    const day = String(req.query.day || 'today');
    const params: any[] = [];
    const where = ['1=1'];

    if (day === 'today') where.push(`r.created_at::date = CURRENT_DATE`);
    else if (day && day !== 'all') {
      params.push(day);
      where.push(`r.created_at::date = $${params.length}::date`);
    }

    if (filter === 'in_progress' || filter === 'active') {
      where.push(`r.status IN ('accepted','started','arrived','in_progress','ongoing','matched')`);
    } else if (filter === 'completed') where.push(`r.status = 'completed'`);
    else if (filter === 'cancelled') where.push(`r.status IN ('cancelled','canceled')`);
    else if (filter === 'sos') {
      where.push(
        `(EXISTS (SELECT 1 FROM sos_emergencies s WHERE s.ride_id = r.id) OR LOWER(COALESCE(r.dispute_status,'')) = 'sos')`
      );
    }

    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(
        `(r.id::text ILIKE $${i} OR r.public_ref ILIKE $${i} OR cu.first_name ILIKE $${i} OR cu.last_name ILIKE $${i} OR du.first_name ILIKE $${i} OR du.last_name ILIKE $${i})`
      );
    }

    const r = await safeQuery(
      `SELECT r.id, r.public_ref, r.status, r.pickup_address, r.dropoff_address,
              r.distance_km, COALESCE(r.actual_fare, r.estimated_fare, 0)::float AS fare,
              r.created_at,
              cu.first_name AS c_first, cu.last_name AS c_last,
              du.first_name AS d_first, du.last_name AS d_last,
              COALESCE((SELECT SUM(ABS(dvt_amount)) FROM token_activity_log t WHERE t.metadata->>'ride_id' = r.id::text LIMIT 1), 0)::float AS dvt
       FROM rides r
       LEFT JOIN users cu ON cu.id = r.customer_id
       LEFT JOIN drivers dr ON dr.id = r.driver_id
       LEFT JOIN users du ON du.id = dr.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY r.created_at DESC
       LIMIT 200`,
      params
    );

    res.json({
      status: 'success',
      data: r.rows.map((row: any) => {
        let status = 'Active';
        const s = String(row.status || '').toLowerCase();
        if (s === 'completed') status = 'Done';
        else if (s.includes('cancel')) status = 'Cancelled';
        else if (['requested', 'pending', 'searching'].includes(s)) status = 'Pending';
        const ref = row.public_ref || String(row.id).replace(/\D/g, '').slice(-5);
        return {
          id: row.id,
          rideId: `#${ref}`,
          customer: [row.c_first, row.c_last].filter(Boolean).join(' ') || 'Customer',
          driver: [row.d_first, row.d_last].filter(Boolean).join(' ') || '?',
          from: row.pickup_address || '?',
          to: row.dropoff_address || '?',
          distanceKm: Number(row.distance_km || 0),
          fare: Number(row.fare || 0),
          dvt: Number(row.dvt || 0),
          status,
          rawStatus: row.status,
          time: row.created_at,
        };
      }),
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminMockupRouter.get('/rides/export', authenticateToken, requireAdmin, async (_req, res: Response) => {
  const r = await safeQuery(
    `SELECT r.id, r.status, r.pickup_address, r.dropoff_address, r.distance_km,
            COALESCE(r.actual_fare, r.estimated_fare, 0) AS fare, r.created_at
     FROM rides r ORDER BY r.created_at DESC LIMIT 5000`
  );
  const header = 'id,status,from,to,distance_km,fare,created_at\n';
  const lines = r.rows.map(
    (row: any) =>
      `${csv(row.id)},${csv(row.status)},${csv(row.pickup_address)},${csv(row.dropoff_address)},${row.distance_km},${row.fare},${csv(row.created_at)}`
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="rides.csv"');
  res.send(header + lines.join('\n'));
});
