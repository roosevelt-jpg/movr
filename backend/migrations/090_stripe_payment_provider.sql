-- 090: Add Stripe as a payment provider (peer of Paystack / Flutterwave)

ALTER TYPE payment_provider_name ADD VALUE IF NOT EXISTS 'stripe';

DO $$
BEGIN
  ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'stripe';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO integrations (key, display_name, category, is_required)
VALUES ('stripe', 'Stripe', 'payments', FALSE)
ON CONFLICT (key) DO NOTHING;

-- Optional country defaults for markets where Stripe is common
INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
SELECT 'country', v.cc, 'stripe'::payment_provider_name, TRUE
FROM (VALUES ('US'), ('GB'), ('EU'), ('CA'), ('AU')) AS v(cc)
WHERE NOT EXISTS (
  SELECT 1 FROM payment_provider_config p
  WHERE p.scope = 'country' AND p.country_code = v.cc AND p.is_active = TRUE
);
