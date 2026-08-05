import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { CmsService } from '../services/cms.service';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { seedCms, ensureCmsDefaults, CMS_SEED } from '../scripts/seed-cms';

const db = new DatabaseService();
const cms = new CmsService(db);

export const publicCmsRouter = Router();
export const adminCmsRouter = Router();

publicCmsRouter.get('/pages/:slug', async (req: Request, res: Response) => {
  try {
    const page = await cms.getPageBySlug(String(req.params.slug), { publishedOnly: true });
    if (!page) {
      return res.status(404).json({ status: 'error', message: 'Page not found' });
    }
    res.json({ status: 'success', data: page });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

publicCmsRouter.get('/bundle', async (_req: Request, res: Response) => {
  try {
    const [global, home] = await Promise.all([
      cms.getPageBySlug('global', { publishedOnly: true }),
      cms.getPageBySlug('home', { publishedOnly: true }),
    ]);
    res.json({ status: 'success', data: { global, home } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminCmsRouter.use(authenticateToken, requireAdmin);

adminCmsRouter.get('/pages', async (_req: AuthRequest, res: Response) => {
  try {
    const pages = await cms.listPages();
    res.json({ status: 'success', data: pages });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminCmsRouter.get('/pages/:slug', async (req: AuthRequest, res: Response) => {
  try {
    const page = await cms.getPageBySlug(String(req.params.slug), { publishedOnly: false });
    if (!page) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'success', data: page });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminCmsRouter.put('/pages/:slug', async (req: AuthRequest, res: Response) => {
  try {
    const slug = String(req.params.slug);
    const { title, status, locale, meta, sections } = req.body;
    const page = await cms.upsertPage({
      slug,
      title: title || slug,
      status,
      locale,
      meta,
      sections,
      updatedBy: req.user?.id,
    });
    res.json({ status: 'success', data: page });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminCmsRouter.post('/pages/:slug/publish', async (req: AuthRequest, res: Response) => {
  try {
    const page = await cms.publish(String(req.params.slug));
    res.json({ status: 'success', data: page });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminCmsRouter.patch('/sections/:id', async (req: AuthRequest, res: Response) => {
  try {
    const row = await cms.updateSection(String(req.params.id), req.body.payload || {}, req.body.enabled);
    res.json({ status: 'success', data: row });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminCmsRouter.get('/defaults', async (_req: AuthRequest, res: Response) => {
  res.json({
    status: 'success',
    data: CMS_SEED.map((p) => ({
      slug: p.slug,
      title: p.title,
      status: p.status,
      sections: p.sections.map((s, i) => ({
        id: `default-${p.slug}-${i}`,
        type: s.type,
        sortOrder: i,
        enabled: true,
        payload: s.payload,
      })),
    })),
  });
});

/** Insert missing default pages (does not overwrite admin edits). */
adminCmsRouter.post('/ensure-defaults', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await ensureCmsDefaults(db);
    const pages = await cms.listPages();
    res.json({
      status: 'success',
      message: `Defaults ready (${pages.length} pages). Added ${result.created}, skipped existing ${CMS_SEED.length - result.created - result.updated}.`,
      data: pages,
      result,
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Reset all default pages to mockup content (overwrites). */
adminCmsRouter.post('/seed', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await seedCms(db, { overwrite: true });
    res.json({
      status: 'success',
      message: `Reset ${CMS_SEED.length} pages from mockup defaults`,
      slugs: CMS_SEED.map((p) => p.slug),
      result,
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
