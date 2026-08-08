/** Turn noisy backend/DB errors into short admin-facing copy. */
export function friendlyApiError(err: any, fallback = 'Something went wrong'): string {
  const raw = String(
    err?.response?.data?.message || err?.message || err || ''
  ).trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (
    lower.includes('remaining connection slots') ||
    lower.includes('too many clients') ||
    lower.includes('connection refused') ||
    lower.includes('econnrefused')
  ) {
    return 'Database is busy — wait a moment and refresh. If this keeps happening, restart the backend.';
  }
  if (lower.includes('is not valid json') || lower.includes('unexpected token')) {
    return 'Settings data was corrupted — defaults were applied. Try Save again.';
  }
  return raw;
}
