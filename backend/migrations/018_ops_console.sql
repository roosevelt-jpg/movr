-- Phase 17 — Ops console (018; was 016_ops_console.sql)

CREATE TABLE IF NOT EXISTS ops_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  author_admin_id UUID REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_notes_entity ON ops_notes(entity_type, entity_id);

-- audit_log already created in 002_integrations_hub.sql; ensure columns for before/after/reason
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS before_state JSONB,
  ADD COLUMN IF NOT EXISTS after_state JSONB;
