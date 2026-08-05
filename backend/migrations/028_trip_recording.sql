-- Phase 28 — Trip recording + security features (Postgres-safe rewrite)
-- Fixes invalid MySQL-style inline INDEX syntax from the original file.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Video Recordings
CREATE TABLE IF NOT EXISTS video_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration INTEGER,
  pickup_location JSONB,
  dropoff_location JSONB,
  file_size INTEGER,
  s3_url TEXT,
  ipfs_hash TEXT,
  blockchain_hash TEXT,
  sos_id UUID,
  sos_evidence BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'recording',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_recordings_ride_id ON video_recordings(ride_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_driver_id ON video_recordings(driver_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_customer_id ON video_recordings(customer_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_status ON video_recordings(status);
CREATE INDEX IF NOT EXISTS idx_video_recordings_created_at ON video_recordings(created_at DESC);

-- Identity Verifications
CREATE TABLE IF NOT EXISTS identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  document_number VARCHAR(100),
  issued_date DATE,
  expiry_date DATE,
  front_image_url TEXT,
  back_image_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_method VARCHAR(20),
  confidence INTEGER,
  details JSONB,
  result_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_driver_id ON identity_verifications(driver_id);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_verified ON identity_verifications(verified);

-- Merchant Verifications
CREATE TABLE IF NOT EXISTS merchant_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  business_registration_number VARCHAR(100),
  owner_id_verified BOOLEAN DEFAULT FALSE,
  business_license_verified BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  confidence INTEGER,
  details JSONB,
  verified_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_verifications_merchant_id ON merchant_verifications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_verifications_verified ON merchant_verifications(verified);

-- SOS Emergency Records
CREATE TABLE IF NOT EXISTS sos_emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sos_type VARCHAR(20) NOT NULL,
  location JSONB NOT NULL,
  video_recording_id UUID REFERENCES video_recordings(id),
  status VARCHAR(50) DEFAULT 'active',
  resolved_by UUID,
  resolution VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sos_emergencies_ride_id ON sos_emergencies(ride_id);
CREATE INDEX IF NOT EXISTS idx_sos_emergencies_driver_id ON sos_emergencies(driver_id);
CREATE INDEX IF NOT EXISTS idx_sos_emergencies_customer_id ON sos_emergencies(customer_id);
CREATE INDEX IF NOT EXISTS idx_sos_emergencies_status ON sos_emergencies(status);
CREATE INDEX IF NOT EXISTS idx_sos_emergencies_created_at ON sos_emergencies(created_at);

-- Emergency Contacts
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL,
  contact_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  relationship VARCHAR(50),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_type ON emergency_contacts(user_type);

-- Emergency Streams
CREATE TABLE IF NOT EXISTS emergency_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES video_recordings(id),
  room_id VARCHAR(100) NOT NULL,
  token TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expired_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emergency_streams_recording_id ON emergency_streams(recording_id);
CREATE INDEX IF NOT EXISTS idx_emergency_streams_active ON emergency_streams(active);

-- Blockchain Evidence
CREATE TABLE IF NOT EXISTS blockchain_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id UUID NOT NULL REFERENCES sos_emergencies(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  video_id UUID REFERENCES video_recordings(id),
  evidence_hash VARCHAR(255) NOT NULL,
  blockchain_tx_hash VARCHAR(255),
  stored_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blockchain_evidence_sos_id ON blockchain_evidence(sos_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_evidence_ride_id ON blockchain_evidence(ride_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_evidence_tx ON blockchain_evidence(blockchain_tx_hash);

-- Security Personnel (JSONB location — no PostGIS required)
CREATE TABLE IF NOT EXISTS security_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_number VARCHAR(50) UNIQUE NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'pending',
  location JSONB,
  service_area JSONB,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  fcm_token TEXT,
  status VARCHAR(20) DEFAULT 'inactive',
  shift_start TIME,
  shift_end TIME,
  response_time_average INTEGER,
  cases_handled INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_personnel_status ON security_personnel(status);

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  video_recording_id UUID REFERENCES video_recordings(id),
  dispute_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  evidence_ids JSONB,
  status VARCHAR(50) DEFAULT 'open',
  resolution VARCHAR(255),
  refund_amount NUMERIC(10, 2),
  resolved_by UUID REFERENCES security_personnel(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disputes_ride_id ON disputes(ride_id);
CREATE INDEX IF NOT EXISTS idx_disputes_customer_id ON disputes(customer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_driver_id ON disputes(driver_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON disputes(created_at);

-- Phase 28: local-record + async-upload model with consent + retention
DO $$ BEGIN
  CREATE TYPE trip_recording_status AS ENUM (
    'recording', 'uploading', 'uploaded', 'failed', 'deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS trip_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  status trip_recording_status DEFAULT 'recording',
  local_duration_seconds INTEGER,
  cloud_storage_key TEXT,
  uploaded_at TIMESTAMPTZ,
  retention_expires_at TIMESTAMPTZ,
  flagged_for_dispute BOOLEAN DEFAULT FALSE,
  flagged_at TIMESTAMPTZ,
  flagged_by_admin_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ride_id)
);

CREATE TABLE IF NOT EXISTS recording_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE UNIQUE,
  rider_notified_at TIMESTAMPTZ,
  driver_consented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_recordings_status ON trip_recordings(status);
CREATE INDEX IF NOT EXISTS idx_trip_recordings_retention ON trip_recordings(retention_expires_at)
  WHERE status = 'uploaded' AND flagged_for_dispute = FALSE;

-- 026 columns that depend on identity_verifications existing
ALTER TABLE identity_verifications
  ADD COLUMN IF NOT EXISTS national_id_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS national_id_country VARCHAR(8),
  ADD COLUMN IF NOT EXISTS driving_license_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS driving_license_issuing_authority VARCHAR(128),
  ADD COLUMN IF NOT EXISTS vehicle_registration_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS linked_phone_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS link_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS link_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_linked BOOLEAN DEFAULT FALSE;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO movr_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO movr_app;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
