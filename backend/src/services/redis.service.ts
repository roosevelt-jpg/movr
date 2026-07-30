// backend/src/services/redis.service.ts
import Redis, { Cluster } from 'ioredis';
import winston from 'winston';

export class RedisService {
  private redis: Redis;
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      defaultMeta: { service: 'redis' }
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      enableReadyCheck: false,
      enableOfflineQueue: false,
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const pong = await this.redis.ping();
      this.logger.info(`Redis connection successful: ${pong}`);
    } catch (error) {
      this.logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  // ============================================
  // CACHE OPERATIONS
  // ============================================
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  // ============================================
  // DRIVER LOCATION TRACKING
  // ============================================
  async setDriverLocation(driverId: string, latitude: number, longitude: number): Promise<void> {
    const key = `driver:location:${driverId}`;
    await this.set(key, { latitude, longitude, timestamp: Date.now() }, 3600); // 1 hour TTL
  }

  async getDriverLocation(driverId: string): Promise<{ latitude: number; longitude: number } | null> {
    const key = `driver:location:${driverId}`;
    return this.get<{ latitude: number; longitude: number }>(key);
  }

  async getNearbyDrivers(latitude: number, longitude: number, radiusKm: number = 5) {
    // GEO operations for driver proximity
    const key = 'drivers:locations:geo';
    try {
      const nearbyDrivers = await this.redis.georadius(
        key,
        longitude,
        latitude,
        radiusKm,
        'km',
        'WITHDIST'
      );
      return nearbyDrivers;
    } catch (error) {
      this.logger.error('Failed to get nearby drivers:', error);
      return [];
    }
  }

  async addDriverToGeo(driverId: string, latitude: number, longitude: number): Promise<void> {
    const key = 'drivers:locations:geo';
    try {
      await this.redis.geoadd(key, longitude, latitude, driverId);
    } catch (error) {
      this.logger.error(`Failed to add driver ${driverId} to geo index:`, error);
    }
  }

  async removeDriverFromGeo(driverId: string): Promise<void> {
    const key = 'drivers:locations:geo';
    try {
      await this.redis.zrem(key, driverId);
    } catch (error) {
      this.logger.error(`Failed to remove driver ${driverId} from geo index:`, error);
    }
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================
  async setSession(userId: string, token: string, userData: any, ttl: number = 86400): Promise<void> {
    const key = `session:${token}`;
    const sessionData = { userId, ...userData, createdAt: Date.now() };
    await this.set(key, sessionData, ttl);
    
    // Also store user session list
    await this.redis.lpush(`user:sessions:${userId}`, token);
    await this.redis.expire(`user:sessions:${userId}`, ttl);
  }

  async getSession(token: string): Promise<any | null> {
    const key = `session:${token}`;
    return this.get(key);
  }

  async invalidateSession(token: string, userId: string): Promise<void> {
    const key = `session:${token}`;
    await this.del(key);
    await this.redis.lrem(`user:sessions:${userId}`, 1, token);
  }

  // ============================================
  // RATE LIMITING
  // ============================================
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }
      return current <= limit;
    } catch (error) {
      this.logger.error(`Rate limit check failed for ${key}:`, error);
      return false;
    }
  }

  // ============================================
  // REAL-TIME COUNTERS
  // ============================================
  async incrementCounter(key: string, by: number = 1): Promise<number> {
    return this.redis.incrby(key, by);
  }

  async decrementCounter(key: string, by: number = 1): Promise<number> {
    return this.redis.decrby(key, by);
  }

  async getCounter(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value ? parseInt(value) : 0;
  }

  // ============================================
  // LISTS (QUEUE OPERATIONS)
  // ============================================
  async pushToQueue(key: string, item: any): Promise<void> {
    const serialized = JSON.stringify(item);
    await this.redis.rpush(key, serialized);
  }

  async popFromQueue(key: string): Promise<any | null> {
    const item = await this.redis.lpop(key);
    return item ? JSON.parse(item) : null;
  }

  async getQueueLength(key: string): Promise<number> {
    return this.redis.llen(key);
  }

  // ============================================
  // SETS (UNIQUE VALUES)
  // ============================================
  async addToSet(key: string, ...members: any[]): Promise<void> {
    await this.redis.sadd(key, ...members);
  }

  async removeFromSet(key: string, ...members: any[]): Promise<void> {
    await this.redis.srem(key, ...members);
  }

  async getSet(key: string): Promise<any[]> {
    return this.redis.smembers(key);
  }

  async isInSet(key: string, member: any): Promise<boolean> {
    const result = await this.redis.sismember(key, member);
    return result === 1;
  }

  // ============================================
  // HASHES (OBJECT STORAGE)
  // ============================================
  async setHash(key: string, field: string, value: any): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.hset(key, field, serialized);
  }

  async getHash(key: string, field: string): Promise<any | null> {
    const value = await this.redis.hget(key, field);
    return value ? JSON.parse(value) : null;
  }

  async getHashAll(key: string): Promise<Record<string, any>> {
    const data = await this.redis.hgetall(key);
    const result: Record<string, any> = {};
    for (const [field, value] of Object.entries(data)) {
      try {
        result[field] = JSON.parse(value as string);
      } catch {
        result[field] = value;
      }
    }
    return result;
  }

  async deleteHash(key: string, field: string): Promise<void> {
    await this.redis.hdel(key, field);
  }

  // ============================================
  // PUBLISH/SUBSCRIBE
  // ============================================
  async publish(channel: string, message: any): Promise<void> {
    const serialized = JSON.stringify(message);
    await this.redis.publish(channel, serialized);
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.redis.duplicate();
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          const parsed = JSON.parse(msg);
          callback(parsed);
        } catch (error) {
          this.logger.error(`Failed to parse message on channel ${channel}:`, error);
        }
      }
    });
    await subscriber.subscribe(channel);
  }

  // ============================================
  // CLEANUP
  // ============================================
  async disconnect(): Promise<void> {
    await this.redis.quit();
    this.logger.info('Redis disconnected');
  }
}
