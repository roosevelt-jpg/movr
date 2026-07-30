/**
 * Shared money/time helpers for web + RN (Phase 20).
 * Prefer these over hardcoded $ / USD.
 */
export function formatCurrency(amount: number, currencyCode = 'GHS'): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${currencyCode} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

export function formatLocalTime(
  value: string | Date | null | undefined,
  timezone = 'Africa/Accra'
): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}
