import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireDriver,
  requireAdmin,
  requireCustomer,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { PaymentService } from '../services/payment.service';
import { DriverPerformanceService } from '../services/driver-performance.service';
import { SubscriptionService } from '../services/subscription.service';
import { FeatureFlagsService } from '../services/feature-flags.service';
import { RewardsEngineService } from '../services/rewards-engine.service';
import { SettlementService } from '../services/settlement.service';
import { InboxService } from '../services/inbox.service';
import { KycAttestationService } from '../services/kyc-attestation.service';

const db = new DatabaseService();
const payments = new PaymentService(db);
const performance = new DriverPerformanceService(db);
const subscriptions = new SubscriptionService(db, payments);
const flags = new FeatureFlagsService(db);
const rewards = new RewardsEngineService(db);
const settlement = new SettlementService(db, payments);
const inbox = new InboxService(db);
const kyc = new KycAttestationService(db);

export const driverRouter = Router();
export const subscriptionsRouter = Router();
export const rentalsRouter = Router();
export const adminOpsRouter = Router();
export const adminFinanceRouter = Router();
export const adminRewardsRouter = Router();
export const inboxRouter = Router();

// --- Phase 13 driver performance ---
driverRouter.get(
  '/performance',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await performance.getPerformance(req.user!.id);
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

// --- Phase 14 subscriptions ---
subscriptionsRouter.get('/plans', async (_req, res: Response) => {
  try {
    const plans = await db.query(`SELECT * FROM plans ORDER BY amount`);
    res.json({ status: 'success', data: plans.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

subscriptionsRouter.post(
  '/quote',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const quote = await subscriptions.quote(
        req.user!.id,
        req.body.planId,
        req.body.paymentMethod || 'fiat'
      );
      res.json({ status: 'success', data: quote });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

subscriptionsRouter.post(
  '/activate',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await subscriptions.activate(req.user!.id, {
        planId: req.body.planId,
        paymentMethod: req.body.paymentMethod || 'fiat',
        email: req.body.email || req.user!.email,
        fullName: req.body.fullName || 'MOVR Driver',
        countryCode: req.body.countryCode || 'GH',
      });
      res.status(201).json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

subscriptionsRouter.get(
  '/active',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.getActiveSubscription(req.user!.id);
      res.json({ status: 'success', data: result.rows[0] || null });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

// --- Phase 15 rentals ---
rentalsRouter.get('/pricing', async (req: any, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM rental_pricing
       WHERE ($1::text IS NULL OR vehicle_type_id = $1)
       ORDER BY vehicle_type_id, rental_type, rate_unit`,
      [req.query.vehicleTypeId || null]
    );
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

rentalsRouter.get(
  '/self-drive-available',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const enabled = await flags.isEnabled('self_drive_rentals', req.user!.id, req.query.city as string);
    res.json({ status: 'success', data: { enabled } });
  }
);

rentalsRouter.post(
  '/book',
  authenticateToken,
  requireCustomer,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        vehicleTypeId = 'standard',
        rentalType = 'chauffeur',
        rateUnit = 'daily',
        duration = 1,
        pickupAddress,
        licenseUploadUrl,
        countryCode = 'GH',
        email,
        fullName,
      } = req.body;

      if (rentalType === 'self_drive') {
        const enabled = await flags.isEnabled('self_drive_rentals', req.user!.id);
        if (!enabled) {
          return res.status(403).json({ status: 'error', message: 'Self-drive not available yet' });
        }
      }

      const pricing = await db.query(
        `SELECT * FROM rental_pricing
         WHERE vehicle_type_id = $1 AND rental_type = $2::rental_type AND rate_unit = $3::rental_rate_unit
         LIMIT 1`,
        [vehicleTypeId, rentalType, rateUnit]
      );
      if (!pricing.rows[0]) {
        return res.status(400).json({ status: 'error', message: 'No pricing for selection' });
      }

      const rate = Number(pricing.rows[0].rate_amount);
      const total = rate * Number(duration);

      const rental = await db.query(
        `INSERT INTO rentals (
           user_id, vehicle_type_id, rental_type, rate_unit, duration,
           rate_amount, total_amount, currency, status, pickup_address
         ) VALUES ($1,$2,$3::rental_type,$4::rental_rate_unit,$5,$6,$7,$8,'pending',$9)
         RETURNING *`,
        [
          req.user!.id,
          vehicleTypeId,
          rentalType,
          rateUnit,
          duration,
          rate,
          total,
          pricing.rows[0].currency_code,
          pickupAddress || null,
        ]
      );

      let depositHold: any = null;
      if (rentalType === 'self_drive') {
        const depositAmount = Math.max(100, total * 0.2);
        if (!licenseUploadUrl) {
          return res.status(400).json({ status: 'error', message: 'License upload required' });
        }

        depositHold = await payments.initializePreauthorization({
          amount: depositAmount,
          currency: pricing.rows[0].currency_code,
          email: email || req.user!.email,
          fullName: fullName || 'MOVR Renter',
          countryCode,
          metadata: { rentalId: rental.rows[0].id, type: 'rental_deposit' },
        });

        await db.query(
          `INSERT INTO self_drive_requirements
             (rental_id, license_upload_url, deposit_amount, deposit_status, license_verified)
           VALUES ($1,$2,$3,$4,FALSE)`,
          [
            rental.rows[0].id,
            licenseUploadUrl,
            depositAmount,
            depositHold.success ? 'held' : 'pending',
          ]
        );

        if (depositHold.reference) {
          await db.query(`UPDATE rentals SET deposit_hold_reference = $1 WHERE id = $2`, [
            depositHold.reference,
            rental.rows[0].id,
          ]);
        }
      }

      const payment = await payments.initializePayment({
        userId: req.user!.id,
        amount: total,
        currency: pricing.rows[0].currency_code,
        paymentType: 'rental',
        email: email || req.user!.email,
        fullName: fullName || 'MOVR Renter',
        countryCode,
        metadata: { rentalId: rental.rows[0].id },
      });

      res.status(201).json({
        status: 'success',
        data: { rental: rental.rows[0], payment, depositHold },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

// --- Phase 16 admin rewards rules ---
adminRewardsRouter.get('/', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await rewards.listRules();
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminRewardsRouter.patch(
  '/:eventType',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await rewards.updateRule(req.params.eventType, req.body);
      res.json({ status: 'success', data: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

// --- Phase 17 ops console ---
adminOpsRouter.post(
  '/rides/:id/force-cancel',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.body.reason) {
        return res.status(400).json({ status: 'error', message: 'reason required' });
      }
      const before = await db.query(`SELECT * FROM rides WHERE id = $1`, [req.params.id]);
      const after = await db.query(
        `UPDATE rides SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      await db.query(
        `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, before_state, after_state, metadata)
         VALUES ($1,'force_cancel','ride',$2,$3,$4::jsonb,$5::jsonb,'{}'::jsonb)`,
        [
          req.user!.id,
          req.params.id,
          req.body.reason,
          JSON.stringify(before.rows[0] || {}),
          JSON.stringify(after.rows[0] || {}),
        ]
      );
      if (before.rows[0]?.driver_id) {
        await performance.recalculateMetrics(before.rows[0].driver_id);
      }
      res.json({ status: 'success', data: after.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminOpsRouter.post(
  '/rides/:id/adjust-fare',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.body.reason || req.body.amount == null) {
        return res.status(400).json({ status: 'error', message: 'amount and reason required' });
      }
      const before = await db.query(`SELECT * FROM rides WHERE id = $1`, [req.params.id]);
      const after = await db.query(
        `UPDATE rides SET actual_fare = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [req.body.amount, req.params.id]
      );
      await db.query(
        `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, before_state, after_state)
         VALUES ($1,'adjust_fare','ride',$2,$3,$4::jsonb,$5::jsonb)`,
        [
          req.user!.id,
          req.params.id,
          req.body.reason,
          JSON.stringify(before.rows[0] || {}),
          JSON.stringify(after.rows[0] || {}),
        ]
      );
      res.json({ status: 'success', data: after.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminOpsRouter.post(
  '/orders/:id/force-cancel',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.body.reason) {
        return res.status(400).json({ status: 'error', message: 'reason required' });
      }
      const before = await db.query(`SELECT * FROM marketplace_orders WHERE id = $1`, [
        req.params.id,
      ]);
      const after = await db.query(
        `UPDATE marketplace_orders SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      await db.query(
        `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, before_state, after_state)
         VALUES ($1,'force_cancel','order',$2,$3,$4::jsonb,$5::jsonb)`,
        [
          req.user!.id,
          req.params.id,
          req.body.reason,
          JSON.stringify(before.rows[0] || {}),
          JSON.stringify(after.rows[0] || {}),
        ]
      );
      res.json({ status: 'success', data: after.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminOpsRouter.get('/notes', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM ops_notes
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC`,
      [req.query.entityType, req.query.entityId]
    );
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminOpsRouter.post('/notes', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const row = await db.query(
      `INSERT INTO ops_notes (entity_type, entity_id, author_admin_id, note)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.body.entityType, req.body.entityId, req.user!.id, req.body.note]
    );
    res.status(201).json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// --- Phase 18 finance ---
adminFinanceRouter.get('/gmv', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const rows = await settlement.listGmv({
      serviceType: req.query.serviceType,
      country: req.query.country,
      from: req.query.from,
      to: req.query.to,
    });
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminFinanceRouter.post(
  '/payout-batches',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const batch = await settlement.createPayoutBatch(
        req.body.recipientType || 'driver',
        new Date(req.body.periodStart),
        new Date(req.body.periodEnd),
        req.user!.id
      );
      res.status(201).json({ status: 'success', data: batch });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminFinanceRouter.get(
  '/payout-batches/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const batch = await settlement.getBatch(req.params.id);
      res.json({ status: 'success', data: batch });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

adminFinanceRouter.post(
  '/payout-batches/:id/execute',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const batch = await settlement.executePayoutBatch(req.params.id, req.body.countryCode || 'GH');
      res.json({ status: 'success', data: batch });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminFinanceRouter.get(
  '/reconciliation',
  authenticateToken,
  requireAdmin,
  async (req: any, res: Response) => {
    try {
      const csv = await settlement.reconciliationCsv(req.query.from, req.query.to);
      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=reconciliation.csv');
        return res.send(csv);
      }
      res.json({ status: 'success', data: csv });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminFinanceRouter.post(
  '/rollup',
  authenticateToken,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const result = await settlement.rollupGmv();
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

// --- Phase 19 inbox ---
inboxRouter.use(authenticateToken);

inboxRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await inbox.list(req.user!.id, {
      category: req.query.category as string,
      limit: Number(req.query.limit || 50),
      offset: Number(req.query.offset || 0),
    });
    const unread = await inbox.unreadCount(req.user!.id);
    res.json({ status: 'success', data: { messages: rows.rows, unread } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

inboxRouter.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const row = await inbox.markRead(req.user!.id, req.params.id);
    res.json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

inboxRouter.patch('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    await inbox.markAllRead(req.user!.id);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export { performance, rewards, settlement, inbox, kyc };
