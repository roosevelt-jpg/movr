import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { PaymentService } from '../services/payment.service';
import { DatabaseService } from '../services/database.service';

const db = new DatabaseService();
const paymentService = new PaymentService(db);

export const paymentWebhooksRouter = Router();
export const adminPaymentProvidersRouter = Router();
export const paymentsRouter = Router();

// --- Public webhooks (no JWT; signature-verified inside providers) ---

paymentWebhooksRouter.post('/paystack', async (req: any, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    await paymentService.handlePaystackWebhook(req.body, signature || '');
    res.sendStatus(200);
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

paymentWebhooksRouter.post('/flutterwave', async (req: any, res: Response) => {
  try {
    const signature =
      (req.headers['verif-hash'] as string) ||
      (req.headers['x-flutterwave-signature'] as string) ||
      '';
    await paymentService.handleFlutterwaveWebhook(req.body, signature);
    res.sendStatus(200);
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

paymentWebhooksRouter.post('/stripe', async (req: any, res: Response) => {
  try {
    const signature = (req.headers['stripe-signature'] as string) || '';
    // Prefer raw body (Buffer) set by express.raw on /webhooks/stripe
    const payload = req.rawBody || req.body;
    await paymentService.handleStripeWebhook(payload, signature);
    res.sendStatus(200);
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// --- Authenticated payment APIs ---

paymentsRouter.post('/initialize', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await paymentService.initializePayment({
      userId: req.user!.id,
      ...req.body,
    });
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

paymentsRouter.post('/verify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await paymentService.verifyPayment(req.body.txRef || req.body.reference, req.body.countryCode);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// --- Admin payment provider config ---

adminPaymentProvidersRouter.get(
  '/',
  authenticateToken,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      await paymentService.ensureProviderDefaults();
      const result = await paymentService.listProviderConfig();
      res.json({ status: 'success', data: result.rows });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

adminPaymentProvidersRouter.patch(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { provider } = req.body;
      if (provider !== 'paystack' && provider !== 'flutterwave' && provider !== 'stripe') {
        return res.status(400).json({ status: 'error', message: 'Invalid provider' });
      }
      const row = await paymentService.updateProviderConfig(req.params.id, provider, req.user?.id);
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);
