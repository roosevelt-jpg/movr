-- 106: Extend integration_key enum for Play / messaging (commit before inserts in 107)
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'firebase_fcm';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'expo_push';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'google_play';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'sendgrid';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'mapbox';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'stripe';
