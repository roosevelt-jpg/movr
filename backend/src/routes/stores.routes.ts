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
    const products = await marketplace.getStoreProducts(req.params.id);
    res.json({ status: 'success', data: products });
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
