-- Help centre, legal docs, UI status copy (offline / empty history)

CREATE TABLE IF NOT EXISTS help_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(128) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon_key VARCHAR(32) NOT NULL DEFAULT 'car',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES help_categories(id) ON DELETE CASCADE,
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(256) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_keywords ON help_articles USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || coalesce(keywords,'')));

CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(256) NOT NULL,
  updated_label VARCHAR(128) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  section_number INT NOT NULL,
  title VARCHAR(256) NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_sections_doc_num
  ON legal_sections(document_id, section_number);

CREATE TABLE IF NOT EXISTS app_status_copy (
  key VARCHAR(64) PRIMARY KEY,
  title VARCHAR(256) NOT NULL,
  body TEXT NOT NULL,
  cta_label VARCHAR(128) NOT NULL DEFAULT 'Retry',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Help categories (mockup)
INSERT INTO help_categories (slug, title, description, icon_key, sort_order) VALUES
  ('ride', 'Ride issues', 'Fare disputes, lost items, safety concerns.', 'car', 1),
  ('order', 'Order & delivery', 'Track orders, report a delivery issue.', 'package', 2),
  ('pay', 'Payments & wallet', 'Refunds, payout issues, top-ups.', 'card', 3)
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    icon_key = EXCLUDED.icon_key,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

INSERT INTO help_articles (category_id, slug, title, body, keywords, sort_order)
SELECT c.id, v.slug, v.title, v.body, v.keywords, v.sort_order
FROM help_categories c
JOIN (VALUES
  ('ride', 'fare-dispute', 'Fare looks wrong',
   'If your fare looks wrong, open the trip in History and tap Report a fare issue. Ops can adjust disputed rides such as Ride #88213.',
   'fare dispute ride adjust', 1),
  ('ride', 'lost-item', 'Lost an item',
   'Lost an item? Contact your driver from the trip screen within 24 hours, or message Support.',
   'lost item driver', 2),
  ('ride', 'safety', 'Safety concerns',
   'For safety concerns, use in-app SOS during an active ride or contact local emergency services.',
   'safety sos emergency', 3),
  ('order', 'track-order', 'Track an order',
   'Track live delivery from your order confirmation screen.',
   'track order delivery', 1),
  ('order', 'delivery-issue', 'Report a delivery issue',
   'If a parcel is late or damaged, open the order and tap Report an issue.',
   'delivery late damaged parcel', 2),
  ('pay', 'refunds', 'Refunds',
   'Refunds appear in your wallet currency within 1–3 business days after approval.',
   'refund wallet', 1),
  ('pay', 'top-ups', 'Top-ups',
   'Top up from Wallet using mobile money or card.',
   'top-up wallet momo card', 2)
) AS v(cat_slug, slug, title, body, keywords, sort_order)
  ON c.slug = v.cat_slug
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    keywords = EXCLUDED.keywords,
    category_id = EXCLUDED.category_id,
    is_active = TRUE;

-- Terms of Service
INSERT INTO legal_documents (slug, title, updated_label, is_active)
VALUES ('terms', 'Terms of Service', 'Last updated July 2026', TRUE)
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    updated_label = EXCLUDED.updated_label,
    is_active = TRUE,
    updated_at = NOW();

INSERT INTO legal_sections (document_id, section_number, title, body, sort_order)
SELECT d.id, v.n, v.title, v.body, v.n
FROM legal_documents d
JOIN (VALUES
  (1, 'Introduction', 'these terms govern your use of the Movr platform across ride, shop, deliver, and rental services.'),
  (2, 'Eligibility', 'you must be verified to use certain features including payments and driving.'),
  (3, 'Payments', 'transactions are processed through our payment partners in accordance with local regulations.'),
  (4, 'Conduct', 'you agree not to misuse the platform, harass other users, or attempt to circumvent safety or identity checks.'),
  (5, 'Liability', 'Movr provides the marketplace and matching services; service providers remain responsible for their services.')
) AS v(n, title, body) ON TRUE
WHERE d.slug = 'terms'
ON CONFLICT (document_id, section_number) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    sort_order = EXCLUDED.sort_order;

INSERT INTO legal_documents (slug, title, updated_label, is_active)
VALUES ('privacy', 'Privacy Policy', 'Last updated July 2026', TRUE)
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    updated_label = EXCLUDED.updated_label,
    is_active = TRUE,
    updated_at = NOW();

INSERT INTO legal_sections (document_id, section_number, title, body, sort_order)
SELECT d.id, v.n, v.title, v.body, v.n
FROM legal_documents d
JOIN (VALUES
  (1, 'Data we collect', 'We collect account, trip, and payment data needed to operate Movr.'),
  (2, 'How we use data', 'We use your data to match rides, process orders, prevent fraud, and improve the product.'),
  (3, 'Sharing', 'We share data with payment partners, drivers, merchants, and regulators when required.')
) AS v(n, title, body) ON TRUE
WHERE d.slug = 'privacy'
ON CONFLICT (document_id, section_number) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body;

-- Offline / empty-state copy (live)
INSERT INTO app_status_copy (key, title, body, cta_label) VALUES
  (
    'no_connection',
    'No connection',
    'Check your internet connection and try again. You can still book by SMS or a call.',
    'Retry'
  ),
  (
    'trip_history_empty',
    'No trips yet',
    'Your ride and order history will show up here once you take your first trip.',
    'Book a ride'
  )
ON CONFLICT (key) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    cta_label = EXCLUDED.cta_label,
    updated_at = NOW();
