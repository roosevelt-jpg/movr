-- Phase 26 — National ID linking (026; was 024_national_id_linking.sql)

DO $$ BEGIN
  CREATE TYPE national_id_type AS ENUM (
    'ghana_card', 'nigeria_nin', 'cote_divoire_oneci', 'senegal_cni', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE identity_link_check_type AS ENUM (
    'id_to_license', 'id_to_vehicle', 'id_to_phone'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE identity_link_status AS ENUM ('match', 'mismatch', 'unverifiable');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS id_verification_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(8) NOT NULL REFERENCES countries(code),
  id_type national_id_type NOT NULL,
  provider_name VARCHAR(128) NOT NULL,
  api_base_url TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  UNIQUE (country_code, id_type)
);

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

CREATE TABLE IF NOT EXISTS identity_link_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_type identity_link_check_type NOT NULL,
  status identity_link_status NOT NULL,
  details_json JSONB DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO id_verification_providers (country_code, id_type, provider_name, api_base_url, is_active) VALUES
  ('GH', 'ghana_card', 'NIA Ghana Card', 'https://api.nia.gov.gh', FALSE),
  ('NG', 'nigeria_nin', 'NIMC NIN', 'https://api.nimc.gov.ng', FALSE),
  ('CI', 'cote_divoire_oneci', 'ONECI', NULL, FALSE),
  ('SN', 'senegal_cni', 'CNI Senegal', NULL, FALSE)
ON CONFLICT (country_code, id_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_identity_link_checks_user ON identity_link_checks(user_id);
