-- Phase 20 — Multi-country (021; was 019_multi_country.sql)

CREATE TABLE IF NOT EXISTS countries (
  code VARCHAR(8) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  currency_code VARCHAR(8) NOT NULL,
  dial_code VARCHAR(8) NOT NULL,
  otp_format_regex VARCHAR(128) DEFAULT '^[0-9]{4,8}$',
  emergency_number VARCHAR(16) DEFAULT '911',
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS city_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city VARCHAR(128) NOT NULL,
  country_code VARCHAR(8) NOT NULL REFERENCES countries(code),
  base_fare NUMERIC(12,2) NOT NULL,
  per_km_rate NUMERIC(12,2) NOT NULL,
  per_min_rate NUMERIC(12,2) NOT NULL,
  currency_code VARCHAR(8) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Accra',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  UNIQUE (city, country_code)
);

CREATE TABLE IF NOT EXISTS fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(8) NOT NULL,
  to_currency VARCHAR(8) NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_currency, to_currency)
);

INSERT INTO countries (code, name, currency_code, dial_code, otp_format_regex, emergency_number) VALUES
  ('GH', 'Ghana', 'GHS', '+233', '^[0-9]{6}$', '191'),
  ('NG', 'Nigeria', 'NGN', '+234', '^[0-9]{6}$', '112'),
  ('KE', 'Kenya', 'KES', '+254', '^[0-9]{6}$', '999'),
  ('ZA', 'South Africa', 'ZAR', '+27', '^[0-9]{6}$', '10111'),
  ('CI', 'Côte d''Ivoire', 'XOF', '+225', '^[0-9]{6}$', '180')
ON CONFLICT (code) DO NOTHING;

INSERT INTO city_pricing (city, country_code, base_fare, per_km_rate, per_min_rate, currency_code, timezone, lat, lng)
SELECT * FROM (VALUES
  ('Accra', 'GH', 2.5, 1.5, 0.25, 'GHS', 'Africa/Accra', 5.6037, -0.1870),
  ('Kumasi', 'GH', 2.2, 1.4, 0.22, 'GHS', 'Africa/Accra', 6.6885, -1.6244),
  ('Lagos', 'NG', 500, 150, 25, 'NGN', 'Africa/Lagos', 6.5244, 3.3792),
  ('Nairobi', 'KE', 150, 50, 8, 'KES', 'Africa/Nairobi', -1.2921, 36.8219),
  ('Johannesburg', 'ZA', 15, 8, 1.5, 'ZAR', 'Africa/Johannesburg', -26.2041, 28.0473)
) AS v(city, country_code, base_fare, per_km_rate, per_min_rate, currency_code, timezone, lat, lng)
WHERE NOT EXISTS (
  SELECT 1 FROM city_pricing c WHERE c.city = v.city AND c.country_code = v.country_code
);

INSERT INTO fx_rates (from_currency, to_currency, rate) VALUES
  ('GHS', 'GHS', 1), ('NGN', 'NGN', 1), ('KES', 'KES', 1), ('ZAR', 'ZAR', 1), ('USD', 'USD', 1),
  ('GHS', 'USD', 0.064), ('USD', 'GHS', 15.6),
  ('NGN', 'USD', 0.00065), ('USD', 'NGN', 1540),
  ('KES', 'USD', 0.0077), ('USD', 'KES', 130),
  ('ZAR', 'USD', 0.055), ('USD', 'ZAR', 18.2)
ON CONFLICT (from_currency, to_currency) DO NOTHING;
