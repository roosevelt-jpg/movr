-- Shop checkout payment methods + address defaults (noon-like checkout)
ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32),
  ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE saved_addresses
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_default
  ON saved_addresses (user_id, is_default DESC);
