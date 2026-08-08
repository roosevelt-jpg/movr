/** Resolve relative /assets or /uploads URLs against API origin. */
export function mediaUrl(url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/assets') || url.startsWith('/uploads')) {
    const api = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    try {
      const origin = new URL(api).origin;
      return new URL(url, origin).toString();
    } catch {
      return url;
    }
  }
  return url;
}

export function isMediaVideo(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/');
}
