-- 074: OTP 4-digit auth, driver-matched ride fields, arrival receipt, profile setup

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN users.onboarding_step IS 'Customer onboarding progress: 1=phone, 2=profile, 3=done';

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS base_fare NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS distance_fare NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS dvt_discount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS duration_minutes INT,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(64) DEFAULT 'Movr Wallet',
  ADD COLUMN IF NOT EXISTS dvt_earned NUMERIC(12,2) DEFAULT 0;

-- Ensure driver vehicle color is available via driver_vehicles (already exists); seed helpers on rides if needed
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS vehicle_color VARCHAR(64);

-- Tip presets helper (optional custom tips already in ride_tips)
CREATE TABLE IF NOT EXISTS ride_receipts (
  ride_id UUID PRIMARY KEY REFERENCES rides(id) ON DELETE CASCADE,
  destination_label VARCHAR(200),
  duration_minutes INT,
  distance_km NUMERIC(10,2),
  base_fare NUMERIC(12,2) NOT NULL DEFAULT 0,
  distance_fare NUMERIC(12,2) NOT NULL DEFAULT 0,
  dvt_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  dvt_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(8) DEFAULT 'NGN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
