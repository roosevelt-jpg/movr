-- Shop ecommerce upgrade: galleries, reviews, returns, sale pricing

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS stock_qty INT;

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt VARCHAR(255),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES marketplace_orders(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(160),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES marketplace_order_items(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'denied', 'refunded')),
  refund_amount NUMERIC(12,2),
  merchant_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_returns_order ON marketplace_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_returns_status ON marketplace_returns(status);

CREATE INDEX IF NOT EXISTS idx_products_name_search ON products (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON products (store_id, in_stock)
  WHERE COALESCE(is_active, TRUE) = TRUE;

-- Backfill primary image into gallery
INSERT INTO product_images (product_id, url, sort_order, alt)
SELECT p.id, p.image_url, 0, p.name
FROM products p
WHERE p.image_url IS NOT NULL AND LENGTH(TRIM(p.image_url)) > 0
  AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)
ON CONFLICT DO NOTHING;

-- Demo sale prices on a few products
UPDATE products SET
  compare_at_price = ROUND(price * 1.25, 2),
  sale_price = ROUND(price * 0.9, 2)
WHERE sale_price IS NULL
  AND price > 0
  AND (
    name ILIKE '%zinger%'
    OR name ILIKE '%dress%'
    OR name ILIKE '%sneaker%'
    OR name ILIKE '%shirt%'
    OR name ILIKE '%burger%'
  );

-- Seed a couple of placeholder gallery extras (reuse primary url with sort)
INSERT INTO product_images (product_id, url, sort_order, alt)
SELECT p.id, p.image_url, 1, p.name || ' · view 2'
FROM products p
WHERE p.image_url IS NOT NULL
  AND (SELECT COUNT(*) FROM product_images i WHERE i.product_id = p.id) = 1
  AND p.name ILIKE ANY (ARRAY['%zinger%', '%dress%', '%shirt%', '%burger%'])
ON CONFLICT DO NOTHING;

-- Seed reviews from demo riders if products exist
INSERT INTO product_reviews (product_id, user_id, rating, title, body)
SELECT p.id, u.id, v.rating, v.title, v.body
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM users
  WHERE user_type IN ('customer', 'rider') OR COALESCE(user_type, 'customer') = 'customer'
  ORDER BY created_at ASC
  LIMIT 3
) u
CROSS JOIN (VALUES
  (5, 'Great quality', 'Arrived fresh and exactly as described. Will order again.'),
  (4, 'Good value', 'Fair price for Movr delivery. Packaging was solid.'),
  (5, 'Fast delivery', 'Ordered in the afternoon, had it before evening.')
) AS v(rating, title, body)
WHERE p.in_stock IS NOT FALSE
ON CONFLICT (product_id, user_id) DO NOTHING;

-- Refresh aggregate rating/review_count from reviews
UPDATE products p SET
  rating = sub.avg_rating,
  review_count = sub.cnt
FROM (
  SELECT product_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS cnt
  FROM product_reviews
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id;
