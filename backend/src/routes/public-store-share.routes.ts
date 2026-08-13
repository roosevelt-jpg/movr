import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { MarketplaceService } from '../services/marketplace.service';
import { PaymentService } from '../services/payment.service';

const db = new DatabaseService();
const marketplace = new MarketplaceService(db, new PaymentService(db));

export const publicStoreShareRouter = Router();

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function webOrigin(req: Request) {
  const fromEnv =
    process.env.PUBLIC_WEB_ORIGIN ||
    process.env.WEB_ORIGIN ||
    process.env.CORS_ORIGIN?.split(',')[0]?.trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv.replace(/\/$/, '');
  const ref = req.get('referer') || req.get('origin') || '';
  try {
    if (ref) return new URL(ref).origin;
  } catch {
    /* ignore */
  }
  return 'http://127.0.0.1:5180';
}

function apiOrigin(req: Request) {
  const fromEnv = process.env.PUBLIC_API_ORIGIN || process.env.API_PUBLIC_ORIGIN;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('x-forwarded-host') || req.get('host') || '127.0.0.1:3000';
  return `${proto}://${host}`;
}

function absoluteMedia(req: Request, url?: string | null) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
  try {
    return new URL(u.startsWith('/') ? u : `/${u}`, apiOrigin(req)).toString();
  } catch {
    return u;
  }
}

async function buildShareMeta(req: Request, ref: string) {
  const result = await marketplace.getStore(ref);
  const store = result.rows[0];
  if (!store) return null;

  const code = store.store_code || store.id;
  const name = String(store.name || 'Movr store').trim();
  const category = String(store.category || '').trim();
  const description = String(
    store.seo_description ||
      store.description ||
      (category
        ? `${name} on Movr — ${category}. Order online for delivery.`
        : `${name} on Movr. Browse the menu and order for delivery.`)
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);

  const title = String(store.seo_title || `${name} · Movr`).trim().slice(0, 120);
  const banner =
    store.logo_url ||
    store.banner_url ||
    store.banners?.[0]?.image_url ||
    '/brand/shop-partner.png';
  const image = absoluteMedia(req, banner) || absoluteMedia(req, '/brand/shop-partner.png');
  const path = `/store/${code}`;
  const url = `${webOrigin(req)}${path}`;

  return {
    id: store.id,
    storeCode: store.store_code || null,
    name,
    category: category || null,
    title,
    description,
    image,
    logo: absoluteMedia(req, store.logo_url) || image,
    url,
    path,
  };
}

/** JSON meta for the web app / tooling */
publicStoreShareRouter.get('/:ref/meta', async (req: Request, res: Response) => {
  try {
    const meta = await buildShareMeta(req, String(req.params.ref || ''));
    if (!meta) return res.status(404).json({ status: 'error', message: 'Store not found' });
    res.json({ status: 'success', data: meta });
  } catch (e: any) {
    res.status(500).json({ status: 'error', message: e?.message || 'Failed to load store meta' });
  }
});

/**
 * Crawler-friendly HTML with Open Graph / Twitter cards.
 * Humans are redirected to the SPA storefront.
 */
publicStoreShareRouter.get('/:ref/og', async (req: Request, res: Response) => {
  try {
    const meta = await buildShareMeta(req, String(req.params.ref || ''));
    if (!meta) {
      res.status(404).type('html').send('<!doctype html><title>Store not found</title><p>Store not found</p>');
      return;
    }
    const title = escapeHtml(meta.title);
    const desc = escapeHtml(meta.description);
    const image = escapeHtml(meta.image);
    const url = escapeHtml(meta.url);
    const site = 'Movr';
    res
      .status(200)
      .type('html')
      .send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${site}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:alt" content="${escapeHtml(meta.name)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body>
  <p>Opening <a href="${url}">${escapeHtml(meta.name)}</a> on Movr…</p>
  <script>location.replace(${JSON.stringify(meta.url)});</script>
</body>
</html>`);
  } catch (e: any) {
    res.status(500).type('html').send(`<!doctype html><title>Error</title><p>${escapeHtml(e?.message || 'Error')}</p>`);
  }
});
