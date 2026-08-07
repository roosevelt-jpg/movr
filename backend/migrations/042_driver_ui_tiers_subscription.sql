-- Driver UI alignment: tiers, subscription discounts, weekly plan naming
-- Rollback: reverse UPDATEs; no destructive DDL

UPDATE tier_thresholds
SET min_rides = 50, subscription_discount_pct = 10, matching_priority_weight = 1.25
WHERE tier = 'pro';

UPDATE tier_thresholds
SET min_rides = 500, subscription_discount_pct = 15, matching_priority_weight = 1.5
WHERE tier = 'premium';

UPDATE subscription_discount_config
SET staking_discount_pct = 5, max_total_discount_pct = 25, updated_at = NOW()
WHERE id = 1;

UPDATE plans
SET name = 'Weekly plan', amount = 60, currency = 'GHS'
WHERE id = 'weekly_driver';

-- Ensure one drivers row per user for presence upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id_unique ON drivers (user_id);
