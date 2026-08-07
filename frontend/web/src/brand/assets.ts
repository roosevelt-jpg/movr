/**
 * Brand photography for marketing heroes and banners.
 * Served from /public/brand — used only when CMS has no background set yet.
 * Once an admin saves backgroundImage in CMS, that value always wins.
 */
export const BRAND = {
  wordmark: '/brand/movr-wordmark.png',
  rideSedan: '/brand/ride-sedan.png',
  courierMoto: '/brand/courier-moto.png',
  shopPartner: '/brand/shop-partner.png',
} as const;

/** Default full-bleed hero photo by CMS page slug (fallback only). */
export const BRAND_HERO_BY_SLUG: Record<string, string> = {
  home: BRAND.rideSedan,
  features: BRAND.rideSedan,
  contact: BRAND.rideSedan,
  drivers: BRAND.courierMoto,
  merchants: BRAND.shopPartner,
  about: BRAND.rideSedan,
  download: BRAND.wordmark,
  ai: BRAND.rideSedan,
};

export function brandHeroForSlug(slug?: string): string | undefined {
  if (!slug) return undefined;
  return BRAND_HERO_BY_SLUG[slug];
}

export type CmsHeroMedia = {
  imageUrl?: string;
  videoUrl?: string;
  /** 0–100 photo visibility */
  imageOpacity: number;
  /** 0–100 dark fade strength */
  overlayOpacity: number;
};

function clampPct(value: unknown, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Resolve hero media from CMS payload.
 * - Admin upload / URL / preset → always used
 * - Explicit empty string → no photo (admin cleared)
 * - Missing field → brand stock fallback by page slug
 */
export function resolveCmsHeroMedia(
  payload: {
    backgroundImage?: string | null;
    backgroundVideo?: string | null;
    useBrandPhoto?: boolean;
    backgroundOpacity?: number | string | null;
    overlayOpacity?: number | string | null;
    imageOpacity?: number | string | null;
  },
  pageSlug?: string
): CmsHeroMedia {
  const imageOpacity = clampPct(payload?.imageOpacity ?? payload?.backgroundOpacity, 65);
  const overlayOpacity = clampPct(payload?.overlayOpacity, 55);

  const video = String(payload?.backgroundVideo || '').trim();
  if (video) return { videoUrl: video, imageOpacity, overlayOpacity };

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'backgroundImage')) {
    const img = String(payload.backgroundImage || '').trim();
    return img ? { imageUrl: img, imageOpacity, overlayOpacity } : { imageOpacity, overlayOpacity };
  }

  if (payload?.useBrandPhoto === false) return { imageOpacity, overlayOpacity };
  const fallback = brandHeroForSlug(pageSlug);
  return fallback
    ? { imageUrl: fallback, imageOpacity, overlayOpacity }
    : { imageOpacity, overlayOpacity };
}
