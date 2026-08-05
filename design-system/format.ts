/**
 * Shared money/time helpers for web + RN (Phase 20).
 * Prices display in the user's local African currency.
 */

/** ISO country (GH) → ISO currency (GHS) */
export const CURRENCY_BY_COUNTRY: Record<string, string> = {
  GH: 'GHS',
  NG: 'NGN',
  KE: 'KES',
  ZA: 'ZAR',
  CI: 'XOF',
  SN: 'XOF',
  TG: 'XOF',
  BJ: 'XOF',
  BF: 'XOF',
  ML: 'XOF',
  NE: 'XOF',
  GW: 'XOF',
  CM: 'XAF',
  GA: 'XAF',
  CG: 'XAF',
  TD: 'XAF',
  GQ: 'XAF',
  CF: 'XAF',
  TZ: 'TZS',
  UG: 'UGX',
  RW: 'RWF',
  ET: 'ETB',
  EG: 'EGP',
  MA: 'MAD',
  TN: 'TND',
  DZ: 'DZD',
  AO: 'AOA',
  MZ: 'MZN',
  ZM: 'ZMW',
  BW: 'BWP',
  NA: 'NAD',
  MW: 'MWK',
  ZW: 'USD',
};

/** Preferred display symbols (Intl often uses wrong glyphs for African markets). */
export const CURRENCY_SYMBOL: Record<string, string> = {
  GHS: 'GH₵',
  NGN: '₦',
  KES: 'KSh',
  ZAR: 'R',
  XOF: 'CFA',
  XAF: 'FCFA',
  TZS: 'TSh',
  UGX: 'USh',
  RWF: 'RF',
  ETB: 'Br',
  EGP: 'E£',
  MAD: 'MAD',
  TND: 'DT',
  DZD: 'DA',
  AOA: 'Kz',
  MZN: 'MT',
  ZMW: 'ZK',
  BWP: 'P',
  NAD: 'N$',
  MWK: 'MK',
  USD: '$',
};

export const COUNTRY_NAME: Record<string, string> = {
  GH: 'Ghana',
  NG: 'Nigeria',
  KE: 'Kenya',
  ZA: 'South Africa',
  CI: "Côte d'Ivoire",
  SN: 'Senegal',
  TG: 'Togo',
  BJ: 'Benin',
  BF: 'Burkina Faso',
  ML: 'Mali',
  CM: 'Cameroon',
  TZ: 'Tanzania',
  UG: 'Uganda',
  RW: 'Rwanda',
  ET: 'Ethiopia',
  EG: 'Egypt',
  MA: 'Morocco',
  AO: 'Angola',
  MZ: 'Mozambique',
  ZM: 'Zambia',
  BW: 'Botswana',
  NA: 'Namibia',
};

export function currencyForCountry(countryCode?: string | null): string {
  if (!countryCode) return 'GHS';
  const code = countryCode.toUpperCase();
  return CURRENCY_BY_COUNTRY[code] || code;
}

export function currencySymbol(currencyCode?: string | null): string {
  const c = (currencyCode || 'GHS').toUpperCase();
  return CURRENCY_SYMBOL[c] || c;
}

/**
 * Format amount in a currency. Uses African-friendly symbols where Intl is weak.
 */
export function formatCurrency(amount: number, currencyCode = 'GHS'): string {
  const code = (currencyCode || 'GHS').toUpperCase();
  const n = Number(amount) || 0;
  const symbol = CURRENCY_SYMBOL[code];

  // Zero-decimal currencies common in Africa
  const zeroDecimal = ['XOF', 'XAF', 'UGX', 'RWF', 'GNF'].includes(code);
  const digits = zeroDecimal ? 0 : 2;
  const formatted = n.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  if (symbol) {
    // CFA / FCFA after amount; others before
    if (code === 'XOF' || code === 'XAF') return `${formatted} ${symbol}`;
    return `${symbol}${formatted}`;
  }

  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n);
  } catch {
    return `${code} ${formatted}`;
  }
}

/** Format using ISO country code (GH → GHS → GH₵…). */
export function formatMoneyForCountry(amount: number, countryCode?: string | null): string {
  return formatCurrency(amount, currencyForCountry(countryCode));
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
