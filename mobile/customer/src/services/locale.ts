/**
 * Auto-detect country → currency + language for the customer app.
 * Mirrors web `/public/detect` + stores on globalThis for screens.
 */
const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export type AppLocale = {
  countryCode: string;
  currencyCode: string;
  languageCode: string;
  languageLabel: string;
  city: string;
  dialCode: string;
  source?: string;
};

const DEFAULT: AppLocale = {
  countryCode: 'GH',
  currencyCode: 'GHS',
  languageCode: 'en',
  languageLabel: 'English',
  city: 'Accra',
  dialCode: '+233',
};

function readCache(): AppLocale {
  try {
    const g = (globalThis as any).__MOVR_LOCALE__;
    if (g?.countryCode) return g as AppLocale;
    const code =
      (globalThis as any).__MOVR_COUNTRY__ ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_country') : null);
    if (code) return { ...DEFAULT, countryCode: String(code).toUpperCase() };
  } catch {
    /* */
  }
  return { ...DEFAULT };
}

function writeCache(data: AppLocale) {
  (globalThis as any).__MOVR_LOCALE__ = data;
  (globalThis as any).__MOVR_COUNTRY__ = data.countryCode;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('movr_country', data.countryCode);
      localStorage.setItem('movr_locale', JSON.stringify(data));
    }
  } catch {
    /* */
  }
}

export function getAppLocale(): AppLocale {
  return readCache();
}

export function setAppCountry(countryCode: string, partial?: Partial<AppLocale>) {
  const next: AppLocale = {
    ...readCache(),
    ...partial,
    countryCode: (countryCode || 'GH').toUpperCase(),
  };
  if (partial?.currencyCode) next.currencyCode = partial.currencyCode.toUpperCase();
  writeCache(next);
  return next;
}

/** GPS → edge IP → timezone via backend `/public/detect`. */
export async function detectAppLocale(coords?: {
  latitude: number;
  longitude: number;
}): Promise<AppLocale> {
  const qs = new URLSearchParams();
  if (coords) {
    qs.set('lat', String(coords.latitude));
    qs.set('lng', String(coords.longitude));
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) qs.set('timezone', tz);
  } catch {
    /* */
  }

  const res = await fetch(`${API}/public/detect?${qs.toString()}`);
  const j = await res.json();
  if (!j?.data?.countryCode) return readCache();

  const next: AppLocale = {
    countryCode: String(j.data.countryCode).toUpperCase(),
    currencyCode: String(j.data.currencyCode || 'GHS').toUpperCase(),
    languageCode: j.data.languageCode || 'en',
    languageLabel: j.data.languageLabel || 'English',
    city: j.data.city || '',
    dialCode: j.data.dialCode || '+233',
    source: j.data.source,
  };
  writeCache(next);
  return next;
}

/** Boot helper — native GPS first, then IP/timezone detect. */
export function bootLocaleDetect(): void {
  (async () => {
    try {
      const { getCurrentGps } = require('../lib/location');
      const fix = await getCurrentGps();
      if (fix) {
        await detectAppLocale({ latitude: fix.latitude, longitude: fix.longitude });
        return;
      }
    } catch {
      /* */
    }
    detectAppLocale().catch(() => undefined);
  })();
}
