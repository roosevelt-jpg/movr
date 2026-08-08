/**
 * Admin API base URL.
 * Prefer same-origin `/api/v1` so Vite can proxy to the backend.
 * Host-only values like `http://localhost:3000` (missing `/api/v1`) produce
 * Express 404 "Route not found" on paths such as `/admin/ai/tickets`.
 */
function normalizeApiBase(raw: string): string {
  let base = String(raw || '').trim().replace(/\/$/, '');
  if (!base) return '/api/v1';
  if (/^https?:\/\/[^/]+$/i.test(base)) {
    return `${base}/api/v1`;
  }
  return base;
}

export function getApiBase(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env || {};
  // Vite dev: keep same-origin so the `/api` proxy is used (avoids localhost vs 127.0.0.1).
  if (env.DEV) return '/api/v1';
  return normalizeApiBase(env.VITE_API_URL || env.REACT_APP_API_URL || '/api/v1');
}

export const API = getApiBase();
