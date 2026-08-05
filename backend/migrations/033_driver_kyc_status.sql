-- Driver KYC status for Phase 5A admin queue + attestation hooks

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(32) DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_drivers_user ON drivers(user_id);
