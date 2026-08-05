import { useEffect, useState } from 'react';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

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
  sections: CmsSection[];
  meta?: Record<string, any>;
};

const cache = new Map<string, CmsPage | null>();

export async function fetchCmsPage(slug: string): Promise<CmsPage | null> {
  if (cache.has(slug)) return cache.get(slug) || null;
  try {
    const res = await fetch(`${API}/public/cms/pages/${encodeURIComponent(slug)}`);
    const json = await res.json();
    const page = res.ok ? (json.data as CmsPage) : null;
    cache.set(slug, page);
    return page;
  } catch {
    cache.set(slug, null);
    return null;
  }
}

export function clearCmsCache() {
  cache.clear();
}

export function sectionOf(page: CmsPage | null | undefined, type: string) {
  return page?.sections?.find((s) => s.type === type && s.enabled !== false) || null;
}

export function sectionsOf(page: CmsPage | null | undefined, type: string) {
  return page?.sections?.filter((s) => s.type === type && s.enabled !== false) || [];
}

export function useCmsPage(slug: string) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCmsPage(slug)
      .then((p) => {
        if (cancelled) return;
        setPage(p);
        if (!p) setError('Content unavailable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { page, loading, error, section: (type: string) => sectionOf(page, type) };
}
