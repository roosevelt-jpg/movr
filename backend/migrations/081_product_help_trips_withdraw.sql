-- 081: Food product sizes/add-ons, Help Center tickets, trips empty copy, customer withdraw

-- Product options (sizes) + add-ons
CREATE TABLE IF NOT EXISTS product_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_addons_product ON product_addons(product_id);

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS addon_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS addon_total NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 4.8,
  ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merchant_label TEXT,
  ADD COLUMN IF NOT EXISTS long_description TEXT;

-- Zinger meal sizes as variants + attributes
UPDATE products SET
  rating = COALESCE(rating, 4.8),
  review_count = COALESCE(NULLIF(review_count, 0), 128),
  merchant_label = COALESCE(merchant_label, 'Chicken Republic · Fast Food'),
  long_description = COALESCE(
    long_description,
    'Crispy chicken fillet, signature zinger sauce, lettuce and mayo in a toasted bun — served with fries and a soft drink. Freshly prepared when you order.'
  ),
  attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
    'kind', 'food',
    'sizes', jsonb_build_array(
      jsonb_build_object('id', 'regular', 'label', 'Regular', 'price_delta', 0),
      jsonb_build_object('id', 'large', 'label', 'Large', 'price_delta', 0),
      jsonb_build_object('id', 'family', 'label', 'Family', 'price_delta', 800)
    )
  )
WHERE id = 'd0000000-0000-4000-8000-000000000141'::uuid
   OR name ILIKE '%Zinger Burger%';

INSERT INTO product_variants (product_id, name, price_delta)
SELECT p.id, v.name, v.delta
FROM products p
CROSS JOIN (VALUES
  ('Regular', 0),
  ('Large', 0),
  ('Family', 800)
) AS v(name, delta)
WHERE (p.id = 'd0000000-0000-4000-8000-000000000141'::uuid OR p.name ILIKE '%Zinger Burger%')
  AND NOT EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.product_id = p.id AND pv.name = v.name
  );

INSERT INTO product_addons (product_id, name, price_delta, sort_order)
SELECT p.id, a.name, a.delta, a.ord
FROM products p
CROSS JOIN (VALUES
  ('Extra Fries', 400, 1),
  ('Extra Sauce', 200, 2)
) AS a(name, delta, ord)
WHERE (p.id = 'd0000000-0000-4000-8000-000000000141'::uuid OR p.name ILIKE '%Zinger Burger%')
  AND NOT EXISTS (
    SELECT 1 FROM product_addons x WHERE x.product_id = p.id AND x.name = a.name
  );

-- Help Center: DVT topic + ticket refs
INSERT INTO help_categories (slug, title, description, icon_key, sort_order) VALUES
  ('dvt', 'DVT Tokens', 'Earn, claim, stake and spend DVT.', 'chain', 4)
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    icon_key = EXCLUDED.icon_key,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

UPDATE help_categories SET title = 'Ride Issues', sort_order = 1 WHERE slug = 'ride';
UPDATE help_categories SET title = 'Payments', sort_order = 2 WHERE slug = 'pay';
UPDATE help_categories SET title = 'Orders & Delivery', sort_order = 3 WHERE slug IN ('order', 'orders');

INSERT INTO help_articles (category_id, slug, title, body, keywords, sort_order)
SELECT c.id, v.slug, v.title, v.body, v.keywords, v.sort_order
FROM help_categories c
JOIN (VALUES
  ('dvt', 'earn-dvt', 'How do I earn DVT?',
   'Complete rides, orders and referrals to earn DVT. Check Rewards and Claim screens for pending tokens.',
   'dvt earn claim rewards', 1),
  ('dvt', 'stake-dvt', 'Staking DVT',
   'Stake DVT from the Staking screen to earn yield. Unstake anytime after the lock period.',
   'dvt stake yield', 2)
) AS v(cat, slug, title, body, keywords, sort_order)
  ON c.slug = v.cat
WHERE NOT EXISTS (
  SELECT 1 FROM help_articles ha WHERE ha.slug = v.slug AND ha.category_id = c.id
);

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS ticket_ref VARCHAR(32),
  ADD COLUMN IF NOT EXISTS status_label VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_ref
  ON support_tickets (ticket_ref) WHERE ticket_ref IS NOT NULL;

-- Seed a demo ticket for customers (Payment not received)
INSERT INTO support_tickets (user_id, subject, status, status_label, ticket_ref, priority, created_at)
SELECT u.id, 'Payment not received', 'in_review', 'In Review',
       'MVR-TKT-' || LPAD((ABS(HASHTEXT(u.id::text)) % 9000 + 1000)::text, 4, '0'),
       'normal', NOW() - INTERVAL '2 days'
FROM users u
WHERE COALESCE(u.user_type, 'customer') IN ('customer', 'rider', 'user')
  AND NOT EXISTS (
    SELECT 1 FROM support_tickets t WHERE t.user_id = u.id AND t.subject = 'Payment not received'
  )
LIMIT 25;

UPDATE support_tickets
SET ticket_ref = COALESCE(
      ticket_ref,
      'MVR-TKT-' || LPAD((ABS(HASHTEXT(id::text)) % 9000 + 1000)::text, 4, '0')
    ),
    status_label = COALESCE(
      status_label,
      CASE status
        WHEN 'in_review' THEN 'In Review'
        WHEN 'open' THEN 'Open'
        WHEN 'resolved' THEN 'Resolved'
        ELSE INITCAP(REPLACE(status, '_', ' '))
      END
    )
WHERE ticket_ref IS NULL OR status_label IS NULL;

-- Trips empty-state copy
ALTER TABLE app_status_copy
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

INSERT INTO app_status_copy (key, title, body, cta_label, meta)
VALUES (
  'trip_history_empty',
  'No trips yet',
  'Your rides, parcels, orders and rentals will all appear here.',
  'Book Your First Ride',
  '{"secondaryCta":"Browse Stores","tryThese":["ride","shop","deliver"]}'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    cta_label = EXCLUDED.cta_label,
    meta = EXCLUDED.meta;

-- Customer wallet withdrawals
CREATE TABLE IF NOT EXISTS wallet_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'NGN',
  method_id UUID,
  method_label VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user ON wallet_withdrawals(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_withdraw_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_amount NUMERIC(12,2) NOT NULL DEFAULT 500,
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  fee_label VARCHAR(32) NOT NULL DEFAULT 'Free',
  currency VARCHAR(8) NOT NULL DEFAULT 'NGN'
);

INSERT INTO wallet_withdraw_settings (id, min_amount, fee_amount, fee_label, currency)
VALUES (1, 500, 0, 'Free', 'NGN')
ON CONFLICT (id) DO NOTHING;

-- Ensure demo wallet balance for withdraw mockup
UPDATE wallets
SET balance_fiat = GREATEST(COALESCE(balance_fiat, 0), 18400),
    currency = COALESCE(NULLIF(currency, ''), 'NGN')
WHERE user_id IN (
  SELECT id FROM users WHERE COALESCE(user_type, 'customer') IN ('customer', 'rider', 'user') LIMIT 50
)
AND COALESCE(balance_fiat, 0) < 18400;
