-- Bidirectional ride reviews + moderation flags (autonomous review loop)
ALTER TABLE ride_ratings
  ADD COLUMN IF NOT EXISTS rater_role VARCHAR(16) NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS rater_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS moderated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS moderation_flags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_submitted BOOLEAN NOT NULL DEFAULT FALSE;

-- Allow one rating per ride per role (customer rates driver; driver rates rider)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ride_ratings_ride_id_key'
  ) THEN
    ALTER TABLE ride_ratings DROP CONSTRAINT ride_ratings_ride_id_key;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ride_ratings_ride_role
  ON ride_ratings (ride_id, rater_role);

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS rider_rating SMALLINT,
  ADD COLUMN IF NOT EXISTS rider_review TEXT,
  ADD COLUMN IF NOT EXISTS rating_prompted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_rated_at TIMESTAMPTZ;
