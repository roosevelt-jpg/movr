import { DatabaseService } from './database.service';

export type CmsSection = {
  id: string;
  type: string;
  sortOrder: number;
  enabled: boolean;
  payload: Record<string, any>;
};

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  status: string;
  locale: string;
  meta: Record<string, any>;
  publishedAt: string | null;
  updatedAt: string;
  sections: CmsSection[];
};

const RESERVED_SLUGS = new Set([
  'global',
  'home',
  'login',
  'register',
  'dashboard',
  'admin',
  'api',
  'merchant',
]);

export class CmsService {
  constructor(private db: DatabaseService) {}

  private mapPage(row: any, sections: any[] = []): CmsPage {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      locale: row.locale,
      meta: row.meta || {},
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      sections: sections.map((s) => ({
        id: s.id,
        type: s.type,
        sortOrder: s.sort_order,
        enabled: s.enabled,
        payload: s.payload || {},
      })),
    };
  }

  normalizeSlug(raw: string) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  async listPages() {
    const r = await this.db.query(
      `SELECT id, slug, title, status, locale, meta, published_at, updated_at
       FROM cms_pages ORDER BY slug`
    );
    return r.rows.map((row) => this.mapPage(row));
  }

  async getPageBySlug(slug: string, opts: { publishedOnly?: boolean; includeDisabled?: boolean } = {}) {
    const publishedOnly = opts.publishedOnly !== false;
    const includeDisabled = opts.includeDisabled === true || publishedOnly === false;
    const page = await this.db.query(
      `SELECT * FROM cms_pages WHERE slug = $1 ${publishedOnly ? `AND status = 'published'` : ''} LIMIT 1`,
      [slug]
    );
    if (!page.rows[0]) return null;
    const sections = await this.db.query(
      `SELECT * FROM cms_sections
       WHERE page_id = $1 ${includeDisabled ? '' : 'AND enabled = TRUE'}
       ORDER BY sort_order ASC, created_at ASC`,
      [page.rows[0].id]
    );
    return this.mapPage(page.rows[0], sections.rows);
  }

  async getPageById(id: string) {
    const page = await this.db.query(`SELECT * FROM cms_pages WHERE id = $1`, [id]);
    if (!page.rows[0]) return null;
    const sections = await this.db.query(
      `SELECT * FROM cms_sections WHERE page_id = $1 ORDER BY sort_order ASC`,
      [id]
    );
    return this.mapPage(page.rows[0], sections.rows);
  }

  async upsertPage(input: {
    slug: string;
    title: string;
    status?: string;
    locale?: string;
    meta?: Record<string, any>;
    sections?: Array<{ type: string; sortOrder?: number; enabled?: boolean; payload?: any }>;
    updatedBy?: string;
  }) {
    const slug = this.normalizeSlug(input.slug);
    if (!slug) throw new Error('Invalid slug');
    if (RESERVED_SLUGS.has(slug) && slug !== 'global' && slug !== 'home') {
      // allow editing seeded pages; only block brand-new reserved collisions for custom create
    }

    const existing = await this.db.query(`SELECT id, meta FROM cms_pages WHERE slug = $1`, [slug]);
    let pageId: string;
    const status = input.status || 'draft';
    const publishedAt = status === 'published' ? new Date().toISOString() : null;
    const prevMeta = (existing.rows[0]?.meta as Record<string, any>) || {};
    const meta =
      input.meta !== undefined && input.meta !== null
        ? { ...prevMeta, ...input.meta }
        : prevMeta;

    if (existing.rows[0]) {
      pageId = existing.rows[0].id;
      await this.db.query(
        `UPDATE cms_pages SET
           title = $2::text, status = $3::varchar(16), locale = COALESCE($4::varchar(16), locale),
           meta = $5::jsonb,
           published_at = CASE WHEN $3::varchar(16) = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
           updated_by = $6, updated_at = NOW()
         WHERE id = $1::uuid`,
        [
          pageId,
          input.title,
          status,
          input.locale || null,
          JSON.stringify(meta),
          input.updatedBy || null,
        ]
      );
      if (input.sections) {
        await this.db.query(`DELETE FROM cms_sections WHERE page_id = $1`, [pageId]);
      }
    } else {
      const ins = await this.db.query(
        `INSERT INTO cms_pages (slug, title, status, locale, meta, published_at, updated_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id`,
        [
          slug,
          input.title,
          status,
          input.locale || 'en',
          JSON.stringify(meta),
          publishedAt,
          input.updatedBy || null,
        ]
      );
      pageId = ins.rows[0].id;
    }

    if (input.sections?.length) {
      for (let i = 0; i < input.sections.length; i++) {
        const s = input.sections[i];
        await this.db.query(
          `INSERT INTO cms_sections (page_id, type, sort_order, enabled, payload)
           VALUES ($1,$2,$3,$4,$5::jsonb)`,
          [
            pageId,
            s.type,
            s.sortOrder ?? i,
            s.enabled !== false,
            JSON.stringify(s.payload || {}),
          ]
        );
      }
    }

    await this.syncMenuPlacement(slug, input.title, meta);

    return this.getPageById(pageId);
  }

  /** Keep header/footer links in sync with page meta.menuPlacement. */
  async syncMenuPlacement(slug: string, title: string, meta: Record<string, any>) {
    const placement = String(meta.menuPlacement || 'none');
    const label = String(meta.menuLabel || title || slug).trim();
    const href = String(meta.path || `/pages/${slug}`);
    const managedKey = `cms:${slug}`;

    const global = await this.db.query(`SELECT id FROM cms_pages WHERE slug = 'global' LIMIT 1`);
    if (!global.rows[0]) return;
    const pageId = global.rows[0].id;

    const sections = await this.db.query(
      `SELECT id, type, payload FROM cms_sections WHERE page_id = $1 AND type IN ('nav', 'footer')`,
      [pageId]
    );

    for (const row of sections.rows) {
      const payload = { ...(row.payload || {}) };

      if (row.type === 'nav') {
        let links: any[] = Array.isArray(payload.links) ? [...payload.links] : [];
        links = links.filter((l) => l?.managedKey !== managedKey && l?.href !== href);
        if (placement === 'header') {
          links.push({ label, href, managedKey });
        }
        payload.links = links;
      }

      if (row.type === 'footer') {
        const columns = Array.isArray(payload.columns) ? payload.columns.map((c: any) => ({ ...c })) : [];
        for (const col of columns) {
          col.links = (col.links || []).filter(
            (l: any) => l?.managedKey !== managedKey && l?.href !== href
          );
        }
        if (placement.startsWith('footer')) {
          const want =
            placement === 'footer-services'
              ? 'SERVICES'
              : placement === 'footer-support'
                ? 'SUPPORT'
                : 'COMPANY';
          let col = columns.find((c: any) => String(c.title || '').toUpperCase() === want);
          if (!col) {
            col = { title: want, links: [] };
            columns.push(col);
          }
          col.links = [...(col.links || []), { label, href, managedKey }];
        }
        payload.columns = columns;
      }

      await this.db.query(
        `UPDATE cms_sections SET payload = $2::jsonb, updated_at = NOW() WHERE id = $1`,
        [row.id, JSON.stringify(payload)]
      );
    }
  }

  async updateSection(sectionId: string, payload: Record<string, any>, enabled?: boolean) {
    await this.db.query(
      `UPDATE cms_sections SET
         payload = $2::jsonb,
         enabled = COALESCE($3, enabled),
         updated_at = NOW()
       WHERE id = $1`,
      [sectionId, JSON.stringify(payload), enabled ?? null]
    );
    const r = await this.db.query(`SELECT * FROM cms_sections WHERE id = $1`, [sectionId]);
    return r.rows[0];
  }

  async publish(slug: string) {
    await this.db.query(
      `UPDATE cms_pages SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE slug = $1`,
      [slug]
    );
    return this.getPageBySlug(slug, { publishedOnly: false, includeDisabled: true });
  }

  async countPages() {
    const r = await this.db.query(`SELECT COUNT(*)::int AS n FROM cms_pages`);
    return r.rows[0]?.n || 0;
  }

  async submitForm(pageSlug: string, formKey: string, payload: Record<string, any>) {
    const slug = this.normalizeSlug(pageSlug);
    const page = await this.getPageBySlug(slug, { publishedOnly: true });
    if (!page) throw new Error('Page not found');
    const hasForm = page.sections.some((s) => s.type === 'form');
    if (!hasForm) throw new Error('No form on this page');

    const r = await this.db.query(
      `INSERT INTO cms_form_submissions (page_slug, form_key, payload)
       VALUES ($1, $2, $3::jsonb) RETURNING id, created_at`,
      [slug, formKey || 'default', JSON.stringify(payload || {})]
    );
    return r.rows[0];
  }

  async listFormSubmissions(limit = 50) {
    const r = await this.db.query(
      `SELECT id, page_slug, form_key, payload, created_at
       FROM cms_form_submissions
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.min(200, Math.max(1, limit))]
    );
    return r.rows;
  }
}
