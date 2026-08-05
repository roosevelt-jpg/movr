/**
 * Shared product-category catalog defaults (Phase storefront).
 */
import { DatabaseService } from '../services/database.service';

export const DEFAULT_CATEGORIES: Array<{ name: string; slug: string; sort_order: number }> = [
  { name: 'Fashion', slug: 'fashion', sort_order: 10 },
  { name: 'Food & Groceries', slug: 'food-groceries', sort_order: 20 },
  { name: 'Electronics', slug: 'electronics', sort_order: 30 },
  { name: 'Beauty', slug: 'beauty', sort_order: 40 },
  { name: 'Home', slug: 'home', sort_order: 50 },
  { name: 'Sports', slug: 'sports', sort_order: 60 },
  { name: 'Baby', slug: 'baby', sort_order: 70 },
  { name: 'Pharmacy', slug: 'pharmacy', sort_order: 80 },
  { name: 'Books', slug: 'books', sort_order: 90 },
  { name: 'Pets', slug: 'pets', sort_order: 100 },
  { name: 'Automotive', slug: 'automotive', sort_order: 110 },
  { name: 'Other', slug: 'other', sort_order: 120 },
];

export async function ensureCatalogDefaults(db: DatabaseService) {
  let created = 0;
  for (const c of DEFAULT_CATEGORIES) {
    const res = await db.query(
      `INSERT INTO product_categories (name, slug, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [c.name, c.slug, c.sort_order]
    );
    if (res.rows[0]) created += 1;
  }
  return { created };
}
