import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MarketplaceService } from '../services/marketplace.service';
import { PaymentService } from '../services/payment.service';
import { assertDirectUploadUrl } from '../utils/media-url';

const db = new DatabaseService();
const marketplace = new MarketplaceService(db, new PaymentService(db));

/** Public shared categories */
export const categoriesRouter = Router();
categoriesRouter.get('/', async (_req, res: Response) => {
  try {
    const result = await marketplace.listCategories(true);
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Admin marketplace catalog — categories + store banners */
export const adminCatalogRouter = Router();
adminCatalogRouter.use(authenticateToken, requireAdmin);

adminCatalogRouter.get('/categories', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await marketplace.listCategories(false);
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminCatalogRouter.post('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, iconUrl, sortOrder, isActive } = req.body;
    assertDirectUploadUrl(iconUrl, 'iconUrl');
    if (!name || !slug) {
      return res.status(400).json({ status: 'error', message: 'name and slug required' });
    }
    const row = await db.query(
      `INSERT INTO product_categories (name, slug, icon_url, sort_order, is_active)
       VALUES ($1,$2,$3,$4,COALESCE($5,TRUE)) RETURNING *`,
      [name, String(slug).toLowerCase(), iconUrl || null, sortOrder != null ? Number(sortOrder) : 0, isActive]
    );
    res.status(201).json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminCatalogRouter.patch('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, iconUrl, sortOrder, isActive } = req.body;
    assertDirectUploadUrl(iconUrl, 'iconUrl');
    const row = await db.query(
      `UPDATE product_categories SET
         name = COALESCE($1, name),
         slug = COALESCE($2, slug),
         icon_url = COALESCE($3, icon_url),
         sort_order = COALESCE($4, sort_order),
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        name || null,
        slug ? String(slug).toLowerCase() : null,
        iconUrl || null,
        sortOrder != null ? Number(sortOrder) : null,
        typeof isActive === 'boolean' ? isActive : null,
        req.params.id,
      ]
    );
    if (!row.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Category not found' });
    }
    res.json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminCatalogRouter.delete('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const row = await db.query(
      `DELETE FROM product_categories WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!row.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Category not found' });
    }
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminCatalogRouter.get('/stores', async (_req: AuthRequest, res: Response) => {
  try {
    const stores = await db.query(
      `SELECT s.id, s.name, s.category, s.banner_url, s.status, s.is_active,
              m.business_name AS merchant_name
       FROM stores s
       LEFT JOIN merchants m ON m.id = s.merchant_id
       ORDER BY s.name ASC
       LIMIT 200`
    );
    res.json({ status: 'success', data: stores.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminCatalogRouter.get('/stores/:id/banners', async (req: AuthRequest, res: Response) => {
  try {
    const banners = await db.query(
      `SELECT * FROM store_banners WHERE store_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [req.params.id]
    );
    res.json({ status: 'success', data: banners.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminCatalogRouter.post('/stores/:id/banners', async (req: AuthRequest, res: Response) => {
  try {
    const { title, imageUrl, linkUrl, sortOrder, isActive } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ status: 'error', message: 'imageUrl is required' });
    }
    assertDirectUploadUrl(imageUrl, 'imageUrl');
    const banner = await db.query(
      `INSERT INTO store_banners (store_id, title, image_url, link_url, sort_order, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,TRUE),$7) RETURNING *`,
      [
        req.params.id,
        title || null,
        imageUrl,
        linkUrl || null,
        sortOrder != null ? Number(sortOrder) : 0,
        typeof isActive === 'boolean' ? isActive : true,
        req.user!.id,
      ]
    );
    res.status(201).json({ status: 'success', data: banner.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminCatalogRouter.patch(
  '/stores/:storeId/banners/:bannerId',
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, imageUrl, linkUrl, sortOrder, isActive } = req.body;
      assertDirectUploadUrl(imageUrl, 'imageUrl');
      const banner = await db.query(
        `UPDATE store_banners SET
           title = COALESCE($1, title),
           image_url = COALESCE($2, image_url),
           link_url = COALESCE($3, link_url),
           sort_order = COALESCE($4, sort_order),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
         WHERE id = $6 AND store_id = $7
         RETURNING *`,
        [
          title || null,
          imageUrl || null,
          linkUrl || null,
          sortOrder != null ? Number(sortOrder) : null,
          typeof isActive === 'boolean' ? isActive : null,
          req.params.bannerId,
          req.params.storeId,
        ]
      );
      if (!banner.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Banner not found' });
      }
      res.json({ status: 'success', data: banner.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminCatalogRouter.delete(
  '/stores/:storeId/banners/:bannerId',
  async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await db.query(
        `DELETE FROM store_banners WHERE id = $1 AND store_id = $2 RETURNING id`,
        [req.params.bannerId, req.params.storeId]
      );
      if (!deleted.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Banner not found' });
      }
      res.json({ status: 'success' });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);
