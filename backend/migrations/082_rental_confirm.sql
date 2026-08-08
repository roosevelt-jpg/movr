-- 082: Confirm Rental — vehicle color, hubs, insurance/DVT pricing

ALTER TABLE rental_vehicles
  ADD COLUMN IF NOT EXISTS color VARCHAR(32) DEFAULT 'Silver',
  ADD COLUMN IF NOT EXISTS insurance_daily NUMERIC(12,2) DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS dvt_discount_default NUMERIC(12,2) DEFAULT 2000;

UPDATE rental_vehicles SET
  color = COALESCE(color, 'Silver'),
  insurance_daily = COALESCE(insurance_daily, 3000),
  dvt_discount_default = COALESCE(dvt_discount_default, 2000)
WHERE TRUE;

UPDATE rental_vehicles SET color = 'Silver'
WHERE make = 'Honda' AND model = 'CR-V';
UPDATE rental_vehicles SET color = 'White'
WHERE make = 'Toyota' AND model = 'Corolla';
UPDATE rental_vehicles SET color = 'Black'
WHERE make = 'BMW';

CREATE TABLE IF NOT EXISTS rental_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(64) DEFAULT 'Lagos',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO rental_hubs (id, name, address, city, is_default)
SELECT
  'f0000000-0000-4000-8000-0000000000a1'::uuid,
  'Movr Hub',
  'Movr Hub, Victoria Island, Lagos',
  'Lagos',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM rental_hubs WHERE is_default = TRUE);

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS insurance_fee NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dvt_discount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pickup_hub_id UUID REFERENCES rental_hubs(id),
  ADD COLUMN IF NOT EXISTS return_address TEXT,
  ADD COLUMN IF NOT EXISTS days INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Ensure CR-V pricing matches mockup (₦45k + ₦3k insurance − ₦2k DVT = ₦46k)
UPDATE rental_vehicles
SET daily_rate = 45000,
    insurance_daily = 3000,
    dvt_discount_default = 2000,
    color = 'Silver',
    currency_code = 'NGN'
WHERE id = 'e0000000-0000-4000-8000-000000000002'::uuid
   OR (make = 'Honda' AND model = 'CR-V');
