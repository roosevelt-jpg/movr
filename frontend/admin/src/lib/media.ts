/** Resolve relative /assets or legacy /uploads URLs against API origin in local/dev. */
export function mediaUrl(url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/assets') || url.startsWith('/uploads')) {
    const api = process.env.REACT_APP_API_URL || '';
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

/** Direct multipart upload — primary path for all catalog/CMS/KYC images (saved under backend/assets). */
export async function uploadCatalogImage(file: File, token: string): Promise<string> {
  const API = process.env.REACT_APP_API_URL || '/api/v1';
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || 'Upload failed');
  return json.data.url as string;
}
