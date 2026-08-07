-- Align points/referral/transfer defaults to product mockups
UPDATE points_global_config
SET dvt_conversion_rate = 0.1
WHERE id = 1;
-- 0.1 => 10 points ≈ 1 DVT (matches "1,280 pts ≈ 128 DVT")

UPDATE referral_reward_config
SET points_amount = 250, reward_type = 'points'
WHERE id = 1;

UPDATE transfer_limits_config
SET fee_flat = 5, fee_percent = 0, max_per_tx = 5000, requires_identity_linked_above = 2000
WHERE id = 1;

-- Seed FX for GHS→NGN used by send-money mockup (1 GHS = 71.4 NGN)
INSERT INTO fx_rates (from_currency, to_currency, rate) VALUES
  ('GHS', 'NGN', 71.4),
  ('NGN', 'GHS', 0.014005602)
ON CONFLICT (from_currency, to_currency) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = NOW();

ALTER TABLE identity_verifications
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'pending';
