/** Reject pasted remote image URLs — media must come from POST /uploads. */
export function assertDirectUploadUrl(
  url: string | null | undefined,
  field = 'imageUrl'
): void {
  if (url == null || url === '') return;
  const value = String(url).trim();
  if (value.startsWith('/uploads/')) return;
  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/uploads/')) return;
  } catch {
    // not an absolute URL
  }
  throw new Error(`${field} must be a direct upload path from POST /uploads`);
}
