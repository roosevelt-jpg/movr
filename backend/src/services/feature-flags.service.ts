import crypto from 'crypto';
import { DatabaseService } from './database.service';

export class FeatureFlagsService {
  constructor(private db: DatabaseService) {}

  async isEnabled(key: string, userId?: string, city?: string): Promise<boolean> {
    const row = await this.db.query(`SELECT * FROM feature_flags WHERE key = $1`, [key]);
    const flag = row.rows[0];
    if (!flag || !flag.enabled) return false;

    const pct = Number(flag.rollout_pct || 0);
    if (pct >= 100) return true;
    if (pct <= 0) return false;

    const seed = `${key}:${userId || city || 'anon'}`;
    const hash = crypto.createHash('sha256').update(seed).digest();
    const bucket = hash[0] % 100;
    return bucket < pct;
  }

  async list() {
    return this.db.query(`SELECT * FROM feature_flags ORDER BY key`);
  }

  async set(
    key: string,
    enabled: boolean,
    rolloutPct = 100,
    metadata?: Record<string, unknown>
  ) {
    return this.db.query(
      `INSERT INTO feature_flags (key, enabled, rollout_pct, metadata, updated_at)
       VALUES ($1,$2,$3,COALESCE($4::jsonb, '{}'::jsonb),NOW())
       ON CONFLICT (key) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         rollout_pct = EXCLUDED.rollout_pct,
         metadata = COALESCE(EXCLUDED.metadata, feature_flags.metadata),
         updated_at = NOW()
       RETURNING *`,
      [key, enabled, rolloutPct, metadata ? JSON.stringify(metadata) : null]
    );
  }
}
