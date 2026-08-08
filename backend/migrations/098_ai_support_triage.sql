-- AI support triage metadata
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS triage_category VARCHAR(64),
  ADD COLUMN IF NOT EXISTS triage_priority VARCHAR(24),
  ADD COLUMN IF NOT EXISTS suggested_reply TEXT,
  ADD COLUMN IF NOT EXISTS triage_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS transcript JSONB,
  ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS guest_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS channel VARCHAR(40),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ops_note TEXT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_source ON support_tickets(source);
