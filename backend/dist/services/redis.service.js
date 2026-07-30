"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
// backend/src/services/redis.service.ts
const ioredis_1 = __importDefault(require("ioredis"));
const winston_1 = __importDefault(require("winston"));
class RedisService {
    constructor() {
        this.logger = winston_1.default.createLogger({
            defaultMeta: { service: 'redis' }
        });
        this.redis = new ioredis_1.default({
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
    async connect() {
        try {
            const pong = await this.redis.ping();
            this.logger.info(`Redis connection successful: ${pong}`);
        }
        catch (error) {
            this.logger.error('Redis connection failed:', error);
            throw error;
        }
    }
    // ============================================
    // CACHE OPERATIONS
    // ============================================
    async set(key, value, ttl) {
        try {
            const serialized = JSON.stringify(value);
            if (ttl) {
                await this.redis.setex(key, ttl, serialized);
            }
            else {
                await this.redis.set(key, serialized);
            }
        }
        catch (error) {
            this.logger.error(`Failed to set key ${key}:`, error);
        }
    }
    async get(key) {
        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        }
        catch (error) {
            this.logger.error(`Failed to get key ${key}:`, error);
            return null;
        }
    }
    async del(key) {
        try {
            await this.redis.del(key);
        }
        catch (error) {
            this.logger.error(`Failed to delete key ${key}:`, error);
        }
    }
    async exists(key) {
        try {
            const exists = await this.redis.exists(key);
            return exists === 1;
        }
        catch (error) {
            this.logger.error(`Failed to check existence of key ${key}:`, error);
            return false;
        }
    }
    // ============================================
    // DRIVER LOCATION TRACKING
    // ============================================
    async setDriverLocation(driverId, latitude, longitude) {
        const key = `driver:location:${driverId}`;
        await this.set(key, { latitude, longitude, timestamp: Date.now() }, 3600); // 1 hour TTL
    }
    async getDriverLocation(driverId) {
        const key = `driver:location:${driverId}`;
        return this.get(key);
    }
    async getNearbyDrivers(latitude, longitude, radiusKm = 5) {
        // GEO operations for driver proximity
        const key = 'drivers:locations:geo';
        try {
            const nearbyDrivers = await this.redis.georadius(key, longitude, latitude, radiusKm, 'km', 'WITHDIST');
            return nearbyDrivers;
        }
        catch (error) {
            this.logger.error('Failed to get nearby drivers:', error);
            return [];
        }
    }
    async addDriverToGeo(driverId, latitude, longitude) {
        const key = 'drivers:locations:geo';
        try {
            await this.redis.geoadd(key, longitude, latitude, driverId);
        }
        catch (error) {
            this.logger.error(`Failed to add driver ${driverId} to geo index:`, error);
        }
    }
    async removeDriverFromGeo(driverId) {
        const key = 'drivers:locations:geo';
        try {
            await this.redis.zrem(key, driverId);
        }
        catch (error) {
            this.logger.error(`Failed to remove driver ${driverId} from geo index:`, error);
        }
    }
    // ============================================
    // SESSION MANAGEMENT
    // ============================================
    async setSession(userId, token, userData, ttl = 86400) {
        const key = `session:${token}`;
        const sessionData = { userId, ...userData, createdAt: Date.now() };
        await this.set(key, sessionData, ttl);
        // Also store user session list
        await this.redis.lpush(`user:sessions:${userId}`, token);
        await this.redis.expire(`user:sessions:${userId}`, ttl);
    }
    async getSession(token) {
        const key = `session:${token}`;
        return this.get(key);
    }
    async invalidateSession(token, userId) {
        const key = `session:${token}`;
        await this.del(key);
        await this.redis.lrem(`user:sessions:${userId}`, 1, token);
    }
    // ============================================
    // RATE LIMITING
    // ============================================
    async checkRateLimit(key, limit, windowSeconds) {
        try {
            const current = await this.redis.incr(key);
            if (current === 1) {
                await this.redis.expire(key, windowSeconds);
            }
            return current <= limit;
        }
        catch (error) {
            this.logger.error(`Rate limit check failed for ${key}:`, error);
            return false;
        }
    }
    // ============================================
    // REAL-TIME COUNTERS
    // ============================================
    async incrementCounter(key, by = 1) {
        return this.redis.incrby(key, by);
    }
    async decrementCounter(key, by = 1) {
        return this.redis.decrby(key, by);
    }
    async getCounter(key) {
        const value = await this.redis.get(key);
        return value ? parseInt(value) : 0;
    }
    // ============================================
    // LISTS (QUEUE OPERATIONS)
    // ============================================
    async pushToQueue(key, item) {
        const serialized = JSON.stringify(item);
        await this.redis.rpush(key, serialized);
    }
    async popFromQueue(key) {
        const item = await this.redis.lpop(key);
        return item ? JSON.parse(item) : null;
    }
    async getQueueLength(key) {
        return this.redis.llen(key);
    }
    // ============================================
    // SETS (UNIQUE VALUES)
    // ============================================
    async addToSet(key, ...members) {
        await this.redis.sadd(key, ...members);
    }
    async removeFromSet(key, ...members) {
        await this.redis.srem(key, ...members);
    }
    async getSet(key) {
        return this.redis.smembers(key);
    }
    async isInSet(key, member) {
        const result = await this.redis.sismember(key, member);
        return result === 1;
    }
    // ============================================
    // HASHES (OBJECT STORAGE)
    // ============================================
    async setHash(key, field, value) {
        const serialized = JSON.stringify(value);
        await this.redis.hset(key, field, serialized);
    }
    async getHash(key, field) {
        const value = await this.redis.hget(key, field);
        return value ? JSON.parse(value) : null;
    }
    async getHashAll(key) {
        const data = await this.redis.hgetall(key);
        const result = {};
        for (const [field, value] of Object.entries(data)) {
            try {
                result[field] = JSON.parse(value);
            }
            catch {
                result[field] = value;
            }
        }
        return result;
    }
    async deleteHash(key, field) {
        await this.redis.hdel(key, field);
    }
    // ============================================
    // PUBLISH/SUBSCRIBE
    // ============================================
    async publish(channel, message) {
        const serialized = JSON.stringify(message);
        await this.redis.publish(channel, serialized);
    }
    async subscribe(channel, callback) {
        const subscriber = this.redis.duplicate();
        subscriber.on('message', (ch, msg) => {
            if (ch === channel) {
                try {
                    const parsed = JSON.parse(msg);
                    callback(parsed);
                }
                catch (error) {
                    this.logger.error(`Failed to parse message on channel ${channel}:`, error);
                }
            }
        });
        await subscriber.subscribe(channel);
    }
    // ============================================
    // CLEANUP
    // ============================================
    async disconnect() {
        await this.redis.quit();
        this.logger.info('Redis disconnected');
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=redis.service.js.map