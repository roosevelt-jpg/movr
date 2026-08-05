import { Router, Express } from 'express';
import { authenticateToken, requireCustomer, requireDriver } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { RideBookingService } from '../services/ride-booking.service';

const router: Express.Router = Router();

// ============================================
// CUSTOMER RIDES — thin wrapper → ride-booking.service (Phase 22)
// ============================================

router.post('/request', authenticateToken, requireCustomer, async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, rideType = 'standard' } = req.body;
    const customerId = req.user?.id;
    const db = (req.app.locals.db as DatabaseService) || new DatabaseService();
    const matching =
      (req.app.locals.matching as MatchingEngineService) ||
      new MatchingEngineService(db, req.app.locals.redis || null, {
        broadcastToDrivers: () => undefined,
      } as any);
    const booking = new RideBookingService(db, matching);

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required location fields',
      });
    }

    const result = await booking.createRideRequest({
      userId: customerId!,
      pickupLat: Number(pickupLat),
      pickupLng: Number(pickupLng),
      dropoffLat: Number(dropoffLat),
      dropoffLng: Number(dropoffLng),
      pickupAddress: req.body.pickupAddress,
      dropoffAddress: req.body.dropoffAddress,
      rideType,
      vehicleTypeCode: req.body.vehicleTypeCode,
      sourceChannel: 'app',
      countryCode: req.body.countryCode,
    });

    const realtime = req.app.locals.realtime;
    realtime?.broadcastToDrivers?.('ride:new-request', {
      rideId: result.rideId || result.id,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      estimatedFare: result.estimatedFare,
      rideType,
    });

    res.status(201).json({
      status: 'success',
      message: 'Ride requested successfully',
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to request ride',
    });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const result = await db.getRideById(id);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Ride not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch ride'
    });
  }
});

router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const realtime = req.app.locals.realtime;

    const result = await db.updateRideStatus(id, 'cancelled');

    try {
      const driverId = result.rows[0]?.driver_id;
      if (driverId) {
        const { DriverPerformanceService } = require('../services/driver-performance.service');
        const perf = new DriverPerformanceService(db);
        await perf.recalculateMetrics(driverId);
      }
    } catch {
      /* non-blocking */
    }

    realtime.broadcastToRide(id, 'ride:cancelled', {
      rideId: id,
      timestamp: Date.now()
    });

    res.status(200).json({
      status: 'success',
      message: 'Ride cancelled successfully',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel ride'
    });
  }
});

router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review, tags } = req.body;
    const db = req.app.locals.db;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Rating must be between 1 and 5'
      });
    }

    const reviewText = [review, Array.isArray(tags) && tags.length ? `Tags: ${tags.join(', ')}` : '']
      .filter(Boolean)
      .join('\n');

    const query = `
      UPDATE rides
      SET rating = $1, review = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(query, [rating, reviewText || null, id]);

    res.status(200).json({
      status: 'success',
      message: 'Ride rated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to rate ride'
    });
  }
});

router.post('/:id/tip', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const userId = req.user?.id;
    const payments = req.app.locals.payments;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid tip amount'
      });
    }

    const paymentResult = await payments.initializePayment({
      userId,
      amount,
      paymentType: 'tip',
      email: req.user?.email || '',
      fullName: 'Tip Payment',
      metadata: { rideId: id }
    });

    res.status(200).json({
      status: 'success',
      message: 'Tip initiated',
      data: paymentResult
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to add tip'
    });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 10, offset = 0 } = req.query;
    const db = req.app.locals.db;

    const query = `
      SELECT * FROM rides
      WHERE customer_id = $1 OR driver_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [userId, limit, offset]);

    res.status(200).json({
      status: 'success',
      data: {
        rides: result.rows,
        total: result.rowCount,
        limit,
        offset
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch rides'
    });
  }
});

// ============================================
// DRIVER OPERATIONS
// ============================================

router.put('/:id/accept', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user?.id;
    const db = req.app.locals.db;
    const matching = req.app.locals.matching;
    const realtime = req.app.locals.realtime;

    await matching.assignRideToDriver(id, driverId!);
    const result = await db.updateRideStatus(id, 'accepted');

    try {
      const { DriverPerformanceService } = require('../services/driver-performance.service');
      const perf = new DriverPerformanceService(db);
      await perf.recalculateMetrics(driverId!);
    } catch {
      /* non-blocking */
    }

    realtime.broadcastToRide(id, 'ride:accepted', {
      driverId,
      timestamp: Date.now()
    });

    res.status(200).json({
      status: 'success',
      message: 'Ride accepted',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to accept ride'
    });
  }
});

router.put('/:id/arrived', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const realtime = req.app.locals.realtime;

    const query = `
      UPDATE rides
      SET status = 'arrived', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id]);

    realtime?.broadcastToRide?.(id, 'ride:arrived', {
      rideId: id,
      timestamp: Date.now(),
    });

    res.status(200).json({
      status: 'success',
      message: 'Driver arrived at pickup',
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark arrived',
    });
  }
});

router.put('/:id/start', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const realtime = req.app.locals.realtime;

    const query = `
      UPDATE rides
      SET status = 'started', started_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    realtime.broadcastToRide(id, 'ride:started', {
      rideId: id,
      timestamp: Date.now()
    });

    res.status(200).json({
      status: 'success',
      message: 'Ride started',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to start ride'
    });
  }
});

router.put('/:id/complete', authenticateToken, requireDriver, async (req, res) => {
  try {
    const { id } = req.params;
    const { actualFare } = req.body;
    const driverId = req.user?.id;
    const db = req.app.locals.db;
    const realtime = req.app.locals.realtime;

    const query = `
      UPDATE rides
      SET status = 'completed', actual_fare = $1, completed_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [actualFare, id]);

    // Update driver earnings
    await db.query(
      `UPDATE driver_performance SET total_earnings = total_earnings + $1 WHERE driver_id = $2`,
      [actualFare, driverId]
    ).catch(() => undefined);

    // Phase 6 + 10 — points ledger + referral milestones on ride completion
    try {
      const customerId = result.rows[0]?.customer_id;
      if (customerId) {
        const { RewardsEngineService } = require('../services/rewards-engine.service');
        const { advanceReferralMilestone } = require('./referrals.routes');
        const rewards = new RewardsEngineService(db);
        await rewards.emitActivityEvent(customerId, 'ride_completed', {
          description: `Ride ${id} completed`,
          rideId: id,
        });
        await advanceReferralMilestone(customerId, 'first_ride_completed');
      }
    } catch (e) {
      console.warn('points/referral hook failed', e);
    }

    // Phase 13 — driver performance metrics
    try {
      if (driverId || result.rows[0]?.driver_id) {
        const { DriverPerformanceService } = require('../services/driver-performance.service');
        const perf = new DriverPerformanceService(db);
        await perf.recalculateMetrics(driverId || result.rows[0].driver_id);
      }
    } catch (e) {
      console.warn('performance recalculate failed', e);
    }

    realtime.broadcastToRide(id, 'ride:completed', {
      rideId: id,
      actualFare,
      timestamp: Date.now()
    });

    res.status(200).json({
      status: 'success',
      message: 'Ride completed',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete ride'
    });
  }
});

export default router;
