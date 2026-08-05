-- Phase CMS — site pages & sections (no hardcoded marketing copy in the app)

CREATE TABLE IF NOT EXISTS cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(256) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  locale VARCHAR(16) NOT NULL DEFAULT 'en',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_sections_page ON cms_sections(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cms_pages_status ON cms_pages(status);

COMMENT ON TABLE cms_pages IS 'Marketing / help / legal pages edited in admin CMS';
COMMENT ON TABLE cms_sections IS 'Typed section blocks (nav, hero, four_ways, stories, cta, download, footer, rich_text, cards, …)';
