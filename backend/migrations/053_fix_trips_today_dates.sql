-- Fix completed_at to "today" in DB local date for trips_today meta
UPDATE rides
SET completed_at = CURRENT_TIMESTAMP - (INTERVAL '1 hour' * (CASE id
      WHEN 'f0000000-0000-4000-8000-0000000000f2'::uuid THEN 2
      WHEN 'f0000000-0000-4000-8000-0000000000f3'::uuid THEN 4
      ELSE 1
    END)),
    status = 'completed'
WHERE id IN (
  'f0000000-0000-4000-8000-0000000000f2'::uuid,
  'f0000000-0000-4000-8000-0000000000f3'::uuid
);
