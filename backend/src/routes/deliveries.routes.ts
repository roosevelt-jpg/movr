import crypto from 'crypto';
import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireCustomer,
  requireDriver,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { PaymentService } from '../services/payment.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { RewardsEngineService } from '../services/rewards-engine.service';

const db = new DatabaseService();
const payments = new PaymentService(db);
const matching = new MatchingEngineService(db, null, { broadcastToDrivers: () => undefined } as any);
const rewards = new RewardsEngineService(db);

export const deliveriesRouter = Router();

async function deliveryFee(speedTier: 'standard' | 'express') {
  const cfg = await db.query(`SELECT * FROM delivery_pricing_config WHERE id = 1`);
  const base = Number(cfg.rows[0]?.standard_fee || 10);
  const mult = Number(cfg.rows[0]?.express_multiplier || 1.5);
  return speedTier === 'express' ? base * mult : base;
}

deliveriesRouter.post('/', authenticateToken, requireCustomer, async (req: AuthRequest, res: Response) => {
  try {
    const {
      pickupAddress,
      dropoffAddress,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      speedTier = 'standard',
      receiverName,
      receiverPhone,
    } = req.body;

    const fee = await deliveryFee(speedTier);
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    const row = await db.query(
      `INSERT INTO deliveries (
         sender_id, receiver_name, receiver_phone, pickup_address, dropoff_address,
         pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, speed_tier, otp_code, delivery_fee, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::speed_tier,$11,$12,'requested')
       RETURNING *`,
      [
        req.user!.id,
        receiverName || null,
        receiverPhone || null,
        pickupAddress,
        dropoffAddress,
        pickupLat || null,
        pickupLng || null,
        dropoffLat || null,
        dropoffLng || null,
        speedTier,
        otp,
        fee,
      ]
    );

    if (pickupLat != null && pickupLng != null) {
      await matching.assignNearestDriver('delivery', row.rows[0].id, pickupLat, pickupLng);
      // assignNearestDriver currently updates marketplace_orders — also set courier on deliveries
      const drivers = await matching.findBestDrivers(pickupLat, pickupLng);
      if (drivers[0]?.id) {
        await db.query(
          `UPDATE deliveries SET courier_id = $1, status = 'assigned', updated_at = NOW() WHERE id = $2`,
          [drivers[0].id, row.rows[0].id]
        );
      }
    }

    const fresh = await db.query(`SELECT * FROM deliveries WHERE id = $1`, [row.rows[0].id]);
    res.status(201).json({
      status: 'success',
      data: { ...fresh.rows[0], otp_code: undefined, otpHint: 'Shared with receiver' },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

deliveriesRouter.post(
  '/:id/proof',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const { proofOfDeliveryUrl, receiverSignatureUrl } = req.body;
      const result = await db.query(
        `UPDATE deliveries SET
           proof_of_delivery_url = COALESCE($1, proof_of_delivery_url),
           receiver_signature_url = COALESCE($2, receiver_signature_url),
           updated_at = NOW()
         WHERE id = $3 AND courier_id = $4
         RETURNING id, proof_of_delivery_url, receiver_signature_url, status`,
        [proofOfDeliveryUrl || null, receiverSignatureUrl || null, req.params.id, req.user!.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Delivery not found' });
      }
      res.json({ status: 'success', data: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

deliveriesRouter.post(
  '/:id/verify-otp',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const delivery = await db.query(`SELECT * FROM deliveries WHERE id = $1 AND courier_id = $2`, [
        req.params.id,
        req.user!.id,
      ]);
      const row = delivery.rows[0];
      if (!row) {
        return res.status(404).json({ status: 'error', message: 'Delivery not found' });
      }
      if (String(req.body.otp) !== String(row.otp_code)) {
        return res.status(400).json({ status: 'error', message: 'Invalid OTP' });
      }

      const updated = await db.query(
        `UPDATE deliveries SET status = 'delivered', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [row.id]
      );

      await rewards.emitActivityEvent(row.sender_id, 'delivery_completed', {
        description: `Parcel ${row.id} delivered`,
        deliveryId: row.id,
      });

      res.json({ status: 'success', data: updated.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

deliveriesRouter.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(`SELECT * FROM deliveries WHERE id = $1`, [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    const { otp_code, ...safe } = result.rows[0];
    res.json({ status: 'success', data: safe });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
