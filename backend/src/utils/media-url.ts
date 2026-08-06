/** Accept direct-upload media paths from POST /uploads (stored under /assets/…). */
export function assertDirectUploadUrl(
  url: string | null | undefined,
  field = 'imageUrl'
): void {
  if (url == null || url === '') return;
  const value = String(url).trim();
  if (value.startsWith('/assets/')) return;
  // Legacy paths from before assets/ migration
  if (value.startsWith('/uploads/')) return;
  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/assets/')) return;
    if (parsed.pathname.startsWith('/uploads/')) return;
  } catch {
    // not an absolute URL
  }
  throw new Error(`${field} must be a direct upload path from POST /uploads (assets folder)`);
}

export function isStoredMediaPath(url: string): boolean {
  return url.startsWith('/assets/') || url.startsWith('/uploads/');
}
