-- Ensure messaging/payments catalog keys exist (enum first — required on fresh DBs)
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'sendgrid';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'mapbox';

-- Row inserts deferred to 107_playstore_integration_rows.sql — Postgres forbids
-- using a newly added enum value in the same transaction that added it.
