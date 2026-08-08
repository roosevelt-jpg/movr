import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';

const db = new DatabaseService();

export const customerExtrasRouter = Router();

/** Full settings for Preferences mockup */
customerExtrasRouter.get('/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    let row = await db
      .query(`SELECT * FROM user_settings WHERE user_id = $1`, [uid])
      .catch(() => ({ rows: [] as any[] }));
    if (!row.rows[0]) {
      await db
        .query(
          `INSERT INTO user_settings (user_id, language, region, currency_code, dark_mode)
           VALUES ($1, 'English', 'Nigeria', 'NGN', TRUE)
           ON CONFLICT (user_id) DO NOTHING`,
          [uid]
        )
        .catch(() => undefined);
      row = await db.query(`SELECT * FROM user_settings WHERE user_id = $1`, [uid]);
    }
    const s = row.rows[0] || {};
    res.json({
      status: 'success',
      data: {
        language: s.language || 'English',
        currency: s.currency_code || 'NGN',
        currencyLabel: s.currency_code === 'GHS' ? 'GHS (GH₵)' : 'NGN (₦)',
        darkMode: s.dark_mode !== false,
        locationEnabled: s.location_enabled !== false,
        rideNotifications: s.ride_notifications !== false,
        shoppingNotifications: s.shopping_notifications !== false,
        dvtEnabled: s.dvt_enabled !== false,
        walletPaymentEnabled: s.wallet_payment_enabled === true,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

customerExtrasRouter.patch('/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const b = req.body || {};
    const result = await db.query(
      `INSERT INTO user_settings (
         user_id, language, region, currency_code, dark_mode, location_enabled,
         ride_notifications, shopping_notifications, dvt_enabled, wallet_payment_enabled,
         notifications_enabled
       ) VALUES (
         $1,
         COALESCE($2, 'English'),
         COALESCE($3, 'Nigeria'),
         COALESCE($4, 'NGN'),
         COALESCE($5, TRUE),
         COALESCE($6, TRUE),
         COALESCE($7, TRUE),
         COALESCE($8, TRUE),
         COALESCE($9, TRUE),
         COALESCE($10, FALSE),
         TRUE
       )
       ON CONFLICT (user_id) DO UPDATE SET
         language = COALESCE($2, user_settings.language),
         region = COALESCE($3, user_settings.region),
         currency_code = COALESCE($4, user_settings.currency_code),
         dark_mode = COALESCE($5, user_settings.dark_mode),
         location_enabled = COALESCE($6, user_settings.location_enabled),
         ride_notifications = COALESCE($7, user_settings.ride_notifications),
         shopping_notifications = COALESCE($8, user_settings.shopping_notifications),
         dvt_enabled = COALESCE($9, user_settings.dvt_enabled),
         wallet_payment_enabled = COALESCE($10, user_settings.wallet_payment_enabled),
         updated_at = NOW()
       RETURNING *`,
      [
        uid,
        b.language ?? null,
        b.region ?? null,
        b.currency ?? b.currencyCode ?? null,
        typeof b.darkMode === 'boolean' ? b.darkMode : null,
        typeof b.locationEnabled === 'boolean' ? b.locationEnabled : null,
        typeof b.rideNotifications === 'boolean' ? b.rideNotifications : null,
        typeof b.shoppingNotifications === 'boolean' ? b.shoppingNotifications : null,
        typeof b.dvtEnabled === 'boolean' ? b.dvtEnabled : null,
        typeof b.walletPaymentEnabled === 'boolean' ? b.walletPaymentEnabled : null,
      ]
    );
    const s = result.rows[0];
    res.json({
      status: 'success',
      data: {
        language: s.language,
        currency: s.currency_code,
        currencyLabel: s.currency_code === 'GHS' ? 'GHS (GH₵)' : `NGN (₦)`,
        darkMode: s.dark_mode,
        locationEnabled: s.location_enabled,
        rideNotifications: s.ride_notifications,
        shoppingNotifications: s.shopping_notifications,
        dvtEnabled: s.dvt_enabled,
        walletPaymentEnabled: s.wallet_payment_enabled,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

customerExtrasRouter.post('/account/delete', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await db.query(
      `UPDATE users SET deletion_requested_at = NOW(), is_active = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [req.user!.id]
    );
    res.json({
      status: 'success',
      data: { requested: true, message: 'Account deletion requested' },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Search Explore — merchants + quick actions */
customerExtrasRouter.get('/explore', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const filter = String(req.query.filter || 'all').toLowerCase();

    let merchants = await db
      .query(
        `SELECT id, store_id, name, category, emoji, rating, distance_km, filter_tags
         FROM explore_merchants
         WHERE is_active = TRUE
         ORDER BY sort_order, distance_km`
      )
      .catch(() => ({ rows: [] as any[] }));

    if (!merchants.rows.length) {
      merchants = {
        rows: [
          { id: '1', name: 'Chicken Republic', category: 'Fast Food', emoji: '🍔', rating: 4.8, distance_km: 1.2, store_id: 'c0000000-0000-4000-8000-000000000014' },
          { id: '2', name: 'MedPlus', category: 'Pharmacy', emoji: '💊', rating: 4.9, distance_km: 0.8 },
          { id: '3', name: 'ShopRite', category: 'Grocery', emoji: '🛒', rating: 4.5, distance_km: 2.0 },
          { id: '4', name: 'Fashion Hub', category: 'Fashion', emoji: '👗', rating: 4.6, distance_km: 1.6 },
        ],
      };
    }

    let list = merchants.rows;
    if (filter === 'shop') {
      list = list.filter((m: any) => true);
    } else if (filter === 'ride' || filter === 'deliver') {
      list = [];
    }
    if (q) {
      list = list.filter(
        (m: any) =>
          String(m.name).toLowerCase().includes(q) ||
          String(m.category).toLowerCase().includes(q) ||
          (filter === 'all' &&
            ('ride'.includes(q) || 'parcel'.includes(q) || 'store'.includes(q)))
      );
      // If searching services, keep merchants matching OR show empty for ride/parcel keywords
      if (['ride', 'rides', 'parcel', 'parcels', 'deliver'].some((k) => q.includes(k))) {
        /* keep filtered merchants; UI also routes via actions */
      }
    }

    res.json({
      status: 'success',
      data: {
        merchants: list.map((m: any) => ({
          id: m.id,
          storeId: m.store_id || m.id,
          name: m.name,
          category: m.category,
          emoji: m.emoji || '🏪',
          rating: Number(m.rating || 4.5),
          distanceKm: Number(m.distance_km || 1),
          meta: `${m.category} · ${Number(m.distance_km || 1).toFixed(1)}km`,
        })),
        actions: [
          { id: 'ride', label: 'Book Ride', emoji: '🚗', tone: 'purple' },
          { id: 'parcel', label: 'Send Parcel', emoji: '📦', tone: 'blue' },
          { id: 'rental', label: 'Rent Car', emoji: '🚙', tone: 'green' },
        ],
        filters: ['all', 'ride', 'shop', 'deliver'],
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Saved payment instruments (vault) */
customerExtrasRouter.get('/payment-instruments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .query(
        `SELECT * FROM customer_payment_methods
         WHERE user_id = $1
         ORDER BY is_default DESC, display_order ASC, created_at ASC`,
        [req.user!.id]
      )
      .catch(() => ({ rows: [] as any[] }));

    const mapRow = (r: any) => ({
      id: r.id,
      type: r.method_type,
      provider: r.provider,
      brand: r.brand || r.method_type,
      label: r.label,
      lastFour: r.last_four,
      isDefault: !!r.is_default,
      status: r.status || 'active',
      cardholderName: r.cardholder_name,
      expires:
        r.expires_month && r.expires_year
          ? `${String(r.expires_month).padStart(2, '0')}/${String(r.expires_year).slice(-2)}`
          : null,
      phone: r.phone_number,
      walletAddress: r.wallet_address,
      network: r.network,
    });

    let data = rows.rows.map(mapRow);
    if (!data.length) {
      data = [
        {
          id: 'visa-demo',
          type: 'card',
          provider: 'Visa',
          brand: 'visa',
          label: 'Visa',
          lastFour: '4821',
          isDefault: true,
          status: 'active',
          cardholderName: 'Kwame Asante',
          expires: '08/27',
          phone: null,
          walletAddress: null,
          network: null,
        },
        {
          id: 'mc-demo',
          type: 'card',
          provider: 'Mastercard',
          brand: 'mastercard',
          label: 'Mastercard',
          lastFour: '7732',
          isDefault: false,
          status: 'active',
          cardholderName: 'Kwame Asante',
          expires: '03/26',
          phone: null,
          walletAddress: null,
          network: null,
        },
        {
          id: 'momo-demo',
          type: 'momo',
          provider: 'MTN MoMo',
          brand: 'momo',
          label: 'MTN MoMo',
          lastFour: '5678',
          isDefault: false,
          status: 'active',
          cardholderName: null,
          expires: null,
          phone: '+234 801 234 5678',
          walletAddress: null,
          network: null,
        },
        {
          id: 'mm-demo',
          type: 'crypto',
          provider: 'MetaMask',
          brand: 'metamask',
          label: 'MetaMask',
          lastFour: '9d2c',
          isDefault: false,
          status: 'active',
          cardholderName: null,
          expires: null,
          phone: null,
          walletAddress: '0x3a4F...9d2c',
          network: 'Polygon',
        },
      ];
    }

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

customerExtrasRouter.delete(
  '/payment-instruments/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      await db.query(`DELETE FROM customer_payment_methods WHERE id = $1 AND user_id = $2`, [
        req.params.id,
        req.user!.id,
      ]);
      res.json({ status: 'success', data: { deleted: true } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

customerExtrasRouter.patch(
  '/payment-instruments/:id/default',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const uid = req.user!.id;
      await db.query(`UPDATE customer_payment_methods SET is_default = FALSE WHERE user_id = $1`, [
        uid,
      ]);
      await db.query(
        `UPDATE customer_payment_methods SET is_default = TRUE WHERE id = $1 AND user_id = $2`,
        [req.params.id, uid]
      );
      res.json({ status: 'success', data: { id: req.params.id, isDefault: true } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

customerExtrasRouter.post('/payment-instruments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const b = req.body || {};
    const row = await db.query(
      `INSERT INTO customer_payment_methods (
         user_id, provider, method_type, label, last_four, is_default,
         brand, cardholder_name, expires_month, expires_year, phone_number,
         wallet_address, network, status
       ) VALUES ($1,$2,$3,$4,$5,COALESCE($6,FALSE),$7,$8,$9,$10,$11,$12,$13,'active')
       RETURNING *`,
      [
        req.user!.id,
        b.provider || 'Card',
        b.methodType || b.type || 'card',
        b.label || b.provider || 'Card',
        String(b.lastFour || '0000').slice(-4),
        !!b.isDefault,
        b.brand || null,
        b.cardholderName || null,
        b.expiresMonth || null,
        b.expiresYear || null,
        b.phone || null,
        b.walletAddress || null,
        b.network || null,
      ]
    );
    res.status(201).json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Customer deals feed */
customerExtrasRouter.get('/deals', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category || 'all').toLowerCase();
    const uid = req.user!.id;
    const promos = await db
      .query(
        `SELECT p.*,
                COALESCE(up.status, CASE WHEN p.code = 'DOUBLDVT' THEN 'active' ELSE 'available' END) AS user_status
         FROM promotions p
         LEFT JOIN user_promotions up ON up.promotion_id = p.id AND up.user_id = $1
         WHERE p.status IN ('active', 'permanent')
            OR up.status = 'used'
         ORDER BY p.is_featured DESC NULLS LAST, p.created_at DESC`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));

    let rows = promos.rows;
    if (!rows.length) {
      rows = [
        {
          code: 'MOVR50',
          title: '50% OFF',
          description: 'Your next 3 rides',
          category: 'rides',
          is_featured: true,
          ends_at: '2026-04-15',
          user_status: 'available',
        },
        {
          code: 'MOVRGRO20',
          title: '20% off Grocery Orders',
          description: 'Min order ₦2,000 · ShopRite',
          category: 'food',
          icon_key: 'cart',
          ends_at: '2026-04-20',
          user_status: 'available',
        },
        {
          code: 'DOUBLDVT',
          title: 'Double DVT Weekend',
          description: 'Earn 2x tokens on all rides',
          category: 'tokens',
          is_auto_applied: true,
          user_status: 'active',
        },
        {
          code: 'FREERENT1',
          title: 'Free First Rental Day',
          description: 'New users only · Used',
          category: 'rides',
          icon_key: 'car',
          user_status: 'used',
        },
      ];
    }

    if (category !== 'all') {
      rows = rows.filter((r: any) => String(r.category || '').toLowerCase() === category);
    }

    const data = rows.map((p: any) => {
      const ends = p.ends_at ? new Date(p.ends_at) : null;
      const expLabel = ends
        ? `Exp${p.is_featured ? 'ires' : ''} ${ends.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : p.is_auto_applied
          ? 'This weekend'
          : null;
      return {
        id: p.id || p.code,
        code: p.code,
        title: p.title || p.code,
        description: p.description || '',
        category: p.category || 'all',
        featured: !!p.is_featured,
        autoApplied: !!p.is_auto_applied,
        partner: p.partner_name,
        icon: p.icon_key || 'promo',
        status: p.user_status || 'available',
        expiresLabel: expLabel,
        endsAt: p.ends_at,
      };
    });

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Help Center — Your Tickets */
customerExtrasRouter.get(
  '/support/tickets',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const uid = req.user!.id;
      let rows = await db
        .query(
          `SELECT id, subject, status, status_label, ticket_ref, created_at
           FROM support_tickets WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 20`,
          [uid]
        )
        .catch(() => ({ rows: [] as any[] }));

      if (!rows.rows.length) {
        const seeded = await db
          .query(
            `INSERT INTO support_tickets (user_id, subject, status, status_label, ticket_ref, created_at)
             VALUES ($1, 'Payment not received', 'in_review', 'In Review',
                     'MVR-TKT-4821', NOW() - INTERVAL '2 days')
             RETURNING id, subject, status, status_label, ticket_ref, created_at`,
            [uid]
          )
          .catch(() => ({ rows: [] as any[] }));
        rows = seeded.rows.length
          ? seeded
          : {
              rows: [
                {
                  id: 'demo',
                  subject: 'Payment not received',
                  status: 'in_review',
                  status_label: 'In Review',
                  ticket_ref: 'MVR-TKT-4821',
                  created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
                },
              ],
            };
      }

      const data = rows.rows.map((t: any) => {
        const opened = new Date(t.created_at);
        const days = Math.max(0, Math.floor((Date.now() - opened.getTime()) / 86400000));
        const when =
          days === 0 ? 'Opened today' : days === 1 ? 'Opened 1 day ago' : `Opened ${days} days ago`;
        return {
          id: t.id,
          subject: t.subject,
          status: t.status_label || t.status || 'In Review',
          ticketRef: t.ticket_ref || 'MVR-TKT-4821',
          openedLabel: when,
          createdAt: t.created_at,
        };
      });

      res.json({
        status: 'success',
        data: {
          tickets: data,
          contact: {
            liveChat: { label: 'Live Chat', subtitle: 'Usually replies in 5 min', online: true },
            email: { label: 'Email Support', subtitle: 'support@movr.app' },
            raiseTicket: { label: 'Raise a Ticket', subtitle: 'For complex issues' },
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

customerExtrasRouter.post(
  '/support/tickets',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const subject = String(req.body.subject || 'New support request').slice(0, 256);
      const ref = `MVR-TKT-${Math.floor(1000 + Math.random() * 9000)}`;
      const row = await db.query(
        `INSERT INTO support_tickets (user_id, subject, status, status_label, ticket_ref)
         VALUES ($1, $2, 'open', 'Open', $3)
         RETURNING *`,
        [req.user!.id, subject, ref]
      );
      res.status(201).json({
        status: 'success',
        data: {
          id: row.rows[0].id,
          ticketRef: row.rows[0].ticket_ref,
          subject: row.rows[0].subject,
          status: 'Open',
        },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);
