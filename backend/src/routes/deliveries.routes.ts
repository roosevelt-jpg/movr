import multer from 'multer';
import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireCustomer,
  requireDriver,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { RewardsEngineService } from '../services/rewards-engine.service';
import {
  assetUrlFromMulterFile,
  multerAssetStorage,
  saveAssetBuffer,
} from '../utils/asset-storage';

const db = new DatabaseService();
const matching = new MatchingEngineService(db, null, { broadcastToDrivers: () => undefined } as any);
const rewards = new RewardsEngineService(db);

const upload = multer({
  storage: multerAssetStorage({ filenamePrefix: 'pod-' }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const deliveriesRouter = Router();

async function deliveryFee(speedTier: 'standard' | 'express') {
  const cfg = await db.query(`SELECT * FROM delivery_pricing_config WHERE id = 1`);
  const base = Number(cfg.rows[0]?.standard_fee || 18);
  const mult = Number(cfg.rows[0]?.express_multiplier || 32 / 18);
  const express = Math.round(base * mult);
  return {
    standard: base,
    express,
    fee: speedTier === 'express' ? express : base,
    expressMultiplier: mult,
  };
}

deliveriesRouter.get('/quote', async (req: AuthRequest, res: Response) => {
  try {
    const tier = (String(req.query.tier || 'standard') === 'express' ? 'express' : 'standard') as
      | 'standard'
      | 'express';
    const pricing = await deliveryFee(tier);
    res.json({
      status: 'success',
      data: {
        tier,
        standardFee: pricing.standard,
        expressFee: pricing.express,
        fee: pricing.fee,
        expressMultiplier: pricing.expressMultiplier,
        currency: 'GHS',
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

deliveriesRouter.post('/', authenticateToken, requireCustomer, async (req: AuthRequest, res: Response) => {
  try {
    const {
      pickupAddress,
      dropoffAddress,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      speedTier,
      tier,
      receiverName,
      receiverPhone,
    } = req.body;

    const speed = (speedTier || tier || 'standard') === 'express' ? 'express' : 'standard';
    const pricing = await deliveryFee(speed);
    const otp = String(Math.floor(1000 + Math.random() * 9000));

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
        speed,
        otp,
        pricing.fee,
      ]
    );

    if (pickupLat != null && pickupLng != null) {
      await matching.assignNearestDriver('delivery', row.rows[0].id, pickupLat, pickupLng).catch(() => undefined);
      const drivers = await matching.findBestDrivers(pickupLat, pickupLng).catch(() => []);
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

deliveriesRouter.get('/mine', authenticateToken, requireDriver, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT id, pickup_address, dropoff_address, speed_tier, status, delivery_fee, created_at
       FROM deliveries WHERE courier_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user!.id]
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Multipart or JSON body — stores proof_of_delivery_url + receiver_signature_url */
deliveriesRouter.post(
  '/:id/proof',
  authenticateToken,
  requireDriver,
  upload.fields([
    { name: 'proof', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
      const proofFile = files?.proof?.[0];
      const sigFile = files?.signature?.[0];

      let proofOfDeliveryUrl = req.body.proofOfDeliveryUrl || req.body.proof_of_delivery_url || null;
      let receiverSignatureUrl =
        req.body.receiverSignatureUrl || req.body.receiver_signature_url || null;

      if (proofFile) proofOfDeliveryUrl = assetUrlFromMulterFile(proofFile);
      if (sigFile) receiverSignatureUrl = assetUrlFromMulterFile(sigFile);

      if (typeof req.body.proofBase64 === 'string' && req.body.proofBase64.startsWith('data:')) {
        const buf = Buffer.from(req.body.proofBase64.split(',')[1] || '', 'base64');
        proofOfDeliveryUrl = saveAssetBuffer(buf, {
          mime: 'image/jpeg',
          filename: `pod-${Date.now()}.jpg`,
        }).url;
      }
      if (typeof req.body.signatureBase64 === 'string' && req.body.signatureBase64.startsWith('data:')) {
        const buf = Buffer.from(req.body.signatureBase64.split(',')[1] || '', 'base64');
        receiverSignatureUrl = saveAssetBuffer(buf, {
          mime: 'image/png',
          filename: `sig-${Date.now()}.png`,
        }).url;
      }

      const result = await db.query(
        `UPDATE deliveries SET
           proof_of_delivery_url = COALESCE($1, proof_of_delivery_url),
           receiver_signature_url = COALESCE($2, receiver_signature_url),
           updated_at = NOW()
         WHERE id = $3 AND (courier_id = $4 OR courier_id IS NULL)
         RETURNING id, proof_of_delivery_url, receiver_signature_url, status`,
        [proofOfDeliveryUrl, receiverSignatureUrl, req.params.id, req.user!.id]
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
      const delivery = await db.query(`SELECT * FROM deliveries WHERE id = $1`, [req.params.id]);
      const row = delivery.rows[0];
      if (!row) {
        return res.status(404).json({ status: 'error', message: 'Delivery not found' });
      }
      if (row.courier_id && row.courier_id !== req.user!.id) {
        return res.status(403).json({ status: 'error', message: 'Not your delivery' });
      }
      if (String(req.body.otp) !== String(row.otp_code)) {
        return res.status(400).json({ status: 'error', message: 'Invalid OTP' });
      }

      const updated = await db.query(
        `UPDATE deliveries SET status = 'delivered', courier_id = COALESCE(courier_id, $2), updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [row.id, req.user!.id]
      );

      await rewards.emitActivityEvent(row.sender_id, 'delivery_completed', {
        description: `Parcel ${row.id} delivered`,
        deliveryId: row.id,
      });

      const { otp_code, ...safe } = updated.rows[0];
      res.json({ status: 'success', data: safe });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

deliveriesRouter.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(`SELECT * FROM deliveries WHERE id = $1`, [req.params.id]);
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ status: 'error', message: 'Delivery not found' });
    }
    const uid = req.user!.id;
    const allowed =
      row.courier_id === uid ||
      row.sender_id === uid ||
      req.user?.user_type === 'admin' ||
      !row.courier_id;
    if (!allowed) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    const { otp_code, ...safe } = row;
    const ref = String(row.id).replace(/-/g, '').slice(-4).toUpperCase();
    const customer = row.receiver_name || 'Customer';
    res.json({
      status: 'success',
      data: {
        ...safe,
        orderLabel: `Order #${ref} · ${customer}`,
        otpLength: 4,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
