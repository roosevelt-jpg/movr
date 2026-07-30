// backend/src/services/realtime.service.ts
import { Server } from 'socket.io';
import winston from 'winston';
import { RedisService } from './redis.service';

export class RealTimeService {
  private io: Server;
  private redis: RedisService;
  private logger: winston.Logger;
  private driverLocations: Map<string, { lat: number; lng: number; timestamp: number }> = new Map();

  constructor(io: Server) {
    this.io = io;
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
      // Prefer PostGIS + driver_performance when available; fall back to simple online drivers.
      try {
        const query = `
          SELECT 
            u.id, u.first_name, u.phone,
            dp.avg_rating, dp.acceptance_rate, dp.tier,
            ST_Distance(
              ST_MakePoint(u.longitude, u.latitude)::geography,
              ST_MakePoint($1, $2)::geography
            ) as distance_m
          FROM users u
          JOIN driver_performance dp ON u.id = dp.driver_id
          WHERE u.user_type = 'driver'
            AND u.is_active = true
            AND dp.avg_rating >= 4.5
            AND dp.acceptance_rate >= 70
            AND ST_DWithin(
              ST_MakePoint(u.longitude, u.latitude)::geography,
              ST_MakePoint($1, $2)::geography,
              5000
            )
          ORDER BY dp.avg_rating DESC, distance_m ASC
          LIMIT 20
        `;
        const result = await this.db.query(query, [pickupLng, pickupLat]);
        if (result.rows.length) return result.rows;
      } catch {
        // driver_performance or user lat/lng may not exist yet
      }

      const fallback = await this.db.query(
        `SELECT u.id, u.first_name, u.phone
         FROM users u
         LEFT JOIN drivers d ON d.user_id = u.id
         WHERE u.user_type = 'driver' AND u.is_active = true
         ORDER BY COALESCE(d.rating, 5) DESC
         LIMIT 10`
      );
      return fallback.rows;
    } catch (error) {
      this.logger.error('Error finding best drivers:', error);
      return [];
    }
  }

  /**
   * Generic nearest-driver assignment for rides or marketplace deliveries (Phase 4).
   */
  async assignNearestDriver(
    taskType: 'ride' | 'delivery',
    taskId: string,
    pickupLat: number,
    pickupLng: number
  ): Promise<{ driverId: string | null; driversConsidered: number }> {
    const drivers = await this.findBestDrivers(pickupLat, pickupLng);
    const driverId = drivers[0]?.id || null;

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
      this.realtime.broadcastToDrivers?.('delivery:assigned', {
        orderId: taskId,
        driverId,
        pickupLat,
        pickupLng,
      });
    }

    if (driverId && taskType === 'ride') {
      await this.db.query(
        `UPDATE rides SET driver_id = $1, status = 'accepted', updated_at = NOW() WHERE id = $2`,
        [driverId, taskId]
      );
    }

    this.logger.info('assignNearestDriver', {
      taskType,
      taskId,
      driverId,
      considered: drivers.length,
    });

    return { driverId, driversConsidered: drivers.length };
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
    precomputedBreakdown?: any
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
      breakdown = await pricingEngine.calculateMultiplier({ lat, lng });
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
    pickupLng?: number
  ): Promise<number> {
    const result = await this.calculateFareWithBreakdown(
      distanceKm,
      durationMinutes,
      rideType,
      countryCode,
      pickupLat,
      pickupLng
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
        SET driver_id = $1, status = 'accepted'
        WHERE id = $2
      `;
      await this.db.query(query, [driverId, rideId]);

      // Update counters
      await this.redis.incrementCounter('active:rides');
      await this.redis.decrementCounter('available:drivers');

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
        SET driver_id = NULL, status = 'requested'
        WHERE id = $1
      `;
      await this.db.query(query, [rideId]);

      // Update counters
      await this.redis.decrementCounter('active:rides');
      await this.redis.incrementCounter('available:drivers');

      this.logger.info(`Ride ${rideId} assignment cancelled (driver: ${driverId}, reason: ${reason})`);
    } catch (error) {
      this.logger.error('Error cancelling assignment:', error);
      throw error;
    }
  }
}
