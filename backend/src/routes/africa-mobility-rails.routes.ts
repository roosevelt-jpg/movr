import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireCustomer,
  requireDriver,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { RideBookingService } from '../services/ride-booking.service';
import { AfricaMobilityRailsService } from '../services/africa-mobility-rails.service';

const db = new DatabaseService();
const matching = new MatchingEngineService(db, null, {
  broadcastToDrivers: () => undefined,
  broadcastToRide: () => undefined,
} as any);
const booking = new RideBookingService(db, matching);
const rails = new AfricaMobilityRailsService(db, matching, booking);

export const africaRailsRouter = Router();
export const africaRailsAdminRouter = Router();

africaRailsRouter.get('/catalog', async (req: any, res: Response) => {
  try {
    const data = await rails.getCatalog(String(req.query.countryCode || 'GH'));
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/quote', async (req: any, res: Response) => {
  try {
    const data = await rails.quote({
      pickupLat: Number(req.body.pickupLat),
      pickupLng: Number(req.body.pickupLng),
      dropoffLat: Number(req.body.dropoffLat),
      dropoffLng: Number(req.body.dropoffLng),
      countryCode: req.body.countryCode || 'GH',
      fareMode: req.body.fareMode,
      vehicleCode: req.body.vehicleCode || req.body.vehicleTypeCode,
    });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/book', authenticateToken, requireCustomer, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.book({
      userId: req.user!.id,
      pickupLat: Number(req.body.pickupLat),
      pickupLng: Number(req.body.pickupLng),
      dropoffLat: Number(req.body.dropoffLat),
      dropoffLng: Number(req.body.dropoffLng),
      pickupAddress: req.body.pickupAddress,
      dropoffAddress: req.body.dropoffAddress,
      vehicleTypeCode: req.body.vehicleTypeCode || req.body.rideType || 'economy',
      fareMode: req.body.fareMode || 'now',
      sourceChannel: req.body.sourceChannel || 'app',
      countryCode: req.body.countryCode,
      payWithMobilityCredit: Boolean(req.body.payWithMobilityCredit),
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.get('/credit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ status: 'success', data: await rails.getMobilityBalance(req.user!.id) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/credit/topup', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.topUpMobilityCredit({
      userId: req.user!.id,
      amount: Number(req.body.amount),
      currency: req.body.currency,
      source: String(req.body.source || 'momo'),
      reference: req.body.reference,
      meta: req.body.meta,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.get('/trust-score', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ status: 'success', data: await rails.getTrustScore(req.user!.id) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.get('/trust-score/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ status: 'success', data: await rails.getTrustScore(req.params.userId) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Family share
africaRailsRouter.get('/family', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ status: 'success', data: await rails.listFamilyCircles(req.user!.id) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/family/circles', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.createFamilyCircle(req.user!.id, req.body.name, req.body.currency);
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post(
  '/family/circles/:id/members',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await rails.addFamilyMember(
        req.params.id,
        req.user!.id,
        req.body.memberId,
        req.body.dailyLimit != null ? Number(req.body.dailyLimit) : 50
      );
      res.status(201).json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

// Remittance → ride gifts
africaRailsRouter.post('/remittance/gift', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.createRemittanceGift({
      senderId: req.user!.id,
      amount: Number(req.body.amount),
      currency: req.body.currency,
      recipientPhone: req.body.recipientPhone,
      recipientId: req.body.recipientId,
      note: req.body.note,
      ridesCount: req.body.ridesCount != null ? Number(req.body.ridesCount) : undefined,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/remittance/claim', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.claimRemittanceGift(String(req.body.claimCode), req.user!.id);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// Driver rails
africaRailsRouter.post(
  '/driver/destination',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await rails.setDestinationPref({
        driverId: req.user!.id,
        destLat: Number(req.body.destLat),
        destLng: Number(req.body.destLng),
        label: req.body.label,
        radiusKm: req.body.radiusKm != null ? Number(req.body.radiusKm) : undefined,
        hours: req.body.hours != null ? Number(req.body.hours) : undefined,
        bonusAccept: req.body.bonusAccept != null ? Number(req.body.bonusAccept) : undefined,
      });
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

africaRailsRouter.delete(
  '/driver/destination',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      res.json({ status: 'success', data: await rails.clearDestinationPref(req.user!.id) });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

africaRailsRouter.post(
  '/driver/guarantee',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await rails.enrollGuarantee({
        driverId: req.user!.id,
        minAmount: req.body.minAmount != null ? Number(req.body.minAmount) : undefined,
        windowHours: req.body.windowHours != null ? Number(req.body.windowHours) : undefined,
        zoneId: req.body.zoneId,
        currency: req.body.currency,
      });
      res.status(201).json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

africaRailsRouter.get(
  '/driver/guarantee',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const rows = await db.query(
        `SELECT * FROM driver_earnings_guarantees
         WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [req.user!.id]
      );
      res.json({ status: 'success', data: rows.rows });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

// Admin
africaRailsAdminRouter.get('/overview', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const [credits, guarantees, gifts, corridors, channels] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(amount),0)::float AS c FROM mobility_credit_ledger WHERE amount > 0`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM driver_earnings_guarantees WHERE status = 'active'`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM remittance_ride_gifts WHERE status = 'pending'`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM mobility_corridors WHERE is_active`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM channel_booking_events WHERE created_at > NOW() - INTERVAL '24 hours'`).catch(() => ({ rows: [{ c: 0 }] })),
    ]);
    res.json({
      status: 'success',
      data: {
        mobilityCreditIssued: Number(credits.rows[0]?.c || 0),
        activeGuarantees: Number(guarantees.rows[0]?.c || 0),
        pendingGifts: Number(gifts.rows[0]?.c || 0),
        activeCorridors: Number(corridors.rows[0]?.c || 0),
        channelEvents24h: Number(channels.rows[0]?.c || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsAdminRouter.get('/corridors', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await db.query(`SELECT * FROM mobility_corridors ORDER BY city, name`);
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsAdminRouter.post('/corridors', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const row = await db.query(
      `INSERT INTO mobility_corridors (
         name, city, country_code, origin_lat, origin_lng, dest_lat, dest_lng,
         radius_km, max_rider_fare, driver_min_payout, municipal_code, vehicle_codes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        req.body.name,
        req.body.city,
        req.body.countryCode || 'GH',
        req.body.originLat,
        req.body.originLng,
        req.body.destLat,
        req.body.destLng,
        req.body.radiusKm ?? 2.5,
        req.body.maxRiderFare,
        req.body.driverMinPayout,
        req.body.municipalCode || null,
        req.body.vehicleCodes || ['okada', 'keke', 'economy', 'shared', 'standard'],
      ]
    );
    res.status(201).json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export { rails as africaRailsService };
