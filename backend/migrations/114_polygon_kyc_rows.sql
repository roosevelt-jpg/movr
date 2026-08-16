INSERT INTO integrations (key, display_name, category, is_required) VALUES
  ('polygon_amoy', 'Polygon Amoy / PoS RPC', 'identity_verification', FALSE),
  ('kyc_registry', 'KYCRegistry (on-chain attestation)', 'identity_verification', FALSE)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS kyc_chain_cursor (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  last_block BIGINT NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO kyc_chain_cursor (id, last_block) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE kyc_attestations
  ADD COLUMN IF NOT EXISTS confirmation_block BIGINT,
  ADD COLUMN IF NOT EXISTS verifier_address VARCHAR(66);
