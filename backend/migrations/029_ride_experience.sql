-- Phase 12 — Ride experience (partial schema support)

CREATE TABLE IF NOT EXISTS ride_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ride_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ride_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'GHS',
  payment_reference VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- sos_emergencies may be created in 028; skip gracefully if that migration has not run yet
DO $$ BEGIN
  ALTER TABLE sos_emergencies
    ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(16),
    ADD COLUMN IF NOT EXISTS incident_snapshot JSONB DEFAULT '{}'::jsonb;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ride_messages_ride ON ride_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_share_token ON ride_share_links(token);
