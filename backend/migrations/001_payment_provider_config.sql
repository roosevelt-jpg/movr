-- Phase 0A — Dual payment provider config (Paystack + Flutterwave)

CREATE TYPE payment_provider_scope AS ENUM ('global', 'country');
CREATE TYPE payment_provider_name AS ENUM ('paystack', 'flutterwave');

CREATE TABLE IF NOT EXISTS payment_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope payment_provider_scope NOT NULL,
  country_code VARCHAR(8),
  provider payment_provider_name NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payment_provider_country_required
    CHECK (
      (scope = 'global' AND country_code IS NULL)
      OR (scope = 'country' AND country_code IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_provider_global_active
  ON payment_provider_config (scope)
  WHERE scope = 'global' AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_provider_country_active
  ON payment_provider_config (country_code)
  WHERE scope = 'country' AND is_active = TRUE;

-- Default: Flutterwave global (existing production path)
INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
SELECT 'global', NULL, 'flutterwave', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM payment_provider_config WHERE scope = 'global' AND is_active = TRUE
);

-- Paystack preferred in its live markets when configured
INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
SELECT v.scope, v.country_code, v.provider::payment_provider_name, TRUE
FROM (VALUES
  ('country', 'GH', 'paystack'),
  ('country', 'NG', 'paystack'),
  ('country', 'ZA', 'paystack'),
  ('country', 'KE', 'paystack'),
  ('country', 'CI', 'paystack')
) AS v(scope, country_code, provider)
WHERE NOT EXISTS (
  SELECT 1 FROM payment_provider_config p
  WHERE p.scope = 'country' AND p.country_code = v.country_code AND p.is_active = TRUE
);
