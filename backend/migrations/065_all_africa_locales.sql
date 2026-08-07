-- All African countries for Movr locale + currency coverage (AU member states)

INSERT INTO countries (code, name, currency_code, dial_code, otp_format_regex, emergency_number) VALUES
  ('DZ', 'Algeria', 'DZD', '+213', '^[0-9]{6}$', '14'),
  ('AO', 'Angola', 'AOA', '+244', '^[0-9]{6}$', '113'),
  ('BJ', 'Benin', 'XOF', '+229', '^[0-9]{6}$', '117'),
  ('BW', 'Botswana', 'BWP', '+267', '^[0-9]{6}$', '999'),
  ('BF', 'Burkina Faso', 'XOF', '+226', '^[0-9]{6}$', '17'),
  ('BI', 'Burundi', 'BIF', '+257', '^[0-9]{6}$', '112'),
  ('CV', 'Cabo Verde', 'CVE', '+238', '^[0-9]{6}$', '132'),
  ('CM', 'Cameroon', 'XAF', '+237', '^[0-9]{6}$', '117'),
  ('CF', 'Central African Republic', 'XAF', '+236', '^[0-9]{6}$', '117'),
  ('TD', 'Chad', 'XAF', '+235', '^[0-9]{6}$', '17'),
  ('KM', 'Comoros', 'KMF', '+269', '^[0-9]{6}$', '17'),
  ('CG', 'Congo', 'XAF', '+242', '^[0-9]{6}$', '117'),
  ('CD', 'Democratic Republic of the Congo', 'CDF', '+243', '^[0-9]{6}$', '112'),
  ('CI', 'Côte d''Ivoire', 'XOF', '+225', '^[0-9]{6}$', '180'),
  ('DJ', 'Djibouti', 'DJF', '+253', '^[0-9]{6}$', '18'),
  ('EG', 'Egypt', 'EGP', '+20', '^[0-9]{6}$', '122'),
  ('GQ', 'Equatorial Guinea', 'XAF', '+240', '^[0-9]{6}$', '115'),
  ('ER', 'Eritrea', 'ERN', '+291', '^[0-9]{6}$', '127'),
  ('SZ', 'Eswatini', 'SZL', '+268', '^[0-9]{6}$', '999'),
  ('ET', 'Ethiopia', 'ETB', '+251', '^[0-9]{6}$', '911'),
  ('GA', 'Gabon', 'XAF', '+241', '^[0-9]{6}$', '1730'),
  ('GM', 'Gambia', 'GMD', '+220', '^[0-9]{6}$', '117'),
  ('GH', 'Ghana', 'GHS', '+233', '^[0-9]{6}$', '191'),
  ('GN', 'Guinea', 'GNF', '+224', '^[0-9]{6}$', '117'),
  ('GW', 'Guinea-Bissau', 'XOF', '+245', '^[0-9]{6}$', '117'),
  ('KE', 'Kenya', 'KES', '+254', '^[0-9]{6}$', '999'),
  ('LS', 'Lesotho', 'LSL', '+266', '^[0-9]{6}$', '123'),
  ('LR', 'Liberia', 'LRD', '+231', '^[0-9]{6}$', '911'),
  ('LY', 'Libya', 'LYD', '+218', '^[0-9]{6}$', '1515'),
  ('MG', 'Madagascar', 'MGA', '+261', '^[0-9]{6}$', '117'),
  ('MW', 'Malawi', 'MWK', '+265', '^[0-9]{6}$', '997'),
  ('ML', 'Mali', 'XOF', '+223', '^[0-9]{6}$', '17'),
  ('MR', 'Mauritania', 'MRU', '+222', '^[0-9]{6}$', '17'),
  ('MU', 'Mauritius', 'MUR', '+230', '^[0-9]{6}$', '999'),
  ('MA', 'Morocco', 'MAD', '+212', '^[0-9]{6}$', '19'),
  ('MZ', 'Mozambique', 'MZN', '+258', '^[0-9]{6}$', '119'),
  ('NA', 'Namibia', 'NAD', '+264', '^[0-9]{6}$', '10111'),
  ('NE', 'Niger', 'XOF', '+227', '^[0-9]{6}$', '17'),
  ('NG', 'Nigeria', 'NGN', '+234', '^[0-9]{6}$', '112'),
  ('RW', 'Rwanda', 'RWF', '+250', '^[0-9]{6}$', '112'),
  ('ST', 'São Tomé and Príncipe', 'STN', '+239', '^[0-9]{6}$', '112'),
  ('SN', 'Senegal', 'XOF', '+221', '^[0-9]{6}$', '17'),
  ('SC', 'Seychelles', 'SCR', '+248', '^[0-9]{6}$', '999'),
  ('SL', 'Sierra Leone', 'SLE', '+232', '^[0-9]{6}$', '999'),
  ('SO', 'Somalia', 'SOS', '+252', '^[0-9]{6}$', '888'),
  ('ZA', 'South Africa', 'ZAR', '+27', '^[0-9]{6}$', '10111'),
  ('SS', 'South Sudan', 'SSP', '+211', '^[0-9]{6}$', '999'),
  ('SD', 'Sudan', 'SDG', '+249', '^[0-9]{6}$', '999'),
  ('TZ', 'Tanzania', 'TZS', '+255', '^[0-9]{6}$', '112'),
  ('TG', 'Togo', 'XOF', '+228', '^[0-9]{6}$', '117'),
  ('TN', 'Tunisia', 'TND', '+216', '^[0-9]{6}$', '197'),
  ('UG', 'Uganda', 'UGX', '+256', '^[0-9]{6}$', '999'),
  ('ZM', 'Zambia', 'ZMW', '+260', '^[0-9]{6}$', '999'),
  ('ZW', 'Zimbabwe', 'USD', '+263', '^[0-9]{6}$', '999')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  dial_code = EXCLUDED.dial_code,
  emergency_number = EXCLUDED.emergency_number,
  is_active = TRUE;

-- Footer / region selector: one locale row per African country
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

ALTER TABLE site_locales ALTER COLUMN country_name TYPE VARCHAR(128);
ALTER TABLE site_locales ALTER COLUMN display_label TYPE VARCHAR(160);

INSERT INTO site_locales (country_code, country_name, language_code, language_label, display_label, is_default, sort_order)
SELECT
  c.code,
  c.name,
  v.language_code,
  v.language_label,
  c.name || ' - ' || v.language_label,
  (c.code = 'GH'),
  ROW_NUMBER() OVER (ORDER BY c.name)
FROM countries c
JOIN (VALUES
  ('DZ', 'ar', 'Arabic'),
  ('AO', 'pt', 'Portuguese'),
  ('BJ', 'fr', 'French'),
  ('BW', 'en', 'English'),
  ('BF', 'fr', 'French'),
  ('BI', 'fr', 'French'),
  ('CV', 'pt', 'Portuguese'),
  ('CM', 'fr', 'French'),
  ('CF', 'fr', 'French'),
  ('TD', 'fr', 'French'),
  ('KM', 'fr', 'French'),
  ('CG', 'fr', 'French'),
  ('CD', 'fr', 'French'),
  ('CI', 'fr', 'French'),
  ('DJ', 'fr', 'French'),
  ('EG', 'ar', 'Arabic'),
  ('GQ', 'es', 'Spanish'),
  ('ER', 'en', 'English'),
  ('SZ', 'en', 'English'),
  ('ET', 'en', 'English'),
  ('GA', 'fr', 'French'),
  ('GM', 'en', 'English'),
  ('GH', 'en', 'English'),
  ('GN', 'fr', 'French'),
  ('GW', 'pt', 'Portuguese'),
  ('KE', 'en', 'English'),
  ('LS', 'en', 'English'),
  ('LR', 'en', 'English'),
  ('LY', 'ar', 'Arabic'),
  ('MG', 'fr', 'French'),
  ('MW', 'en', 'English'),
  ('ML', 'fr', 'French'),
  ('MR', 'ar', 'Arabic'),
  ('MU', 'en', 'English'),
  ('MA', 'ar', 'Arabic'),
  ('MZ', 'pt', 'Portuguese'),
  ('NA', 'en', 'English'),
  ('NE', 'fr', 'French'),
  ('NG', 'en', 'English'),
  ('RW', 'en', 'English'),
  ('ST', 'pt', 'Portuguese'),
  ('SN', 'fr', 'French'),
  ('SC', 'en', 'English'),
  ('SL', 'en', 'English'),
  ('SO', 'en', 'English'),
  ('ZA', 'en', 'English'),
  ('SS', 'en', 'English'),
  ('SD', 'ar', 'Arabic'),
  ('TZ', 'en', 'English'),
  ('TG', 'fr', 'French'),
  ('TN', 'ar', 'Arabic'),
  ('UG', 'en', 'English'),
  ('ZM', 'en', 'English'),
  ('ZW', 'en', 'English')
) AS v(code, language_code, language_label) ON v.code = c.code
WHERE c.is_active = TRUE
ON CONFLICT (country_code, language_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  language_label = EXCLUDED.language_label,
  display_label = EXCLUDED.display_label,
  is_default = EXCLUDED.is_default,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

-- Ensure only Ghana is the default locale
UPDATE site_locales SET is_default = (country_code = 'GH');

-- Identity FX rows for new currencies (pricing can refine later)
INSERT INTO fx_rates (from_currency, to_currency, rate)
SELECT cur, cur, 1
FROM (VALUES
  ('DZD'), ('BIF'), ('CVE'), ('CDF'), ('DJF'), ('ERN'), ('SZL'), ('GMD'),
  ('GNF'), ('LSL'), ('LRD'), ('LYD'), ('MGA'), ('MWK'), ('MRU'), ('MUR'),
  ('STN'), ('SCR'), ('SLE'), ('SOS'), ('SSP'), ('SDG'), ('TND'), ('USD'),
  ('XOF'), ('XAF'), ('AOA'), ('BWP'), ('EGP'), ('ETB'), ('GHS'), ('KES'),
  ('MAD'), ('MZN'), ('NAD'), ('NGN'), ('RWF'), ('TZS'), ('UGX'), ('ZAR'), ('ZMW')
) AS v(cur)
ON CONFLICT (from_currency, to_currency) DO NOTHING;
