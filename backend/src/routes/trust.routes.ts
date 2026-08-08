import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { TrustSettlementService } from '../services/trust-settlement.service';

const db = new DatabaseService();
const trust = new TrustSettlementService(db);

export const trustRouter = Router();

trustRouter.get('/promise', async (req: any, res: Response) => {
  try {
    const data = await trust.getPromise(
      typeof req.query.country === 'string' ? req.query.country : undefined
    );
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustRouter.get('/agents', async (req: any, res: Response) => {
  try {
    const data = await trust.listCashAgents({
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      countryCode: typeof req.query.country === 'string' ? req.query.country : undefined,
      lat: req.query.lat != null ? Number(req.query.lat) : undefined,
      lng: req.query.lng != null ? Number(req.query.lng) : undefined,
    });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustRouter.get('/trip/:token', async (req: any, res: Response) => {
  try {
    const trip = await trust.getSharedTrip(req.params.token);
    if (!trip) {
      return res.status(404).json({ status: 'error', message: 'Share link expired or not found' });
    }
    res.json({
      status: 'success',
      data: {
        status: trip.status,
        pickup: trip.pickup_address,
        dropoff: trip.dropoff_address,
        fare: Number(trip.actual_fare || trip.estimated_fare || 0),
        currency: trip.currency || 'GHS',
        expiresAt: trip.expires_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Agent confirms deposit/pickup by code (no user auth — code is the secret). */
trustRouter.post('/cash-agent/confirm', async (req: any, res: Response) => {
  try {
    const data = await trust.confirmCashAgentCode(String(req.body.code || ''), {
      agentPhone: req.body.agentPhone,
    });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustRouter.use(authenticateToken);

trustRouter.get('/rails', async (req: AuthRequest, res: Response) => {
  try {
    const data = await trust.listRails(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustRouter.post('/rails', async (req: AuthRequest, res: Response) => {
  try {
    const row = await trust.upsertRail(req.user!.id, {
      railType: req.body.railType || req.body.type,
      provider: req.body.provider,
      accountNumber: req.body.accountNumber,
      accountMask: req.body.accountMask,
      isDefault: req.body.isDefault,
      bankCode: req.body.bankCode || req.body.bank_code,
      metadata: req.body.metadata,
    });
    res.status(201).json({ status: 'success', data: row });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustRouter.post('/cash-agent/deposit', async (req: AuthRequest, res: Response) => {
  try {
    const data = await trust.cashAgentDeposit(req.user!.id, {
      agentId: req.body.agentId,
      amount: Number(req.body.amount),
      currency: req.body.currency,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustRouter.post('/cash-agent/withdraw', async (req: AuthRequest, res: Response) => {
  try {
    const data = await trust.cashAgentWithdraw(req.user!.id, {
      agentId: req.body.agentId,
      amount: Number(req.body.amount),
      currency: req.body.currency,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustRouter.get('/receipts', async (req: AuthRequest, res: Response) => {
  try {
    const result = await trust.listReceipts(req.user!.id);
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustRouter.get('/receipts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const row = await trust.getReceipt(req.user!.id, req.params.id);
    if (!row) return res.status(404).json({ status: 'error', message: 'Receipt not found' });
    res.json({ status: 'success', data: row });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustRouter.post('/disputes', async (req: AuthRequest, res: Response) => {
  try {
    const row = await trust.createDispute(req.user!.id, {
      domain: req.body.domain,
      subjectId: req.body.subjectId || req.body.rideId || req.body.orderId,
      reason: req.body.reason,
      refundAmount: req.body.refundAmount != null ? Number(req.body.refundAmount) : undefined,
    });
    res.status(201).json({ status: 'success', data: row });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustRouter.get('/disputes', async (req: AuthRequest, res: Response) => {
  try {
    const result = await trust.listDisputes(req.user!.id);
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustRouter.post('/reliability/no-show', async (req: AuthRequest, res: Response) => {
  try {
    const data = await trust.compensateNoShow(
      req.user!.id,
      req.body.rideId,
      req.body.note
    );
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustRouter.post('/reliability/sla-breach', async (req: AuthRequest, res: Response) => {
  try {
    const data = await trust.recordSlaBreach(
      req.user!.id,
      req.body.rideId,
      Number(req.body.waitSeconds || 0)
    );
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustRouter.post('/share-trip', async (req: AuthRequest, res: Response) => {
  try {
    const data = await trust.createTripShare(req.user!.id, req.body.rideId);
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustRouter.get('/kyc-gate', async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.query.amount || 0);
    const roleRaw = String(req.query.role || 'customer').toLowerCase();
    const role =
      roleRaw === 'merchant' ? 'merchant' : roleRaw === 'driver' ? 'driver' : 'customer';
    try {
      const data = await trust.assertKycForPayout(req.user!.id, amount, role);
      res.json({ status: 'success', data: { ...data, allowed: true } });
    } catch (e: any) {
      res.json({
        status: 'success',
        data: { allowed: false, message: e.message },
      });
    }
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export const trustAdminRouter = Router();
trustAdminRouter.use(authenticateToken, requireAdmin);

trustAdminRouter.get('/sos', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await trust.listActiveSos();
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustAdminRouter.patch('/sos/:id/resolve', async (req: AuthRequest, res: Response) => {
  try {
    const row = await trust.resolveSos(req.params.id, req.user!.id, req.body.note);
    if (!row) return res.status(404).json({ status: 'error', message: 'SOS not found' });
    res.json({ status: 'success', data: row });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustAdminRouter.get('/disputes', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT d.*, COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'') AS customer_name
       FROM unified_disputes d
       LEFT JOIN users u ON u.id = d.user_id
       ORDER BY d.created_at DESC
       LIMIT 100`
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustAdminRouter.get('/reliability', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT e.*,
              COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'') AS customer_name
       FROM reliability_events e
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.created_at DESC
       LIMIT 100`
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustAdminRouter.get('/receipts', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT r.*,
              COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'') AS customer_name
       FROM settlement_receipts r
       LEFT JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC
       LIMIT 100`
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

trustAdminRouter.post('/cash-agent/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const data = await trust.confirmCashAgentCode(String(req.body.code || ''), {
      agentPhone: req.body.agentPhone || 'ops',
    });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustAdminRouter.post('/payouts/retry', async (_req: AuthRequest, res: Response) => {
  try {
    const { PaymentService } = require('../services/payment.service');
    const payments = new PaymentService(db);
    const data = await trust.retryPendingPayouts(payments);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

trustAdminRouter.patch('/disputes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const row = await trust.resolveDispute(req.params.id, {
      status: String(req.body.status || ''),
      refundAmount: req.body.refundAmount != null ? Number(req.body.refundAmount) : undefined,
      opsNote: req.body.opsNote,
      adminId: req.user!.id,
    });
    res.json({ status: 'success', data: row });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});
