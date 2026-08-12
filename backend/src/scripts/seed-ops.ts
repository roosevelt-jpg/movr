/**
 * Seed ops baseline data (admin user + feature flags).
 * Run: pnpm --filter @movr/backend exec ts-node --transpile-only src/scripts/seed-ops.ts
 */
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'movr',
  password: process.env.DB_PASSWORD || 'movr',
  database: process.env.DB_NAME || 'movr_db',
});

const FLAGS = [
  {
    key: 'self_drive_rentals',
    enabled: true,
    rollout_pct: 25,
    metadata: {
      label: 'Self-drive rentals',
      phase: 'Phase 15 rollout',
      rolloutLabel: '25% · Accra only',
    },
  },
  {
    key: 'voice_booking',
    enabled: true,
    rollout_pct: 100,
    metadata: { label: 'Voice booking', phase: 'Phase 23', rolloutLabel: '100% · all regions' },
  },
  {
    key: 'ussd_booking',
    enabled: true,
    rollout_pct: 10,
    metadata: { label: 'USSD booking', phase: 'Phase 22', rolloutLabel: '10% · Ghana' },
  },
  {
    key: 'cross_border_transfers',
    enabled: false,
    rollout_pct: 0,
    metadata: {
      label: 'Cross-border transfers',
      phase: 'Phase 27',
      rolloutLabel: '0% · compliance review pending',
    },
  },
];

async function main() {
  const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin123!', 10);

  await pool.query(
    `INSERT INTO users (email, phone, first_name, last_name, password, user_type, country, city, is_active, is_verified, email_verified_at)
     VALUES ($1, $2, 'Movr', 'Admin', $3, 'admin', 'GH', 'Accra', true, true, NOW())
     ON CONFLICT (email) DO UPDATE SET
       password = EXCLUDED.password,
       user_type = 'admin',
       is_active = true,
       is_verified = true,
       updated_at = NOW()`,
    ['admin@mymovr.io', '+233200000001', hash]
  );

  await pool
    .query(
      `INSERT INTO admin_roles (user_id, role)
       SELECT id, v.role
       FROM users, (VALUES ('super_admin'), ('trust_and_safety'), ('ops')) AS v(role)
       WHERE lower(email) = 'admin@mymovr.io'
       ON CONFLICT DO NOTHING`
    )
    .catch(() => undefined);

  for (const f of FLAGS) {
    await pool.query(
      `INSERT INTO feature_flags (key, enabled, rollout_pct, metadata, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         rollout_pct = EXCLUDED.rollout_pct,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      [f.key, f.enabled, f.rollout_pct, JSON.stringify(f.metadata)]
    );
  }

  // Ensure rewards_rules has baseline rows if table exists and empty
  await pool
    .query(
      `INSERT INTO rewards_rules (event_type, points_amount, active)
       SELECT * FROM (VALUES
         ('ride_completed', 10, true),
         ('order_completed', 8, true),
         ('referral_qualified', 250, true),
         ('stake_created', 5, false)
       ) AS v(event_type, points_amount, active)
       WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rewards_rules')
         AND NOT EXISTS (SELECT 1 FROM rewards_rules LIMIT 1)
       ON CONFLICT DO NOTHING`
    )
    .catch(() => undefined);

  console.log('Seeded admin@mymovr.io (password from SEED_ADMIN_PASSWORD or Admin123!)');
  console.log('Seeded feature flags');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
