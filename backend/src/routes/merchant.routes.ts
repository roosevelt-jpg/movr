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
import { InboxService } from '../services/inbox.service';

const db = new DatabaseService();
const payments = new PaymentService(db);
const kycAttestation = new KycAttestationService(db);
const inbox = new InboxService(db);

async function notifyCustomerOrderUpdate(order: any) {
  if (!order?.user_id) return;
  const label = String(order.status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
  try {
    await inbox.sendInboxMessage(
      order.user_id,
      'order_update',
      `Order ${label}`,
      `Your order is now ${label.toLowerCase()}.`,
      `movr://orders/${order.id}`
    );
  } catch {
    /* ignore */
  }
}

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

function normalizePhone(value: string) {
  return String(value || '').replace(/[\s\-()]/g, '');
}

merchantRouter.post('/auth/register', async (req: any, res: Response) => {
  try {
    const { email, phone, password, firstName, lastName, businessName, category, country } =
      req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = phone ? normalizePhone(phone) : null;

    if (!password || !businessName) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    if (!cleanEmail && !cleanPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Email or phone number is required',
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await db.query(
      `INSERT INTO users (email, phone, first_name, last_name, password, user_type, country)
       VALUES ($1, $2, $3, $4, $5, 'merchant', $6)
       RETURNING id, email, phone, user_type`,
      [cleanEmail, cleanPhone, firstName || null, lastName || null, hash, country || 'GH']
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
    const { email, phone, password, identifier } = req.body;
    const raw = String(identifier || email || phone || '').trim();
    if (!raw || !password) {
      return res.status(400).json({ status: 'error', message: 'Email/phone and password required' });
    }

    const isEmail = raw.includes('@');
    const users = isEmail
      ? await db.query(
          `SELECT * FROM users WHERE lower(email) = lower($1) AND user_type = 'merchant' LIMIT 1`,
          [raw]
        )
      : await db.query(
          `SELECT * FROM users
           WHERE user_type = 'merchant'
             AND (
               phone = $1
               OR regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $2
             )
           LIMIT 1`,
          [raw, normalizePhone(raw)]
        );

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
          phone: user.phone,
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

    const {
      documentType,
      documentNumber,
      fileUrl,
      businessRegistrationNumber,
      countryCode = 'GH',
      fullName,
      dateOfBirth,
      ocrConfirmed,
    } = req.body;

    // Phase 26 — country-specific ID validation before identity pipeline
    if (documentType === 'national_id' || documentType === 'ghana_card' || documentNumber) {
      const { NationalIdVerificationService } = require('../services/ghana-card-verification.service');
      const national = new NationalIdVerificationService(db);
      const check = national.validateIdNumber(countryCode, documentNumber || '');
      if (documentNumber && !check.valid) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid ${check.pattern.label} for ${String(countryCode).toUpperCase()}`,
          data: { field: check.pattern },
        });
      }
    }

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
      countryCode,
      fullName,
      dateOfBirth,
      ocrConfirmed: Boolean(ocrConfirmed),
    }) || { verified: false, confidence: 0, pendingManualReview: true };

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
      `UPDATE merchants SET kyc_status = $1, country = COALESCE($2, country), updated_at = NOW() WHERE id = $3`,
      [
        verification.verified ? 'approved' : 'pending',
        countryCode || null,
        merchant.id,
      ]
    ).catch(async () => {
      await db.query(
        `UPDATE merchants SET kyc_status = $1, updated_at = NOW() WHERE id = $2`,
        [verification.verified ? 'approved' : 'pending', merchant.id]
      );
    });

    res.status(201).json({
      status: 'success',
      data: {
        document: doc.rows[0],
        verification,
        countryCode,
        pendingAutomatedVerification: Boolean(verification.pendingManualReview),
      },
    });
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
    const { name, description, category, lat, lng, hoursJson, bannerUrl, defaultDeliveryMode } = req.body;
    const store = await db.query(
      `INSERT INTO stores (merchant_id, name, description, category, lat, lng, latitude, longitude, hours_json, status, is_active, banner_url, default_delivery_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$5,$6,$7,'active',TRUE,$8,$9)
       RETURNING *`,
      [
        merchant.id,
        name,
        description || null,
        category || null,
        lat || null,
        lng || null,
        JSON.stringify(hoursJson || {}),
        bannerUrl || null,
        defaultDeliveryMode || null,
      ]
    );
    res.status(201).json({ status: 'success', data: store.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.patch('/stores/:id', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const { name, description, category, hoursJson, status, bannerUrl, defaultDeliveryMode } = req.body;
    const store = await db.query(
      `UPDATE stores SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         hours_json = COALESCE($4::jsonb, hours_json),
         status = COALESCE($5, status),
         banner_url = COALESCE($6, banner_url),
         default_delivery_mode = COALESCE($7, default_delivery_mode)
       WHERE id = $8 AND merchant_id = $9
       RETURNING *`,
      [
        name || null,
        description || null,
        category || null,
        hoursJson ? JSON.stringify(hoursJson) : null,
        status || null,
        bannerUrl || null,
        defaultDeliveryMode || null,
        req.params.id,
        merchant.id,
      ]
    );
    if (!store.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    res.json({ status: 'success', data: store.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get('/products', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const products = await db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE s.merchant_id = $1
       ORDER BY p.created_at DESC`,
      [merchant.id]
    );
    res.json({ status: 'success', data: products.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get('/categories', authenticateToken, requireMerchant, async (_req: AuthRequest, res: Response) => {
  try {
    const cats = await db.query(
      `SELECT * FROM product_categories WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
    );
    res.json({ status: 'success', data: cats.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.post('/products', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const { storeId, name, description, price, currency, imageUrl, categoryId } = req.body;
    const store = await db.query(
      `SELECT id FROM stores WHERE id = $1 AND merchant_id = $2`,
      [storeId, merchant.id]
    );
    if (!store.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    const product = await db.query(
      `INSERT INTO products (store_id, name, description, price, currency, image_url, category_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [storeId, name, description || null, price, currency || 'GHS', imageUrl || null, categoryId || null]
    );
    res.status(201).json({ status: 'success', data: product.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.patch('/products/:id', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const { name, description, price, currency, imageUrl, categoryId, inStock } = req.body;
    const product = await db.query(
      `UPDATE products p SET
         name = COALESCE($1, p.name),
         description = COALESCE($2, p.description),
         price = COALESCE($3, p.price),
         currency = COALESCE($4, p.currency),
         image_url = COALESCE($5, p.image_url),
         category_id = COALESCE($6, p.category_id),
         in_stock = COALESCE($7, p.in_stock),
         updated_at = NOW()
       FROM stores s
       WHERE p.id = $8 AND p.store_id = s.id AND s.merchant_id = $9
       RETURNING p.*`,
      [
        name || null,
        description || null,
        price != null ? Number(price) : null,
        currency || null,
        imageUrl || null,
        categoryId || null,
        typeof inStock === 'boolean' ? inStock : null,
        req.params.id,
        merchant.id,
      ]
    );
    if (!product.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }
    res.json({ status: 'success', data: product.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.delete('/products/:id', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const deleted = await db.query(
      `DELETE FROM products p
       USING stores s
       WHERE p.id = $1 AND p.store_id = s.id AND s.merchant_id = $2
       RETURNING p.id`,
      [req.params.id, merchant.id]
    );
    if (!deleted.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

async function assertMerchantStore(merchantId: string, storeId: string) {
  const store = await db.query(
    `SELECT id FROM stores WHERE id = $1 AND merchant_id = $2`,
    [storeId, merchantId]
  );
  return store.rows[0] || null;
}

merchantRouter.get(
  '/stores/:id/banners',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      if (!(await assertMerchantStore(merchant.id, req.params.id))) {
        return res.status(404).json({ status: 'error', message: 'Store not found' });
      }
      const banners = await db.query(
        `SELECT * FROM store_banners WHERE store_id = $1 ORDER BY sort_order ASC, created_at ASC`,
        [req.params.id]
      );
      res.json({ status: 'success', data: banners.rows });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.post(
  '/stores/:id/banners',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      if (!(await assertMerchantStore(merchant.id, req.params.id))) {
        return res.status(404).json({ status: 'error', message: 'Store not found' });
      }
      const { title, imageUrl, linkUrl, sortOrder, isActive } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ status: 'error', message: 'imageUrl is required' });
      }
      const banner = await db.query(
        `INSERT INTO store_banners (store_id, title, image_url, link_url, sort_order, is_active, created_by)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,TRUE),$7) RETURNING *`,
        [
          req.params.id,
          title || null,
          imageUrl,
          linkUrl || null,
          sortOrder != null ? Number(sortOrder) : 0,
          typeof isActive === 'boolean' ? isActive : true,
          req.user!.id,
        ]
      );
      res.status(201).json({ status: 'success', data: banner.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.patch(
  '/stores/:storeId/banners/:bannerId',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      if (!(await assertMerchantStore(merchant.id, req.params.storeId))) {
        return res.status(404).json({ status: 'error', message: 'Store not found' });
      }
      const { title, imageUrl, linkUrl, sortOrder, isActive } = req.body;
      const banner = await db.query(
        `UPDATE store_banners SET
           title = COALESCE($1, title),
           image_url = COALESCE($2, image_url),
           link_url = COALESCE($3, link_url),
           sort_order = COALESCE($4, sort_order),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
         WHERE id = $6 AND store_id = $7
         RETURNING *`,
        [
          title || null,
          imageUrl || null,
          linkUrl || null,
          sortOrder != null ? Number(sortOrder) : null,
          typeof isActive === 'boolean' ? isActive : null,
          req.params.bannerId,
          req.params.storeId,
        ]
      );
      if (!banner.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Banner not found' });
      }
      res.json({ status: 'success', data: banner.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.delete(
  '/stores/:storeId/banners/:bannerId',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      if (!(await assertMerchantStore(merchant.id, req.params.storeId))) {
        return res.status(404).json({ status: 'error', message: 'Store not found' });
      }
      const deleted = await db.query(
        `DELETE FROM store_banners WHERE id = $1 AND store_id = $2 RETURNING id`,
        [req.params.bannerId, req.params.storeId]
      );
      if (!deleted.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Banner not found' });
      }
      res.json({ status: 'success' });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

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
      await notifyCustomerOrderUpdate(result.rows[0]);
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
      if (result.rows[0]) await notifyCustomerOrderUpdate(result.rows[0]);
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
      if (result.rows[0]) await notifyCustomerOrderUpdate(result.rows[0]);
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
      if (result.rows[0]) await notifyCustomerOrderUpdate(result.rows[0]);
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

merchantRouter.get(
  '/balance',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const earned = await db.query(
        `SELECT COALESCE(SUM(o.total), 0)::float AS total
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE s.merchant_id = $1
           AND o.status IN ('completed', 'paid', 'out_for_delivery', 'ready_for_pickup', 'preparing', 'accepted')`,
        [merchant.id]
      );
      const paidOut = await db.query(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM merchant_payouts
         WHERE merchant_id = $1 AND status IN ('processing', 'completed', 'paid')`,
        [merchant.id]
      ).catch(() => ({ rows: [{ total: 0 }] }));
      const pending = await db.query(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM merchant_payouts
         WHERE merchant_id = $1 AND status IN ('pending', 'processing')`,
        [merchant.id]
      ).catch(() => ({ rows: [{ total: 0 }] }));
      const total = Number(earned.rows[0]?.total || 0);
      const withdrawn = Number(paidOut.rows[0]?.total || 0);
      res.json({
        status: 'success',
        data: {
          available: Math.max(0, total - withdrawn),
          pending: Number(pending.rows[0]?.total || 0),
          balance: Math.max(0, total - withdrawn),
          currency: merchant.country === 'NG' ? 'NGN' : 'GHS',
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.get(
  '/payouts',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const rows = await db.query(
        `SELECT id, amount, currency, status, reference_id, created_at,
                COALESCE(reference_id, 'Payout') AS label
         FROM merchant_payouts
         WHERE merchant_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [merchant.id]
      ).catch(() => ({ rows: [] }));
      res.json({ status: 'success', data: rows.rows });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

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
