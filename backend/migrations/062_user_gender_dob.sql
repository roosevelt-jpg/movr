-- Profile demographics for global gender / date-of-birth selectors
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender VARCHAR(32),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN users.gender IS 'ISO-style: female | male | non_binary | prefer_not_to_say';
COMMENT ON COLUMN users.date_of_birth IS 'Stored as ISO date (YYYY-MM-DD)';
