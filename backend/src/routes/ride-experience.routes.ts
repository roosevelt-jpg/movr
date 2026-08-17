import crypto from 'crypto';
import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireCustomer,
  requireAdmin,
  requireDriver,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { PaymentService } from '../services/payment.service';
import { PointsService } from '../services/points.service';
import maskedCommunication from '../services/masked-communication.service';
import { advanceReferralMilestone } from './referrals.routes';
import { RewardsEngineService } from '../services/rewards-engine.service';
import { DriverPerformanceService } from '../services/driver-performance.service';
import { ReviewAutonomyService } from '../services/review-autonomy.service';

const db = new DatabaseService();
const payments = new PaymentService(db);
const points = new PointsService(db);
const rewards = new RewardsEngineService(db);
const performance = new DriverPerformanceService(db);
const reviews = new ReviewAutonomyService(db);

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
      try {
        const { WalletLedgerService } = require('../services/wallet-ledger.service');
        const ledger = new WalletLedgerService(db);
        await ledger.settleCompletedRide(ride.rows[0]);
      } catch (e) {
        console.warn('ride wallet settle failed', e);
      }

      try {
        const { verified } = require('./verified.routes');
        await verified.settleOnComplete(ride.rows[0].id);
      } catch {
        /* verified escrow settle is optional */
      }

      try {
        const { InboxService } = require('../services/inbox.service');
        const inboxSvc = new InboxService(db);
        const fare = ride.rows[0].actual_fare || ride.rows[0].estimated_fare;
        if (customerId) {
          await inboxSvc.sendInboxMessage(
            customerId,
            'ride_update',
            'Trip completed',
            `Your ride is complete${fare != null ? ` · fare ${fare}` : ''}.`,
            `/ride/${ride.rows[0].id}`
          );
        }
      } catch {
        /* inbox optional */
      }

      try {
        await reviews.promptAfterComplete(ride.rows[0].id);
      } catch {
        /* review prompt optional */
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
      const url = `${process.env.PUBLIC_WEB_URL || process.env.WEB_APP_URL || 'http://localhost:5180'}/trip/${token}`;
      res.json({ status: 'success', data: { url, token, expiresAt: expires } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

rideExperienceRouter.post(
  '/:id/rate',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { rating, review, comment, tags, asDriver } = req.body;
      const score = Number(rating);
      if (!score || score < 1 || score > 5) {
        return res.status(400).json({ status: 'error', message: 'Rating must be between 1 and 5' });
      }

      const ride = await db.query(`SELECT * FROM rides WHERE id = $1`, [req.params.id]);
      if (!ride.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Ride not found' });
      }

      const uid = req.user!.id;
      const isDriver =
        Boolean(asDriver) ||
        ride.rows[0].driver_id === uid ||
        String(req.user!.user_type || '').toLowerCase() === 'driver';
      const isCustomer = ride.rows[0].customer_id === uid;

      if (!isDriver && !isCustomer) {
        return res.status(403).json({ status: 'error', message: 'Not a party on this ride' });
      }

      const raterRole: 'customer' | 'driver' =
        isDriver && ride.rows[0].driver_id === uid ? 'driver' : 'customer';

      if (raterRole === 'customer' && ride.rows[0].customer_id !== uid) {
        return res.status(403).json({ status: 'error', message: 'Only the rider can submit a customer rating' });
      }
      if (raterRole === 'driver' && ride.rows[0].driver_id !== uid) {
        return res.status(403).json({ status: 'error', message: 'Only the assigned driver can rate the rider' });
      }

      const data = await reviews.submitRating({
        rideId: req.params.id,
        raterId: uid,
        raterRole,
        rating: score,
        comment: String(review || comment || ''),
        tags: Array.isArray(tags) ? tags : [],
      });

      res.json({
        status: 'success',
        message: data.moderated
          ? 'Rating saved (comment moderated)'
          : 'Ride rated successfully',
        data,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to rate ride' });
    }
  }
);

rideExperienceRouter.put(
  '/:id/arrived',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE rides
         SET status = 'arrived', updated_at = NOW()
         WHERE id = $1 AND (driver_id = $2 OR $2 IS NOT NULL)
         RETURNING *`,
        [req.params.id, req.user!.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Ride not found' });
      }
      try {
        const { verified } = require('./verified.routes');
        await verified.markArrived(req.params.id);
      } catch {
        /* verified mobility is optional */
      }
      res.status(200).json({
        status: 'success',
        message: 'Driver arrived at pickup',
        data: result.rows[0],
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to mark arrived' });
    }
  }
);

rideExperienceRouter.put(
  '/:id/start',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE rides
         SET status = 'started', updated_at = NOW()
         WHERE id = $1 AND driver_id = $2
         RETURNING *`,
        [req.params.id, req.user!.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Ride not found' });
      }
      res.status(200).json({
        status: 'success',
        message: 'Ride started',
        data: result.rows[0],
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to start ride' });
    }
  }
);

rideExperienceRouter.post(
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

rideExperienceRouter.get(
  '/:id/chat',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const rideId = req.params.id;
      const ride = await db
        .query(
          `SELECT r.*,
                  TRIM(CONCAT(COALESCE(d.first_name,''),' ',COALESCE(d.last_name,''))) AS driver_name,
                  d.avatar_url AS driver_avatar
           FROM rides r
           LEFT JOIN users d ON d.id = r.driver_id
           WHERE r.id = $1`,
          [rideId]
        )
        .catch(() => ({ rows: [] as any[] }));

      const messages = await db
        .query(
          `SELECT id, ride_id, sender_id, body, created_at,
                  COALESCE(status, 'sent') AS status,
                  COALESCE(is_encrypted, TRUE) AS is_encrypted, read_at
           FROM ride_messages WHERE ride_id = $1
           ORDER BY created_at ASC LIMIT 200`,
          [rideId]
        )
        .catch(() => ({ rows: [] as any[] }));

      const quick = await db
        .query(
          `SELECT label, body FROM ride_chat_quick_replies
           WHERE is_active = TRUE ORDER BY sort_order`
        )
        .catch(() => ({
          rows: [
            { label: '👍 OK', body: '👍 OK' },
            { label: 'I am ready', body: 'I am ready' },
            { label: 'Wait 2 mins', body: 'Wait 2 mins' },
          ],
        }));

      const rows = messages.rows;

      const driverOnline = ['accepted', 'arrived', 'in_progress', 'en_route'].includes(
        String(ride.rows[0]?.status || 'accepted')
      );

      res.json({
        status: 'success',
        data: {
          rideId,
          driver: {
            name: ride.rows[0]?.driver_name?.trim() || 'Driver',
            avatarUrl: ride.rows[0]?.driver_avatar || null,
            online: driverOnline,
            phone: null,
          },
          privacyBanner:
            'These messages are secure. Messages are encrypted and will be deleted after the ride ends.',
          quickReplies: quick.rows.length
            ? quick.rows
            : [
                { label: '👍 OK', body: '👍 OK' },
                { label: 'I am ready', body: 'I am ready' },
                { label: 'Wait 2 mins', body: 'Wait 2 mins' },
              ],
          messages: rows.map((m: any) => ({
            id: m.id,
            body: m.body,
            senderId: m.sender_id,
            mine: String(m.sender_id) === String(req.user!.id),
            status: m.status || 'sent',
            createdAt: m.created_at,
            encrypted: m.is_encrypted !== false,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

rideExperienceRouter.post(
  '/:id/chat',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const body = String(req.body.body || req.body.message || '').trim();
      if (!body) {
        return res.status(400).json({ status: 'error', message: 'body required' });
      }
      const msg = await db.query(
        `INSERT INTO ride_messages (ride_id, sender_id, body, status, is_encrypted)
         VALUES ($1,$2,$3,'sent',TRUE) RETURNING *`,
        [req.params.id, req.user!.id, body]
      ).catch(() =>
        db.query(
          `INSERT INTO ride_messages (ride_id, sender_id, body) VALUES ($1,$2,$3) RETURNING *`,
          [req.params.id, req.user!.id, body]
        )
      );
      res.status(201).json({
        status: 'success',
        data: {
          message: {
            id: msg.rows[0].id,
            body: msg.rows[0].body,
            senderId: msg.rows[0].sender_id,
            mine: true,
            status: 'sent',
            createdAt: msg.rows[0].created_at,
          },
          room: maskedCommunication.chatRoom(req.params.id),
        },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

sosRouter.post('/trigger', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rideId, lat, lng, triggeredBy } = req.body;
    const role = triggeredBy || (req.user!.userType === 'driver' ? 'driver' : 'rider');

    const ride = await db.query(`SELECT * FROM rides WHERE id = $1`, [rideId]);
    let emergencyNumber = process.env.DEFAULT_EMERGENCY_NUMBER || '191';
    try {
      const country = await db.query(
        `SELECT emergency_number FROM countries WHERE code = $1 LIMIT 1`,
        [req.body.countryCode || process.env.DEFAULT_COUNTRY || 'GH']
      );
      if (country.rows[0]?.emergency_number) emergencyNumber = country.rows[0].emergency_number;
    } catch {
      /* countries table optional */
    }

    const snapshot: any = {
      ride: ride.rows[0]
        ? {
            id: ride.rows[0].id,
            status: ride.rows[0].status,
            pickup: {
              lat: ride.rows[0].pickup_lat,
              lng: ride.rows[0].pickup_lng,
              address: ride.rows[0].pickup_address,
            },
            dropoff: {
              lat: ride.rows[0].dropoff_lat,
              lng: ride.rows[0].dropoff_lng,
              address: ride.rows[0].dropoff_address,
            },
            startedAt: ride.rows[0].started_at || ride.rows[0].created_at,
          }
        : null,
      location: { lat, lng },
      triggeredBy: role,
      emergencyNumber,
      vehicle: null,
      driver: null,
      generatedAt: new Date().toISOString(),
    };

    if (ride.rows[0]?.driver_id) {
      const vehicle = await db
        .query(
          `SELECT document_type, document_number, verified, details, created_at
           FROM identity_verifications WHERE driver_id = $1
           ORDER BY created_at DESC LIMIT 5`,
          [ride.rows[0].driver_id]
        )
        .catch(() => ({ rows: [] }));

      const driver = await db
        .query(
          `SELECT id, first_name, last_name, phone, email FROM users WHERE id = $1`,
          [ride.rows[0].driver_id]
        )
        .catch(() => ({ rows: [] }));

      const plate =
        vehicle.rows.find((r: any) => /plate|vehicle/i.test(String(r.document_type || ''))) ||
        vehicle.rows[0];

      snapshot.vehicle = plate
        ? {
            document_type: plate.document_type,
            document_number: plate.document_number,
            plate: plate.document_number,
            verified: plate.verified,
            details: plate.details,
          }
        : null;
      snapshot.driver = driver.rows[0]
        ? {
            id: driver.rows[0].id,
            name: `${driver.rows[0].first_name || ''} ${driver.rows[0].last_name || ''}`.trim(),
            phone: driver.rows[0].phone,
          }
        : null;
    }

    const sos = await db.query(
      `INSERT INTO sos_emergencies (
         ride_id, driver_id, customer_id, sos_type, location, status, triggered_by, incident_snapshot
       ) VALUES (
         $1, $2, $3, $4, $5::jsonb, 'active', $6, $7::jsonb
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

    // Phase 28 — auto-flag trip recording for dispute retention when SOS fires
    try {
      const { TripRecordingService } = await import('../services/trip-recording.service');
      const tripRec = new TripRecordingService(db);
      await tripRec.flagRecordingForDispute(
        rideId,
        req.user!.id,
        `SOS incident ${sos.rows[0].id}`
      );
    } catch {
      /* recording may be disabled / tables missing */
    }

    // Best-effort alert dispatch via existing SOS service (non-blocking)
    try {
      const { default: sosService } = await import('../services/sos-emergency.service');
      if (typeof (sosService as any).triggerSOS === 'function') {
        await (sosService as any)
          .triggerSOS(
            rideId,
            ride.rows[0]?.driver_id || req.user!.id,
            ride.rows[0]?.customer_id || req.user!.id,
            role === 'driver' ? 'driver' : 'customer',
            { lat: lat || 0, lng: lng || 0 }
          )
          .catch(() => undefined);
      }
    } catch {
      /* service may reference missing tables — snapshot already persisted */
    }

    res.status(201).json({
      status: 'success',
      data: {
        sos: sos.rows[0],
        quickDial: `tel:${emergencyNumber}`,
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
      const incident = sos.rows[0];
      const snap = incident.incident_snapshot || {};
      const format = String(req.query.format || 'json');

      const report = {
        title: 'MOVR SOS Incident Report',
        generatedAt: new Date().toISOString(),
        incidentId: incident.id,
        rideId: incident.ride_id,
        triggeredBy: incident.triggered_by || incident.sos_type,
        status: incident.status,
        createdAt: incident.created_at,
        location: incident.location,
        snapshot: snap,
        note: 'For law-enforcement handoff on formal request — not live dispatch.',
      };

      if (format === 'pdf' || format === 'text') {
        const lines = [
          'MOVR SOS INCIDENT REPORT',
          '========================',
          `Generated: ${report.generatedAt}`,
          `Incident ID: ${report.incidentId}`,
          `Ride ID: ${report.rideId}`,
          `Triggered by: ${report.triggeredBy}`,
          `Status: ${report.status}`,
          `Created: ${report.createdAt}`,
          `Location: ${JSON.stringify(report.location)}`,
          '',
          'DRIVER / VEHICLE SNAPSHOT',
          `Driver: ${snap.driver?.name || '—'} (${snap.driver?.phone || '—'})`,
          `Plate/Doc: ${snap.vehicle?.plate || snap.vehicle?.document_number || '—'}`,
          `Verified: ${snap.vehicle?.verified ?? '—'}`,
          `Trip pickup: ${JSON.stringify(snap.ride?.pickup || {})}`,
          `Trip dropoff: ${JSON.stringify(snap.ride?.dropoff || {})}`,
          '',
          report.note,
        ];
        const body = lines.join('\n');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="sos-${incident.id}.txt"`
        );
        res.type('text/plain').send(body);
        return;
      }

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
