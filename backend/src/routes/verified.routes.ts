import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireCustomer, requireDriver } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { RideBookingService } from '../services/ride-booking.service';
import { AfricaMobilityRailsService } from '../services/africa-mobility-rails.service';
import { VerifiedMobilityService } from '../services/verified-mobility.service';

const db = new DatabaseService();
const matching = new MatchingEngineService(db, null, {
  broadcastToDrivers: () => undefined,
  broadcastToRide: () => undefined,
} as any);
const booking = new RideBookingService(db, matching);
const rails = new AfricaMobilityRailsService(db, matching, booking);
const verified = new VerifiedMobilityService(db, booking, matching, rails);

export const verifiedRouter = Router();

verifiedRouter.get('/classes', async (_req, res: Response) => {
  try {
    res.json({ status: 'success', data: await verified.listClasses() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.get('/listings', async (req, res: Response) => {
  try {
    const data = await verified.listListings({
      classCode: typeof req.query.class === 'string' ? req.query.class : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      countryCode: typeof req.query.country === 'string' ? req.query.country : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.get('/listings/:id', async (req, res: Response) => {
  try {
    const data = await verified.getListing(req.params.id);
    if (!data) return res.status(404).json({ status: 'error', message: 'Vehicle not found' });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.post('/listings/:id/quote', async (req, res: Response) => {
  try {
    const data = await verified.quote(req.params.id, req.body || {});
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.post('/book', authenticateToken, requireCustomer, async (req: AuthRequest, res: Response) => {
  try {
    const data = await verified.book({
      userId: req.user!.id,
      listingId: req.body.listingId,
      pickupLat: Number(req.body.pickupLat),
      pickupLng: Number(req.body.pickupLng),
      dropoffLat: Number(req.body.dropoffLat),
      dropoffLng: Number(req.body.dropoffLng),
      pickupAddress: req.body.pickupAddress,
      dropoffAddress: req.body.dropoffAddress,
      pickupAt: req.body.pickupAt || null,
      passengers: req.body.passengers,
      product: req.body.product,
      hours: req.body.hours,
      priority: Boolean(req.body.priority),
      orgId: req.body.orgId,
      countryCode: req.body.countryCode,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.post('/movements', authenticateToken, requireCustomer, async (req: AuthRequest, res: Response) => {
  try {
    const data = await verified.bookMovement({
      userId: req.user!.id,
      orgId: req.body.orgId,
      pickupLat: Number(req.body.pickupLat),
      pickupLng: Number(req.body.pickupLng),
      dropoffLat: Number(req.body.dropoffLat),
      dropoffLng: Number(req.body.dropoffLng),
      pickupAddress: req.body.pickupAddress,
      dropoffAddress: req.body.dropoffAddress,
      pickupAt: req.body.pickupAt || null,
      notes: req.body.notes,
      vehicles: Array.isArray(req.body.vehicles) ? req.body.vehicles : [],
      countryCode: req.body.countryCode,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.get('/bookings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ status: 'success', data: await verified.myBookings(req.user!.id) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.get('/by-ride/:rideId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await verified.byRide(req.params.rideId, req.user!.id);
    if (!data) return res.status(404).json({ status: 'error', message: 'No verified booking' });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.post(
  '/by-ride/:rideId/match',
  authenticateToken,
  requireCustomer,
  async (req: AuthRequest, res: Response) => {
    try {
      const matches = req.body.matches !== false && req.body.matched !== false;
      const data = await verified.confirmMatch(req.user!.id, req.params.rideId, matches);
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

verifiedRouter.post(
  '/by-ride/:rideId/class',
  authenticateToken,
  requireDriver,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await verified.applyClassSla(req.params.rideId, String(req.body.classCode || ''));
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

verifiedRouter.post('/orgs', authenticateToken, requireCustomer, async (req: AuthRequest, res: Response) => {
  try {
    const data = await verified.createOrg(req.user!.id, req.body || {});
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.get('/orgs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ status: 'success', data: await verified.myOrgs(req.user!.id) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.get('/orgs/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await verified.orgDesk(req.user!.id, req.params.id);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.post('/orgs/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await verified.addOrgMember(req.user!.id, req.params.id, req.body || {});
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

verifiedRouter.post('/driver/listing', authenticateToken, requireDriver, async (req: AuthRequest, res: Response) => {
  try {
    const data = await verified.upsertListingFromDriver(req.user!.id, req.body || {});
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export { verified };
