-- Payment providers mockup rows + product attributes + wishlist
-- (Avoid new enum value in same txn — use country_code STBY for standby)

-- Align global default to Paystack (mockup)
UPDATE payment_provider_config
SET provider = 'paystack', is_active = TRUE, updated_at = NOW()
WHERE scope = 'global';

-- Ensure GH / NG / KE Paystack
INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
SELECT 'country', v.cc, 'paystack', TRUE
FROM (VALUES ('GH'), ('NG'), ('KE')) AS v(cc)
WHERE NOT EXISTS (
  SELECT 1 FROM payment_provider_config p
  WHERE p.scope = 'country' AND p.country_code = v.cc AND p.is_active = TRUE
);

UPDATE payment_provider_config
SET provider = 'paystack', is_active = TRUE, updated_at = NOW()
WHERE scope = 'country' AND country_code IN ('GH', 'NG', 'KE');

-- Senegal → Flutterwave (Paystack unsupported)
INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
SELECT 'country', 'SN', 'flutterwave', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM payment_provider_config p
  WHERE p.scope = 'country' AND p.country_code = 'SN' AND p.is_active = TRUE
);

UPDATE payment_provider_config
SET provider = 'flutterwave', is_active = TRUE, updated_at = NOW()
WHERE scope = 'country' AND country_code = 'SN';

-- Standby Flutterwave (inactive country sentinel STBY)
INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
SELECT 'country', 'STBY', 'flutterwave', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM payment_provider_config p
  WHERE p.country_code = 'STBY'
);

UPDATE payment_provider_config
SET provider = 'flutterwave', is_active = FALSE, updated_at = NOW()
WHERE country_code = 'STBY';

-- Product attributes for size/color UI
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

UPDATE products p SET attributes = jsonb_build_object(
  'sizes', '["S","M","L","XL"]'::jsonb,
  'colors', jsonb_build_array(
    jsonb_build_object('name', 'Blue', 'hex', '#3B82F6'),
    jsonb_build_object('name', 'Charcoal', 'hex', '#374151'),
    jsonb_build_object('name', 'White', 'hex', '#E5E7EB')
  )
)
FROM stores s
WHERE p.store_id = s.id AND s.name = 'Boutique 22' AND p.name = 'Cotton shirt';

-- Size × color variants for Cotton shirt
INSERT INTO product_variants (product_id, name, price_delta)
SELECT p.id, v.name, 0
FROM products p
JOIN stores s ON s.id = p.store_id
CROSS JOIN (VALUES
  ('S · Blue'), ('M · Blue'), ('L · Blue'), ('XL · Blue'),
  ('S · Charcoal'), ('M · Charcoal'), ('L · Charcoal'), ('XL · Charcoal'),
  ('S · White'), ('M · White'), ('L · White'), ('XL · White')
) AS v(name)
WHERE s.name = 'Boutique 22' AND p.name = 'Cotton shirt'
  AND NOT EXISTS (
    SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.name = v.name
  );

CREATE TABLE IF NOT EXISTS product_wishlist (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_wishlist_user ON product_wishlist(user_id);
