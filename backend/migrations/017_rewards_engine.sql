-- Phase 16 — Rewards trigger engine (017; was 015_rewards_engine.sql)

CREATE TABLE IF NOT EXISTS rewards_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(64) NOT NULL UNIQUE,
  points_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  dvt_amount NUMERIC(14,8) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rewards_rules (event_type, points_amount, dvt_amount, active) VALUES
  ('ride_completed', 50, 0, TRUE),
  ('order_completed', 30, 0, TRUE),
  ('delivery_completed', 30, 0, TRUE),
  ('referral_qualified', 100, 0, TRUE),
  ('stake_created', 10, 0, FALSE)
ON CONFLICT (event_type) DO NOTHING;
