-- Trust depth: agent confirm codes, SLA uniqueness, dispute refunds metadata

ALTER TABLE settlement_receipts
  ADD COLUMN IF NOT EXISTS confirm_code VARCHAR(12);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_receipts_confirm_code
  ON settlement_receipts(confirm_code) WHERE confirm_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reliability_events_sla_ride
  ON reliability_events(ride_id) WHERE event_type = 'sla_breach' AND ride_id IS NOT NULL;

ALTER TABLE wallet_withdrawals
  ADD COLUMN IF NOT EXISTS reference VARCHAR(80);

INSERT INTO platform_settings (key, value)
VALUES
  ('trust_no_show_min_wait_seconds', '300'::jsonb),
  ('trust_buyer_protection_note', '"Buyer protection: dispute any shop issue from Wallet → Settle within 48h."'::jsonb)
ON CONFLICT (key) DO NOTHING;
