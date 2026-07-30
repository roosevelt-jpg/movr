-- backend/migrations/001_add_security_features.sql

-- Video Recordings Table
CREATE TABLE IF NOT EXISTS video_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- seconds
  pickup_location JSONB,
  dropoff_location JSONB,
  file_size INTEGER, -- bytes
  s3_url TEXT,
  ipfs_hash TEXT,
  blockchain_hash TEXT,
  sos_id UUID,
  sos_evidence BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'recording', -- recording, processing, stored, verified
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  INDEX idx_ride_id (ride_id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Identity Verifications Table
CREATE TABLE IF NOT EXISTS identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- national_id, passport, driving_license
  document_number VARCHAR(100),
  issued_date DATE,
  expiry_date DATE,
  front_image_url TEXT,
  back_image_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_method VARCHAR(20), -- api, manual
  confidence INTEGER, -- 0-100
  details JSONB, -- stores API response and verification details
  result_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  INDEX idx_driver_id (driver_id),
  INDEX idx_verified (verified),
  INDEX idx_document_type (document_type)
);

-- Merchant Verifications Table
CREATE TABLE IF NOT EXISTS merchant_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  business_registration_number VARCHAR(100),
  owner_id_verified BOOLEAN DEFAULT FALSE,
  business_license_verified BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  confidence INTEGER, -- 0-100
  details JSONB, -- stores verification details
  verified_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  INDEX idx_merchant_id (merchant_id),
  INDEX idx_verified (verified)
);

-- SOS Emergency Records Table
CREATE TABLE IF NOT EXISTS sos_emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sos_type VARCHAR(20) NOT NULL, -- driver, customer
  location JSONB NOT NULL, -- lat, lng
  video_recording_id UUID REFERENCES video_recordings(id),
  status VARCHAR(50) DEFAULT 'active', -- active, resolved, cancelled
  resolved_by UUID,
  resolution VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_ride_id (ride_id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Emergency Contacts Table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL, -- driver, customer
  contact_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  relationship VARCHAR(50),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_user_type (user_type),
  UNIQUE (user_id, phone_number)
);

-- Emergency Streams Table (for live video during SOS)
CREATE TABLE IF NOT EXISTS emergency_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES video_recordings(id),
  room_id VARCHAR(100) NOT NULL,
  token TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expired_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_recording_id (recording_id),
  INDEX idx_active (active)
);

-- Blockchain Evidence Table
CREATE TABLE IF NOT EXISTS blockchain_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id UUID NOT NULL REFERENCES sos_emergencies(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  video_id UUID REFERENCES video_recordings(id),
  evidence_hash VARCHAR(255) NOT NULL,
  blockchain_tx_hash VARCHAR(255),
  stored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  INDEX idx_sos_id (sos_id),
  INDEX idx_ride_id (ride_id),
  INDEX idx_blockchain_tx_hash (blockchain_tx_hash)
);

-- Security Personnel Table
CREATE TABLE IF NOT EXISTS security_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_number VARCHAR(50) UNIQUE NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'pending',
  location GEOMETRY(Point, 4326),
  service_area GEOMETRY(Polygon, 4326),
  phone_number VARCHAR(20),
  email VARCHAR(255),
  fcm_token TEXT, -- Firebase Cloud Messaging token for push notifications
  status VARCHAR(20) DEFAULT 'inactive', -- active, inactive, on_leave
  shift_start TIME,
  shift_end TIME,
  response_time_average INTEGER, -- seconds
  cases_handled INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  INDEX idx_status (status),
  INDEX idx_location (location),
  INDEX idx_service_area (service_area)
);

-- Dispute Resolution Table
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  video_recording_id UUID REFERENCES video_recordings(id),
  dispute_type VARCHAR(100) NOT NULL, -- safety_concern, fare_dispute, property_damage, harassment
  description TEXT NOT NULL,
  evidence_ids JSONB, -- array of document/video IDs
  status VARCHAR(50) DEFAULT 'open', -- open, under_review, resolved, closed
  resolution VARCHAR(255),
  refund_amount DECIMAL(10, 2),
  resolved_by UUID REFERENCES security_personnel(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_ride_id (ride_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Create indexes for performance
CREATE INDEX idx_video_recordings_ride_id ON video_recordings(ride_id);
CREATE INDEX idx_video_recordings_driver_id ON video_recordings(driver_id);
CREATE INDEX idx_video_recordings_customer_id ON video_recordings(customer_id);
CREATE INDEX idx_video_recordings_status ON video_recordings(status);
CREATE INDEX idx_video_recordings_created_at ON video_recordings(created_at DESC);

CREATE INDEX idx_identity_verifications_driver_id ON identity_verifications(driver_id);
CREATE INDEX idx_identity_verifications_verified ON identity_verifications(verified);

CREATE INDEX idx_sos_emergencies_ride_id ON sos_emergencies(ride_id);
CREATE INDEX idx_sos_emergencies_driver_id ON sos_emergencies(driver_id);
CREATE INDEX idx_sos_emergencies_status ON sos_emergencies(status);

CREATE INDEX idx_disputes_ride_id ON disputes(ride_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- Enable PostGIS extension for location-based queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Phase 28 additions: local-record + async-upload model with consent + retention
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

-- Grant permissions when role exists (docker init may use different app user)
DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO movr_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO movr_app;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
