-- Phase 13 — Driver performance (014; was 012_driver_performance.sql)

DO $$ BEGIN
  CREATE TYPE driver_tier AS ENUM ('lite', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS driver_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acceptance_rate NUMERIC(5,2) DEFAULT 100,
  cancellation_rate NUMERIC(5,2) DEFAULT 0,
  on_time_rate NUMERIC(5,2) DEFAULT 100,
  rides_completed INTEGER DEFAULT 0,
  rides_accepted INTEGER DEFAULT 0,
  rides_cancelled INTEGER DEFAULT 0,
  rides_offered INTEGER DEFAULT 0,
  current_tier driver_tier DEFAULT 'lite',
  period_start TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
  period_end TIMESTAMPTZ DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (driver_id, period_start)
);

CREATE TABLE IF NOT EXISTS tier_thresholds (
  tier driver_tier PRIMARY KEY,
  min_acceptance_rate NUMERIC(5,2) NOT NULL,
  max_cancellation_rate NUMERIC(5,2) NOT NULL,
  min_on_time_rate NUMERIC(5,2) NOT NULL,
  min_rides INTEGER NOT NULL,
  subscription_discount_pct NUMERIC(5,2) DEFAULT 0,
  matching_priority_weight NUMERIC(5,2) DEFAULT 1.0
);

INSERT INTO tier_thresholds (tier, min_acceptance_rate, max_cancellation_rate, min_on_time_rate, min_rides, subscription_discount_pct, matching_priority_weight) VALUES
  ('lite', 70, 20, 70, 0, 0, 1.0),
  ('pro', 85, 10, 85, 50, 5, 1.25),
  ('premium', 95, 5, 95, 150, 15, 1.5)
ON CONFLICT (tier) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_driver_metrics_driver ON driver_metrics(driver_id);
