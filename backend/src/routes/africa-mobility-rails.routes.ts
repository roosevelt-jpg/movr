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

/** Gateway MoMo/card or airtime/salary top-up → mobility credit */
africaRailsRouter.post('/credit/checkout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.startMobilityTopUp({
      userId: req.user!.id,
      amount: Number(req.body.amount),
      currency: req.body.currency,
      source: req.body.source || 'momo',
      provider: req.body.provider,
      email: req.body.email || req.user!.email,
      phone: req.body.phone || (req.user as any).phone,
      countryCode: req.body.countryCode,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/share/join', authenticateToken, requireCustomer, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.joinSharePool({
      userId: req.user!.id,
      pickupLat: Number(req.body.pickupLat),
      pickupLng: Number(req.body.pickupLng),
      dropoffLat: Number(req.body.dropoffLat),
      dropoffLng: Number(req.body.dropoffLng),
      pickupAddress: req.body.pickupAddress,
      dropoffAddress: req.body.dropoffAddress,
      countryCode: req.body.countryCode,
      payWithMobilityCredit: Boolean(req.body.payWithMobilityCredit),
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.get('/remittance/corridors', async (_req, res: Response) => {
  try {
    res.json({ status: 'success', data: await rails.listRemittanceCorridors() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/remittance/quote', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.quoteRemittanceGift({
      corridorId: req.body.corridorId,
      amountFrom: Number(req.body.amountFrom),
    });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/remittance/send', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await rails.sendRemittanceViaCorridor({
      senderId: req.user!.id,
      corridorId: req.body.corridorId,
      amountFrom: Number(req.body.amountFrom),
      recipientPhone: req.body.recipientPhone,
      recipientId: req.body.recipientId,
      note: req.body.note,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Channel parity: book + optional mobility pay + log */
africaRailsRouter.post('/channel/book', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const channel = String(req.body.channel || req.body.sourceChannel || 'whatsapp');
    const data = await rails.book({
      userId: req.user!.id,
      pickupLat: Number(req.body.pickupLat),
      pickupLng: Number(req.body.pickupLng),
      dropoffLat: Number(req.body.dropoffLat),
      dropoffLng: Number(req.body.dropoffLng),
      pickupAddress: req.body.pickupAddress,
      dropoffAddress: req.body.dropoffAddress,
      vehicleTypeCode: req.body.vehicleTypeCode || 'economy',
      fareMode: req.body.fareMode || 'now',
      sourceChannel: channel,
      countryCode: req.body.countryCode,
      payWithMobilityCredit: req.body.payWithMobilityCredit !== false,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

africaRailsRouter.post('/channel/rate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ReviewAutonomyService } = require('../services/review-autonomy.service');
    const reviews = new ReviewAutonomyService(db);
    const data = await reviews.submitRating({
      rideId: req.body.rideId,
      raterId: req.user!.id,
      raterRole: req.body.asDriver ? 'driver' : 'customer',
      rating: Number(req.body.rating),
      comment: req.body.comment || req.body.review,
      tags: req.body.tags,
    });
    await rails.logChannelEvent({
      channel: String(req.body.channel || 'app'),
      userId: req.user!.id,
      rideId: req.body.rideId,
      eventType: 'rated',
      payload: { rating: req.body.rating },
    });
    res.json({ status: 'success', data });
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
    const [credits, guarantees, gifts, corridors, channels, pools, remits, floats] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(amount),0)::float AS c FROM mobility_credit_ledger WHERE amount > 0`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM driver_earnings_guarantees WHERE status = 'active'`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM remittance_ride_gifts WHERE status = 'pending'`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM mobility_corridors WHERE is_active`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM channel_booking_events WHERE created_at > NOW() - INTERVAL '24 hours'`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM share_pools WHERE status IN ('open','matching','full')`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COUNT(*)::int AS c FROM remittance_corridors WHERE is_active`).catch(() => ({ rows: [{ c: 0 }] })),
      db.query(`SELECT COALESCE(SUM(balance),0)::float AS c FROM cash_agent_accounts`).catch(() => ({ rows: [{ c: 0 }] })),
    ]);
    res.json({
      status: 'success',
      data: {
        mobilityCreditIssued: Number(credits.rows[0]?.c || 0),
        activeGuarantees: Number(guarantees.rows[0]?.c || 0),
        pendingGifts: Number(gifts.rows[0]?.c || 0),
        activeCorridors: Number(corridors.rows[0]?.c || 0),
        channelEvents24h: Number(channels.rows[0]?.c || 0),
        openSharePools: Number(pools.rows[0]?.c || 0),
        remittanceCorridors: Number(remits.rows[0]?.c || 0),
        agentFloatTotal: Number(floats.rows[0]?.c || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsAdminRouter.get('/share-pools', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT * FROM share_pools ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsAdminRouter.get('/remittance-corridors', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    res.json({ status: 'success', data: await rails.listRemittanceCorridors() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsAdminRouter.get('/agent-float', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT a.id, a.name, a.city, COALESCE(acc.balance,0)::float AS float_balance, acc.currency
       FROM cash_agents a
       LEFT JOIN cash_agent_accounts acc ON acc.agent_id = a.id
       WHERE a.is_active = TRUE
       ORDER BY a.name`
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

africaRailsAdminRouter.post('/agent-float/topup', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { TrustSettlementService } = require('../services/trust-settlement.service');
    const trust = new TrustSettlementService(db);
    const data = await trust.adjustAgentFloat(
      String(req.body.agentId),
      Number(req.body.amount),
      'float_topup'
    );
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
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
         radius_km, max_rider_fare, driver_min_payout, municipal_code, vehicle_codes,
         origin_polygon, dest_polygon
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
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
        req.body.originPolygon ? JSON.stringify(req.body.originPolygon) : null,
        req.body.destPolygon ? JSON.stringify(req.body.destPolygon) : null,
      ]
    );
    res.status(201).json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export { rails as africaRailsService };
