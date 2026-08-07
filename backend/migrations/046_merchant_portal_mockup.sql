-- Merchant portal mockup align: variants, payouts, analytics sample orders, payout account

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS payout_account JSONB DEFAULT '{}'::jsonb;

ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Default bank for Boutique 22 merchant
UPDATE merchants
SET payout_account = COALESCE(payout_account, '{}'::jsonb) ||
  '{"bankName":"GCB Bank","bankCode":"GCB","accountNumber":"****4820","accountName":"Boutique 22"}'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000022'::uuid
   OR business_name = 'Boutique 22';

-- Align Boutique 22 store profile fields to mockup
UPDATE stores SET
  category = 'Fashion',
  default_delivery_mode = COALESCE(NULLIF(default_delivery_mode, ''), 'Movr courier'),
  hours_json = COALESCE(hours_json, '{}'::jsonb) ||
    '{"mon_sun":"9:00 AM – 9:00 PM","label":"9:00 AM – 9:00 PM","closes":"21:00"}'::jsonb
WHERE name = 'Boutique 22';

-- Full variant set for Boutique 22 products (Products table mockup)
INSERT INTO product_variants (product_id, name, price_delta)
SELECT p.id, v.variant, 0
FROM products p
JOIN stores s ON s.id = p.store_id
JOIN (VALUES
  ('Cotton shirt', 'Size M, Blue'),
  ('Denim jacket', 'Size L, Black'),
  ('Canvas sneakers', 'Size 42, White'),
  ('Wool scarf', 'One size')
) AS v(product_name, variant) ON p.name = v.product_name
WHERE s.name = 'Boutique 22'
  AND NOT EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.product_id = p.id AND pv.name = v.variant
  );

-- Mark Canvas sneakers out of stock (mockup)
UPDATE products p SET in_stock = FALSE
FROM stores s
WHERE p.store_id = s.id AND s.name = 'Boutique 22' AND p.name = 'Canvas sneakers';

-- Sample completed payouts for Earnings screen
INSERT INTO merchant_payouts (merchant_id, amount, currency, status, reference_id, bank_account, created_at)
SELECT m.id, 3200, 'GHS', 'completed', 'WEEKLY-GCB-3200',
  '{"bankName":"GCB Bank","bankCode":"GCB"}'::jsonb,
  NOW() - INTERVAL '7 days'
FROM merchants m
WHERE (m.id = 'b0000000-0000-4000-8000-000000000022'::uuid OR m.business_name = 'Boutique 22')
  AND NOT EXISTS (
    SELECT 1 FROM merchant_payouts mp WHERE mp.reference_id = 'WEEKLY-GCB-3200'
  )
LIMIT 1;

INSERT INTO merchant_payouts (merchant_id, amount, currency, status, reference_id, bank_account, created_at)
SELECT m.id, 2940, 'GHS', 'completed', 'WEEKLY-GCB-2940',
  '{"bankName":"GCB Bank","bankCode":"GCB"}'::jsonb,
  NOW() - INTERVAL '14 days'
FROM merchants m
WHERE (m.id = 'b0000000-0000-4000-8000-000000000022'::uuid OR m.business_name = 'Boutique 22')
  AND NOT EXISTS (
    SELECT 1 FROM merchant_payouts mp WHERE mp.reference_id = 'WEEKLY-GCB-2940'
  )
LIMIT 1;

INSERT INTO merchant_payouts (merchant_id, amount, currency, status, reference_id, bank_account, created_at)
SELECT m.id, 920, 'GHS', 'pending', 'PENDING-SETTLE-920',
  '{"bankName":"GCB Bank","bankCode":"GCB"}'::jsonb,
  NOW() - INTERVAL '1 day'
FROM merchants m
WHERE (m.id = 'b0000000-0000-4000-8000-000000000022'::uuid OR m.business_name = 'Boutique 22')
  AND NOT EXISTS (
    SELECT 1 FROM merchant_payouts mp WHERE mp.reference_id = 'PENDING-SETTLE-920'
  )
LIMIT 1;

-- Demo customers for analytics orders
INSERT INTO users (id, phone, email, first_name, last_name, user_type, is_verified)
SELECT
  'a0000000-0000-4000-8000-000000000099'::uuid,
  '+233200000099',
  'shopper99@movr.local',
  'Ama',
  'K',
  'customer',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-4000-8000-000000000099'::uuid);

INSERT INTO users (id, phone, email, first_name, last_name, user_type, is_verified)
SELECT
  'a0000000-0000-4000-8000-000000000098'::uuid,
  '+233200000098',
  'shopper98@movr.local',
  'Kofi',
  'M',
  'customer',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-4000-8000-000000000098'::uuid);

-- Seed recent marketplace orders for Boutique 22 analytics / earnings
DO $$
DECLARE
  sid UUID;
  oid UUID;
  pid UUID;
  d INT;
  day_sales NUMERIC;
BEGIN
  SELECT id INTO sid FROM stores WHERE name = 'Boutique 22' LIMIT 1;
  IF sid IS NULL THEN RETURN; END IF;

  FOR d IN 0..6 LOOP
    day_sales := CASE d
      WHEN 0 THEN 980
      WHEN 1 THEN 1420
      WHEN 2 THEN 760
      WHEN 3 THEN 1680
      WHEN 4 THEN 1120
      WHEN 5 THEN 1540
      ELSE 960
    END;

    IF EXISTS (
      SELECT 1 FROM marketplace_orders
      WHERE store_id = sid
        AND notes = 'mockup-seed-day-' || d
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO marketplace_orders (
      id, store_id, user_id, status, subtotal, total, currency, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      sid,
      CASE WHEN d % 2 = 0
        THEN 'a0000000-0000-4000-8000-000000000099'::uuid
        ELSE 'a0000000-0000-4000-8000-000000000098'::uuid
      END,
      'completed',
      day_sales,
      day_sales,
      'GHS',
      'mockup-seed-day-' || d,
      date_trunc('day', NOW()) - (d || ' days')::interval + INTERVAL '12 hours',
      NOW()
    ) RETURNING id INTO oid;

    SELECT id INTO pid FROM products WHERE store_id = sid AND name = 'Cotton shirt' LIMIT 1;
    IF pid IS NOT NULL THEN
      INSERT INTO marketplace_order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
      VALUES (
        oid, pid, 'Cotton shirt',
        GREATEST(1, (day_sales / 240)::int),
        120,
        120 * GREATEST(1, (day_sales / 240)::int)
      );
    END IF;

    SELECT id INTO pid FROM products WHERE store_id = sid AND name = 'Canvas sneakers' LIMIT 1;
    IF pid IS NOT NULL AND d < 4 THEN
      INSERT INTO marketplace_order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
      VALUES (oid, pid, 'Canvas sneakers', 2, 210, 420);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM marketplace_orders WHERE store_id = sid AND notes = 'mockup-seed-repeat'
  ) THEN
    INSERT INTO marketplace_orders (
      store_id, user_id, status, subtotal, total, currency, notes, created_at
    ) VALUES (
      sid,
      'a0000000-0000-4000-8000-000000000099'::uuid,
      'completed',
      240,
      240,
      'GHS',
      'mockup-seed-repeat',
      NOW() - INTERVAL '2 days'
    );
  END IF;
END $$;
