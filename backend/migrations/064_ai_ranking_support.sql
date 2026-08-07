-- Movr AI quality ranking + support escalation threads

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS channel VARCHAR(32) DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS guest_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS transcript JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source VARCHAR(64) DEFAULT 'ai_escalate',
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender VARCHAR(32) NOT NULL DEFAULT 'user',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket
  ON support_ticket_messages(ticket_id, created_at);

-- Cached quality scores for marketplace / matching placement
CREATE TABLE IF NOT EXISTS entity_quality_scores (
  entity_type VARCHAR(32) NOT NULL,
  entity_id UUID NOT NULL,
  score NUMERIC(8,4) NOT NULL DEFAULT 0,
  rating_component NUMERIC(8,4) NOT NULL DEFAULT 0,
  activity_component NUMERIC(8,4) NOT NULL DEFAULT 0,
  behaviour_component NUMERIC(8,4) NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_quality_score
  ON entity_quality_scores(entity_type, score DESC);

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS response_score NUMERIC(5,2) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS service_score NUMERIC(5,2) DEFAULT 70;
