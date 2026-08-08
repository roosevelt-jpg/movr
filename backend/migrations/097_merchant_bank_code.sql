-- 097: Merchant payout bank code for live transfers

ALTER TABLE merchant_bank_accounts
  ADD COLUMN IF NOT EXISTS bank_code VARCHAR(32);

COMMENT ON COLUMN merchant_bank_accounts.bank_code IS
  'Provider/bank code for Paystack/Flutterwave transfers (e.g. MTN, 058)';
