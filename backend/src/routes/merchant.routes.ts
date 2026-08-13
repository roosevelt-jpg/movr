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
import { assertDirectUploadUrl } from '../utils/media-url';

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

// Matching engine needs realtime ? use a minimal stub when not bootstrapped via app.locals
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

    let verification: any = null;
    try {
      const { getUserOnboardingComms } = require('../services/user-onboarding-comms.service');
      const { createHash } = require('crypto');
      // Persist OTP via lightweight local helper matching auth index.ts shape
      const otpStoreLocal = new Map();
      const persist = async (opts: {
        identifier: string;
        code: string;
        purpose: 'reset' | 'signup';
        userId?: string;
      }) => {
        const key = String(opts.identifier || '').trim().toLowerCase();
        otpStoreLocal.set(key, opts);
        await db
          .query(
            `INSERT INTO auth_otps (identifier, code_hash, purpose, user_id, expires_at)
             VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
            [
              key.includes('@') ? key : key.replace(/[\s\-()]/g, ''),
              createHash('sha256').update(String(opts.code)).digest('hex'),
              opts.purpose,
              opts.userId || null,
            ]
          )
          .catch(() => undefined);
      };
      verification = await getUserOnboardingComms(db).afterSignup(
        {
          id: user.rows[0].id,
          email: user.rows[0].email,
          phone: user.rows[0].phone,
          first_name: firstName || null,
          user_type: 'merchant',
        },
        persist
      );
    } catch {
      /* non-blocking */
    }

    res.status(201).json({
      status: 'success',
      data: { token, user: user.rows[0], merchant: merchant.rows[0], verification },
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
    const user = await db.query(
      `SELECT id, email, phone, first_name, last_name, avatar_url, country, city, gender, date_of_birth
       FROM users WHERE id = $1`,
      [req.user!.id]
    );
    const u = user.rows[0] || {};
    const prefs = await db
      .query(
        `SELECT new_order_alerts, daily_sales_summary
         FROM merchant_notification_settings WHERE merchant_id = $1`,
        [merchant.id]
      )
      .catch(() => ({ rows: [] as any[] }));

    const payoutRaw = merchant.payout_account;
    let payoutLabel = 'GCB Bank ? ****3390';
    if (typeof payoutRaw === 'string' && payoutRaw.trim()) {
      payoutLabel = payoutRaw;
    } else if (payoutRaw && typeof payoutRaw === 'object') {
      const bank = payoutRaw.bankName || payoutRaw.bank || 'GCB Bank';
      const mask = payoutRaw.accountNumber || payoutRaw.last4 || '****3390';
      payoutLabel = `${bank} ? ${mask}`;
    }

    res.json({
      status: 'success',
      data: {
        ...merchant,
        user_id: u.id || req.user!.id,
        email: merchant.business_email || u.email || merchant.email,
        business_email: merchant.business_email || u.email,
        registration_number: merchant.business_registration_number || 'BN-2024-88213',
        payout_account: payoutLabel,
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        phone: u.phone || '',
        avatar_url: u.avatar_url || null,
        country: u.country || 'GH',
        city: u.city || '',
        gender: u.gender || null,
        date_of_birth: u.date_of_birth ? String(u.date_of_birth).slice(0, 10) : null,
        notifications: {
          new_order_alerts: prefs.rows[0]?.new_order_alerts ?? true,
          daily_sales_summary: prefs.rows[0]?.daily_sales_summary ?? true,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.patch(
  '/settings/notifications',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      if (!merchant) {
        return res.status(404).json({ status: 'error', message: 'Merchant not found' });
      }
      const newOrders =
        req.body.new_order_alerts != null ? !!req.body.new_order_alerts : undefined;
      const daily =
        req.body.daily_sales_summary != null ? !!req.body.daily_sales_summary : undefined;

      const row = await db.query(
        `INSERT INTO merchant_notification_settings (merchant_id, new_order_alerts, daily_sales_summary, updated_at)
         VALUES ($1, COALESCE($2, TRUE), COALESCE($3, TRUE), NOW())
         ON CONFLICT (merchant_id) DO UPDATE SET
           new_order_alerts = COALESCE($2, merchant_notification_settings.new_order_alerts),
           daily_sales_summary = COALESCE($3, merchant_notification_settings.daily_sales_summary),
           updated_at = NOW()
         RETURNING new_order_alerts, daily_sales_summary`,
        [merchant.id, newOrders ?? null, daily ?? null]
      );
      res.json({ status: 'success', data: row.rows[0] });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

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
      businessName,
      countryCode = 'GH',
      fullName,
      dateOfBirth,
      ocrConfirmed,
    } = req.body;

    // National ID validation only ? not business registration numbers
    if (
      (documentType === 'national_id' || documentType === 'ghana_card') &&
      documentNumber
    ) {
      const { NationalIdVerificationService } = require('../services/ghana-card-verification.service');
      const national = new NationalIdVerificationService(db);
      const check = national.validateIdNumber(countryCode, documentNumber || '');
      if (!check.valid) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid ${check.pattern.label} for ${String(countryCode).toUpperCase()}`,
          data: { field: check.pattern },
        });
      }
    }

    if (businessRegistrationNumber || businessName || fileUrl) {
      await db.query(
        `UPDATE merchants SET
           business_registration_number = COALESCE($1, business_registration_number),
           business_name = COALESCE($2, business_name),
           registration_certificate_url = COALESCE($3, registration_certificate_url),
           onboarding_step = GREATEST(COALESCE(onboarding_step, 1), 2),
           updated_at = NOW()
         WHERE id = $4`,
        [
          businessRegistrationNumber || null,
          businessName || null,
          fileUrl || null,
          merchant.id,
        ]
      ).catch(async () => {
        if (businessRegistrationNumber) {
          await db.query(
            `UPDATE merchants SET business_registration_number = $1, updated_at = NOW() WHERE id = $2`,
            [businessRegistrationNumber, merchant.id]
          );
        }
      });
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
      `INSERT INTO stores (merchant_id, name, description, category, lat, lng, latitude, longitude, hours_json, status, is_active, banner_url, default_delivery_mode, store_code)
       VALUES ($1,$2,$3,$4,$5,$6,$5,$6,$7,'active',TRUE,$8,$9,
         'STR-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 5)))
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
    const b = req.body || {};
    const store = await db.query(
      `UPDATE stores SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         hours_json = COALESCE($4::jsonb, hours_json),
         status = COALESCE($5, status),
         banner_url = COALESCE($6, banner_url),
         default_delivery_mode = COALESCE($7, default_delivery_mode),
         phone = COALESCE($8, phone),
         email = COALESCE($9, email),
         address = COALESCE($10, address),
         min_order_amount = COALESCE($11, min_order_amount),
         delivery_radius_km = COALESCE($12, delivery_radius_km),
         avg_prep_time_minutes = COALESCE($13, avg_prep_time_minutes),
         prep_time_minutes = COALESCE($13, prep_time_minutes),
         use_movr_courier = COALESCE($14, use_movr_courier),
         use_self_delivery = COALESCE($15, use_self_delivery),
         accept_preorders = COALESCE($16, accept_preorders),
         is_open = COALESCE($17, is_open),
         updated_at = NOW()
       WHERE id = $18 AND merchant_id = $19
       RETURNING *`,
      [
        b.name || null,
        b.description || null,
        b.category || null,
        (b.hoursJson || b.hours_json) ? JSON.stringify(b.hoursJson || b.hours_json) : null,
        b.status || null,
        b.bannerUrl || b.banner_url || null,
        b.defaultDeliveryMode || b.default_delivery_mode || null,
        b.phone || null,
        b.email || null,
        b.address || null,
        b.minOrderAmount != null || b.min_order_amount != null
          ? Number(b.minOrderAmount ?? b.min_order_amount)
          : null,
        b.deliveryRadiusKm != null || b.delivery_radius_km != null
          ? Number(b.deliveryRadiusKm ?? b.delivery_radius_km)
          : null,
        b.avgPrepTimeMinutes != null || b.avg_prep_time_minutes != null
          ? Number(b.avgPrepTimeMinutes ?? b.avg_prep_time_minutes)
          : null,
        typeof b.useMovrCourier === 'boolean'
          ? b.useMovrCourier
          : typeof b.use_movr_courier === 'boolean'
            ? b.use_movr_courier
            : null,
        typeof b.useSelfDelivery === 'boolean'
          ? b.useSelfDelivery
          : typeof b.use_self_delivery === 'boolean'
            ? b.use_self_delivery
            : null,
        typeof b.acceptPreorders === 'boolean'
          ? b.acceptPreorders
          : typeof b.accept_preorders === 'boolean'
            ? b.accept_preorders
            : null,
        typeof b.isOpen === 'boolean' ? b.isOpen : typeof b.is_open === 'boolean' ? b.is_open : null,
        req.params.id,
        merchant.id,
      ]
    );
    if (!store.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    const seoPatch = await db
      .query(
        `UPDATE stores SET
           logo_url = COALESCE($1, logo_url),
           seo_title = COALESCE($2, seo_title),
           seo_description = COALESCE($3, seo_description),
           updated_at = NOW()
         WHERE id = $4 AND merchant_id = $5
         RETURNING *`,
        [
          b.logoUrl || b.logo_url || null,
          b.seoTitle || b.seo_title || null,
          b.seoDescription || b.seo_description || null,
          req.params.id,
          merchant.id,
        ]
      )
      .catch(() => store);
    res.json({ status: 'success', data: seoPatch.rows[0] || store.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get('/products', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const products = await db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              (
                SELECT COALESCE(
                  json_agg(
                    json_build_object(
                      'id', pv.id,
                      'name', pv.name,
                      'price_delta', pv.price_delta,
                      'sku', pv.sku,
                      'stock_qty', pv.stock_qty
                    )
                    ORDER BY pv.created_at ASC NULLS LAST, pv.name ASC
                  ),
                  '[]'::json
                )
                FROM product_variants pv
                WHERE pv.product_id = p.id
              ) AS variants,
              (
                SELECT COALESCE(
                  json_agg(
                    json_build_object(
                      'id', pi.id,
                      'url', pi.url,
                      'alt', pi.alt,
                      'sort_order', pi.sort_order
                    )
                    ORDER BY pi.sort_order ASC, pi.created_at ASC
                  ),
                  '[]'::json
                )
                FROM product_images pi
                WHERE pi.product_id = p.id
              ) AS images,
              (
                SELECT pv.name FROM product_variants pv
                WHERE pv.product_id = p.id
                ORDER BY pv.created_at ASC NULLS LAST, pv.name ASC
                LIMIT 1
              ) AS variant_label,
              (
                SELECT COALESCE(SUM(oi.quantity),0)::int
                FROM marketplace_order_items oi
                JOIN marketplace_orders o ON o.id = oi.order_id
                WHERE oi.product_id = p.id
                  AND o.created_at >= NOW() - INTERVAL '7 days'
                  AND o.status NOT IN ('cancelled','pending_payment')
              ) AS orders_week
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
    const {
      storeId,
      name,
      description,
      price,
      currency,
      imageUrl,
      categoryId,
      salePrice,
      compareAtPrice,
      stockQty,
      inStock,
      isAvailable,
      isFeatured,
      isActive,
    } = req.body;
    assertDirectUploadUrl(imageUrl, 'imageUrl');
    const store = await db.query(
      `SELECT id FROM stores WHERE id = $1 AND merchant_id = $2`,
      [storeId, merchant.id]
    );
    if (!store.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    const qty = stockQty != null ? Math.max(0, Number(stockQty)) : 50;
    const available =
      typeof isAvailable === 'boolean'
        ? isAvailable
        : typeof inStock === 'boolean'
          ? inStock
          : true;
    const product = await db.query(
      `INSERT INTO products (
         store_id, name, description, price, currency, image_url, category_id,
         sale_price, compare_at_price, stock_qty, in_stock, is_available, is_featured, is_active
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        storeId,
        name,
        description || null,
        price,
        currency || 'GHS',
        imageUrl || null,
        categoryId || null,
        salePrice != null ? Number(salePrice) : null,
        compareAtPrice != null ? Number(compareAtPrice) : null,
        qty,
        available && qty > 0,
        available,
        Boolean(isFeatured),
        typeof isActive === 'boolean' ? isActive : true,
      ]
    );
    if (imageUrl) {
      await db
        .query(
          `INSERT INTO product_images (product_id, url, sort_order, alt) VALUES ($1,$2,0,$3)`,
          [product.rows[0].id, imageUrl, name]
        )
        .catch(() => undefined);
    }
    res.status(201).json({ status: 'success', data: product.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.patch('/products/:id', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const {
      name,
      description,
      price,
      currency,
      imageUrl,
      categoryId,
      inStock,
      stockQty,
      isFeatured,
      isAvailable,
      isActive,
      salePrice,
      compareAtPrice,
    } = req.body;
    assertDirectUploadUrl(imageUrl, 'imageUrl');
    const product = await db.query(
      `UPDATE products p SET
         name = COALESCE($1, p.name),
         description = COALESCE($2, p.description),
         price = COALESCE($3, p.price),
         currency = COALESCE($4, p.currency),
         image_url = COALESCE($5, p.image_url),
         category_id = COALESCE($6, p.category_id),
         in_stock = COALESCE($7, p.in_stock),
         stock_qty = COALESCE($8, p.stock_qty),
         is_featured = COALESCE($9, p.is_featured),
         is_available = COALESCE($10, p.is_available),
         is_active = COALESCE($11, p.is_active),
         sale_price = CASE WHEN $14::boolean THEN $12 ELSE COALESCE($12, p.sale_price) END,
         compare_at_price = CASE WHEN $15::boolean THEN $13 ELSE COALESCE($13, p.compare_at_price) END,
         updated_at = NOW()
       FROM stores s
       WHERE p.id = $16 AND p.store_id = s.id AND s.merchant_id = $17
       RETURNING p.*`,
      [
        name || null,
        description || null,
        price != null ? Number(price) : null,
        currency || null,
        imageUrl || null,
        categoryId || null,
        typeof inStock === 'boolean' ? inStock : typeof isAvailable === 'boolean' ? isAvailable : null,
        stockQty != null ? Number(stockQty) : null,
        typeof isFeatured === 'boolean' ? isFeatured : null,
        typeof isAvailable === 'boolean' ? isAvailable : null,
        typeof isActive === 'boolean' ? isActive : null,
        Object.prototype.hasOwnProperty.call(req.body, 'salePrice')
          ? salePrice != null
            ? Number(salePrice)
            : null
          : null,
        Object.prototype.hasOwnProperty.call(req.body, 'compareAtPrice')
          ? compareAtPrice != null
            ? Number(compareAtPrice)
            : null
          : null,
        Object.prototype.hasOwnProperty.call(req.body, 'salePrice'),
        Object.prototype.hasOwnProperty.call(req.body, 'compareAtPrice'),
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
      assertDirectUploadUrl(imageUrl, 'imageUrl');
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
      if (imageUrl) assertDirectUploadUrl(imageUrl, 'imageUrl');
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
      const merchant = await getMerchantForUser(req.user!.id);
      const owned = await db.query(
        `SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id
         WHERE p.id = $1 AND s.merchant_id = $2`,
        [req.params.id, merchant.id]
      );
      if (!owned.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Product not found' });
      }
      const { name, priceDelta, sku, stockQty } = req.body;
      const variant = await db.query(
        `INSERT INTO product_variants (product_id, name, price_delta, sku, stock_qty)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [
          req.params.id,
          name,
          priceDelta || 0,
          sku || null,
          stockQty != null ? Number(stockQty) : null,
        ]
      );
      res.status(201).json({ status: 'success', data: variant.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.patch(
  '/products/:productId/variants/:variantId',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const { name, priceDelta, sku, stockQty } = req.body;
      const variant = await db.query(
        `UPDATE product_variants pv SET
           name = COALESCE($1, pv.name),
           price_delta = COALESCE($2, pv.price_delta),
           sku = COALESCE($3, pv.sku),
           stock_qty = CASE WHEN $4::boolean THEN $5 ELSE COALESCE($5, pv.stock_qty) END
         FROM products p
         JOIN stores s ON s.id = p.store_id
         WHERE pv.id = $6 AND pv.product_id = p.id AND p.id = $7 AND s.merchant_id = $8
         RETURNING pv.*`,
        [
          name || null,
          priceDelta != null ? Number(priceDelta) : null,
          sku || null,
          Object.prototype.hasOwnProperty.call(req.body, 'stockQty'),
          Object.prototype.hasOwnProperty.call(req.body, 'stockQty')
            ? stockQty != null
              ? Number(stockQty)
              : null
            : null,
          req.params.variantId,
          req.params.productId,
          merchant.id,
        ]
      );
      if (!variant.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Variant not found' });
      }
      res.json({ status: 'success', data: variant.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.delete(
  '/products/:productId/variants/:variantId',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const deleted = await db.query(
        `DELETE FROM product_variants pv
         USING products p, stores s
         WHERE pv.id = $1 AND pv.product_id = p.id AND p.id = $2
           AND p.store_id = s.id AND s.merchant_id = $3
         RETURNING pv.id`,
        [req.params.variantId, req.params.productId, merchant.id]
      );
      if (!deleted.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Variant not found' });
      }
      res.json({ status: 'success' });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.post(
  '/products/:id/images',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const owned = await db.query(
        `SELECT p.id, p.name FROM products p JOIN stores s ON s.id = p.store_id
         WHERE p.id = $1 AND s.merchant_id = $2`,
        [req.params.id, merchant.id]
      );
      if (!owned.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Product not found' });
      }
      const { url, alt, sortOrder } = req.body;
      if (!url) {
        return res.status(400).json({ status: 'error', message: 'url is required' });
      }
      assertDirectUploadUrl(url, 'url');
      const image = await db.query(
        `INSERT INTO product_images (product_id, url, alt, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [
          req.params.id,
          url,
          alt || owned.rows[0].name,
          sortOrder != null ? Number(sortOrder) : 0,
        ]
      );
      const count = await db.query(
        `SELECT COUNT(*)::int AS c FROM product_images WHERE product_id = $1`,
        [req.params.id]
      );
      if (Number(count.rows[0]?.c || 0) === 1) {
        await db.query(`UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2`, [
          url,
          req.params.id,
        ]);
      }
      res.status(201).json({ status: 'success', data: image.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.delete(
  '/products/:productId/images/:imageId',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const deleted = await db.query(
        `DELETE FROM product_images pi
         USING products p, stores s
         WHERE pi.id = $1 AND pi.product_id = p.id AND p.id = $2
           AND p.store_id = s.id AND s.merchant_id = $3
         RETURNING pi.id`,
        [req.params.imageId, req.params.productId, merchant.id]
      );
      if (!deleted.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Image not found' });
      }
      res.json({ status: 'success' });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.get('/returns', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const rows = await db.query(
      `SELECT r.*,
              o.public_ref, o.total AS order_total, o.status AS order_status,
              s.name AS store_name,
              TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS customer_name
       FROM marketplace_returns r
       JOIN marketplace_orders o ON o.id = r.order_id
       JOIN stores s ON s.id = o.store_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE s.merchant_id = $1
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [merchant.id]
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.patch(
  '/returns/:id',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const status = String(req.body.status || '').toLowerCase();
      if (!['approved', 'denied', 'refunded', 'requested'].includes(status)) {
        return res.status(400).json({ status: 'error', message: 'Invalid status' });
      }
      const updated = await db.query(
        `UPDATE marketplace_returns r SET
           status = $1,
           refund_amount = COALESCE($2, r.refund_amount),
           merchant_note = COALESCE($3, r.merchant_note),
           updated_at = NOW()
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE r.id = $4 AND r.order_id = o.id AND s.merchant_id = $5
         RETURNING r.*`,
        [
          status,
          req.body.refundAmount != null ? Number(req.body.refundAmount) : null,
          req.body.merchantNote || null,
          req.params.id,
          merchant.id,
        ]
      );
      if (!updated.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Return not found' });
      }
      res.json({ status: 'success', data: updated.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.get('/orders', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const orders = await db.query(
      `SELECT o.*,
              TRIM(CONCAT(
                COALESCE(u.first_name, 'Customer'),
                CASE
                  WHEN u.last_name IS NOT NULL AND LENGTH(TRIM(u.last_name)) > 0
                  THEN ' ' || LEFT(TRIM(u.last_name), 1) || '.'
                  ELSE ''
                END
              )) AS customer_name,
              COALESCE((
                SELECT SUM(i.quantity)::int FROM marketplace_order_items i WHERE i.order_id = o.id
              ), 0) AS item_count
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       LEFT JOIN users u ON u.id = o.user_id
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
      const id = req.params.id;
      const orderRes = await db.query(
        `SELECT o.*, u.first_name, u.last_name, u.phone,
                COALESCE(o.public_ref, RIGHT(REPLACE(o.id::text, '-', ''), 4)) AS display_ref
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         JOIN merchants m ON m.id = s.merchant_id
         LEFT JOIN users u ON u.id = o.user_id
         WHERE m.user_id = $2
           AND (o.id::text = $1 OR o.public_ref = $1)`,
        [id, req.user!.id]
      );
      const order = orderRes.rows[0];
      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Order not found' });
      }
      const items = await db
        .query(
          `SELECT product_name, unit_price, quantity, line_total
           FROM marketplace_order_items WHERE order_id = $1
           ORDER BY created_at ASC NULLS LAST, product_name ASC`,
          [order.id]
        )
        .catch(() =>
          db.query(
            `SELECT product_name, unit_price, quantity, line_total
             FROM marketplace_order_items WHERE order_id = $1`,
            [order.id]
          )
        );
      const customerName =
        [order.first_name, order.last_name].filter(Boolean).join(' ') || order.customer_name || 'Customer';
      const shortName = order.first_name
        ? `${order.first_name}${order.last_name ? ` ${String(order.last_name)[0]}.` : ''}`
        : customerName;
      res.json({
        status: 'success',
        data: {
          ...order,
          public_ref: order.public_ref || order.display_ref,
          customer_name: customerName,
          customer_short: shortName,
          items: items.rows,
          delivery_recipient: order.delivery_address || customerName,
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
        `UPDATE marketplace_orders o SET status = 'preparing', updated_at = NOW()
         FROM stores s
         WHERE o.id = $1 AND o.store_id = s.id AND s.merchant_id = (
           SELECT id FROM merchants WHERE user_id = $2
         )
         AND o.status IN ('pending_payment', 'paid', 'accepted')
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
  '/orders/:id/out-for-delivery',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE marketplace_orders o
         SET status = 'out_for_delivery',
             delivery_otp = COALESCE(NULLIF(o.delivery_otp, ''), LPAD((floor(random()*9000)+1000)::int::text, 4, '0')),
             updated_at = NOW()
         FROM stores s
         WHERE o.id = $1 AND o.store_id = s.id AND s.merchant_id = (
           SELECT id FROM merchants WHERE user_id = $2
         )
         AND o.status IN ('accepted', 'preparing', 'ready_for_pickup')
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

/** Summary cards for Earnings & payouts mockup. */
merchantRouter.get(
  '/earnings/summary',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const feeCfg = await db
        .query(`SELECT fee_pct FROM merchant_payout_config WHERE id = 1`)
        .catch(() => ({ rows: [{ fee_pct: 5 }] }));
      const feePct = Number(feeCfg.rows[0]?.fee_pct ?? 5);

      const earned = await db.query(
        `SELECT COALESCE(SUM(o.total), 0)::float AS total
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE s.merchant_id = $1
           AND o.status IN ('completed', 'paid', 'out_for_delivery', 'ready_for_pickup', 'preparing', 'accepted')`,
        [merchant.id]
      );
      const week = await db.query(
        `SELECT COALESCE(SUM(o.total), 0)::float AS total
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE s.merchant_id = $1
           AND o.created_at >= date_trunc('week', NOW())
           AND o.status IN ('completed', 'paid', 'out_for_delivery', 'ready_for_pickup', 'preparing', 'accepted')`,
        [merchant.id]
      );
      const month = await db.query(
        `SELECT COALESCE(SUM(o.total), 0)::float AS total
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE s.merchant_id = $1
           AND o.created_at >= date_trunc('month', NOW())
           AND o.status IN ('completed', 'paid', 'out_for_delivery', 'ready_for_pickup', 'preparing', 'accepted')`,
        [merchant.id]
      );
      const paidOut = await db
        .query(
          `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM merchant_payouts
         WHERE merchant_id = $1 AND status IN ('processing', 'completed', 'paid')`,
          [merchant.id]
        )
        .catch(() => ({ rows: [{ total: 0 }] }));
      const pending = await db
        .query(
          `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM merchant_payouts
         WHERE merchant_id = $1 AND status IN ('pending', 'processing')`,
          [merchant.id]
        )
        .catch(() => ({ rows: [{ total: 0 }] }));

      const wallet = await db
        .query(`SELECT available, currency_code FROM merchant_wallet_balances WHERE merchant_id = $1`, [
          merchant.id,
        ])
        .catch(() => ({ rows: [] as any[] }));

      const banks = await db
        .query(
          `SELECT id, bank_name, account_number, account_mask, account_name, bank_code, is_primary
           FROM merchant_bank_accounts WHERE merchant_id = $1
           ORDER BY is_primary DESC, created_at ASC`,
          [merchant.id]
        )
        .catch(() => ({ rows: [] as any[] }));

      const total = Number(earned.rows[0]?.total || 0);
      const withdrawn = Number(paidOut.rows[0]?.total || 0);
      const thisWeek = Number(week.rows[0]?.total || 0);
      const fee = Math.round(thisWeek * (feePct / 100) * 100) / 100;
      const net = Math.round((thisWeek - fee) * 100) / 100;
      const available =
        wallet.rows[0]?.available != null
          ? Number(wallet.rows[0].available)
          : Math.max(0, total - withdrawn);
      const currency =
        wallet.rows[0]?.currency_code ||
        (merchant.country === 'NG' || merchant.country === 'NGN' ? 'NGN' : 'GHS');

      let payoutAccount = merchant.payout_account || null;
      const primary = banks.rows.find((b: any) => b.is_primary) || banks.rows[0];
      if (primary) {
        payoutAccount = {
          id: primary.id,
          bankName: primary.bank_name,
          accountNumber: primary.account_mask || primary.account_number,
          accountName: primary.account_name,
          bankCode: primary.bank_code || null,
          selected: true,
        };
      }

      res.json({
        status: 'success',
        data: {
          available,
          thisWeek,
          thisMonth: Number(month.rows[0]?.total || 0),
          month: Number(month.rows[0]?.total || 0),
          pending: Number(pending.rows[0]?.total || 0),
          movrFeePct: feePct,
          movrFee: fee,
          net,
          currency,
          payoutAccount,
          accounts: banks.rows.map((b: any) => ({
            id: b.id,
            bankName: b.bank_name,
            accountNumber: b.account_mask || b.account_number,
            accountName: b.account_name,
            bankCode: b.bank_code || null,
            isPrimary: b.is_primary,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.get('/analytics', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const period = String(req.query.period || 'week').toLowerCase();
    const interval =
      period === 'year' ? '365 days' : period === 'month' ? '30 days' : '7 days';
    const prevInterval =
      period === 'year' ? '730 days' : period === 'month' ? '60 days' : '14 days';
    const paid = `o.status IN ('paid','accepted','preparing','out_for_delivery','ready_for_pickup','completed')`;

    const current = await db.query(
      `SELECT COALESCE(SUM(o.total),0) AS revenue, COUNT(*)::int AS orders,
              COALESCE(AVG(o.total),0) AS avg_order
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1 AND o.created_at > NOW() - INTERVAL '${interval}' AND ${paid}`,
      [merchant.id]
    );
    const previous = await db.query(
      `SELECT COALESCE(SUM(o.total),0) AS revenue, COUNT(*)::int AS orders,
              COALESCE(AVG(o.total),0) AS avg_order
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1
         AND o.created_at > NOW() - INTERVAL '${prevInterval}'
         AND o.created_at <= NOW() - INTERVAL '${interval}'
         AND ${paid}`,
      [merchant.id]
    );
    const sales = await db.query(
      `SELECT date_trunc('day', o.created_at) AS day, COALESCE(SUM(o.total),0) AS sales, COUNT(*)::int AS orders
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1 AND o.created_at > NOW() - INTERVAL '${interval}' AND ${paid}
       GROUP BY 1 ORDER BY 1`,
      [merchant.id]
    );
    const topProducts = await db.query(
      `SELECT oi.product_name, SUM(oi.quantity)::int AS qty, SUM(oi.line_total) AS revenue,
              MAX(COALESCE(p.emoji, '🍽')) AS emoji
       FROM marketplace_order_items oi
       JOIN marketplace_orders o ON o.id = oi.order_id
       JOIN stores s ON s.id = o.store_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE s.merchant_id = $1 AND o.created_at > NOW() - INTERVAL '${interval}' AND ${paid}
       GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5`,
      [merchant.id]
    );
    const statusRows = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE o.status = 'completed' OR o.status IN ('paid','accepted','preparing','out_for_delivery','ready_for_pickup'))::int AS completed,
         COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled,
         COUNT(*) FILTER (WHERE o.status = 'refunded')::int AS refunded,
         COUNT(*)::int AS total
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1 AND o.created_at > NOW() - INTERVAL '${interval}'`,
      [merchant.id]
    );
    const peak = await db.query(
      `SELECT EXTRACT(HOUR FROM o.created_at)::int AS hour, COUNT(*)::int AS orders
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1 AND o.created_at > NOW() - INTERVAL '${interval}' AND ${paid}
       GROUP BY 1 ORDER BY orders DESC LIMIT 5`,
      [merchant.id]
    );
    const rating = await db.query(
      `SELECT COALESCE(AVG(s.rating),0) AS rating FROM stores s WHERE s.merchant_id = $1`,
      [merchant.id]
    );
    const repeat = await db.query(
      `SELECT COUNT(*)::int AS repeat_customers FROM (
         SELECT o.user_id FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE s.merchant_id = $1 AND ${paid}
         GROUP BY o.user_id HAVING COUNT(*) > 1
       ) t`,
      [merchant.id]
    );

    const cur = current.rows[0] || {};
    const prev = previous.rows[0] || {};
    const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : a > 0 ? 100 : 0);

    const days = period === 'year' ? 12 : period === 'month' ? 30 : 7;
    const byDay = new Map<string, { sales: number; orders: number }>();
    for (const r of sales.rows) {
      const key = new Date(r.day).toISOString().slice(0, 10);
      byDay.set(key, { sales: Number(r.sales || 0), orders: Number(r.orders || 0) });
    }
    const salesOverTime: { day: string; label: string; sales: number; orders: number }[] = [];
    if (period === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        let salesSum = 0;
        let ordersSum = 0;
        for (const [k, v] of byDay) {
          if (k.startsWith(key)) {
            salesSum += v.sales;
            ordersSum += v.orders;
          }
        }
        salesOverTime.push({
          day: key,
          label: d.toLocaleString('en', { month: 'short' }),
          sales: salesSum,
          orders: ordersSum,
        });
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const v = byDay.get(key) || { sales: 0, orders: 0 };
        salesOverTime.push({
          day: key,
          label: d.toLocaleString('en', { weekday: 'short' }),
          sales: v.sales,
          orders: v.orders,
        });
      }
    }

    const st = statusRows.rows[0] || { completed: 0, cancelled: 0, refunded: 0, total: 0 };
    const totalStatus = Number(st.total || 0) || 1;
    const hourLabel = (h: number) => {
      const start = h % 12 || 12;
      const end = (h + 1) % 12 || 12;
      const ap = h >= 12 ? 'PM' : 'AM';
      const ap2 = h + 1 >= 12 && h + 1 < 24 ? 'PM' : h + 1 === 24 ? 'AM' : ap;
      return `${start}-${end} ${ap}${ap !== ap2 ? '' : ''}`;
    };

    res.json({
      status: 'success',
      data: {
        period,
        kpis: {
          revenue: Number(cur.revenue || 0),
          revenueDelta: pct(Number(cur.revenue || 0), Number(prev.revenue || 0)),
          orders: Number(cur.orders || 0),
          ordersDelta: pct(Number(cur.orders || 0), Number(prev.orders || 0)),
          avgOrder: Number(cur.avg_order || 0),
          avgOrderDelta: pct(Number(cur.avg_order || 0), Number(prev.avg_order || 0)),
          rating: Number(rating.rows[0]?.rating || 4.8),
          ratingStatus: 'Stable',
          revenueLabel:
            period === 'year' ? 'YEARLY REVENUE' : period === 'month' ? 'MONTHLY REVENUE' : 'WEEKLY REVENUE',
          vsLabel:
            period === 'year' ? 'vs last year' : period === 'month' ? 'vs last month' : 'vs last week',
        },
        salesOverTime: salesOverTime.map((b, idx) => ({
          ...b,
          highlight: idx === salesOverTime.length - 1 || b.label === new Date().toLocaleString('en', { weekday: 'short' }),
        })),
        orderStatus: {
          completed: Number(st.completed || 0),
          cancelled: Number(st.cancelled || 0),
          refunded: Number(st.refunded || 0),
          completedPct: Math.round((Number(st.completed || 0) / totalStatus) * 100),
          cancelledPct: Math.round((Number(st.cancelled || 0) / totalStatus) * 100),
          refundedPct: Math.round((Number(st.refunded || 0) / totalStatus) * 100),
        },
        topProducts: topProducts.rows.map((p: any) => ({
          product_name: p.product_name,
          qty: Number(p.qty || 0),
          revenue: Number(p.revenue || 0),
          emoji: p.emoji || '🍽',
        })),
        peakHours: peak.rows.map((r: any) => ({
          hour: Number(r.hour),
          label: hourLabel(Number(r.hour)),
          orders: Number(r.orders || 0),
        })),
        averageOrderValue: Number(cur.avg_order || 0),
        repeatCustomerRate:
          Number(cur.orders || 0) > 0 ? Number(repeat.rows[0]?.repeat_customers || 0) / Math.max(1, Number(cur.orders || 1)) : 0,
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
      const rows = await db
        .query(
          `SELECT id, amount, currency, status, reference_id, bank_account, created_at,
                  week_start, paid_at, label, fee_amount, gross_amount
           FROM merchant_payouts
           WHERE merchant_id = $1
           ORDER BY COALESCE(paid_at, created_at) DESC
           LIMIT 50`,
          [merchant.id]
        )
        .catch(() => ({ rows: [] as any[] }));

      const fmtWeek = (d: any) => {
        if (!d) return null;
        const dt = new Date(d);
        return `Week of ${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      };
      const fmtPaid = (d: any, bank: string) => {
        if (!d) return bank ? `Pending · ${bank}` : 'Pending';
        const when = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return bank ? `Paid ${when} · ${bank}` : `Paid ${when}`;
      };

      res.json({
        status: 'success',
        data: rows.rows.map((r: any) => {
          const bank = r.bank_account?.bankName || r.bank_account?.bank || 'GTBank';
          const status = String(r.status || '').toLowerCase();
          const done = status === 'completed' || status === 'paid';
          return {
            id: r.id,
            amount: Number(r.amount || 0),
            currency: r.currency || 'NGN',
            status: r.status,
            statusLabel: done ? 'Paid' : String(r.status || 'Pending'),
            label: r.label || fmtWeek(r.week_start) || 'Weekly payout',
            detail: fmtPaid(r.paid_at || (done ? r.created_at : null), bank),
            bankName: bank,
            referenceId: r.reference_id,
          };
        }),
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

merchantRouter.post(
  '/payouts/accounts',
  authenticateToken,
  requireMerchant,
  async (req: AuthRequest, res: Response) => {
    try {
      const merchant = await getMerchantForUser(req.user!.id);
      const bankName = String(req.body.bankName || '').trim();
      const accountNumber = String(req.body.accountNumber || '').trim();
      const accountName = String(req.body.accountName || merchant.business_name || '').trim();
      const bankCode = String(req.body.bankCode || req.body.bank_code || '').trim() || null;
      if (!bankName || !accountNumber) {
        return res.status(400).json({ status: 'error', message: 'bankName and accountNumber required' });
      }
      const mask =
        accountNumber.length > 3
          ? `${accountNumber.slice(0, 3)}${'X'.repeat(Math.max(0, accountNumber.length - 3))}`
          : accountNumber;
      await db.query(
        `UPDATE merchant_bank_accounts SET is_primary = FALSE WHERE merchant_id = $1`,
        [merchant.id]
      ).catch(() => undefined);
      await db
        .query(`ALTER TABLE merchant_bank_accounts ADD COLUMN IF NOT EXISTS bank_code VARCHAR(32)`)
        .catch(() => undefined);
      let row = await db
        .query(
          `INSERT INTO merchant_bank_accounts
             (merchant_id, bank_name, account_number, account_mask, account_name, bank_code, is_primary)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE)
           RETURNING *`,
          [merchant.id, bankName, accountNumber, mask, accountName, bankCode]
        )
        .catch(() => ({ rows: [] as any[] }));
      if (!row.rows[0]) {
        row = await db.query(
          `INSERT INTO merchant_bank_accounts
             (merchant_id, bank_name, account_number, account_mask, account_name, is_primary)
           VALUES ($1,$2,$3,$4,$5,TRUE)
           RETURNING *`,
          [merchant.id, bankName, accountNumber, mask, accountName]
        );
      }
      await db.query(
        `UPDATE merchants SET payout_account = $2::jsonb WHERE id = $1`,
        [
          merchant.id,
          JSON.stringify({
            bankName,
            accountNumber: mask,
            accountName,
            bankCode,
          }),
        ]
      );
      res.status(201).json({ status: 'success', data: row.rows[0] });
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
      const { TrustSettlementService } = require('../services/trust-settlement.service');
      const trust = new TrustSettlementService(db);
      await trust.assertKycForPayout(req.user!.id, Number(amount), 'merchant');
      const payCurrency = currency || (merchant.country === 'NG' ? 'NGN' : 'GHS');
      const primaryBank = await db
        .query(
          `SELECT * FROM merchant_bank_accounts
           WHERE merchant_id = $1
           ORDER BY is_primary DESC, created_at DESC
           LIMIT 1`,
          [merchant.id]
        )
        .catch(() => ({ rows: [] as any[] }));
      const stored = primaryBank.rows[0];
      const incoming = bankAccount || {};
      const looksMasked = /X/i.test(String(incoming.accountNumber || ''));
      const bank = {
        bankName: stored?.bank_name || incoming.bankName || incoming.bank_name,
        accountNumber:
          stored?.account_number ||
          (!looksMasked ? incoming.accountNumber || incoming.account_number : null),
        accountName: stored?.account_name || incoming.accountName || incoming.account_name,
        bankCode:
          stored?.bank_code ||
          incoming.bankCode ||
          incoming.bank_code ||
          null,
      };
      if (!bank.accountNumber) {
        return res.status(400).json({
          status: 'error',
          message: 'Add a payout account with account number (and bank code for bank transfers)',
        });
      }
      const reference = `MERCHANT-PAYOUT-${Date.now()}`;
      let transfer: any = { success: false, reference };
      try {
        transfer = await payments.initializeTransfer({
          amount: Number(amount),
          currency: payCurrency,
          recipient: {
            accountNumber: bank.accountNumber,
            bankCode: bank.bankCode || bank.bank_code,
            accountBank: bank.bankCode || bank.bank_code,
          },
          reference,
          narration: 'MOVR merchant payout',
          countryCode: merchant.country || 'GH',
        });
      } catch (e: any) {
        transfer = { success: false, reference, error: e.message };
      }

      const live = Boolean(
        process.env.PAYSTACK_SECRET_KEY ||
          process.env.FLUTTERWAVE_SECRET_KEY ||
          process.env.PAYSTACK_SECRET ||
          process.env.FLW_SECRET_KEY
      );
      if (!transfer.success && live) {
        return res.status(400).json({
          status: 'error',
          message: transfer.error || 'Payout provider rejected transfer — balance not debited',
          transfer,
        });
      }

      const payout = await db.query(
        `INSERT INTO merchant_payouts (
           merchant_id, amount, currency, status, reference_id, bank_account,
           week_start, paid_at, label, created_at
         )
         VALUES ($1,$2,$3,$4,$5,$6, date_trunc('week', NOW())::date, NOW(), $7, NOW())
         RETURNING *`,
        [
          merchant.id,
          amount,
          payCurrency,
          transfer.success ? 'processing' : 'pending',
          reference,
          JSON.stringify(bank),
          `Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        ]
      );

      await db
        .query(
          `UPDATE merchant_wallet_balances
           SET available = GREATEST(available - $1, 0), updated_at = NOW()
           WHERE merchant_id = $2`,
          [Number(amount), merchant.id]
        )
        .catch(() => undefined);

      await trust
        .createReceipt(req.user!.id, {
          kind: 'merchant_payout',
          amount: Number(amount),
          currency: payCurrency,
          channel: 'bank',
          counterparty: bank.bankName || 'Merchant bank',
          status: transfer.success ? 'processing' : 'pending',
          metadata: { payoutId: payout.rows[0]?.id, reference, transferSuccess: Boolean(transfer.success) },
        })
        .catch(() => undefined);

      res.status(201).json({
        status: 'success',
        data: {
          payout: payout.rows[0],
          transfer,
          message: transfer.success
            ? 'Payout sent'
            : 'Payout queued — ops can retry from Trust Ops',
        },
      });
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

/** Merchant portal board ? KPIs + Kanban-ready order payload */
merchantRouter.get('/dashboard-board', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    await db
      .query(
        `UPDATE stores
         SET store_code = COALESCE(
           NULLIF(store_code, ''),
           'STR-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 5))
         )
         WHERE merchant_id = $1 AND (store_code IS NULL OR store_code = '')`,
        [merchant.id]
      )
      .catch(() => undefined);
    const store = await db.query(
      `SELECT id, name, store_code, COALESCE(is_open, true) AS is_open, COALESCE(rating, 0)::float AS rating,
              COALESCE(prep_time_minutes, 15)::int AS prep_time_minutes
       FROM stores WHERE merchant_id = $1 ORDER BY created_at DESC NULLS LAST LIMIT 1`,
      [merchant.id]
    );
    const storeRow = store.rows[0] || null;

    const today = await db.query(
      `SELECT COUNT(*)::int AS orders,
              COALESCE(SUM(o.total),0)::float AS revenue
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.merchant_id = $1
         AND o.created_at::date = CURRENT_DATE
         AND o.status NOT IN ('rejected','cancelled','canceled')`,
      [merchant.id]
    );
    const ordersCount = Number(today.rows[0]?.orders || 0);
    const revenue = Number(today.rows[0]?.revenue || 0);

    const orders = await db.query(
      `SELECT o.id, o.status, o.total, o.created_at, o.public_ref,
              COALESCE(o.prep_minutes, $2)::int AS prep_minutes,
              o.customer_display_name,
              o.user_id,
              TRIM(CONCAT(COALESCE(u.first_name,''),' ',LEFT(COALESCE(u.last_name,''),1),'.')) AS customer_name
       FROM marketplace_orders o
       JOIN stores s ON s.id = o.store_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE s.merchant_id = $1
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [merchant.id, storeRow?.prep_time_minutes || 15]
    ).catch(async () =>
      db.query(
        `SELECT o.id, o.status, o.total, o.created_at, o.public_ref
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE s.merchant_id = $1
         ORDER BY o.created_at DESC
         LIMIT 100`,
        [merchant.id]
      )
    );

    const withItems = [];
    for (const o of orders.rows) {
      const items = await db
        .query(
          `SELECT product_name, name, quantity, unit_price
           FROM marketplace_order_items WHERE order_id = $1`,
          [o.id]
        )
        .catch(() => ({ rows: [] }));
      const itemRows = items.rows.map((i: any) => ({
        name: i.product_name || i.name || 'Item',
        quantity: Number(i.quantity || 1),
      }));
      const itemLabel = itemRows
        .map((i: any) => `${i.name} × ${i.quantity}`)
        .join(', ');
      const ref = o.public_ref || `MVR-${String(o.id).replace(/\D/g, '').slice(-5) || '20480'}`;
      withItems.push({
        id: o.id,
        ref: ref.startsWith('#') ? ref : `#${ref}`,
        status: o.status,
        total: Number(o.total || 0),
        createdAt: o.created_at,
        itemsLabel: itemLabel || 'Order items',
        items: itemRows,
        customerName:
          o.customer_display_name ||
          (o.customer_name && o.customer_name !== '.' ? o.customer_name : null) ||
          'Customer',
        fulfillment: 'Movr Courier',
        prepMinutes: Number(o.prep_minutes || storeRow?.prep_time_minutes || 15),
      });
    }

    const NEW = ['pending_payment', 'paid', 'pending', 'placed', 'awaiting_acceptance'];
    const PREP = ['accepted', 'preparing'];
    const DONE = ['ready_for_pickup', 'out_for_delivery', 'completed', 'delivered'];

    const newCol = withItems.filter((o) => NEW.includes(String(o.status).toLowerCase()));
    const prepCol = withItems.filter((o) => PREP.includes(String(o.status).toLowerCase()));
    const doneCol = withItems.filter((o) => DONE.includes(String(o.status).toLowerCase()));

    const pendingCount = newCol.length;
    const completedCount = doneCol.length || Math.max(0, ordersCount - pendingCount);

    res.json({
      status: 'success',
      data: {
        store: storeRow
          ? {
              id: storeRow.id,
              name: storeRow.name,
              storeCode: storeRow.store_code || null,
              sharePath: `/store/${storeRow.store_code || storeRow.id}`,
              isOpen: Boolean(storeRow.is_open),
              rating: Number(storeRow.rating || 0),
            }
          : { id: null, name: 'Store', storeCode: null, sharePath: null, isOpen: true, rating: 0 },
        kpis: {
          revenueToday: revenue || 0,
          ordersToday: ordersCount,
          pending: pendingCount,
          completed: completedCount,
          avgOrder: ordersCount ? revenue / ordersCount : 0,
          rating: Number(storeRow?.rating || 0),
          revenueDelta: 0,
          ordersDelta: 0,
        },
        columns: {
          new: newCol,
          preparing: prepCol,
          completed: doneCol,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.patch('/store/open', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const isOpen = Boolean(req.body?.isOpen ?? req.body?.is_open);
    const r = await db.query(
      `UPDATE stores SET is_open = $1, is_active = $1, updated_at = NOW()
       WHERE merchant_id = $2
       RETURNING id, name, is_open`,
      [isOpen, merchant.id]
    );
    res.json({ status: 'success', data: r.rows[0] || { is_open: isOpen } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ??? Coupons ???

merchantRouter.get('/coupons/stats', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const stats = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE COALESCE(c.status, CASE WHEN c.is_active THEN 'active' ELSE 'expired' END) = 'active')::int AS active,
         COUNT(*)::int AS total,
         COALESCE(SUM(COALESCE(c.current_redemptions,0)),0)::int AS redemptions,
         COALESCE(AVG(
           CASE WHEN c.discount_type = 'fixed' THEN c.discount_value
                WHEN c.discount_type = 'percent' THEN c.discount_value * 20
                ELSE c.discount_value END
         ),0)::float AS avg_discount
       FROM coupons c
       LEFT JOIN stores s ON s.id = c.store_id
       WHERE c.merchant_id = $1 OR s.merchant_id = $1`,
      [merchant.id]
    );
    const newUsers = await db.query(
      `SELECT COUNT(DISTINCT cr.user_id)::int AS c
       FROM coupon_redemptions cr
       JOIN coupons c ON c.id = cr.coupon_id
       LEFT JOIN stores s ON s.id = c.store_id
       WHERE (c.merchant_id = $1 OR s.merchant_id = $1) AND COALESCE(cr.is_new_user,false)=true`,
      [merchant.id]
    ).catch(() => ({ rows: [{ c: 0 }] }));
    const row = stats.rows[0] || {};
    res.json({
      status: 'success',
      data: {
        active: Number(row.active || 0),
        total: Number(row.total || 0),
        redemptions: Number(row.redemptions || 0),
        avgDiscount: Math.round(Number(row.avg_discount || 0)),
        newUsersAcquired: Number(newUsers.rows[0]?.c || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.get('/coupons', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const rows = await db.query(
      `SELECT c.*, s.name AS store_name
       FROM coupons c
       LEFT JOIN stores s ON s.id = c.store_id
       WHERE c.merchant_id = $1 OR s.merchant_id = $1
       ORDER BY c.code ASC`,
      [merchant.id]
    ).catch(async () =>
      db.query(
        `SELECT c.*, s.name AS store_name
         FROM coupons c
         LEFT JOIN stores s ON s.id = c.store_id
         WHERE s.merchant_id = $1
         ORDER BY c.code ASC`,
        [merchant.id]
      )
    );
    res.json({
      status: 'success',
      data: rows.rows.map((c: any) => {
        const status =
          c.status ||
          (c.is_active === false
            ? 'expired'
            : c.starts_at && new Date(c.starts_at) > new Date()
              ? 'scheduled'
              : 'active');
        const discountLabel =
          c.discount_label ||
          (c.discount_type === 'percent'
            ? `${c.discount_value}% off`
            : c.discount_type === 'fixed'
              ? `?${Number(c.discount_value).toLocaleString()} off`
              : String(c.discount_value));
        return {
          ...c,
          status,
          discountLabel,
          usageTerms:
            c.usage_terms ||
            (c.new_users_only
              ? '1st order only'
              : c.min_order_value
                ? `Min ?${Number(c.min_order_value).toLocaleString()}`
                : '?'),
          used: Number(c.current_redemptions || 0),
        };
      }),
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

merchantRouter.post('/coupons', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const b = req.body || {};
    const code = String(b.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ status: 'error', message: 'code required' });
    const stores = await db.query(`SELECT id FROM stores WHERE merchant_id = $1 LIMIT 1`, [merchant.id]);
    const storeId = b.storeId || stores.rows[0]?.id || null;
    const discountType = b.discountType === 'fixed' || b.discount_type === 'fixed' ? 'fixed' : 'percent';
    const discountValue = Number(b.discountValue ?? b.discount_value ?? 0);
    const startsAt = b.startsAt || b.start_date || null;
    const endsAt = b.endsAt || b.end_date || b.expiresAt || null;
    const status =
      startsAt && new Date(startsAt) > new Date() ? 'scheduled' : 'active';
    const r = await db.query(
      `INSERT INTO coupons
         (store_id, merchant_id, code, discount_type, discount_value, expires_at, ends_at, starts_at,
          is_active, min_order_value, max_redemptions, current_redemptions, promo_type, new_users_only,
          status, usage_terms, discount_label)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,true,$8,$9,0,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        storeId,
        merchant.id,
        code,
        discountType,
        discountValue,
        endsAt,
        startsAt,
        b.minOrderAmount != null ? Number(b.minOrderAmount) : Number(b.min_order_value || 0),
        b.maxUses != null ? Number(b.maxUses) : b.max_redemptions != null ? Number(b.max_redemptions) : null,
        b.promoType || b.type || 'order_discount',
        Boolean(b.newCustomersOnly ?? b.new_users_only),
        status,
        b.usageTerms ||
          (b.newCustomersOnly ? '1st order only' : b.minOrderAmount ? `Min ?${Number(b.minOrderAmount).toLocaleString()}` : null),
        discountType === 'percent' ? `${discountValue}% off` : `?${discountValue} off`,
      ]
    );
    res.status(201).json({ status: 'success', data: r.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

merchantRouter.patch('/coupons/:id', authenticateToken, requireMerchant, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await getMerchantForUser(req.user!.id);
    const b = req.body || {};
    const r = await db.query(
      `UPDATE coupons c SET
         code = COALESCE($1, c.code),
         discount_type = COALESCE($2, c.discount_type),
         discount_value = COALESCE($3, c.discount_value),
         min_order_value = COALESCE($4, c.min_order_value),
         max_redemptions = COALESCE($5, c.max_redemptions),
         starts_at = COALESCE($6, c.starts_at),
         ends_at = COALESCE($7, c.ends_at),
         expires_at = COALESCE($7, c.expires_at),
         new_users_only = COALESCE($8, c.new_users_only),
         status = COALESCE($9, c.status),
         is_active = COALESCE($10, c.is_active),
         usage_terms = COALESCE($11, c.usage_terms),
         promo_type = COALESCE($12, c.promo_type),
         discount_label = COALESCE($13, c.discount_label)
       FROM stores s
       WHERE c.id = $14 AND (c.merchant_id = $15 OR (c.store_id = s.id AND s.merchant_id = $15))
       RETURNING c.*`,
      [
        b.code ? String(b.code).toUpperCase() : null,
        b.discountType || b.discount_type || null,
        b.discountValue != null || b.discount_value != null
          ? Number(b.discountValue ?? b.discount_value)
          : null,
        b.minOrderAmount != null ? Number(b.minOrderAmount) : null,
        b.maxUses != null ? Number(b.maxUses) : null,
        b.startsAt || null,
        b.endsAt || null,
        typeof b.newCustomersOnly === 'boolean' ? b.newCustomersOnly : null,
        b.status || null,
        typeof b.isActive === 'boolean' ? b.isActive : null,
        b.usageTerms || null,
        b.promoType || null,
        b.discountLabel || null,
        req.params.id,
        merchant.id,
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ status: 'error', message: 'Coupon not found' });
    res.json({ status: 'success', data: r.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});
