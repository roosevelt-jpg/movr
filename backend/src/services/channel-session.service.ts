import { RedisService } from './redis.service';
import getLogger from '../utils/logger';

/**
 * Pending booking sessions + phone rate limits for alt channels (Phase 22).
 * Falls back to in-memory when Redis is unavailable.
 */
export class ChannelSessionService {
  private logger = getLogger('channel-session');
  private memory = new Map<string, { value: any; expires: number }>();

  constructor(private redis?: RedisService | null) {}

  async rateLimitPhone(phone: string, channel: string, limit = 20, windowSeconds = 60) {
    const key = `rl:channel:${channel}:${phone || 'unknown'}`;
    if (this.redis?.checkRateLimit) {
      try {
        const ok = await this.redis.checkRateLimit(key, limit, windowSeconds);
        if (!ok) throw new Error('Too many requests — slow down');
        return;
      } catch (e: any) {
        if (e.message?.includes('Too many')) throw e;
      }
    }
    const now = Date.now();
    const entry = this.memory.get(key);
    const count = entry && entry.expires > now ? Number(entry.value || 0) + 1 : 1;
    if (count > limit) throw new Error('Too many requests — slow down');
    this.memory.set(key, { value: count, expires: now + windowSeconds * 1000 });
  }

  async setPending(key: string, payload: any, ttlSeconds = 600) {
    const full = `channel:pending:${key}`;
    // Always keep an in-memory copy so local simulators work when Redis is down/flaky.
    this.memory.set(full, { value: payload, expires: Date.now() + ttlSeconds * 1000 });
    if (this.redis?.set) {
      try {
        await this.redis.set(full, payload, ttlSeconds);
      } catch {
        /* memory already set */
      }
    }
  }

  async getPending(key: string) {
    const full = `channel:pending:${key}`;
    const entry = this.memory.get(full);
    if (entry && entry.expires >= Date.now()) {
      return entry.value;
    }
    if (this.redis?.get) {
      try {
        const v = await this.redis.get(full);
        if (v) return v;
      } catch {
        /* fall through */
      }
    }
    this.memory.delete(full);
    return null;
  }

  async clearPending(key: string) {
    const full = `channel:pending:${key}`;
    this.memory.delete(full);
    try {
      if ((this.redis as any)?.del) await (this.redis as any).del(full);
    } catch {
      /* optional */
    }
  }
}
