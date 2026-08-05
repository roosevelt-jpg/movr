-- Phase 10/12 gap closure — referral milestones + SOS snapshot columns

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS milestone_json JSONB DEFAULT '{"stage":"signed_up"}'::jsonb,
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;

-- Normalize legacy pending → signed_up
UPDATE referrals SET status = 'signed_up' WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS referral_reward_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  reward_type VARCHAR(32) NOT NULL DEFAULT 'points', -- points | dvt | both
  points_amount NUMERIC(14,2) NOT NULL DEFAULT 100,
  dvt_amount NUMERIC(14,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO referral_reward_config (id, reward_type, points_amount, dvt_amount)
VALUES (1, 'points', 100, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE sos_emergencies
  ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(16),
  ADD COLUMN IF NOT EXISTS incident_snapshot JSONB DEFAULT '{}'::jsonb;

-- Soften SOS FKs so rider/driver user ids from rides table can be stored
ALTER TABLE sos_emergencies DROP CONSTRAINT IF EXISTS sos_emergencies_driver_id_fkey;
ALTER TABLE sos_emergencies DROP CONSTRAINT IF EXISTS sos_emergencies_customer_id_fkey;
