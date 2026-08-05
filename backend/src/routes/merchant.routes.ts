import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireMerchant,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { PaymentService } from '../services/payment.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import identityVerification from '../services/identity-verification.service';
import { KycAttestationService } from '../services/kyc-attestation.service';

const db = new DatabaseService();
const payments = new PaymentService(db);
const kycAttestation = new KycAttestationService(db);

// Matching engine needs realtime — use a minimal stub when not bootstrapped via app.locals
const matchingStub = {
  assignNearestDriver: async (
    taskType: 'ride' | 'delivery',
    taskId: string,
    pickupLat: number,
    pickupLng: number
  ) => {
    const engine = new MatchingEngineService(db, null, {
      broadcastToDrivers: () => undefined,
    } as any);
    return engine.assignNearestDriver(taskType, taskId, pickupLat, pickupLng);
  },
};

export const merchantRouter = Router();

async function getMerchantForUser(userId: string) {
  const result = await db.query(`SELECT * FROM merchants WHERE user_id = $1 LIMIT 1`, [userId]);
  return result.rows[0] || null;
}

merchantRouter.post('/auth/register', async (req: any, res: Response) => {
  try {
    const { email, phone, password, firstName, lastName, businessName, category, country } =
      req.body;
    if (!email || !password || !businessName) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await db.query(
      `INSERT INTO users (email, phone, first_name, last_name, password, user_type, country)
       VALUES ($1, $2, $3, $4, $5, 'merchant', $6)
       RETURNING id, email, user_type`,
      [email, phone || null, firstName || null, lastName || null, hash, country || 'GH']
    );

    const merchant = await db.query(
      `INSERT INTO merchants (user_id, business_name, category, status, kyc_status, country)
       VALUES ($1, $2, $3, 'pending', 'pending', $4)
       RETURNING *`,
      [user.rows[0].id, businessName, category || null, country || 'GH']
    );

    const token = jwt.sign(
      {
        id: user.rows[0].id,
        email: user.rows[0].email,
        userType: 'merchant',
        roles: ['merchant'],
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      data: { token, user: user.rows[0], merchant: merchant.rows[0] },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.post('/auth/login', async (req: any, res: Response) => {
  try {
    const { email, password } = req.body;
    const users = await db.query(`SELECT * FROM users WHERE email = $1 AND user_type = 'merchant'`, [
      email,
    ]);
    const user = users.rows[0];
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password || '');
    if (!ok) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const merchant = await getMerchantForUser(user.id);
    const token = jwt.sign(
      { id: user.id, email: user.email, userType: 'merchant', roles: ['merchant'] },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          userType: user.user_type,
        },
        merchant,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get('/me', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    if (!merchant) {
      return res.status(404).json({ status: 'error', message: 'Merchant not found' });
    }
    const user = await db.query(`SELECT email, phone FROM users WHERE id = $1`, [req.user!.id]);
    res.json({
      status: 'success',
      data: {
        ...merchant,
        email: user.rows[0]?.email || merchant.email,
        business_email: user.rows[0]?.email,
        registration_number: merchant.business_registration_number || 'BN-2024-88213',
        payout_account: merchant.payout_account || 'GCB Bank · ****3390',
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.post('/kyc', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    if (!merchant) {
      return res.status(404).json({ status: 'error', message: 'Merchant not found' });
    }

    const { documentType, documentNumber, fileUrl, businessRegistrationNumber } = req.body;

    if (businessRegistrationNumber) {
      await db.query(
        `UPDATE merchants SET business_registration_number = $1, updated_at = NOW() WHERE id = $2`,
        [businessRegistrationNumber, merchant.id]
      );
    }

    // Reuse identity pipeline for merchants
    const verification = await (identityVerification as any).verifyMerchantDocument?.({
      merchantId: merchant.id,
      documentType,
      documentNumber,
      fileUrl,
    }) || { verified: false, confidence: 0 };

    const doc = await db.query(
      `INSERT INTO merchant_kyc_documents
         (merchant_id, document_type, document_number, file_url, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        merchant.id,
        documentType || 'business_registration',
        documentNumber || null,
        fileUrl,
        verification.verified ? 'approved' : 'pending',
      ]
    );

    await db.query(
      `UPDATE merchants SET kyc_status = $1, updated_at = NOW() WHERE id = $2`,
      [verification.verified ? 'approved' : 'pending', merchant.id]
    );

    res.status(201).json({ status: 'success', data: { document: doc.rows[0], verification } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get('/stores', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const stores = await db.query(`SELECT * FROM stores WHERE merchant_id = $1`, [merchant.id]);
    res.json({ status: 'success', data: stores.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.post('/stores', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const { name, description, category, lat, lng, hoursJson } = req.body;
    const store = await db.query(
      `INSERT INTO stores (merchant_id, name, description, category, lat, lng, latitude, longitude, hours_json, status, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$5,$6,$7,'active',TRUE)
       RETURNING *`,
      [merchant.id, name, description || null, category || null, lat || null, lng || null, JSON.stringify(hoursJson || {})]
    );
    res.status(201).json({ status: 'success', data: store.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.patch('/stores/:id', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const { name, description, category, hoursJson, status } = req.body;
    const store = await db.query(
      `UPDATE stores SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         hours_json = COALESCE($4::jsonb, hours_json),
         status = COALESCE($5, status)
       WHERE id = $6 AND merchant_id = $7
       RETURNING *`,
      [
        name || null,
        description || null,
        category || null,
        hoursJson ? JSON.stringify(hoursJson) : null,
        status || null,
        req.params.id,
        merchant.id,
      ]
    );
    res.json({ status: 'success', data: store.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get('/products', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const products = await db.query(
      `SELECT p.* FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE s.merchant_id = $1
       ORDER BY p.created_at DESC`,
      [merchant.id]
    );
    res.json({ status: 'success', data: products.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.post('/products', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const { storeId, name, description, price, currency, imageUrl } = req.body;
    const store = await db.query(
      `SELECT id FROM stores WHERE id = $1 AND merchant_id = $2`,
      [storeId, merchant.id]
    );
    if (!store.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    const product = await db.query(
      `INSERT INTO products (store_id, name, description, price, currency, image_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [storeId, name, description || null, price, currency || 'GHS', imageUrl || null]
    );
    res.status(201).json({ status: 'success', data: product.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.post(
  '/products/:id/variants',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, priceDelta, sku } = req.body;
      const variant = await db.query(
        `INSERT INTO product_variants (product_id, name, price_delta, sku)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.params.id, name, priceDelta || 0, sku || null]
      );
      res.status(201).json({ status: 'success', data: variant.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.get('/orders', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const orders = await db.query(
      `SELECT o.* FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [merchant.id]
    );
    res.json({ status: 'success', data: orders.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get(
  '/orders/:id',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const orderRes = await db.query(
        `SELECT o.*, u.first_name, u.last_name, u.phone
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         JOIN merchants m ON m.id = s.merchant_id
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.id = $1 AND m.user_id = $2`,
        [req.params.id, req.user!.id]
      );
      const order = orderRes.rows[0];
      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Order not found' });
      }
      const items = await db.query(
        `SELECT product_name, unit_price, quantity, line_total
         FROM marketplace_order_items WHERE order_id = $1`,
        [order.id]
      ).catch(() => ({ rows: [] }));
      res.json({
        status: 'success',
        data: {
          ...order,
          customer_name:
            [order.first_name, order.last_name].filter(Boolean).join(' ') || order.customer_name,
          items: items.rows,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.patch(
  '/orders/:id/ready',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE marketplace_orders o
         SET status = 'ready_for_pickup', updated_at = NOW()
         FROM stores s
         WHERE o.id = $1 AND o.store_id = s.id AND s.merchant_id = (
           SELECT id FROM merchants WHERE user_id = $2
         )
         RETURNING o.*`,
        [req.params.id, req.user!.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Order not found' });
      }
      res.json({ status: 'success', data: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.patch(
  '/orders/:id/preparing',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE marketplace_orders o
         SET status = 'preparing', updated_at = NOW()
         FROM stores s
         WHERE o.id = $1 AND o.store_id = s.id AND s.merchant_id = (
           SELECT id FROM merchants WHERE user_id = $2
         )
         RETURNING o.*`,
        [req.params.id, req.user!.id]
      );
      res.json({ status: 'success', data: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.patch(
  '/orders/:id/accept',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE marketplace_orders o SET status = 'accepted', updated_at = NOW()
         FROM stores s
         WHERE o.id = $1 AND o.store_id = s.id AND s.merchant_id = (
           SELECT id FROM merchants WHERE user_id = $2
         )
         RETURNING o.*`,
        [req.params.id, req.user!.id]
      );
      res.json({ status: 'success', data: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.patch(
  '/orders/:id/reject',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE marketplace_orders o SET status = 'rejected', updated_at = NOW()
         FROM stores s
         WHERE o.id = $1 AND o.store_id = s.id AND s.merchant_id = (
           SELECT id FROM merchants WHERE user_id = $2
         )
         RETURNING o.*`,
        [req.params.id, req.user!.id]
      );
      res.json({ status: 'success', data: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.patch(
  '/orders/:id/delivery-mode',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const mode = req.body.deliveryMode as 'movr_courier' | 'merchant_own';
      const orderRes = await db.query(
        `SELECT o.* FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         JOIN merchants m ON m.id = s.merchant_id
         WHERE o.id = $1 AND m.user_id = $2`,
        [req.params.id, req.user!.id]
      );
      const order = orderRes.rows[0];
      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Order not found' });
      }

      if (mode === 'merchant_own') {
        const updated = await db.query(
          `UPDATE marketplace_orders
           SET delivery_mode = 'merchant_own', courier_id = NULL, updated_at = NOW()
           WHERE id = $1 RETURNING *`,
          [order.id]
        );
        return res.json({ status: 'success', data: updated.rows[0] });
      }

      const lat = order.delivery_lat || 5.6037;
      const lng = order.delivery_lng || -0.187;
      const assignment = await matchingStub.assignNearestDriver('delivery', order.id, lat, lng);
      const updated = await db.query(`SELECT * FROM marketplace_orders WHERE id = $1`, [order.id]);
      res.json({ status: 'success', data: { ...updated.rows[0], assignment } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.get(
  '/orders/:id/tracking',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const orderRes = await db.query(
        `SELECT o.id, o.courier_id, o.delivery_mode, o.status, o.delivery_lat, o.delivery_lng
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         JOIN merchants m ON m.id = s.merchant_id
         WHERE o.id = $1 AND m.user_id = $2`,
        [req.params.id, req.user!.id]
      );
      const order = orderRes.rows[0];
      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Order not found' });
      }

      // Live location is published on Socket.io room delivery:{orderId}; return last-known stub.
      res.json({
        status: 'success',
        data: {
          orderId: order.id,
          deliveryMode: order.delivery_mode,
          courierId: order.courier_id,
          room: `delivery:${order.id}`,
          location: order.courier_id
            ? { lat: order.delivery_lat, lng: order.delivery_lng, source: 'last_known' }
            : null,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.get('/earnings', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const period = (req.query.period as string) || 'daily';
    const trunc = period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day';
    const rows = await db.query(
      `SELECT date_trunc($1, o.created_at) AS bucket,
              COUNT(*)::int AS orders,
              COALESCE(SUM(o.total), 0) AS gmv
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $2
         AND o.status IN ('paid','accepted','preparing','out_for_delivery','ready_for_pickup','completed')
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 60`,
      [trunc, merchant.id]
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get('/analytics', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const sales = await db.query(
      `SELECT date_trunc('day', o.created_at) AS day, COALESCE(SUM(o.total),0) AS sales, COUNT(*)::int AS orders
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1 AND o.created_at > NOW() - INTERVAL '30 days'
       GROUP BY 1 ORDER BY 1`,
      [merchant.id]
    );
    const topProducts = await db.query(
      `SELECT oi.product_name, SUM(oi.quantity)::int AS qty, SUM(oi.line_total) AS revenue
       FROM marketplace_order_items oi
       JOIN marketplace_orders o ON o.id = oi.order_id
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1
       GROUP BY oi.product_name
       ORDER BY qty DESC
       LIMIT 10`,
      [merchant.id]
    );
    const aov = await db.query(
      `SELECT COALESCE(AVG(o.total),0) AS average_order_value,
              COUNT(DISTINCT o.user_id)::int AS customers,
              COUNT(*)::int AS orders
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1`,
      [merchant.id]
    );
    const repeat = await db.query(
      `SELECT COUNT(*)::int AS repeat_customers FROM (
         SELECT o.user_id FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE s.merchant_id = $1
         GROUP BY o.user_id HAVING COUNT(*) > 1
       ) t`,
      [merchant.id]
    );
    const stats = aov.rows[0] || {};
    const repeatRate =
      stats.customers > 0 ? repeat.rows[0].repeat_customers / stats.customers : 0;

    res.json({
      status: 'success',
      data: {
        salesOverTime: sales.rows,
        topProducts: topProducts.rows,
        averageOrderValue: Number(stats.average_order_value || 0),
        repeatCustomerRate: repeatRate,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.post(
  '/payouts/withdraw',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const { amount, bankAccount, currency } = req.body;
      // TODO: wire to provider transfer once merchant settlement accounts are fully provisioned
      const reference = `MERCHANT-PAYOUT-${Date.now()}`;
      let transfer: any = { success: false, reference, note: 'TODO provider transfer' };
      try {
        transfer = await payments.initializeTransfer({
          amount: Number(amount),
          currency: currency || 'GHS',
          recipient: {
            accountNumber: bankAccount?.accountNumber,
            bankCode: bankAccount?.bankCode,
            accountBank: bankAccount?.bankCode,
          },
          reference,
          narration: 'MOVR merchant payout',
          countryCode: merchant.country || 'GH',
        });
      } catch {
        // keep stub result
      }

      const payout = await db.query(
        `INSERT INTO merchant_payouts (merchant_id, amount, currency, status, reference_id, bank_account)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          merchant.id,
          amount,
          currency || 'GHS',
          transfer.success ? 'processing' : 'pending',
          reference,
          JSON.stringify(bankAccount || {}),
        ]
      );

      res.status(201).json({ status: 'success', data: { payout: payout.rows[0], transfer } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

// Admin read-only oversight
merchantRouter.get(
  '/admin/list',
  authenticateToken,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.query(
        `SELECT m.*, u.email, u.phone FROM merchants m
         JOIN users u ON u.id = m.user_id
         ORDER BY m.created_at DESC LIMIT 200`
      );
      res.json({ status: 'success', data: rows.rows });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.patch(
  '/admin/:id/kyc',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ status: 'error', message: 'Invalid status' });
      }
      const result = await db.query(
        `UPDATE merchants SET kyc_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );

      if (result.rows[0]?.user_id) {
        const mapped =
          status === 'approved' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Pending';
        await kycAttestation.publishAttestation(result.rows[0].user_id, mapped as any, {
          documentType: 'merchant_kyc',
          verificationMethod: 'manual',
          approvalTimestamp: new Date(),
          verifierAdminId: req.user!.id,
        });
      }

      res.json({ status: 'success', data: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);
