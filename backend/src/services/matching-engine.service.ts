// backend/src/services/realtime.service.ts
import { Server } from 'socket.io';
import winston from 'winston';
import { RedisService } from './redis.service';

export class RealTimeService {
  private io: Server;
  private redis?: RedisService;
  private logger: winston.Logger;
  private driverLocations: Map<string, { lat: number; lng: number; timestamp: number }> = new Map();

  constructor(io: Server, redis?: RedisService) {
    this.io = io;
    this.redis = redis;
    this.logger = winston.createLogger({
      defaultMeta: { service: 'realtime' }
    });
  }

  async initialize(): Promise<void> {
    this.setupSocketHandlers();
    this.logger.info('Real-time service initialized');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      const userId = socket.handshake.auth.userId;
      const userType = socket.handshake.auth.userType; // 'customer' or 'driver'

      this.logger.info(`${userType} ${userId} connected: ${socket.id}`);

      // Join user room for targeted messages
      socket.join(`user:${userId}`);
      if (userType === 'driver') {
        socket.join('drivers');
      } else {
        socket.join('customers');
      }

      // ========== LOCATION UPDATES ==========
      socket.on('location:update', (data) => {
        if (userType === 'driver') {
          this.handleDriverLocationUpdate(userId, data);
        }
      });

      // ========== RIDE EVENTS ==========
      socket.on('ride:request', (data) => {
        this.handleRideRequest(userId, data, socket);
      });

      socket.on('ride:accept', (data) => {
        this.handleRideAccept(userId, data);
      });

      socket.on('ride:start', (data) => {
        this.io.to(`ride:${data.rideId}`).emit('ride:started', {
          rideId: data.rideId,
          timestamp: Date.now()
        });
      });

      socket.on('ride:complete', (data) => {
        this.io.to(`ride:${data.rideId}`).emit('ride:completed', {
          rideId: data.rideId,
          timestamp: Date.now()
        });
      });

      // ========== MESSAGING ==========
      socket.on('chat:message', (data) => {
        this.handleChatMessage(data);
      });

      // ========== NOTIFICATIONS ==========
      socket.on('notification:read', (data) => {
        this.logger.debug(`Notification read by ${userId}:`, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(userId, userType);
      });
    });
  }

  // ============================================
  // LOCATION TRACKING
  // ============================================

  private handleDriverLocationUpdate(driverId: string, data: { latitude: number; longitude: number }): void {
    const { latitude, longitude } = data;
    const timestamp = Date.now();

    // Store in memory
    this.driverLocations.set(driverId, { lat: latitude, lng: longitude, timestamp });

    // Broadcast to customers
    this.io.to('customers').emit('driver:location-updated', {
      driverId,
      latitude,
      longitude,
      timestamp
    });

    // Emit to ride room if driver has active ride
    this.io.to(`driver:${driverId}`).emit('driver:location-updated', {
      latitude,
      longitude,
      timestamp
    });
  }

  private handleDisconnect(userId: string, userType: string): void {
    if (userType === 'driver') {
      this.driverLocations.delete(userId);
      this.io.emit('driver:offline', { driverId: userId });
    }
    this.logger.info(`${userType} ${userId} disconnected`);
  }

  // ============================================
  // RIDE MATCHING
  // ============================================

  private handleRideRequest(customerId: string, data: any, socket: any): void {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = data;

    // Find nearby drivers
    const nearbyDrivers = this.findNearbyDrivers(pickupLat, pickupLng, 5); // 5km radius

    this.logger.info(`Ride request from ${customerId}, ${nearbyDrivers.length} drivers nearby`);

    // Notify nearby drivers
    nearbyDrivers.forEach(driver => {
      this.io.to(`user:${driver.id}`).emit('ride:new-request', {
        rideId: data.rideId,
        customer: {
          id: customerId,
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          estimatedFare: data.estimatedFare
        }
      });
    });

    // Create ride room
    socket.join(`ride:${data.rideId}`);
  }

  private handleRideAccept(driverId: string, data: { rideId: string }): void {
    // Notify customer
    this.io.to(`ride:${data.rideId}`).emit('ride:accepted', {
      driverId,
      timestamp: Date.now()
    });

    // Add driver to ride room
    this.io.sockets.sockets.forEach(socket => {
      if (socket.handshake.auth.userId === driverId) {
        socket.join(`ride:${data.rideId}`);
      }
    });
  }

  // ============================================
  // MESSAGING
  // ============================================

  private handleChatMessage(data: { rideId: string; senderId: string; message: string }): void {
    const { rideId, senderId, message } = data;

    this.io.to(`ride:${rideId}`).emit('chat:message-received', {
      rideId,
      senderId,
      message,
      timestamp: Date.now()
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private findNearbyDrivers(lat: number, lng: number, radiusKm: number) {
    const nearby: any[] = [];
    const earthRadiusKm = 6371;

    this.driverLocations.forEach((location, driverId) => {
      const distance = this.calculateDistance(
        lat, lng,
        location.lat, location.lng
      );

      if (distance <= radiusKm) {
        nearby.push({ id: driverId, distance });
      }
    });

    // Sort by distance and return top 10
    return nearby.sort((a, b) => a.distance - b.distance).slice(0, 10);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ============================================
  // PUBLIC METHODS FOR EXTERNAL SERVICES
  // ============================================

  public notifyUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public broadcastToDrivers(event: string, data: any): void {
    this.io.to('drivers').emit(event, data);
  }

  public broadcastToCustomers(event: string, data: any): void {
    this.io.to('customers').emit(event, data);
  }

  public broadcastToRide(rideId: string, event: string, data: any): void {
    this.io.to(`ride:${rideId}`).emit(event, data);
  }
}

// ============================================
// MATCHING ENGINE SERVICE
// ============================================

export class MatchingEngineService {
  private logger: winston.Logger;
  private db: any;
  private redis: any;
  private realtime: RealTimeService;

  constructor(db: any, redis: any, realtime: RealTimeService) {
    this.db = db;
    this.redis = redis;
    this.realtime = realtime;
    this.logger = winston.createLogger({
      defaultMeta: { service: 'matching-engine' }
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Matching engine initialized');
  }

  /**
   * Find best drivers for a ride using algorithm
   */
  async findBestDrivers(
    pickupLat: number,
    pickupLng: number,
    rideType: string = 'standard',
    customerRating: number = 5.0
  ): Promise<any[]> {
    try {
      const cacheKey = `nearby:drivers:${rideType}:${pickupLat.toFixed(3)}:${pickupLng.toFixed(3)}`;
      try {
        if (this.redis?.get) {
          const cached = await this.redis.get(cacheKey);
          if (cached && Array.isArray(cached) && cached.length) {
            return cached;
          }
        }
      } catch {
        /* redis optional */
      }

      // Prefer PostGIS + driver_performance when available; fall back to simple online drivers.
      // Phase 24 — only offer drivers whose registered vehicle_type matches the ride type.
      try {
        const query = `
          SELECT 
            u.id, u.first_name, u.phone,
            dp.avg_rating, dp.acceptance_rate, dp.tier,
            COALESCE(vt.code, d.vehicle_type) AS vehicle_code,
            ST_Distance(
              ST_MakePoint(u.longitude, u.latitude)::geography,
              ST_MakePoint($1, $2)::geography
            ) as distance_m
          FROM users u
          JOIN drivers d ON d.user_id = u.id
          JOIN driver_performance dp ON u.id = dp.driver_id
          LEFT JOIN vehicle_types vt ON vt.id = d.vehicle_type_id
          LEFT JOIN driver_vehicles dv ON dv.driver_user_id = u.id AND dv.is_primary = TRUE
          LEFT JOIN vehicle_types vt2 ON vt2.id = dv.vehicle_type_id
          WHERE u.user_type = 'driver'
            AND u.is_active = true
            AND COALESCE(d.is_online, false) = true
            AND COALESCE(d.status, 'active') <> 'suspended'
            AND dp.avg_rating >= 4.5
            AND dp.acceptance_rate >= 70
            AND (
              COALESCE(vt2.code, vt.code, d.vehicle_type, 'standard') = $3
              OR COALESCE(vt2.code, vt.code, d.vehicle_type) IS NULL
            )
            AND ST_DWithin(
              ST_MakePoint(u.longitude, u.latitude)::geography,
              ST_MakePoint($1, $2)::geography,
              5000
            )
          ORDER BY dp.avg_rating DESC, distance_m ASC
          LIMIT 20
        `;
        const result = await this.db.query(query, [pickupLng, pickupLat, rideType]);
        if (result.rows.length) {
          // Phase 7 — boost by driver stake tier priorityWeight
          const scored = await Promise.all(
            result.rows.map(async (row: any) => {
              let priorityWeight = 1;
              try {
                const { StakingService } = require('./staking.service');
                const staking = new StakingService(this.db);
                const tier = await staking.getTier(row.id, 'driver');
                priorityWeight = tier.priorityWeight || 1;
              } catch {
                /* staking tables may be absent */
              }
              // Phase 13 — performance tier matching weight
              try {
                const { DriverPerformanceService } = require('./driver-performance.service');
                const perf = new DriverPerformanceService(this.db);
                const perfWeight = await perf.getMatchingWeight(row.id);
                priorityWeight *= perfWeight || 1;
              } catch {
                /* metrics may be absent */
              }
              return {
                ...row,
                priorityWeight,
                qualityBoost: 0,
                matchScore:
                  Number(row.avg_rating || 5) * priorityWeight -
                  Number(row.distance_m || 0) / 10000,
              };
            })
          );
          // Bounded quality-score boost from entity_quality_scores (AI ranking)
          try {
            const ids = scored.map((s: any) => s.id).filter(Boolean);
            if (ids.length) {
              const qs = await this.db.query(
                `SELECT entity_id, score FROM entity_quality_scores
                 WHERE entity_type = 'driver' AND entity_id = ANY($1::uuid[])`,
                [ids]
              );
              const byId = new Map(qs.rows.map((r: any) => [r.entity_id, Number(r.score || 0)]));
              for (const s of scored) {
                const q = byId.get(s.id) || 0;
                // Cap boost at +1.5 so distance/rating remain primary
                const boost = Math.min(1.5, q / 40);
                s.qualityBoost = boost;
                s.matchScore = Number(s.matchScore || 0) + boost;
              }
            }
          } catch {
            /* quality table may be empty */
          }
          scored.sort((a, b) => b.matchScore - a.matchScore);
          try {
            if (this.redis?.set) await this.redis.set(cacheKey, scored, 8);
          } catch {
            /* ignore */
          }
          return scored;
        }
      } catch {
        // driver_performance or user lat/lng may not exist yet
      }

      const fallback = await this.db.query(
        `SELECT u.id, u.first_name, u.phone,
                COALESCE(vt.code, d.vehicle_type, 'standard') AS vehicle_code
         FROM users u
         LEFT JOIN drivers d ON d.user_id = u.id
         LEFT JOIN vehicle_types vt ON vt.id = d.vehicle_type_id
         WHERE u.user_type = 'driver' AND u.is_active = true
           AND COALESCE(d.is_online, true) = true
           AND COALESCE(d.status, 'active') <> 'suspended'
           AND (
             COALESCE(vt.code, d.vehicle_type, 'standard') = $1
             OR d.vehicle_type_id IS NULL
           )
         ORDER BY COALESCE(d.rating, 5) DESC
         LIMIT 10`,
        [rideType]
      );
      try {
        if (this.redis?.set) await this.redis.set(cacheKey, fallback.rows, 8);
      } catch {
        /* ignore */
      }
      return fallback.rows;
    } catch (error) {
      this.logger.error('Error finding best drivers:', error);
      return [];
    }
  }

  /**
   * Generic nearest-driver assignment for rides or marketplace deliveries (Phase 4).
   * Rides: opens an offer window (driver must accept) unless hardAssign=true (admin force).
   */
  async assignNearestDriver(
    taskType: 'ride' | 'delivery',
    taskId: string,
    pickupLat: number,
    pickupLng: number,
    opts?: { hardAssign?: boolean; excludeDriverIds?: string[]; rideType?: string }
  ): Promise<{ driverId: string | null; driversConsidered: number; assignmentStatus?: string }> {
    const rideType = opts?.rideType || 'standard';
    const drivers = await this.findBestDrivers(pickupLat, pickupLng, rideType);
    const exclude = new Set((opts?.excludeDriverIds || []).map(String));
    const pick = drivers.find((d: any) => d?.id && !exclude.has(String(d.id))) || null;
    const driverId = pick?.id || null;

    if (driverId && taskType === 'delivery') {
      await this.db.query(
        `UPDATE marketplace_orders
         SET courier_id = $1,
             delivery_mode = 'movr_courier',
             courier_assigned_at = NOW(),
             status = 'out_for_delivery',
             updated_at = NOW()
         WHERE id = $2`,
        [driverId, taskId]
      );
      try {
        const order = await this.db.query(
          `SELECT id, user_id, status FROM marketplace_orders WHERE id = $1`,
          [taskId]
        );
        if (order.rows[0]) {
          const { MarketplaceService } = require('./marketplace.service');
          const { PaymentService } = require('./payment.service');
          const ms = new MarketplaceService(this.db, new PaymentService(this.db));
          await ms.notifyOrderStatus(order.rows[0]);
        }
      } catch {
        /* inbox optional */
      }
      this.realtime.broadcastToDrivers?.('delivery:assigned', {
        orderId: taskId,
        driverId,
        pickupLat,
        pickupLng,
      });
    }

    if (driverId && taskType === 'ride') {
      if (opts?.hardAssign) {
        await this.assignRideToDriver(taskId, driverId);
        return { driverId, driversConsidered: drivers.length, assignmentStatus: 'assigned' };
      }
      await this.offerRideToDriver(taskId, driverId);
      return { driverId, driversConsidered: drivers.length, assignmentStatus: 'offered' };
    }

    this.logger.info('assignNearestDriver', {
      taskType,
      taskId,
      driverId,
      considered: drivers.length,
    });

    return {
      driverId,
      driversConsidered: drivers.length,
      assignmentStatus: driverId ? 'offered' : 'no_drivers',
    };
  }

  /** Offer a ride to a driver (awaiting accept). Does not set accepted. */
  async offerRideToDriver(rideId: string, driverId: string): Promise<void> {
    const offerSeconds = Math.max(
      15,
      parseInt(process.env.AUTO_ASSIGN_OFFER_SECONDS || '45', 10) || 45
    );

    await this.db.query(
      `UPDATE rides SET
         offered_driver_id = $1,
         offered_at = NOW(),
         assign_attempts = COALESCE(assign_attempts, 0) + 1,
         offered_driver_ids = CASE
           WHEN offered_driver_ids IS NULL THEN ARRAY[$1]::uuid[]
           WHEN $1 = ANY(offered_driver_ids) THEN offered_driver_ids
           ELSE array_append(offered_driver_ids, $1::uuid)
         END,
         status = CASE
           WHEN status IN ('requested', 'searching', 'pending', 'offered') THEN 'offered'
           ELSE status
         END,
         last_reassign_at = NOW(),
         updated_at = NOW()
       WHERE id = $2`,
      [driverId, rideId]
    );

    // Bridge to driver-app `ride_offers` table (pending poll / accept / decline).
    try {
      await this.db.query(
        `UPDATE ride_offers SET status = 'expired'
         WHERE ride_id = $1 AND status = 'pending'`,
        [rideId]
      );
      await this.db.query(
        `UPDATE ride_offers SET status = 'expired'
         WHERE driver_id = $1 AND status = 'pending' AND (ride_id IS NULL OR ride_id <> $2)`,
        [driverId, rideId]
      );

      const ride = await this.db.query(
        `SELECT pickup_address, dropoff_address, distance_km, estimated_duration_minutes,
                estimated_fare, surge_multiplier, dvt_reward
         FROM rides WHERE id = $1`,
        [rideId]
      );
      const r = ride.rows[0] || {};
      const fare = Number(r.estimated_fare || 0);
      const surge = Number(r.surge_multiplier || 1);
      const earnings = Math.round(fare * 0.85 * 100) / 100;
      const surgeBonus = Math.round(Math.max(0, fare - fare / Math.max(surge, 1)) * 100) / 100;

      await this.db.query(
        `INSERT INTO ride_offers (
           ride_id, driver_id, status, expires_at,
           pickup_label, dropoff_label, distance_to_pickup_km, trip_distance_km,
           eta_minutes, earnings, surge_multiplier, surge_bonus, currency_code, dvt_reward
         ) VALUES (
           $1, $2, 'pending', NOW() + ($3 || ' seconds')::interval,
           $4, $5, 0.8, $6, $7, $8, $9, $10, 'NGN', $11
         )`,
        [
          rideId,
          driverId,
          String(offerSeconds),
          r.pickup_address || 'Pickup',
          r.dropoff_address || 'Dropoff',
          Number(r.distance_km || 0),
          Math.max(3, Number(r.estimated_duration_minutes || 15)),
          earnings || fare,
          surge,
          surgeBonus,
          Number(r.dvt_reward || Math.round(fare * 0.04) || 0),
        ]
      );
    } catch (e: any) {
      this.logger.warn(`ride_offers bridge failed: ${e?.message || e}`);
    }

    try {
      this.realtime.broadcastToDrivers?.('ride:offer', { rideId, driverId });
      this.realtime.broadcastToRide?.(rideId, 'ride:offered', { rideId, driverId });
    } catch {
      /* realtime optional */
    }

    this.logger.info(`Ride ${rideId} offered to driver ${driverId}`);
  }

  /** Expire pending driver-app offers for a ride (and optionally one driver). */
  async expireRideOffers(rideId: string, driverId?: string | null): Promise<void> {
    try {
      if (driverId) {
        await this.db.query(
          `UPDATE ride_offers SET status = 'expired'
           WHERE ride_id = $1 AND driver_id = $2 AND status = 'pending'`,
          [rideId, driverId]
        );
      } else {
        await this.db.query(
          `UPDATE ride_offers SET status = 'expired'
           WHERE ride_id = $1 AND status = 'pending'`,
          [rideId]
        );
      }
    } catch {
      /* table optional */
    }
  }

  /**
   * Expire stale offers and reassign to next driver (autonomous loop tick).
   */
  async processExpiredOffers(): Promise<{ processed: number; unmatched: number; reassigned: number }> {
    const offerSeconds = Math.max(
      15,
      parseInt(process.env.AUTO_ASSIGN_OFFER_SECONDS || '45', 10) || 45
    );
    const maxAttempts = Math.max(
      1,
      parseInt(process.env.AUTO_ASSIGN_MAX_ATTEMPTS || '5', 10) || 5
    );

    const expired = await this.db.query(
      `SELECT id, pickup_lat, pickup_lng, offered_driver_id, assign_attempts, offered_driver_ids, ride_type
       FROM rides
       WHERE offered_driver_id IS NOT NULL
         AND offered_at IS NOT NULL
         AND offered_at < NOW() - ($1 || ' seconds')::interval
         AND status IN ('requested', 'searching', 'pending', 'offered')
       ORDER BY offered_at ASC
       LIMIT 40`,
      [String(offerSeconds)]
    );

    let reassigned = 0;
    let unmatched = 0;

    for (const ride of expired.rows) {
      const prevDriver = ride.offered_driver_id;
      try {
        await this.cancelRideAssignment(ride.id, prevDriver, 'offer_timeout');
      } catch {
        /* continue */
      }
      await this.expireRideOffers(ride.id, prevDriver);

      const attempts = Number(ride.assign_attempts || 0);
      if (attempts >= maxAttempts) {
        await this.db.query(
          `UPDATE rides SET unmatched_at = COALESCE(unmatched_at, NOW()),
             offered_driver_id = NULL, offered_at = NULL,
             status = 'requested', updated_at = NOW()
           WHERE id = $1`,
          [ride.id]
        );
        await this.expireRideOffers(ride.id);
        try {
          this.realtime.broadcastToDrivers?.('ride:unmatched', { rideId: ride.id });
          this.realtime.broadcastToRide?.(ride.id, 'ride:unmatched', { rideId: ride.id });
        } catch {
          /* optional */
        }
        unmatched += 1;
        continue;
      }

      const exclude = [
        ...(Array.isArray(ride.offered_driver_ids) ? ride.offered_driver_ids : []),
        prevDriver,
      ]
        .filter(Boolean)
        .map(String);

      const result = await this.assignNearestDriver(
        'ride',
        ride.id,
        Number(ride.pickup_lat),
        Number(ride.pickup_lng),
        { excludeDriverIds: exclude, rideType: ride.ride_type || 'standard' }
      );

      if (result.driverId) {
        reassigned += 1;
      } else {
        await this.db.query(
          `UPDATE rides SET unmatched_at = COALESCE(unmatched_at, NOW()),
             offered_driver_id = NULL, offered_at = NULL,
             status = 'requested', updated_at = NOW()
           WHERE id = $1`,
          [ride.id]
        );
        unmatched += 1;
      }
    }

    return { processed: expired.rows.length, unmatched, reassigned };
  }

  /**
   * Calculate estimated fare — DB-driven vehicle_type_pricing (Phase 24) with city fallback (Phase 20).
   * Phase 25 applies contextual pricing via PricingEngineService.
   */
  async calculateFareWithBreakdown(
    distanceKm: number,
    durationMinutes: number,
    rideType: string = 'standard',
    countryCode: string = 'GH',
    pickupLat?: number,
    pickupLng?: number,
    precomputedBreakdown?: any,
    opts?: { destLat?: number; destLng?: number; rideId?: string }
  ) {
    const cacheKey = `fare:${countryCode}:${rideType}`;
    let pricing: any = null;

    try {
      const cached = this.redis?.get ? await this.redis.get(cacheKey) : null;
      if (cached) pricing = cached;
    } catch {
      // redis optional
    }

    if (!pricing) {
      try {
        const row = await this.db.query(
          `SELECT p.*
           FROM vehicle_type_pricing p
           JOIN vehicle_types vt ON vt.id = p.vehicle_type_id
           WHERE vt.code = $1 AND vt.is_active = TRUE
             AND (p.country_code = $2 OR p.country_code IS NULL)
             AND p.effective_from <= NOW()
           ORDER BY p.country_code NULLS LAST, p.effective_from DESC
           LIMIT 1`,
          [rideType, countryCode]
        );
        pricing = row.rows[0];
        if (pricing && this.redis?.set) {
          await this.redis.set(cacheKey, pricing, 300).catch?.(() => undefined);
        }
      } catch {
        pricing = null;
      }
    }

    if (!pricing) {
      try {
        const city = await this.db.query(
          `SELECT * FROM city_pricing WHERE country_code = $1 ORDER BY city LIMIT 1`,
          [countryCode]
        );
        if (city.rows[0]) {
          pricing = {
            base_fare: city.rows[0].base_fare,
            per_km_rate: city.rows[0].per_km_rate,
            per_minute_rate: city.rows[0].per_min_rate,
            minimum_fare: city.rows[0].base_fare,
          };
        }
      } catch {
        // fall through to hardcoded legacy
      }
    }

    if (!pricing) {
      const baseFare: Record<string, number> = { standard: 2.5, express: 3.5, premium: 5.0 };
      const perKmRate: Record<string, number> = { standard: 1.5, express: 2.0, premium: 3.0 };
      const perMinuteRate: Record<string, number> = { standard: 0.25, express: 0.35, premium: 0.5 };
      pricing = {
        base_fare: baseFare[rideType] || 2.5,
        per_km_rate: perKmRate[rideType] || 1.5,
        per_minute_rate: perMinuteRate[rideType] || 0.25,
        minimum_fare: 5,
      };
    }

    const total =
      Number(pricing.base_fare) +
      distanceKm * Number(pricing.per_km_rate) +
      durationMinutes * Number(pricing.per_minute_rate);
    const floored = Math.max(total, Number(pricing.minimum_fare || 0));
    let breakdown = precomputedBreakdown;
    if (!breakdown) {
      const { PricingEngineService } = require('./pricing-engine.service');
      const pricingEngine = new PricingEngineService(this.db, this.redis);
      const lat = pickupLat ?? 5.6037;
      const lng = pickupLng ?? -0.187;
      breakdown = await pricingEngine.calculateMultiplier({
        lat,
        lng,
        destLat: opts?.destLat,
        destLng: opts?.destLng,
        rideId: opts?.rideId,
      });
    }
    const fare = Math.round(floored * breakdown.finalMultiplier * 100) / 100;
    return { fare, breakdown, baseBeforeSurge: floored };
  }

  async calculateFare(
    distanceKm: number,
    durationMinutes: number,
    rideType: string = 'standard',
    countryCode: string = 'GH',
    pickupLat?: number,
    pickupLng?: number,
    opts?: { destLat?: number; destLng?: number; rideId?: string }
  ): Promise<number> {
    const result = await this.calculateFareWithBreakdown(
      distanceKm,
      durationMinutes,
      rideType,
      countryCode,
      pickupLat,
      pickupLng,
      undefined,
      opts
    );
    return result.fare;
  }

  /**
   * Assign driver to ride
   */
  async assignRideToDriver(rideId: string, driverId: string): Promise<void> {
    try {
      const query = `
        UPDATE rides
        SET driver_id = $1, status = 'accepted', updated_at = NOW(),
            accepted_at = COALESCE(accepted_at, NOW()),
            offered_driver_id = NULL,
            offered_at = NULL
        WHERE id = $2
      `;
      await this.db.query(query, [driverId, rideId]);

      try {
        await this.db.query(
          `UPDATE ride_offers SET status = 'accepted'
           WHERE ride_id = $1 AND driver_id = $2 AND status = 'pending'`,
          [rideId, driverId]
        );
        await this.db.query(
          `UPDATE ride_offers SET status = 'expired'
           WHERE ride_id = $1 AND status = 'pending'`,
          [rideId]
        );
      } catch {
        /* ride_offers optional */
      }

      try {
        const { TrustSettlementService } = require('./trust-settlement.service');
        await new TrustSettlementService(this.db).onRideAccepted(rideId);
      } catch {
        /* SLA credit non-blocking */
      }

      try {
        await this.redis.incrementCounter('active:rides');
        await this.redis.decrementCounter('available:drivers');
      } catch {
        /* redis optional */
      }

      this.logger.info(`Ride ${rideId} assigned to driver ${driverId}`);
    } catch (error) {
      this.logger.error('Error assigning ride:', error);
      throw error;
    }
  }

  /**
   * Cancel matched ride
   */
  async cancelRideAssignment(rideId: string, driverId: string, reason: string): Promise<void> {
    try {
      const query = `
        UPDATE rides
        SET driver_id = NULL,
            offered_driver_id = NULL,
            offered_at = NULL,
            status = 'requested',
            updated_at = NOW()
        WHERE id = $1
          AND (driver_id = $2 OR offered_driver_id = $2 OR $2 IS NULL)
      `;
      await this.db.query(query, [rideId, driverId || null]);
      await this.expireRideOffers(rideId, driverId);

      try {
        await this.redis.decrementCounter('active:rides');
        await this.redis.incrementCounter('available:drivers');
      } catch {
        /* redis optional */
      }

      this.logger.info(`Ride ${rideId} assignment cancelled (driver: ${driverId}, reason: ${reason})`);
    } catch (error) {
      this.logger.error('Error cancelling assignment:', error);
      throw error;
    }
  }

  /**
   * Driver declined an offer — expire it and immediately re-offer to next driver.
   */
  async onOfferDeclined(rideId: string, driverId: string): Promise<{ reassigned: boolean }> {
    await this.cancelRideAssignment(rideId, driverId, 'driver_decline');
    const ride = await this.db.query(
      `SELECT pickup_lat, pickup_lng, ride_type, assign_attempts, offered_driver_ids
       FROM rides WHERE id = $1`,
      [rideId]
    );
    const r = ride.rows[0];
    if (!r) return { reassigned: false };

    const maxAttempts = Math.max(
      1,
      parseInt(process.env.AUTO_ASSIGN_MAX_ATTEMPTS || '5', 10) || 5
    );
    if (Number(r.assign_attempts || 0) >= maxAttempts) {
      await this.db.query(
        `UPDATE rides SET unmatched_at = COALESCE(unmatched_at, NOW()), status = 'requested', updated_at = NOW()
         WHERE id = $1`,
        [rideId]
      );
      return { reassigned: false };
    }

    const exclude = [
      ...(Array.isArray(r.offered_driver_ids) ? r.offered_driver_ids : []),
      driverId,
    ]
      .filter(Boolean)
      .map(String);

    const result = await this.assignNearestDriver(
      'ride',
      rideId,
      Number(r.pickup_lat),
      Number(r.pickup_lng),
      { excludeDriverIds: exclude, rideType: r.ride_type || 'standard' }
    );
    return { reassigned: Boolean(result.driverId) };
  }

  /** Whether dispatch auto-assign is enabled (default true). */
  async isAutoAssignEnabled(): Promise<boolean> {
    try {
      const r = await this.db.query(
        `SELECT auto_assign FROM dispatch_settings WHERE id = 1 LIMIT 1`
      );
      if (r.rows[0] && typeof r.rows[0].auto_assign === 'boolean') {
        return r.rows[0].auto_assign;
      }
    } catch {
      /* table may be missing */
    }
    return true;
  }
}
