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
  DZ: 'Algeria',
  AO: 'Angola',
  BJ: 'Benin',
  BW: 'Botswana',
  BF: 'Burkina Faso',
  BI: 'Burundi',
  CV: 'Cabo Verde',
  CM: 'Cameroon',
  CF: 'Central African Republic',
  TD: 'Chad',
  KM: 'Comoros',
  CG: 'Congo',
  CD: 'Democratic Republic of the Congo',
  CI: "Côte d'Ivoire",
  DJ: 'Djibouti',
  EG: 'Egypt',
  GQ: 'Equatorial Guinea',
  ER: 'Eritrea',
  SZ: 'Eswatini',
  ET: 'Ethiopia',
  GA: 'Gabon',
  GM: 'Gambia',
  GH: 'Ghana',
  GN: 'Guinea',
  GW: 'Guinea-Bissau',
  KE: 'Kenya',
  LS: 'Lesotho',
  LR: 'Liberia',
  LY: 'Libya',
  MG: 'Madagascar',
  MW: 'Malawi',
  ML: 'Mali',
  MR: 'Mauritania',
  MU: 'Mauritius',
  MA: 'Morocco',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NE: 'Niger',
  NG: 'Nigeria',
  RW: 'Rwanda',
  ST: 'São Tomé and Príncipe',
  SN: 'Senegal',
  SC: 'Seychelles',
  SL: 'Sierra Leone',
  SO: 'Somalia',
  ZA: 'South Africa',
  SS: 'South Sudan',
  SD: 'Sudan',
  TZ: 'Tanzania',
  TG: 'Togo',
  TN: 'Tunisia',
  UG: 'Uganda',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
};

/** Regional Indicator Symbol Letter A */
const FLAG_A = 0x1f1e6;

/**
 * ISO 3166-1 alpha-2 → flag emoji (🇬🇭). Returns '' for invalid codes.
 */
export function countryFlagEmoji(countryCode?: string | null): string {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    FLAG_A + code.charCodeAt(0) - 65,
    FLAG_A + code.charCodeAt(1) - 65
  );
}

/**
 * Flag + country name for UI labels/selects, e.g. "🇬🇭 Ghana".
 * Pass `nameOverride` when the display name differs from COUNTRY_NAME.
 */
export function formatCountryLabel(
  countryCode?: string | null,
  nameOverride?: string | null
): string {
  const raw = String(countryCode || '').trim();
  if (!raw || raw === '—' || raw.toLowerCase() === 'any') {
    return nameOverride?.trim() || raw || '—';
  }
  const code = raw.toUpperCase();
  const flag = countryFlagEmoji(code);
  const name = (nameOverride || COUNTRY_NAME[code] || code).trim();
  if (!flag) return name;
  if (name.startsWith(flag)) return name;
  return `${flag} ${name}`;
}

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

/** Relative time for inbox / wallet activity (e.g. "2 min ago"). */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  if (Number.isNaN(diffMs)) return '';
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.round(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatLocalTime(d);
}
