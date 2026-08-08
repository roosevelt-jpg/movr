-- 075: Restaurant menu, cart DVT discount, order confirmed/tracking

ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS dvt_discount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS courier_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS courier_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS store_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS store_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS item_count INT DEFAULT 0;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS menu_category VARCHAR(64),
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS emoji VARCHAR(16);

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS hours_text VARCHAR(120),
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(8) DEFAULT 'NGN';

-- Chicken Republic merchant + store
INSERT INTO users (id, phone, email, first_name, last_name, user_type, is_verified)
SELECT
  'a0000000-0000-4000-8000-000000000014'::uuid,
  '+2348010000014',
  'chickenrepublic@movr.local',
  'Chicken',
  'Republic',
  'merchant',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-4000-8000-000000000014'::uuid);

INSERT INTO merchants (id, user_id, business_name, category, status)
SELECT
  'b0000000-0000-4000-8000-000000000014'::uuid,
  'a0000000-0000-4000-8000-000000000014'::uuid,
  'Chicken Republic',
  'Fast Food',
  'active'
WHERE NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'b0000000-0000-4000-8000-000000000014'::uuid);

INSERT INTO stores (
  id, merchant_id, name, description, category, rating, review_count,
  eta_min_minutes, eta_max_minutes, hours_json, hours_text, status, is_active,
  lat, lng, latitude, longitude, min_order_amount, currency_code
)
SELECT
  'c0000000-0000-4000-8000-000000000014'::uuid,
  'b0000000-0000-4000-8000-000000000014'::uuid,
  'Chicken Republic',
  'Crispy chicken, burgers & sides',
  'Fast Food',
  4.8,
  1240,
  20,
  35,
  '{"closes":"22:00","label":"Open until 10 PM"}'::jsonb,
  'Open until 10 PM',
  'active',
  TRUE,
  6.4281,
  3.4219,
  6.4281,
  3.4219,
  500,
  'NGN'
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE id = 'c0000000-0000-4000-8000-000000000014'::uuid);

-- Menu items (use price or base_price depending on schema — both common)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'price'
  ) THEN
    INSERT INTO products (id, store_id, name, description, price, menu_category, is_popular, emoji, in_stock, currency)
    VALUES
      ('d0000000-0000-4000-8000-000000000141'::uuid, 'c0000000-0000-4000-8000-000000000014'::uuid,
       'Zinger Burger Meal', 'Crispy chicken burger, fries & drink', 3200, 'Burgers', true, '🍔', true, 'NGN'),
      ('d0000000-0000-4000-8000-000000000142'::uuid, 'c0000000-0000-4000-8000-000000000014'::uuid,
       'Grilled Chicken Combo', '2pc chicken, coleslaw & plantain', 4500, 'Chicken', true, '🍗', true, 'NGN'),
      ('d0000000-0000-4000-8000-000000000143'::uuid, 'c0000000-0000-4000-8000-000000000014'::uuid,
       'Chicken Wrap', 'Spicy wrap with mayo', 2800, 'Chicken', false, '🌯', true, 'NGN'),
      ('d0000000-0000-4000-8000-000000000144'::uuid, 'c0000000-0000-4000-8000-000000000014'::uuid,
       'Fries Bucket', 'Large seasoned fries', 1500, 'Sides', false, '🍟', true, 'NGN')
    ON CONFLICT (id) DO NOTHING;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'base_price'
  ) THEN
    INSERT INTO products (id, store_id, name, description, base_price, menu_category, is_popular, emoji, in_stock)
    VALUES
      ('d0000000-0000-4000-8000-000000000141'::uuid, 'c0000000-0000-4000-8000-000000000014'::uuid,
       'Zinger Burger Meal', 'Crispy chicken burger, fries & drink', 3200, 'Burgers', true, '🍔', true),
      ('d0000000-0000-4000-8000-000000000142'::uuid, 'c0000000-0000-4000-8000-000000000014'::uuid,
       'Grilled Chicken Combo', '2pc chicken, coleslaw & plantain', 4500, 'Chicken', true, '🍗', true),
      ('d0000000-0000-4000-8000-000000000143'::uuid, 'c0000000-0000-4000-8000-000000000014'::uuid,
       'Chicken Wrap', 'Spicy wrap with mayo', 2800, 'Chicken', false, '🌯', true),
      ('d0000000-0000-4000-8000-000000000144'::uuid, 'c0000000-0000-4000-8000-000000000014'::uuid,
       'Fries Bucket', 'Large seasoned fries', 1500, 'Sides', false, '🍟', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Chicken Republic product seed skipped: %', SQLERRM;
END $$;

-- Demo courier for tracking
INSERT INTO users (id, phone, email, first_name, last_name, user_type, is_verified)
SELECT
  'a0000000-0000-4000-8000-0000000000c0'::uuid,
  '+23480100000C0',
  'courier.tunde@movr.local',
  'Tunde',
  'Adeyemi',
  'driver',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-4000-8000-0000000000c0'::uuid);
