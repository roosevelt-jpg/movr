-- 086: Identity review — merchant KYC docs + Chicken Republic demo seed

ALTER TABLE merchant_kyc_documents
  ADD COLUMN IF NOT EXISTS label VARCHAR(128);

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS identity_linked BOOLEAN DEFAULT FALSE;

-- Chicken Republic owner user: a0000000-0000-4000-8000-000000000014
-- Merchant: b0000000-0000-4000-8000-000000000014
INSERT INTO merchant_kyc_documents (merchant_id, document_type, label, document_number, file_url, status)
SELECT
  'b0000000-0000-4000-8000-000000000014'::uuid,
  v.document_type,
  v.label,
  v.document_number,
  'https://cdn.movr.app/kyc/demo/chicken/' || v.document_type || '.pdf',
  'pending'
FROM (
  VALUES
    ('ghana_card', 'Ghana Card', 'GHA-729104583-1'),
    ('business_reg', 'Business registration', 'BN-CR-44821'),
    ('tax_id', 'Tax ID / TIN', 'C0004491821')
) AS v(document_type, label, document_number)
WHERE EXISTS (SELECT 1 FROM merchants WHERE id = 'b0000000-0000-4000-8000-000000000014'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM merchant_kyc_documents d
    WHERE d.merchant_id = 'b0000000-0000-4000-8000-000000000014'::uuid
      AND d.document_type = v.document_type
  );

-- Baseline link checks (manual review needed until admin override / attest)
INSERT INTO identity_link_checks (user_id, check_type, status, details_json)
SELECT
  'a0000000-0000-4000-8000-000000000014'::uuid,
  v.check_type::identity_link_check_type,
  'unverifiable'::identity_link_status,
  jsonb_build_object('seed', true, 'note', 'Awaiting admin review')
FROM (
  VALUES
    ('id_to_license'),
    ('id_to_vehicle'),
    ('id_to_phone')
) AS v(check_type)
WHERE EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-4000-8000-000000000014'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM identity_link_checks c
    WHERE c.user_id = 'a0000000-0000-4000-8000-000000000014'::uuid
      AND c.check_type::text = v.check_type
  );

UPDATE users
SET
  first_name = COALESCE(NULLIF(first_name, ''), 'Chicken'),
  last_name = COALESCE(NULLIF(last_name, ''), 'Republic'),
  user_type = 'merchant'
WHERE id = 'a0000000-0000-4000-8000-000000000014'::uuid;

UPDATE merchants
SET kyc_status = COALESCE(NULLIF(kyc_status, ''), 'pending')
WHERE id = 'b0000000-0000-4000-8000-000000000014'::uuid
  AND (kyc_status IS NULL OR kyc_status IN ('', 'draft'));
