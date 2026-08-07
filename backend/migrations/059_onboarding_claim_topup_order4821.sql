-- Onboarding slides, claim transfer seed, payment methods, merchant order #4821

CREATE TABLE IF NOT EXISTS onboarding_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon_key VARCHAR(32) NOT NULL DEFAULT 'van',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

DELETE FROM onboarding_slides WHERE sort_order IN (1, 2, 3);
INSERT INTO onboarding_slides (sort_order, title, body, icon_key) VALUES
  (
    1,
    'Ride, shop, and deliver — all in one app',
    'Book a ride, order from local stores, or send a parcel, all from the same place.',
    'van'
  ),
  (
    2,
    'Pay with wallet, MoMo, or card',
    'Top up once and use Movr across rides, orders, and deliveries.',
    'wallet'
  ),
  (
    3,
    'Earn points on every trip',
    'Redeem rewards or convert points when DVT launches.',
    'points'
  );

CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL,
  method_type VARCHAR(32) NOT NULL DEFAULT 'momo',
  label VARCHAR(128) NOT NULL,
  last_four VARCHAR(8) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider, last_four)
);

-- Ama Konadu payment methods (mockup)
INSERT INTO customer_payment_methods (user_id, provider, method_type, label, last_four, is_default)
SELECT u.id, v.provider, v.method_type, v.label, v.last_four, v.is_default
FROM users u
CROSS JOIN (VALUES
  ('MTN MoMo', 'momo', 'MTN MoMo', '4471', TRUE),
  ('Visa', 'visa', 'Visa', '8821', FALSE)
) AS v(provider, method_type, label, last_four, is_default)
WHERE u.phone = '+233240000000'
ON CONFLICT (user_id, provider, last_four) DO UPDATE
SET label = EXCLUDED.label,
    is_default = EXCLUDED.is_default;

-- Ensure Kwesi has a wallet for outbound claim transfer
INSERT INTO wallets (user_id, balance_fiat, currency)
SELECT u.id, 50000, 'NGN'
FROM users u
WHERE u.first_name = 'Kwesi' AND u.user_type = 'driver'
  AND NOT EXISTS (SELECT 1 FROM wallets w WHERE w.user_id = u.id)
LIMIT 1;

UPDATE wallets w
SET balance_fiat = GREATEST(COALESCE(balance_fiat, 0), 50000)
FROM users u
WHERE w.user_id = u.id AND u.first_name = 'Kwesi' AND u.user_type = 'driver';

-- Pending claim: Kwesi → ₦35,700 (claim code for /claim-transfer/KWESI357)
INSERT INTO wallet_transfers (
  sender_wallet_id,
  sender_user_id,
  recipient_identifier,
  sent_amount,
  sent_currency,
  received_amount,
  received_currency,
  fx_rate_used,
  fee_amount,
  status,
  claim_code,
  created_at
)
SELECT
  w.id,
  w.user_id,
  'unclaimed:+2348000000000',
  35700,
  'NGN',
  35700,
  'NGN',
  1,
  0,
  'pending',
  'KWESI357',
  NOW() - INTERVAL '1 hour'
FROM wallets w
JOIN users u ON u.id = w.user_id
WHERE u.first_name = 'Kwesi' AND u.user_type = 'driver'
  AND NOT EXISTS (SELECT 1 FROM wallet_transfers WHERE claim_code = 'KWESI357')
LIMIT 1;

UPDATE wallet_transfers
SET status = 'pending',
    received_amount = 35700,
    received_currency = 'NGN',
    sent_amount = 35700,
    sent_currency = 'NGN',
    claim_code = 'KWESI357'
WHERE claim_code = 'KWESI357'
   OR id = 'c1000000-0000-4000-8000-000000003570'::uuid;

-- Merchant order public ref
ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS public_ref VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_orders_public_ref
  ON marketplace_orders (public_ref) WHERE public_ref IS NOT NULL;

-- Order #4821 Preparing for Boutique 22 · Ama Konadu · Cotton shirt + Canvas sneakers
DO $$
DECLARE
  sid UUID;
  oid UUID := 'e4821000-0000-4000-8000-000000004821'::uuid;
  uid UUID;
  pid_shirt UUID;
  pid_shoes UUID;
BEGIN
  SELECT id INTO sid FROM stores WHERE name = 'Boutique 22' LIMIT 1;
  SELECT id INTO uid FROM users WHERE phone = '+233240000000' LIMIT 1;
  IF sid IS NULL OR uid IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO pid_shirt FROM products WHERE store_id = sid AND name = 'Cotton shirt' LIMIT 1;
  SELECT id INTO pid_shoes FROM products WHERE store_id = sid AND name = 'Canvas sneakers' LIMIT 1;

  INSERT INTO marketplace_orders (
    id, user_id, store_id, status, subtotal, total, currency,
    delivery_address, delivery_mode, fulfillment_type,
    public_ref, notes, created_at
  )
  VALUES (
    oid, uid, sid, 'preparing', 330, 345, 'GHS',
    'Ama Konadu, 12 Oxford St', 'movr_courier', 'delivery',
    '4821', 'mockup-order-4821',
    date_trunc('day', NOW()) + INTERVAL '14 hours 2 minutes'
  )
  ON CONFLICT (id) DO UPDATE
  SET status = 'preparing',
      subtotal = 330,
      total = 345,
      public_ref = '4821',
      delivery_address = 'Ama Konadu, 12 Oxford St',
      delivery_mode = 'movr_courier',
      fulfillment_type = 'delivery',
      notes = 'mockup-order-4821';

  DELETE FROM marketplace_order_items WHERE order_id = oid;

  IF pid_shirt IS NOT NULL THEN
    INSERT INTO marketplace_order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES (oid, pid_shirt, 'Cotton shirt (Size M, Blue)', 120, 1, 120);
  END IF;
  IF pid_shoes IS NOT NULL THEN
    INSERT INTO marketplace_order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES (oid, pid_shoes, 'Canvas sneakers (Size 42)', 210, 1, 210);
  END IF;
END $$;
