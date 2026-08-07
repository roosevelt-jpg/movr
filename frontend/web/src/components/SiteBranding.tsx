import { useEffect } from 'react';
import { useCmsPage } from '../services/cms';
import { mediaUrl } from '../lib/media';

const DEFAULT_FAVICON = '/favicon.png';

/**
 * Applies CMS-configured favicon (and document title brand) from global → nav.
 */
export default function SiteBranding() {
  const { section } = useCmsPage('global');
  const nav = section('nav')?.payload || {};

  useEffect(() => {
    const raw = String(nav.faviconUrl || DEFAULT_FAVICON).trim() || DEFAULT_FAVICON;
    const favicon = mediaUrl(raw) || DEFAULT_FAVICON;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = favicon.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    link.href = favicon;

    const apple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (apple) apple.href = favicon;
    else {
      const a = document.createElement('link');
      a.rel = 'apple-touch-icon';
      a.href = favicon;
      document.head.appendChild(a);
    }

    const brand = String(nav.brand || 'Movr').trim() || 'Movr';
    if (!document.title || document.title === 'MOVR' || document.title === 'Movr') {
      document.title = brand;
    }
  }, [nav.faviconUrl, nav.brand]);

  return null;
}
