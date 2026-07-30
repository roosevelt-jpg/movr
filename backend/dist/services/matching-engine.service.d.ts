import { Server } from 'socket.io';
export declare class RealTimeService {
    private io;
    private redis;
    private logger;
    private driverLocations;
    constructor(io: Server);
    initialize(): Promise<void>;
    private setupSocketHandlers;
    private handleDriverLocationUpdate;
    private handleDisconnect;
    private handleRideRequest;
    private handleRideAccept;
    private handleChatMessage;
    private findNearbyDrivers;
    private calculateDistance;
    notifyUser(userId: string, event: string, data: any): void;
    broadcastToDrivers(event: string, data: any): void;
    broadcastToCustomers(event: string, data: any): void;
    broadcastToRide(rideId: string, event: string, data: any): void;
}
export declare class MatchingEngineService {
    private logger;
    private db;
    private redis;
    private realtime;
    constructor(db: any, redis: any, realtime: RealTimeService);
    initialize(): Promise<void>;
    /**
     * Find best drivers for a ride using algorithm
     */
    findBestDrivers(pickupLat: number, pickupLng: number, rideType?: string, customerRating?: number): Promise<any[]>;
    /**
     * Calculate estimated fare for a ride
     */
    calculateFare(distanceKm: number, durationMinutes: number, rideType?: string): Promise<number>;
    /**
     * Get surge pricing multiplier based on demand
     */
    private getSurgeMultiplier;
    /**
     * Assign driver to ride
     */
    assignRideToDriver(rideId: string, driverId: string): Promise<void>;
    /**
     * Cancel matched ride
     */
    cancelRideAssignment(rideId: string, driverId: string, reason: string): Promise<void>;
}
//# sourceMappingURL=matching-engine.service.d.ts.map