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
      // Query drivers with good ratings and online status
      const query = `
        SELECT 
          u.id, u.first_name, u.phone,
          dp.avg_rating, dp.acceptance_rate, dp.tier,
          ST_Distance(ST_MakePoint(u.longitude, u.latitude), ST_MakePoint($1, $2)) as distance_m
        FROM users u
        JOIN driver_performance dp ON u.id = dp.driver_id
        WHERE u.user_type = 'driver'
          AND u.is_active = true
          AND dp.avg_rating >= 4.5
          AND dp.acceptance_rate >= 70
          AND ST_DWithin(ST_MakePoint(u.longitude, u.latitude), ST_MakePoint($1, $2), 5000)
        ORDER BY 
          dp.avg_rating DESC,
          dp.acceptance_rate DESC,
          distance_m ASC
        LIMIT 20
      `;

      const result = await this.db.query(query, [pickupLng, pickupLat]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error finding best drivers:', error);
      return [];
    }
  }

  /**
   * Calculate estimated fare for a ride
   */
  async calculateFare(
    distanceKm: number,
    durationMinutes: number,
    rideType: string = 'standard'
  ): Promise<number> {
    // Base fare structure
    const baseFare: Record<string, number> = {
      standard: 2.5,
      express: 3.5,
      premium: 5.0
    };

    const perKmRate: Record<string, number> = {
      standard: 1.5,
      express: 2.0,
      premium: 3.0
    };

    const perMinuteRate: Record<string, number> = {
      standard: 0.25,
      express: 0.35,
      premium: 0.50
    };

    const base = baseFare[rideType] || baseFare.standard;
    const distanceFare = distanceKm * (perKmRate[rideType] || perKmRate.standard);
    const timeFare = durationMinutes * (perMinuteRate[rideType] || perMinuteRate.standard);

    const totalFare = base + distanceFare + timeFare;

    // Apply surge pricing if needed
    const surgeMultiplier = await this.getSurgeMultiplier();
    return totalFare * surgeMultiplier;
  }

  /**
   * Get surge pricing multiplier based on demand
   */
  private async getSurgeMultiplier(): Promise<number> {
    // Check active rides vs available drivers
    const activeRides = await this.redis.getCounter('active:rides');
    const availableDrivers = await this.redis.getCounter('available:drivers');

    if (availableDrivers === 0) return 2.0; // High surge

    const ratio = activeRides / availableDrivers;
    if (ratio > 2) return 2.0;
    if (ratio > 1.5) return 1.5;
    if (ratio > 1) return 1.25;
    return 1.0;
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
