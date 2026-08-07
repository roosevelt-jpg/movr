-- Public footer mockup: CMS global footer copy + locales for region selector

CREATE TABLE IF NOT EXISTS site_locales (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(8) NOT NULL,
  country_name VARCHAR(64) NOT NULL,
  language_code VARCHAR(8) NOT NULL DEFAULT 'en',
  language_label VARCHAR(64) NOT NULL DEFAULT 'English',
  display_label VARCHAR(128) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_site_locales_country_lang
  ON site_locales (country_code, language_code);

INSERT INTO site_locales (country_code, country_name, language_code, language_label, display_label, is_default, sort_order)
VALUES
  ('GH', 'Ghana', 'en', 'English', 'Ghana - English', TRUE, 1),
  ('NG', 'Nigeria', 'en', 'English', 'Nigeria - English', FALSE, 2),
  ('KE', 'Kenya', 'en', 'English', 'Kenya - English', FALSE, 3),
  ('ZA', 'South Africa', 'en', 'English', 'South Africa - English', FALSE, 4)
ON CONFLICT (country_code, language_code) DO UPDATE
SET country_name = EXCLUDED.country_name,
    language_label = EXCLUDED.language_label,
    display_label = EXCLUDED.display_label,
    is_default = EXCLUDED.is_default,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

-- Align published CMS footer to mockup
UPDATE cms_sections s
SET payload = '{
  "brand": "Movr",
  "tagline": "Move. Shop. Deliver.\nGlobal mobility, commerce, and logistics in one platform.",
  "social": [
    {"key": "share", "href": "/download", "label": "Share"},
    {"key": "mail", "href": "/contact", "label": "Email"},
    {"key": "community", "href": "/about", "label": "Community"}
  ],
  "columns": [
    {
      "title": "SERVICES",
      "links": [
        {"label": "Ride", "href": "/#ride"},
        {"label": "Shop", "href": "/#shop"},
        {"label": "Deliver", "href": "/#deliver"},
        {"label": "Rentals", "href": "/#rentals"}
      ]
    },
    {
      "title": "COMPANY",
      "links": [
        {"label": "About Movr", "href": "/about"},
        {"label": "For drivers", "href": "/drivers"},
        {"label": "For merchants", "href": "/merchants"},
        {"label": "Careers", "href": "/about"}
      ]
    },
    {
      "title": "SUPPORT",
      "links": [
        {"label": "Help centre", "href": "/help"},
        {"label": "Contact us", "href": "/contact"},
        {"label": "Safety", "href": "/help"},
        {"label": "Terms of Service", "href": "/terms"},
        {"label": "Privacy Policy", "href": "/privacy"}
      ]
    }
  ],
  "appButtons": [
    {"label": "App Store", "store": "ios", "href": "/download"},
    {"label": "Google Play", "store": "android", "href": "/download"}
  ],
  "copyright": "© 2026 Movr Global Technologies. All rights reserved.",
  "legalLinks": [
    {"label": "Privacy", "href": "/privacy"},
    {"label": "Terms", "href": "/terms"},
    {"label": "Cookies", "href": "/privacy"}
  ]
}'::jsonb,
    updated_at = NOW()
FROM cms_pages p
WHERE s.page_id = p.id
  AND p.slug = 'global'
  AND s.type = 'footer';
