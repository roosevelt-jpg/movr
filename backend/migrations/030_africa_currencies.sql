-- Expand Movr multi-country coverage across Africa (local currency pricing)

INSERT INTO countries (code, name, currency_code, dial_code, otp_format_regex, emergency_number) VALUES
  ('GH', 'Ghana', 'GHS', '+233', '^[0-9]{6}$', '191'),
  ('NG', 'Nigeria', 'NGN', '+234', '^[0-9]{6}$', '112'),
  ('KE', 'Kenya', 'KES', '+254', '^[0-9]{6}$', '999'),
  ('ZA', 'South Africa', 'ZAR', '+27', '^[0-9]{6}$', '10111'),
  ('CI', 'Côte d''Ivoire', 'XOF', '+225', '^[0-9]{6}$', '180'),
  ('SN', 'Senegal', 'XOF', '+221', '^[0-9]{6}$', '17'),
  ('TG', 'Togo', 'XOF', '+228', '^[0-9]{6}$', '117'),
  ('BJ', 'Benin', 'XOF', '+229', '^[0-9]{6}$', '117'),
  ('BF', 'Burkina Faso', 'XOF', '+226', '^[0-9]{6}$', '17'),
  ('ML', 'Mali', 'XOF', '+223', '^[0-9]{6}$', '17'),
  ('CM', 'Cameroon', 'XAF', '+237', '^[0-9]{6}$', '117'),
  ('TZ', 'Tanzania', 'TZS', '+255', '^[0-9]{6}$', '112'),
  ('UG', 'Uganda', 'UGX', '+256', '^[0-9]{6}$', '999'),
  ('RW', 'Rwanda', 'RWF', '+250', '^[0-9]{6}$', '112'),
  ('ET', 'Ethiopia', 'ETB', '+251', '^[0-9]{6}$', '911'),
  ('EG', 'Egypt', 'EGP', '+20', '^[0-9]{6}$', '122'),
  ('MA', 'Morocco', 'MAD', '+212', '^[0-9]{6}$', '19'),
  ('AO', 'Angola', 'AOA', '+244', '^[0-9]{6}$', '113'),
  ('MZ', 'Mozambique', 'MZN', '+258', '^[0-9]{6}$', '119'),
  ('ZM', 'Zambia', 'ZMW', '+260', '^[0-9]{6}$', '999'),
  ('BW', 'Botswana', 'BWP', '+267', '^[0-9]{6}$', '999'),
  ('NA', 'Namibia', 'NAD', '+264', '^[0-9]{6}$', '10111')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  dial_code = EXCLUDED.dial_code,
  is_active = TRUE;

INSERT INTO city_pricing (city, country_code, base_fare, per_km_rate, per_min_rate, currency_code, timezone, lat, lng)
SELECT * FROM (VALUES
  ('Accra', 'GH', 2.5, 1.5, 0.25, 'GHS', 'Africa/Accra', 5.6037, -0.1870),
  ('Lagos', 'NG', 500, 150, 25, 'NGN', 'Africa/Lagos', 6.5244, 3.3792),
  ('Abuja', 'NG', 450, 140, 22, 'NGN', 'Africa/Lagos', 9.0765, 7.3986),
  ('Nairobi', 'KE', 150, 50, 8, 'KES', 'Africa/Nairobi', -1.2921, 36.8219),
  ('Johannesburg', 'ZA', 15, 8, 1.5, 'ZAR', 'Africa/Johannesburg', -26.2041, 28.0473),
  ('Cape Town', 'ZA', 14, 7.5, 1.4, 'ZAR', 'Africa/Johannesburg', -33.9249, 18.4241),
  ('Abidjan', 'CI', 400, 120, 20, 'XOF', 'Africa/Abidjan', 5.3600, -4.0083),
  ('Dakar', 'SN', 400, 120, 20, 'XOF', 'Africa/Dakar', 14.7167, -17.4677),
  ('Douala', 'CM', 500, 150, 25, 'XAF', 'Africa/Douala', 4.0511, 9.7679),
  ('Dar es Salaam', 'TZ', 2500, 800, 120, 'TZS', 'Africa/Dar_es_Salaam', -6.7924, 39.2083),
  ('Kampala', 'UG', 3000, 1000, 150, 'UGX', 'Africa/Kampala', 0.3476, 32.5825),
  ('Kigali', 'RW', 1200, 400, 60, 'RWF', 'Africa/Kigali', -1.9441, 30.0619),
  ('Addis Ababa', 'ET', 80, 25, 4, 'ETB', 'Africa/Addis_Ababa', 9.0320, 38.7469),
  ('Cairo', 'EG', 25, 8, 1.2, 'EGP', 'Africa/Cairo', 30.0444, 31.2357),
  ('Casablanca', 'MA', 10, 4, 0.8, 'MAD', 'Africa/Casablanca', 33.5731, -7.5898),
  ('Luanda', 'AO', 800, 250, 40, 'AOA', 'Africa/Luanda', -8.8390, 13.2894),
  ('Maputo', 'MZ', 80, 25, 4, 'MZN', 'Africa/Maputo', -25.9692, 32.5732),
  ('Lusaka', 'ZM', 25, 8, 1.5, 'ZMW', 'Africa/Lusaka', -15.3875, 28.3228),
  ('Gaborone', 'BW', 12, 5, 1, 'BWP', 'Africa/Gaborone', -24.6282, 25.9231),
  ('Windhoek', 'NA', 18, 7, 1.2, 'NAD', 'Africa/Windhoek', -22.5609, 17.0658)
) AS v(city, country_code, base_fare, per_km_rate, per_min_rate, currency_code, timezone, lat, lng)
WHERE NOT EXISTS (
  SELECT 1 FROM city_pricing c WHERE c.city = v.city AND c.country_code = v.country_code
);

INSERT INTO fx_rates (from_currency, to_currency, rate) VALUES
  ('GHS', 'GHS', 1), ('NGN', 'NGN', 1), ('KES', 'KES', 1), ('ZAR', 'ZAR', 1),
  ('XOF', 'XOF', 1), ('XAF', 'XAF', 1), ('TZS', 'TZS', 1), ('UGX', 'UGX', 1),
  ('RWF', 'RWF', 1), ('ETB', 'ETB', 1), ('EGP', 'EGP', 1), ('MAD', 'MAD', 1),
  ('AOA', 'AOA', 1), ('MZN', 'MZN', 1), ('ZMW', 'ZMW', 1), ('BWP', 'BWP', 1),
  ('NAD', 'NAD', 1), ('USD', 'USD', 1),
  ('GHS', 'USD', 0.064), ('USD', 'GHS', 15.6),
  ('NGN', 'USD', 0.00065), ('USD', 'NGN', 1540),
  ('KES', 'USD', 0.0077), ('USD', 'KES', 130),
  ('ZAR', 'USD', 0.055), ('USD', 'ZAR', 18.2),
  ('XOF', 'USD', 0.00165), ('USD', 'XOF', 605),
  ('XAF', 'USD', 0.00165), ('USD', 'XAF', 605),
  ('TZS', 'USD', 0.00037), ('USD', 'TZS', 2700),
  ('UGX', 'USD', 0.00027), ('USD', 'UGX', 3700),
  ('RWF', 'USD', 0.00072), ('USD', 'RWF', 1390),
  ('ETB', 'USD', 0.0075), ('USD', 'ETB', 133),
  ('EGP', 'USD', 0.020), ('USD', 'EGP', 50),
  ('MAD', 'USD', 0.10), ('USD', 'MAD', 10),
  ('AOA', 'USD', 0.0011), ('USD', 'AOA', 910),
  ('MZN', 'USD', 0.015), ('USD', 'MZN', 64),
  ('ZMW', 'USD', 0.037), ('USD', 'ZMW', 27),
  ('BWP', 'USD', 0.074), ('USD', 'BWP', 13.5),
  ('NAD', 'USD', 0.055), ('USD', 'NAD', 18.2)
ON CONFLICT (from_currency, to_currency) DO NOTHING;
