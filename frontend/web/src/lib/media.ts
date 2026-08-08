/** Resolve relative /assets or legacy /uploads URLs against API origin in local/dev. */
export function mediaUrl(url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/assets') || url.startsWith('/uploads')) {
    const api =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
      process.env.REACT_APP_API_URL ||
      '';
    if (api.startsWith('http')) {
      try {
        return new URL(url, new URL(api).origin).toString();
      } catch {
        return url;
      }
    }
  }
  return url;
}

export type UploadPurpose = 'banner' | 'hero' | 'card' | 'product' | 'avatar' | 'default';

export type UploadResult = {
  url: string;
  variants?: { sm?: string; md?: string; lg?: string };
  width?: number;
  height?: number;
  mimeType?: string;
  processed?: boolean;
};

/** Direct multipart upload → backend/assets with server-side auto-resize. */
export async function uploadCatalogImage(
  file: File,
  token: string,
  purpose: UploadPurpose = 'default'
): Promise<string> {
  const result = await uploadMedia(file, token, purpose);
  return result.url;
}

export async function uploadMedia(
  file: File,
  token: string,
  purpose: UploadPurpose = 'default'
): Promise<UploadResult> {
  const API =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
    process.env.REACT_APP_API_URL ||
    '/api/v1';
  const body = new FormData();
  body.append('file', file);
  body.append('purpose', purpose);
  const res = await fetch(`${API}/uploads?purpose=${encodeURIComponent(purpose)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || 'Upload failed');
  return {
    url: json.data.url as string,
    variants: json.data.variants,
    width: json.data.width,
    height: json.data.height,
    mimeType: json.data.mimeType,
    processed: json.data.processed,
  };
}
