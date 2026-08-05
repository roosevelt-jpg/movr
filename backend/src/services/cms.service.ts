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

  async listPages() {
    const r = await this.db.query(
      `SELECT id, slug, title, status, locale, meta, published_at, updated_at
       FROM cms_pages ORDER BY slug`
    );
    return r.rows.map((row) => this.mapPage(row));
  }

  async getPageBySlug(slug: string, opts: { publishedOnly?: boolean } = {}) {
    const publishedOnly = opts.publishedOnly !== false;
    const page = await this.db.query(
      `SELECT * FROM cms_pages WHERE slug = $1 ${publishedOnly ? `AND status = 'published'` : ''} LIMIT 1`,
      [slug]
    );
    if (!page.rows[0]) return null;
    const sections = await this.db.query(
      `SELECT * FROM cms_sections
       WHERE page_id = $1 AND enabled = TRUE
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
    const existing = await this.db.query(`SELECT id FROM cms_pages WHERE slug = $1`, [input.slug]);
    let pageId: string;
    const status = input.status || 'draft';
    const publishedAt = status === 'published' ? new Date().toISOString() : null;

    if (existing.rows[0]) {
      pageId = existing.rows[0].id;
      await this.db.query(
        `UPDATE cms_pages SET
           title = $2::text, status = $3::varchar(16), locale = $4::varchar(16), meta = $5::jsonb,
           published_at = CASE WHEN $3::varchar(16) = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
           updated_by = $6, updated_at = NOW()
         WHERE id = $1::uuid`,
        [
          pageId,
          input.title,
          status,
          input.locale || 'en',
          JSON.stringify(input.meta || {}),
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
          input.slug,
          input.title,
          status,
          input.locale || 'en',
          JSON.stringify(input.meta || {}),
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

    return this.getPageById(pageId);
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
    return this.getPageBySlug(slug, { publishedOnly: false });
  }

  async countPages() {
    const r = await this.db.query(`SELECT COUNT(*)::int AS n FROM cms_pages`);
    return r.rows[0]?.n || 0;
  }
}
