-- Wallet pay for trips/subscriptions: status flags on rides.

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(64),
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) DEFAULT 'pending';
