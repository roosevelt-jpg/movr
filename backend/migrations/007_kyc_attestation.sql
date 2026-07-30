-- Phase 5A — KYC attestation (007; was 005A_kyc_attestation.sql)

DO $$ BEGIN
  CREATE TYPE kyc_attestation_status AS ENUM ('Pending', 'Verified', 'Rejected', 'Revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS kyc_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id VARCHAR(66) NOT NULL,
  record_hash VARCHAR(66) NOT NULL,
  status kyc_attestation_status NOT NULL DEFAULT 'Pending',
  tx_hash VARCHAR(128),
  chain VARCHAR(64) DEFAULT 'polygon-amoy',
  verified_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_attestations_user ON kyc_attestations(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_attestations_subject ON kyc_attestations(subject_id);
