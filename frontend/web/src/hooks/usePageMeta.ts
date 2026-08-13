import { useEffect } from 'react';

type PageMeta = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content || typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  if (!href || typeof document === 'undefined') return;
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Sets document title + Open Graph / Twitter meta for shareable pages. */
export function usePageMeta(meta: PageMeta) {
  useEffect(() => {
    if (!meta.title && !meta.description && !meta.image) return;
    const prevTitle = document.title;
    if (meta.title) document.title = meta.title;
    if (meta.description) {
      upsertMeta('name', 'description', meta.description);
      upsertMeta('property', 'og:description', meta.description);
      upsertMeta('name', 'twitter:description', meta.description);
    }
    if (meta.title) {
      upsertMeta('property', 'og:title', meta.title);
      upsertMeta('name', 'twitter:title', meta.title);
    }
    if (meta.image) {
      upsertMeta('property', 'og:image', meta.image);
      upsertMeta('name', 'twitter:image', meta.image);
      upsertMeta('name', 'twitter:card', 'summary_large_image');
    }
    if (meta.url) {
      upsertMeta('property', 'og:url', meta.url);
      upsertLink('canonical', meta.url);
    }
    upsertMeta('property', 'og:type', meta.type || 'website');
    upsertMeta('property', 'og:site_name', 'Movr');

    return () => {
      document.title = prevTitle || 'Movr';
    };
  }, [meta.title, meta.description, meta.image, meta.url, meta.type]);
}
