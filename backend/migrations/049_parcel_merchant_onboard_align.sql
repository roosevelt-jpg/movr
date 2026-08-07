-- Parcel mockup fees: Standard GH₵18, Express GH₵32
UPDATE delivery_pricing_config
SET standard_fee = 18,
    express_multiplier = 1.7778,
    updated_at = NOW()
WHERE id = 1;

-- If column is NUMERIC(6,2), widen so 32/18 stores accurately
ALTER TABLE delivery_pricing_config
  ALTER COLUMN express_multiplier TYPE NUMERIC(8,4);

-- Ensure merchants can store registration cert URL on profile
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS registration_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1;

-- Seed Home / Work for customers who have none (Oxford St demo pickup)
INSERT INTO saved_addresses (user_id, label, address, lat, lng)
SELECT u.id, v.label, v.address, v.lat, v.lng
FROM users u
CROSS JOIN (
  VALUES
    ('Home', '12 Oxford St, Accra', 5.6037, -0.1870),
    ('Work', 'Independence Ave, Accra', 5.5600, -0.2050)
) AS v(label, address, lat, lng)
WHERE u.user_type IN ('customer', 'rider')
  AND NOT EXISTS (
    SELECT 1 FROM saved_addresses sa
    WHERE sa.user_id = u.id AND lower(sa.label) = lower(v.label)
  );
