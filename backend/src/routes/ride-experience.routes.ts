import crypto from 'crypto';
import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireCustomer,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { PaymentService } from '../services/payment.service';
import { PointsService } from '../services/points.service';
import maskedCommunication from '../services/masked-communication.service';
import { advanceReferralMilestone } from './referrals.routes';
import { RewardsEngineService } from '../services/rewards-engine.service';
import { DriverPerformanceService } from '../services/driver-performance.service';

const db = new DatabaseService();
const payments = new PaymentService(db);
const points = new PointsService(db);
const rewards = new RewardsEngineService(db);
const performance = new DriverPerformanceService(db);

export const rideExperienceRouter = Router();
export const sosRouter = Router();
export const publicTripShareRouter = Router();

rideExperienceRouter.post(
  '/:id/complete',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const ride = await db.query(`UPDATE rides SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING *`, [req.params.id]);
      if (!ride.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Ride not found' });
      }

      const customerId = ride.rows[0].customer_id;
      await rewards.emitActivityEvent(customerId, 'ride_completed', {
        description: `Ride ${ride.rows[0].id} completed`,
        rideId: ride.rows[0].id,
      });
      await advanceReferralMilestone(customerId, 'first_ride_completed');
      if (ride.rows[0].driver_id) {
        await performance.recalculateMetrics(ride.rows[0].driver_id);
      }

      res.json({ status: 'success', data: ride.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

rideExperienceRouter.post(
  '/:id/tip',
  authenticateToken,
  requireCustomer,
  async (req: AuthRequest, res: Response) => {
    try {
      const amount = Number(req.body.amount);
      if (!amount || amount <= 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid tip amount' });
      }

      const ride = await db.query(`SELECT * FROM rides WHERE id = $1 AND customer_id = $2`, [
        req.params.id,
        req.user!.id,
      ]);
      if (!ride.rows[0]?.driver_id) {
        return res.status(400).json({ status: 'error', message: 'Ride has no driver' });
      }

      const payment = await payments.initializePayment({
        userId: req.user!.id,
        amount,
        currency: req.body.currency || 'GHS',
        paymentType: 'ride',
        email: req.user!.email,
        fullName: 'MOVR Tip',
        countryCode: req.body.countryCode || 'GH',
        metadata: { tip: true, rideId: ride.rows[0].id, driverId: ride.rows[0].driver_id },
      });

      const tip = await db.query(
        `INSERT INTO ride_tips (ride_id, customer_id, driver_id, amount, currency, payment_reference)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          ride.rows[0].id,
          req.user!.id,
          ride.rows[0].driver_id,
          amount,
          req.body.currency || 'GHS',
          payment.reference || payment.txRef || null,
        ]
      );

      // 100% to driver — credit driver wallet
      await db.query(
        `INSERT INTO wallets (user_id, balance_fiat, currency)
         VALUES ($1, $2, 'GHS')
         ON CONFLICT (user_id) DO UPDATE SET balance_fiat = wallets.balance_fiat + $2, last_updated = NOW()`,
        [ride.rows[0].driver_id, amount]
      );

      res.status(201).json({ status: 'success', data: { tip: tip.rows[0], payment } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

rideExperienceRouter.get(
  '/:id/share-link',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const token = crypto.randomBytes(24).toString('hex');
      const expires = new Date(Date.now() + 4 * 60 * 60 * 1000);
      await db.query(
        `INSERT INTO ride_share_links (ride_id, token, expires_at) VALUES ($1,$2,$3)`,
        [req.params.id, token, expires]
      );
      const url = `${process.env.PUBLIC_WEB_URL || 'http://localhost:3003'}/trip/${token}`;
      res.json({ status: 'success', data: { url, token, expiresAt: expires } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

rideExperienceRouter.get(
  '/:id/masked-session',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const session = await maskedCommunication.createMaskedSession(
        req.params.id,
        req.body.customerPhone || '',
        req.body.driverPhone || ''
      );
      res.json({
        status: 'success',
        data: { ...session, chatRoom: maskedCommunication.chatRoom(req.params.id) },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

rideExperienceRouter.post(
  '/:id/chat',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const msg = await db.query(
        `INSERT INTO ride_messages (ride_id, sender_id, body) VALUES ($1,$2,$3) RETURNING *`,
        [req.params.id, req.user!.id, req.body.body]
      );
      res.status(201).json({
        status: 'success',
        data: { message: msg.rows[0], room: maskedCommunication.chatRoom(req.params.id) },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

sosRouter.post('/trigger', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rideId, lat, lng, triggeredBy } = req.body;
    const role = triggeredBy || req.user!.userType || 'rider';

    const ride = await db.query(`SELECT * FROM rides WHERE id = $1`, [rideId]);
    const snapshot: any = {
      ride: ride.rows[0] || null,
      location: { lat, lng },
      triggeredBy: role,
      emergencyNumber: process.env.DEFAULT_EMERGENCY_NUMBER || '191',
      vehicle: null,
    };

    if (ride.rows[0]?.driver_id) {
      const vehicle = await db.query(
        `SELECT document_type, document_number, verified, details
         FROM identity_verifications WHERE driver_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [ride.rows[0].driver_id]
      );
      snapshot.vehicle = vehicle.rows[0] || null;
    }

    const sos = await db.query(
      `INSERT INTO sos_emergencies (
         ride_id, driver_id, customer_id, sos_type, location, status, triggered_by, incident_snapshot
       ) VALUES (
         $1,
         $2,
         $3,
         $4,
         $5::jsonb,
         'active',
         $6,
         $7::jsonb
       ) RETURNING *`,
      [
        rideId,
        ride.rows[0]?.driver_id || req.user!.id,
        ride.rows[0]?.customer_id || req.user!.id,
        role === 'driver' ? 'driver' : 'customer',
        JSON.stringify({ lat, lng }),
        role === 'driver' ? 'driver' : 'rider',
        JSON.stringify(snapshot),
      ]
    );

    res.status(201).json({
      status: 'success',
      data: {
        sos: sos.rows[0],
        quickDial: `tel:${snapshot.emergencyNumber}`,
        snapshot,
      },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

sosRouter.get(
  '/admin/incidents/:id/report',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const sos = await db.query(`SELECT * FROM sos_emergencies WHERE id = $1`, [req.params.id]);
      if (!sos.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Not found' });
      }
      const report = {
        generatedAt: new Date().toISOString(),
        incident: sos.rows[0],
        note: 'Export for law-enforcement handoff on formal request — not live dispatch.',
      };
      res.json({ status: 'success', data: report });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

publicTripShareRouter.get('/:token', async (req: any, res: Response) => {
  try {
    const link = await db.query(
      `SELECT * FROM ride_share_links WHERE token = $1 AND expires_at > NOW()`,
      [req.params.token]
    );
    if (!link.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Link expired or invalid' });
    }
    const ride = await db.query(
      `SELECT id, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, created_at
       FROM rides WHERE id = $1`,
      [link.rows[0].ride_id]
    );
    res.json({
      status: 'success',
      data: {
        ride: ride.rows[0],
        room: `ride:${link.rows[0].ride_id}`,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
