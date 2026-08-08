-- 089: Ensure demo merchant accounts have a login password (password123)
UPDATE users
SET password = crypt('password123', gen_salt('bf')),
    updated_at = NOW()
WHERE user_type = 'merchant'
  AND (
    id IN (
      'a0000000-0000-4000-8000-000000000014'::uuid,
      'a0000000-0000-4000-8000-000000000022'::uuid
    )
    OR email ILIKE '%chickenrepublic%'
    OR email ILIKE '%boutique%'
    OR email = 'owner@boutique22.com'
  );
