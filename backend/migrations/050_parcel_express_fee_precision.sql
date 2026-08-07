-- Fix express multiplier precision so Standard 18 → Express 32 exactly
ALTER TABLE delivery_pricing_config
  ALTER COLUMN express_multiplier TYPE NUMERIC(8,4);

UPDATE delivery_pricing_config
SET standard_fee = 18,
    express_multiplier = ROUND(32.0 / 18.0, 4),
    updated_at = NOW()
WHERE id = 1;
