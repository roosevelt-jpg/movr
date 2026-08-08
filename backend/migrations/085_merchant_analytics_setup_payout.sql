-- 085: Merchant analytics mockup seed, store-setup products, payout accounts/history

-- Payout fee config + richer payout rows
ALTER TABLE merchant_payouts
  ADD COLUMN IF NOT EXISTS week_start DATE,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS label VARCHAR(128);

CREATE TABLE IF NOT EXISTS merchant_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  bank_name VARCHAR(128) NOT NULL,
  account_number VARCHAR(64) NOT NULL,
  account_mask VARCHAR(64),
  account_name VARCHAR(128),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_bank_primary
  ON merchant_bank_accounts (merchant_id) WHERE is_primary = TRUE;

CREATE TABLE IF NOT EXISTS merchant_payout_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fee_pct NUMERIC(5,2) NOT NULL DEFAULT 5,
  currency_code VARCHAR(8) DEFAULT 'NGN',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO merchant_payout_config (id, fee_pct, currency_code)
VALUES (1, 5, 'NGN')
ON CONFLICT (id) DO UPDATE SET fee_pct = 5, currency_code = 'NGN', updated_at = NOW();

-- Store setup progress
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS store_setup_step INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS country VARCHAR(8);

UPDATE merchants
SET country = COALESCE(NULLIF(country, ''), 'NG'),
    store_setup_step = GREATEST(COALESCE(store_setup_step, 1), 3)
WHERE business_name ILIKE '%Chicken Republic%';

-- Ensure Family Combo product exists for top-items mockup
DO $$
DECLARE
  sid UUID := 'c0000000-0000-4000-8000-000000000014'::uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price') THEN
    INSERT INTO products (id, store_id, name, description, price, menu_category, is_popular, emoji, in_stock, currency)
    VALUES (
      'd0000000-0000-4000-8000-000000000145'::uuid, sid,
      'Family Combo', 'Family feast with sides & drinks', 5000, 'Combos', true, '🥤', true, 'NGN'
    )
    ON CONFLICT (id) DO UPDATE SET name = 'Family Combo', price = 5000, emoji = '🥤', in_stock = TRUE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Family Combo seed skipped: %', SQLERRM;
END $$;

-- GTBank payout account for Chicken Republic
INSERT INTO merchant_bank_accounts (
  id, merchant_id, bank_name, account_number, account_mask, account_name, is_primary
)
SELECT
  'e0000000-0000-4000-8000-000000000014'::uuid,
  m.id,
  'GTBank',
  '0214567890',
  '021XXXXXXX',
  'Chicken Republic Ltd.',
  TRUE
FROM merchants m
WHERE m.id = 'b0000000-0000-4000-8000-000000000014'::uuid
   OR m.business_name ILIKE '%Chicken Republic%'
ON CONFLICT (id) DO UPDATE SET
  bank_name = 'GTBank',
  account_mask = '021XXXXXXX',
  account_name = 'Chicken Republic Ltd.',
  is_primary = TRUE;

UPDATE merchants m
SET payout_account = jsonb_build_object(
  'bankName', 'GTBank',
  'bankCode', 'GTB',
  'accountNumber', '021XXXXXXX',
  'accountName', 'Chicken Republic Ltd.'
),
country = 'NG'
WHERE m.id = 'b0000000-0000-4000-8000-000000000014'::uuid
   OR m.business_name ILIKE '%Chicken Republic%';

-- Payout history matching mockup
INSERT INTO merchant_payouts (
  merchant_id, amount, currency, status, reference_id, bank_account,
  week_start, paid_at, label, fee_amount, gross_amount, created_at
)
SELECT m.id, 398000, 'NGN', 'completed', 'MVR-PO-APR1',
  '{"bankName":"GTBank","accountMask":"021XXXXXXX"}'::jsonb,
  '2026-04-01'::date, '2026-04-03'::timestamptz, 'Week of Apr 1',
  20947.37, 418947.37, '2026-04-03'::timestamptz
FROM merchants m
WHERE (m.id = 'b0000000-0000-4000-8000-000000000014'::uuid OR m.business_name ILIKE '%Chicken Republic%')
  AND NOT EXISTS (SELECT 1 FROM merchant_payouts WHERE reference_id = 'MVR-PO-APR1')
LIMIT 1;

INSERT INTO merchant_payouts (
  merchant_id, amount, currency, status, reference_id, bank_account,
  week_start, paid_at, label, created_at
)
SELECT m.id, 312750, 'NGN', 'completed', 'MVR-PO-MAR25',
  '{"bankName":"GTBank"}'::jsonb,
  '2026-03-25'::date, '2026-03-27'::timestamptz, 'Week of Mar 25', '2026-03-27'::timestamptz
FROM merchants m
WHERE (m.id = 'b0000000-0000-4000-8000-000000000014'::uuid OR m.business_name ILIKE '%Chicken Republic%')
  AND NOT EXISTS (SELECT 1 FROM merchant_payouts WHERE reference_id = 'MVR-PO-MAR25')
LIMIT 1;

INSERT INTO merchant_payouts (
  merchant_id, amount, currency, status, reference_id, bank_account,
  week_start, paid_at, label, created_at
)
SELECT m.id, 287400, 'NGN', 'completed', 'MVR-PO-MAR18',
  '{"bankName":"GTBank"}'::jsonb,
  '2026-03-18'::date, '2026-03-20'::timestamptz, 'Week of Mar 18', '2026-03-20'::timestamptz
FROM merchants m
WHERE (m.id = 'b0000000-0000-4000-8000-000000000014'::uuid OR m.business_name ILIKE '%Chicken Republic%')
  AND NOT EXISTS (SELECT 1 FROM merchant_payouts WHERE reference_id = 'MVR-PO-MAR18')
LIMIT 1;

-- Analytics week seed: daily revenue Mon–Sun totaling ~870,500 + top items
DO $$
DECLARE
  mid UUID := 'b0000000-0000-4000-8000-000000000014'::uuid;
  sid UUID := 'c0000000-0000-4000-8000-000000000014'::uuid;
  uid UUID;
  oid UUID;
  i INT;
  day_offset INT;
  day_totals NUMERIC[] := ARRAY[95000, 110000, 125000, 148000, 132000, 140500, 120000];
  amt NUMERIC;
  zid UUID;
  gid UUID;
  fid UUID;
BEGIN
  SELECT id INTO uid FROM users
  WHERE COALESCE(user_type, 'customer') IN ('customer', 'rider', 'user')
  ORDER BY created_at ASC LIMIT 1;
  IF uid IS NULL THEN
    uid := 'a0000000-0000-4000-8000-000000000099'::uuid;
  END IF;

  SELECT id INTO zid FROM products WHERE store_id = sid AND name ILIKE '%Zinger%' LIMIT 1;
  SELECT id INTO gid FROM products WHERE store_id = sid AND name ILIKE '%Grilled%' LIMIT 1;
  SELECT id INTO fid FROM products WHERE store_id = sid AND name ILIKE '%Family%' LIMIT 1;

  IF (
    SELECT COUNT(*) FROM marketplace_orders o
    JOIN stores s ON s.id = o.store_id
    WHERE s.merchant_id = mid AND o.created_at > NOW() - INTERVAL '7 days'
  ) < 20 THEN
    FOR i IN 0..6 LOOP
      day_offset := 6 - i;
      amt := day_totals[i + 1];
      oid := ('f5000000-0000-4000-8000-' || lpad((1000 + i)::text, 12, '0'))::uuid;
      INSERT INTO marketplace_orders (
        id, store_id, user_id, status, subtotal, total, currency, notes, created_at, updated_at
      )
      VALUES (
        oid, sid, uid, 'completed', amt, amt, 'NGN',
        'analytics-seed-day-' || i,
        date_trunc('day', NOW()) - (day_offset || ' days')::interval + INTERVAL '14 hours',
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        total = EXCLUDED.total,
        subtotal = EXCLUDED.subtotal,
        status = 'completed',
        created_at = EXCLUDED.created_at;

      IF zid IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM marketplace_order_items WHERE order_id = oid AND product_name ILIKE '%Zinger%'
      ) THEN
        INSERT INTO marketplace_order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
        VALUES (oid, zid, 'Zinger Burger Meal', 10, 3200, 32000);
      END IF;
      IF gid IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM marketplace_order_items WHERE order_id = oid AND product_name ILIKE '%Grilled%'
      ) THEN
        INSERT INTO marketplace_order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
        VALUES (oid, gid, 'Grilled Chicken', 6, 4500, 27000);
      END IF;
      IF fid IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM marketplace_order_items WHERE order_id = oid AND product_name ILIKE '%Family%'
      ) THEN
        INSERT INTO marketplace_order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
        VALUES (oid, fid, 'Family Combo', 4, 5000, 20000);
      END IF;
    END LOOP;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Analytics seed skipped: %', SQLERRM;
END $$;

-- Available balance target ~435,200: ensure earned - paid leaves room; store ledger hint
CREATE TABLE IF NOT EXISTS merchant_wallet_balances (
  merchant_id UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  available NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'NGN',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO merchant_wallet_balances (merchant_id, available, currency_code)
SELECT m.id, 435200, 'NGN'
FROM merchants m
WHERE m.id = 'b0000000-0000-4000-8000-000000000014'::uuid
   OR m.business_name ILIKE '%Chicken Republic%'
ON CONFLICT (merchant_id) DO UPDATE SET
  available = 435200,
  currency_code = 'NGN',
  updated_at = NOW();

UPDATE stores
SET rating = 4.8
WHERE id = 'c0000000-0000-4000-8000-000000000014'::uuid
   OR name ILIKE '%Chicken Republic%';
