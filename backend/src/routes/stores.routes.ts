import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { PaymentService } from '../services/payment.service';
import { MarketplaceService } from '../services/marketplace.service';

const db = new DatabaseService();
const payments = new PaymentService(db);
const marketplace = new MarketplaceService(db, payments);

export const storesRouter = Router();
export const cartRouter = Router();
export const ordersRouter = Router();

storesRouter.get('/', async (req: any, res: Response) => {
  try {
    const { category, search, lat, lng, radiusMeters } = req.query;
    const result = await marketplace.listStores({
      category,
      search,
      lat: lat != null ? Number(lat) : undefined,
      lng: lng != null ? Number(lng) : undefined,
      radiusMeters: radiusMeters != null ? Number(radiusMeters) : undefined,
    });
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

storesRouter.get('/categories/list', async (_req: any, res: Response) => {
  try {
    const result = await marketplace.listCategories(true);
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

storesRouter.get('/:id', async (req: any, res: Response) => {
  try {
    const result = await marketplace.getStore(req.params.id);
    if (!result.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

storesRouter.get('/:id/products', async (req: any, res: Response) => {
  try {
    const data = await marketplace.getStoreProducts(
      req.params.id,
      typeof req.query.category === 'string' ? req.query.category : undefined
    );
    // Backward compatible: data is products array; categories included alongside
    res.json({ status: 'success', data: data.products, categories: data.categories });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

cartRouter.use(authenticateToken);

cartRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const cart = await marketplace.getOrCreateCart(req.user!.id, req.body.storeId);
    res.status(201).json({ status: 'success', data: cart });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

cartRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cart = await marketplace.getOpenCart(req.user!.id, req.query.storeId as string);
    res.json({ status: 'success', data: cart });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

cartRouter.post('/items', async (req: AuthRequest, res: Response) => {
  try {
    const result = await marketplace.addCartItem(req.user!.id, req.body);
    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

cartRouter.patch('/items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await marketplace.updateCartItem(
      req.user!.id,
      req.params.id,
      Number(req.body.quantity)
    );
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

cartRouter.delete('/items/:id', async (req: AuthRequest, res: Response) => {
  try {
    await marketplace.removeCartItem(req.user!.id, req.params.id);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

cartRouter.post('/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const result = await marketplace.checkout(req.user!.id, {
      storeId: req.body.storeId,
      fulfillmentType: req.body.fulfillmentType || 'delivery',
      couponCode: req.body.couponCode,
      email: req.body.email || req.user!.email,
      fullName: req.body.fullName || 'MOVR Customer',
      countryCode: req.body.countryCode || 'GH',
      deliveryAddress: req.body.deliveryAddress,
      deliveryLat: req.body.deliveryLat,
      deliveryLng: req.body.deliveryLng,
    });
    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

cartRouter.post('/quote', async (req: AuthRequest, res: Response) => {
  try {
    const storeId = req.body.storeId as string;
    const couponCode = String(req.body.couponCode || '').trim();
    const cart = await marketplace.getOpenCart(req.user!.id, storeId);
    if (!cart) {
      return res.json({
        status: 'success',
        data: {
          subtotal: 0,
          deliveryFee: 500,
          discount: 0,
          dvtDiscount: 100,
          total: 0,
          currency: 'NGN',
          storeName: 'Chicken Republic',
          eta: '20-35 min',
        },
      });
    }
    const subtotal = Number(cart.subtotal || 0);
    const deliveryFee = 500;
    let discount = 0;
    if (couponCode) {
      try {
        const applied = await (marketplace as any).applyCoupon(storeId, couponCode, subtotal);
        discount = Number(applied?.discount || 0);
      } catch {
        discount = 0;
      }
    }
    const dvtDiscount = Math.min(100, Math.round(subtotal * 0.015) || (subtotal > 0 ? 100 : 0));
    const total = Math.max(0, subtotal + deliveryFee - discount - dvtDiscount);
    const store = await marketplace.getStore(storeId).catch(() => ({ rows: [] as any[] }));
    const s = store.rows?.[0];
    res.json({
      status: 'success',
      data: {
        subtotal,
        deliveryFee,
        discount,
        dvtDiscount,
        total,
        currency: s?.currency_code || 'NGN',
        storeName: s?.name || 'Store',
        eta: s?.eta_text || `${s?.eta_min_minutes || 20}-${s?.eta_max_minutes || 35} min`,
        items: cart.items || [],
      },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

ordersRouter.use(authenticateToken);

ordersRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await marketplace.listOrders(req.user!.id);
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

ordersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const order = await marketplace.getOrder(req.user!.id, req.params.id);
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }
    res.json({ status: 'success', data: order });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

ordersRouter.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const result = await marketplace.updateOrderStatus(req.params.id, req.body.status);
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Wishlist (product favorites) */
cartRouter.get('/wishlist', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT w.product_id, w.created_at, p.name, p.price, p.image_url, p.store_id
       FROM product_wishlist w
       JOIN products p ON p.id = w.product_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [req.user!.id]
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

cartRouter.get('/wishlist/:productId', async (req: AuthRequest, res: Response) => {
  try {
    const row = await db.query(
      `SELECT 1 FROM product_wishlist WHERE user_id = $1 AND product_id = $2`,
      [req.user!.id, req.params.productId]
    );
    res.json({ status: 'success', data: { wished: Boolean(row.rows[0]) } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

cartRouter.post('/wishlist/:productId', async (req: AuthRequest, res: Response) => {
  try {
    await db.query(
      `INSERT INTO product_wishlist (user_id, product_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [req.user!.id, req.params.productId]
    );
    res.status(201).json({ status: 'success', data: { wished: true } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

cartRouter.delete('/wishlist/:productId', async (req: AuthRequest, res: Response) => {
  try {
    await db.query(`DELETE FROM product_wishlist WHERE user_id = $1 AND product_id = $2`, [
      req.user!.id,
      req.params.productId,
    ]);
    res.json({ status: 'success', data: { wished: false } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});
