export declare class RedisService {
    private redis;
    private logger;
    constructor();
    connect(): Promise<void>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    get<T = any>(key: string): Promise<T | null>;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    setDriverLocation(driverId: string, latitude: number, longitude: number): Promise<void>;
    getDriverLocation(driverId: string): Promise<{
        latitude: number;
        longitude: number;
    } | null>;
    getNearbyDrivers(latitude: number, longitude: number, radiusKm?: number): Promise<unknown[]>;
    addDriverToGeo(driverId: string, latitude: number, longitude: number): Promise<void>;
    removeDriverFromGeo(driverId: string): Promise<void>;
    setSession(userId: string, token: string, userData: any, ttl?: number): Promise<void>;
    getSession(token: string): Promise<any | null>;
    invalidateSession(token: string, userId: string): Promise<void>;
    checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
    incrementCounter(key: string, by?: number): Promise<number>;
    decrementCounter(key: string, by?: number): Promise<number>;
    getCounter(key: string): Promise<number>;
    pushToQueue(key: string, item: any): Promise<void>;
    popFromQueue(key: string): Promise<any | null>;
    getQueueLength(key: string): Promise<number>;
    addToSet(key: string, ...members: any[]): Promise<void>;
    removeFromSet(key: string, ...members: any[]): Promise<void>;
    getSet(key: string): Promise<any[]>;
    isInSet(key: string, member: any): Promise<boolean>;
    setHash(key: string, field: string, value: any): Promise<void>;
    getHash(key: string, field: string): Promise<any | null>;
    getHashAll(key: string): Promise<Record<string, any>>;
    deleteHash(key: string, field: string): Promise<void>;
    publish(channel: string, message: any): Promise<void>;
    subscribe(channel: string, callback: (message: any) => void): Promise<void>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=redis.service.d.ts.map