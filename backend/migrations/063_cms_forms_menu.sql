-- CMS custom forms + submissions (admin-created pages/forms)

CREATE TABLE IF NOT EXISTS cms_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug VARCHAR(64) NOT NULL,
  form_key VARCHAR(64) NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_form_submissions_page
  ON cms_form_submissions (page_slug, created_at DESC);

COMMENT ON TABLE cms_form_submissions IS 'Public submissions from CMS form sections';
