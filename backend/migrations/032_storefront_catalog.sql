-- Phase storefront catalog — banners, shared categories, product category links

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS default_delivery_mode VARCHAR(64);

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  icon_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS store_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title VARCHAR(255),
  image_url TEXT NOT NULL,
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_store_banners_store ON store_banners(store_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON product_categories(is_active, sort_order);

-- Seed shared platform categories (idempotent by slug)
INSERT INTO product_categories (name, slug, sort_order) VALUES
  ('Fashion', 'fashion', 10),
  ('Food & Groceries', 'food-groceries', 20),
  ('Electronics', 'electronics', 30),
  ('Beauty', 'beauty', 40),
  ('Home', 'home', 50),
  ('Sports', 'sports', 60),
  ('Baby', 'baby', 70),
  ('Pharmacy', 'pharmacy', 80),
  ('Books', 'books', 90),
  ('Pets', 'pets', 100),
  ('Automotive', 'automotive', 110),
  ('Other', 'other', 120)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE product_categories IS 'Shared platform product categories — merchants pick, do not invent';
COMMENT ON TABLE store_banners IS 'Promo banners for merchant storefronts';
