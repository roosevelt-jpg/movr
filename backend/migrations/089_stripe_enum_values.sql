-- Split out of 090/099: Postgres forbids using a newly added enum value in the
-- same transaction that added it, so the enum extension must commit on its own
-- before any migration INSERTs rows using it (see also 106/107 for the same pattern).
ALTER TYPE payment_provider_name ADD VALUE IF NOT EXISTS 'stripe';

DO $$ BEGIN
  ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'stripe';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
