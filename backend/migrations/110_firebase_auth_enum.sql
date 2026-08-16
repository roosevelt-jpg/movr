-- Firebase Auth (email verification + OTP) alongside FCM.

ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'firebase_auth';
