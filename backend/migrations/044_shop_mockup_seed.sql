-- Shop mockup seed: store meta columns + Boutique 22 / Fresh Mart / etc.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eta_min_minutes INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS eta_max_minutes INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure a demo merchant owner exists for seeded stores
INSERT INTO users (id, phone, email, first_name, last_name, user_type, is_verified)
SELECT
  'a0000000-0000-4000-8000-000000000022'::uuid,
  '+233200000022',
  'boutique22@movr.local',
  'Boutique',
  '22',
  'merchant',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-4000-8000-000000000022'::uuid);

INSERT INTO merchants (id, user_id, business_name, category, status)
SELECT
  'b0000000-0000-4000-8000-000000000022'::uuid,
  'a0000000-0000-4000-8000-000000000022'::uuid,
  'Boutique 22',
  'Fashion',
  'active'
WHERE NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'b0000000-0000-4000-8000-000000000022'::uuid);

INSERT INTO stores (
  id, merchant_id, name, description, category, rating, review_count,
  eta_min_minutes, eta_max_minutes, hours_json, status, is_active, lat, lng, latitude, longitude
)
SELECT
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'b0000000-0000-4000-8000-000000000022'::uuid,
  'Boutique 22',
  'Fashion boutique in Osu',
  'Fashion',
  4.8,
  320,
  20,
  30,
  '{"closes":"21:00","label":"Open until 9:00 PM"}'::jsonb,
  'active',
  TRUE,
  5.5557,
  -0.1820,
  5.5557,
  -0.1820
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Boutique 22');

INSERT INTO stores (
  id, merchant_id, name, description, category, rating, review_count,
  eta_min_minutes, eta_max_minutes, hours_json, status, is_active, lat, lng, latitude, longitude
)
SELECT
  'c0000000-0000-4000-8000-000000000002'::uuid,
  'b0000000-0000-4000-8000-000000000022'::uuid,
  'Fresh Mart',
  'Grocery staples',
  'Grocery',
  4.6,
  210,
  15,
  25,
  '{"closes":"22:00","label":"Open until 10:00 PM"}'::jsonb,
  'active',
  TRUE,
  5.5600,
  -0.1900,
  5.5600,
  -0.1900
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Fresh Mart');

INSERT INTO stores (
  id, merchant_id, name, description, category, rating, review_count,
  eta_min_minutes, eta_max_minutes, hours_json, status, is_active, lat, lng, latitude, longitude
)
SELECT
  'c0000000-0000-4000-8000-000000000003'::uuid,
  'b0000000-0000-4000-8000-000000000022'::uuid,
  'Osu Pharmacy',
  'Pharmacy & wellness',
  'Pharmacy',
  4.9,
  540,
  10,
  20,
  '{"closes":"20:00","label":"Open until 8:00 PM"}'::jsonb,
  'active',
  TRUE,
  5.5580,
  -0.1750,
  5.5580,
  -0.1750
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Osu Pharmacy');

INSERT INTO stores (
  id, merchant_id, name, description, category, rating, review_count,
  eta_min_minutes, eta_max_minutes, hours_json, status, is_active, lat, lng, latitude, longitude
)
SELECT
  'c0000000-0000-4000-8000-000000000004'::uuid,
  'b0000000-0000-4000-8000-000000000022'::uuid,
  'City Electronics',
  'Gadgets & accessories',
  'Electronics',
  4.5,
  180,
  30,
  40,
  '{"closes":"19:00","label":"Open until 7:00 PM"}'::jsonb,
  'active',
  TRUE,
  5.5700,
  -0.1800,
  5.5700,
  -0.1800
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'City Electronics');

-- Update meta if stores already existed under those names
UPDATE stores SET rating = 4.8, review_count = 320, eta_min_minutes = 20, eta_max_minutes = 30,
  hours_json = COALESCE(hours_json, '{}'::jsonb) || '{"closes":"21:00","label":"Open until 9:00 PM"}'::jsonb,
  category = 'Fashion', status = 'active', is_active = TRUE
WHERE name = 'Boutique 22';

UPDATE stores SET rating = 4.6, review_count = 210, eta_min_minutes = 15, eta_max_minutes = 25,
  category = 'Grocery', status = 'active', is_active = TRUE
WHERE name = 'Fresh Mart';

UPDATE stores SET rating = 4.9, review_count = 540, eta_min_minutes = 10, eta_max_minutes = 20,
  category = 'Pharmacy', status = 'active', is_active = TRUE
WHERE name = 'Osu Pharmacy';

UPDATE stores SET rating = 4.5, review_count = 180, eta_min_minutes = 30, eta_max_minutes = 40,
  category = 'Electronics', status = 'active', is_active = TRUE
WHERE name = 'City Electronics';

-- Boutique 22 products (mockup)
INSERT INTO products (store_id, name, price, currency, in_stock, category_id)
SELECT s.id, v.name, v.price, 'GHS', TRUE, c.id
FROM stores s
CROSS JOIN (VALUES
  ('Cotton shirt', 120::numeric),
  ('Denim jacket', 280::numeric),
  ('Canvas sneakers', 210::numeric),
  ('Wool scarf', 65::numeric)
) AS v(name, price)
LEFT JOIN product_categories c ON c.slug = 'fashion'
WHERE s.name = 'Boutique 22'
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.store_id = s.id AND p.name = v.name
  );

-- Variants for cart mockup
INSERT INTO product_variants (product_id, name, price_delta)
SELECT p.id, 'Size M, Blue', 0
FROM products p
JOIN stores s ON s.id = p.store_id
WHERE s.name = 'Boutique 22' AND p.name = 'Cotton shirt'
  AND NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.name = 'Size M, Blue');

INSERT INTO product_variants (product_id, name, price_delta)
SELECT p.id, 'Size 42', 0
FROM products p
JOIN stores s ON s.id = p.store_id
WHERE s.name = 'Boutique 22' AND p.name = 'Canvas sneakers'
  AND NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.name = 'Size 42');

-- Default delivery fee config (used by checkout)
CREATE TABLE IF NOT EXISTS marketplace_pricing_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 15,
  currency VARCHAR(8) DEFAULT 'GHS',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO marketplace_pricing_config (id, delivery_fee) VALUES (1, 15)
ON CONFLICT (id) DO UPDATE SET delivery_fee = EXCLUDED.delivery_fee;
