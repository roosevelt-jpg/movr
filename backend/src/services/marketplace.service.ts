import { DatabaseService } from './database.service';
import { PaymentService } from './payment.service';
import { InboxService } from './inbox.service';

export class MarketplaceService {
  private inbox: InboxService;

  constructor(
    private db: DatabaseService,
    private payments: PaymentService
  ) {
    this.inbox = new InboxService(db);
  }

  /** Notify customer of order status changes (Phase 19 inbox). */
  async notifyOrderStatus(order: { id: string; user_id: string; status: string }) {
    if (!order?.user_id) return;
    const label = String(order.status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    try {
      await this.inbox.sendInboxMessage(
        order.user_id,
        'order_update',
        `Order ${label}`,
        `Your order is now ${label.toLowerCase()}.`,
        `movr://orders/${order.id}`
      );
    } catch {
      /* inbox optional if migration missing */
    }
  }

  async listStores(filters: {
    category?: string;
    search?: string;
    lat?: number;
    lng?: number;
    radiusMeters?: number;
  }) {
    const values: any[] = [];
    let query = `
      SELECT s.*,
             COALESCE(s.lat, s.latitude) AS lat,
             COALESCE(s.lng, s.longitude) AS lng,
             COALESCE(s.review_count, 0) AS review_count,
             COALESCE(s.eta_min_minutes, 20) AS eta_min_minutes,
             COALESCE(s.eta_max_minutes, 30) AS eta_max_minutes,
             COALESCE(s.eta_min_minutes, 20)::text || '–' || COALESCE(s.eta_max_minutes, 30)::text || ' min' AS eta_text,
             COALESCE(s.hours_json->>'label', 'Open until 9:00 PM') AS hours_text
      FROM stores s
      WHERE COALESCE(s.status, 'active') = 'active'
        AND s.is_active = TRUE
    `;

    if (filters.category) {
      const cat = String(filters.category).toLowerCase();
      if (cat === 'food') {
        query += ` AND (
          s.category ILIKE '%food%' OR s.category ILIKE '%restaurant%' OR s.category ILIKE '%cafe%'
        )`;
      } else {
        values.push(`%${cat}%`);
        query += ` AND s.category ILIKE $${values.length}`;
      }
    }

    if (filters.search) {
      values.push(`%${filters.search}%`);
      query += ` AND (s.name ILIKE $${values.length} OR s.description ILIKE $${values.length})`;
    }

    if (filters.lat != null && filters.lng != null) {
      const radius = filters.radiusMeters || 5000;
      values.push(filters.lng, filters.lat, radius);
      query += `
        AND COALESCE(s.lng, s.longitude) IS NOT NULL
        AND ST_DWithin(
          ST_MakePoint(COALESCE(s.lng, s.longitude), COALESCE(s.lat, s.latitude))::geography,
          ST_MakePoint($${values.length - 2}, $${values.length - 1})::geography,
          $${values.length}
        )
      `;
      query += `
        ORDER BY ST_Distance(
          ST_MakePoint(COALESCE(s.lng, s.longitude), COALESCE(s.lat, s.latitude))::geography,
          ST_MakePoint($${values.length - 2}, $${values.length - 1})::geography
        ) ASC
      `;
    } else {
      query += ` ORDER BY s.rating DESC NULLS LAST, s.name ASC`;
    }

    query += ` LIMIT 50`;
    const result = await this.db.query(query, values);

    // Phase 7 — boost merchant placement by active stake tier
    try {
      const { StakingService } = require('./staking.service');
      const staking = new StakingService(this.db);
      const enriched = await Promise.all(
        result.rows.map(async (store: any) => {
          const ownerId = store.owner_id || store.merchant_user_id || store.user_id;
          let stakeBoost = 1;
          let feeDiscountPct = 0;
          if (ownerId) {
            const tier = await staking.getTier(ownerId, 'merchant');
            stakeBoost = tier.priorityWeight || 1;
            feeDiscountPct = tier.feeDiscountPct || 0;
          }
          return { ...store, stakeBoost, feeDiscountPct };
        })
      );
      enriched.sort((a, b) => {
        const boostDiff = (b.stakeBoost || 1) - (a.stakeBoost || 1);
        if (Math.abs(boostDiff) > 0.001) return boostDiff;
        return Number(b.rating || 0) - Number(a.rating || 0);
      });
      return { ...result, rows: enriched };
    } catch {
      return result;
    }
  }

  async getStore(storeId: string) {
    const result = await this.db.query(
      `SELECT s.*,
              COALESCE(s.review_count, 0) AS review_count,
              COALESCE(s.eta_min_minutes, 20) AS eta_min_minutes,
              COALESCE(s.eta_max_minutes, 30) AS eta_max_minutes,
              COALESCE(s.eta_min_minutes, 20)::text || '–' || COALESCE(s.eta_max_minutes, 30)::text || ' min' AS eta_text,
              COALESCE(s.hours_json->>'label', 'Open until 9:00 PM') AS hours_text
       FROM stores s WHERE s.id = $1`,
      [storeId]
    );
    if (!result.rows[0]) return result;
    const banners = await this.db.query(
      `SELECT id, store_id, title, image_url, link_url, sort_order, is_active
       FROM store_banners
       WHERE store_id = $1 AND is_active = TRUE
       ORDER BY sort_order ASC, created_at ASC`,
      [storeId]
    );
    return {
      ...result,
      rows: [{ ...result.rows[0], banners: banners.rows }],
    };
  }

  async deliveryFee() {
    const cfg = await this.db
      .query(`SELECT delivery_fee FROM marketplace_pricing_config WHERE id = 1`)
      .catch(() => ({ rows: [{ delivery_fee: 15 }] }));
    return Number(cfg.rows[0]?.delivery_fee ?? 15);
  }

  async listCategories(activeOnly = true) {
    const q = activeOnly
      ? `SELECT * FROM product_categories WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM product_categories ORDER BY sort_order ASC, name ASC`;
    return this.db.query(q);
  }

  async getStoreProducts(storeId: string, category?: string) {
    const values: any[] = [storeId];
    let filter = '';
    if (category && category !== 'all') {
      values.push(category);
      filter = ` AND (c.slug = $${values.length} OR c.id::text = $${values.length})`;
    }
    const products = await this.db.query(
      `SELECT p.*,
              c.id AS category_id,
              c.name AS category_name,
              c.slug AS category_slug
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.store_id = $1 AND p.in_stock = TRUE${filter}
       ORDER BY c.sort_order NULLS LAST, p.name`,
      values
    );
    const variants = await this.db.query(
      `SELECT pv.* FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE p.store_id = $1`,
      [storeId]
    );
    const byProduct: Record<string, any[]> = {};
    for (const v of variants.rows) {
      byProduct[v.product_id] = byProduct[v.product_id] || [];
      byProduct[v.product_id].push(v);
    }
    const categories = await this.db.query(
      `SELECT DISTINCT c.id, c.name, c.slug, c.icon_url, c.sort_order
       FROM products p
       JOIN product_categories c ON c.id = p.category_id
       WHERE p.store_id = $1 AND p.in_stock = TRUE AND c.is_active = TRUE
       ORDER BY c.sort_order ASC, c.name ASC`,
      [storeId]
    );
    return {
      products: products.rows.map((p) => ({ ...p, variants: byProduct[p.id] || [] })),
      categories: categories.rows,
    };
  }

  async getOrCreateCart(userId: string, storeId: string) {
    const existing = await this.db.query(
      `SELECT * FROM carts WHERE user_id = $1 AND store_id = $2 AND status = 'open' LIMIT 1`,
      [userId, storeId]
    );
    if (existing.rows[0]) return existing.rows[0];

    const created = await this.db.query(
      `INSERT INTO carts (user_id, store_id, status) VALUES ($1, $2, 'open') RETURNING *`,
      [userId, storeId]
    );
    return created.rows[0];
  }

  async addCartItem(
    userId: string,
    data: { storeId: string; productId: string; variantId?: string; quantity?: number }
  ) {
    const cart = await this.getOrCreateCart(userId, data.storeId);
    const qty = data.quantity || 1;
    const existing = await this.db.query(
      `SELECT * FROM cart_items
       WHERE cart_id = $1 AND product_id = $2
         AND COALESCE(variant_id::text, '') = COALESCE($3::text, '')`,
      [cart.id, data.productId, data.variantId || null]
    );
    if (existing.rows[0]) {
      return this.db.query(
        `UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2 RETURNING *`,
        [qty, existing.rows[0].id]
      );
    }
    return this.db.query(
      `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [cart.id, data.productId, data.variantId || null, qty]
    );
  }

  async updateCartItem(userId: string, itemId: string, quantity: number) {
    return this.db.query(
      `UPDATE cart_items ci SET quantity = $1
       FROM carts c
       WHERE ci.id = $2 AND ci.cart_id = c.id AND c.user_id = $3
       RETURNING ci.*`,
      [quantity, itemId, userId]
    );
  }

  async removeCartItem(userId: string, itemId: string) {
    return this.db.query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE ci.id = $1 AND ci.cart_id = c.id AND c.user_id = $2
       RETURNING ci.id`,
      [itemId, userId]
    );
  }

  async getOpenCart(userId: string, storeId?: string) {
    const values: any[] = [userId];
    let q = `
      SELECT c.* FROM carts c
      WHERE c.user_id = $1 AND c.status = 'open'
    `;
    if (storeId) {
      values.push(storeId);
      q += ` AND c.store_id = $${values.length}`;
    }
    q += ` ORDER BY c.updated_at DESC LIMIT 1`;
    const cart = await this.db.query(q, values);
    if (!cart.rows[0]) return null;

    const items = await this.db.query(
      `SELECT ci.*, p.name, p.price, p.currency, p.image_url,
              COALESCE(pv.price_delta, 0) AS price_delta, pv.name AS variant_name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_variants pv ON pv.id = ci.variant_id
       WHERE ci.cart_id = $1`,
      [cart.rows[0].id]
    );

    const lines = items.rows.map((i) => ({
      ...i,
      name: i.name,
      product_name: i.name,
      variant_label: i.variant_name || '',
      unit_price: Number(i.price) + Number(i.price_delta || 0),
      unitPrice: Number(i.price) + Number(i.price_delta || 0),
      lineTotal: (Number(i.price) + Number(i.price_delta || 0)) * Number(i.quantity),
    }));
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const deliveryFee = await this.deliveryFee();
    return { ...cart.rows[0], items: lines, subtotal, delivery_fee: deliveryFee };
  }

  async applyCoupon(storeId: string, code: string, subtotal: number) {
    if (!code) return { discount: 0, code: null as string | null };
    const coupon = await this.db.query(
      `SELECT * FROM coupons
       WHERE store_id = $1 AND UPPER(code) = UPPER($2)
         AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [storeId, code]
    );
    if (!coupon.rows[0]) throw new Error('Invalid or expired coupon');
    const c = coupon.rows[0];
    const discount =
      c.discount_type === 'percent'
        ? (subtotal * Number(c.discount_value)) / 100
        : Number(c.discount_value);
    return { discount: Math.min(discount, subtotal), code: c.code };
  }

  async checkout(
    userId: string,
    data: {
      storeId: string;
      fulfillmentType: 'pickup' | 'delivery';
      couponCode?: string;
      email: string;
      fullName: string;
      countryCode?: string;
      deliveryAddress?: string;
      deliveryLat?: number;
      deliveryLng?: number;
    }
  ) {
    const cart = await this.getOpenCart(userId, data.storeId);
    if (!cart || !cart.items?.length) throw new Error('Cart is empty');

    const deliveryFee = data.fulfillmentType === 'delivery' ? await this.deliveryFee() : 0;
    const { discount, code } = await this.applyCoupon(
      data.storeId,
      data.couponCode || '',
      cart.subtotal
    );
    const total = Math.max(0, cart.subtotal + deliveryFee - discount);

    const order = await this.db.query(
      `INSERT INTO marketplace_orders (
         user_id, store_id, cart_id, subtotal, delivery_fee, discount, total,
         fulfillment_type, status, coupon_code, delivery_address, delivery_lat, delivery_lng
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_payment',$9,$10,$11,$12)
       RETURNING *`,
      [
        userId,
        data.storeId,
        cart.id,
        cart.subtotal,
        deliveryFee,
        discount,
        total,
        data.fulfillmentType,
        code,
        data.deliveryAddress || null,
        data.deliveryLat || null,
        data.deliveryLng || null,
      ]
    );

    for (const item of cart.items) {
      await this.db.query(
        `INSERT INTO marketplace_order_items (
           order_id, product_id, variant_id, product_name, unit_price, quantity, line_total
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          order.rows[0].id,
          item.product_id,
          item.variant_id,
          item.variant_name ? `${item.name} (${item.variant_name})` : item.name,
          item.unitPrice,
          item.quantity,
          item.lineTotal,
        ]
      );
    }

    const payment = await this.payments.initializePayment({
      userId,
      amount: total,
      currency: cart.items[0]?.currency || 'GHS',
      paymentType: 'marketplace',
      email: data.email,
      fullName: data.fullName,
      countryCode: data.countryCode || 'GH',
      metadata: { orderId: order.rows[0].id, storeId: data.storeId },
    });

    if (payment.success && payment.reference) {
      await this.db.query(
        `UPDATE marketplace_orders SET payment_reference = $1, updated_at = NOW() WHERE id = $2`,
        [payment.reference, order.rows[0].id]
      );
      await this.db.query(
        `UPDATE carts SET status = 'checked_out', updated_at = NOW() WHERE id = $1`,
        [cart.id]
      );
    }

    return { order: order.rows[0], payment };
  }

  async listOrders(userId: string) {
    return this.db.query(
      `SELECT o.*,
              s.name AS store_name,
              s.category AS store_category
       FROM marketplace_orders o
       LEFT JOIN stores s ON s.id = o.store_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT 50`,
      [userId]
    );
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.db.query(
      `SELECT o.*,
              s.name AS store_name,
              s.category AS store_category,
              COALESCE(s.eta_min_minutes, 20) AS eta_min_minutes,
              COALESCE(s.eta_max_minutes, 30) AS eta_max_minutes
       FROM marketplace_orders o
       LEFT JOIN stores s ON s.id = o.store_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, userId]
    );
    if (!order.rows[0]) {
      // Allow lookup by short ref (last 4 of uuid hex) for demo tracking screens
      const byRef = await this.db.query(
        `SELECT o.*,
                s.name AS store_name,
                COALESCE(s.eta_min_minutes, 20) AS eta_min_minutes,
                COALESCE(s.eta_max_minutes, 30) AS eta_max_minutes
         FROM marketplace_orders o
         LEFT JOIN stores s ON s.id = o.store_id
         WHERE o.user_id = $1
           AND UPPER(REPLACE(o.id::text, '-', '')) LIKE '%' || UPPER($2)
         ORDER BY o.created_at DESC
         LIMIT 1`,
        [userId, String(orderId).replace(/[^a-zA-Z0-9]/g, '').slice(-4)]
      );
      if (!byRef.rows[0]) return null;
      order.rows[0] = byRef.rows[0];
    }
    const row = order.rows[0];
    const items = await this.db.query(
      `SELECT * FROM marketplace_order_items WHERE order_id = $1`,
      [row.id]
    );
    const status = String(row.status || '').toLowerCase();
    let etaMinutes = Math.round(
      (Number(row.eta_min_minutes || 20) + Number(row.eta_max_minutes || 30)) / 2
    );
    if (status.includes('deliver') || status.includes('complet')) etaMinutes = 0;
    else if (status.includes('out')) etaMinutes = Math.min(etaMinutes, 12);
    else if (status.includes('prepar') || status.includes('accept')) etaMinutes = Math.max(etaMinutes, 18);

    return {
      ...row,
      items: items.rows,
      eta_minutes: etaMinutes,
      eta_text: etaMinutes > 0 ? `${etaMinutes} min away` : 'Arriving',
      order_ref: String(row.id).replace(/-/g, '').slice(-4).toUpperCase(),
      tracking_steps: ['confirmed', 'preparing', 'out_for_delivery', 'delivered'],
    };
  }

  async updateOrderStatus(orderId: string, status: string) {
    const result = await this.db.query(
      `UPDATE marketplace_orders SET status = $1::order_status, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, orderId]
    );

    if (result.rows[0]) {
      await this.notifyOrderStatus(result.rows[0]);
    }

    if (result.rows[0] && status === 'completed') {
      const { RewardsEngineService } = await import('./rewards-engine.service');
      const { advanceReferralMilestone } = await import('../routes/referrals.routes');
      const rewards = new RewardsEngineService(this.db);
      await rewards.emitActivityEvent(result.rows[0].user_id, 'order_completed', {
        description: `Order ${orderId} completed`,
        orderId,
      });
      await advanceReferralMilestone(result.rows[0].user_id, 'order_completed');
    }

    return result;
  }
}
