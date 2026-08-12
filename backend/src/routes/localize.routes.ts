import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { LocalizationService } from '../services/localization.service';
import { IntegrationsService } from '../services/integrations.service';

const db = new DatabaseService();
const localization = new LocalizationService(db);
const integrations = new IntegrationsService(db);

export const publicLocalizeRouter = Router();

/** Primary UI language by African market (business/default). */
const LANGUAGE_BY_COUNTRY: Record<string, { code: string; label: string; dir?: 'ltr' | 'rtl' }> = {
  DZ: { code: 'ar', label: 'Arabic', dir: 'rtl' },
  AO: { code: 'pt', label: 'Portuguese' },
  BJ: { code: 'fr', label: 'French' },
  BW: { code: 'en', label: 'English' },
  BF: { code: 'fr', label: 'French' },
  BI: { code: 'fr', label: 'French' },
  CV: { code: 'pt', label: 'Portuguese' },
  CM: { code: 'fr', label: 'French' },
  CF: { code: 'fr', label: 'French' },
  TD: { code: 'fr', label: 'French' },
  KM: { code: 'fr', label: 'French' },
  CG: { code: 'fr', label: 'French' },
  CD: { code: 'fr', label: 'French' },
  CI: { code: 'fr', label: 'French' },
  DJ: { code: 'fr', label: 'French' },
  EG: { code: 'ar', label: 'Arabic', dir: 'rtl' },
  GQ: { code: 'es', label: 'Spanish' },
  ER: { code: 'en', label: 'English' },
  SZ: { code: 'en', label: 'English' },
  ET: { code: 'en', label: 'English' },
  GA: { code: 'fr', label: 'French' },
  GM: { code: 'en', label: 'English' },
  GH: { code: 'en', label: 'English' },
  GN: { code: 'fr', label: 'French' },
  GW: { code: 'pt', label: 'Portuguese' },
  KE: { code: 'en', label: 'English' },
  LS: { code: 'en', label: 'English' },
  LR: { code: 'en', label: 'English' },
  LY: { code: 'ar', label: 'Arabic', dir: 'rtl' },
  MG: { code: 'fr', label: 'French' },
  MW: { code: 'en', label: 'English' },
  ML: { code: 'fr', label: 'French' },
  MR: { code: 'ar', label: 'Arabic', dir: 'rtl' },
  MU: { code: 'en', label: 'English' },
  MA: { code: 'ar', label: 'Arabic', dir: 'rtl' },
  MZ: { code: 'pt', label: 'Portuguese' },
  NA: { code: 'en', label: 'English' },
  NE: { code: 'fr', label: 'French' },
  NG: { code: 'en', label: 'English' },
  RW: { code: 'en', label: 'English' },
  ST: { code: 'pt', label: 'Portuguese' },
  SN: { code: 'fr', label: 'French' },
  SC: { code: 'en', label: 'English' },
  SL: { code: 'en', label: 'English' },
  SO: { code: 'en', label: 'English' },
  ZA: { code: 'en', label: 'English' },
  SS: { code: 'en', label: 'English' },
  SD: { code: 'ar', label: 'Arabic', dir: 'rtl' },
  TZ: { code: 'en', label: 'English' },
  TG: { code: 'fr', label: 'French' },
  TN: { code: 'ar', label: 'Arabic', dir: 'rtl' },
  UG: { code: 'en', label: 'English' },
  ZM: { code: 'en', label: 'English' },
  ZW: { code: 'en', label: 'English' },
};

const TZ_TO_COUNTRY: Record<string, string> = {
  'Africa/Accra': 'GH',
  'Africa/Lagos': 'NG',
  'Africa/Abidjan': 'CI',
  'Africa/Nairobi': 'KE',
  'Africa/Cairo': 'EG',
  'Africa/Johannesburg': 'ZA',
  'Africa/Casablanca': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Tripoli': 'LY',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kampala': 'UG',
  'Africa/Kigali': 'RW',
  'Africa/Maputo': 'MZ',
  'Africa/Harare': 'ZW',
  'Africa/Lusaka': 'ZM',
  'Africa/Windhoek': 'NA',
  'Africa/Gaborone': 'BW',
  'Africa/Dakar': 'SN',
  'Africa/Bamako': 'ML',
  'Africa/Ouagadougou': 'BF',
  'Africa/Lome': 'TG',
  'Africa/Porto-Novo': 'BJ',
  'Africa/Douala': 'CM',
  'Africa/Kinshasa': 'CD',
  'Africa/Brazzaville': 'CG',
  'Africa/Luanda': 'AO',
};

function langFor(code: string) {
  return LANGUAGE_BY_COUNTRY[code] || { code: 'en', label: 'English', dir: 'ltr' as const };
}

function clientIp(req: Request): string | null {
  const xf = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (xf) return xf;
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real;
  return req.socket?.remoteAddress || null;
}

function headerCountry(req: Request): string | null {
  const keys = [
    'cf-ipcountry',
    'x-vercel-ip-country',
    'cloudfront-viewer-country',
    'x-country-code',
    'x-geo-country',
  ];
  for (const k of keys) {
    const v = String(req.headers[k] || '')
      .trim()
      .toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1') return v;
  }
  return null;
}

async function countryFromLatLng(lat: number, lng: number): Promise<string | null> {
  try {
    const key = await integrations.resolveGoogleMapsKey();
    if (!key) return null;
    const axios = require('axios');
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { latlng: `${lat},${lng}`, key, result_type: 'country' },
      timeout: 8000,
    });
    const comps = res.data?.results?.[0]?.address_components || [];
    const country = comps.find((c: any) => (c.types || []).includes('country'));
    const code = String(country?.short_name || '').toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

async function countryFromIp(ip: string | null): Promise<string | null> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) return null;
  try {
    const axios = require('axios');
    // Lightweight free lookup — no API key required for low volume
    const res = await axios.get(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
      timeout: 4000,
      headers: { 'User-Agent': 'movr-localize/1.0' },
      validateStatus: (s: number) => s < 500,
    });
    const code = String(res.data || '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** Active African markets + local currency codes. */
publicLocalizeRouter.get('/countries', async (_req: Request, res: Response) => {
  try {
    const rows = await localization.listCountries();
    res.json({
      status: 'success',
      data: rows.map((c: any) => {
        const code = String(c.code || '').toUpperCase();
        const flag =
          /^[A-Z]{2}$/.test(code)
            ? String.fromCodePoint(
                0x1f1e6 + code.charCodeAt(0) - 65,
                0x1f1e6 + code.charCodeAt(1) - 65
              )
            : '';
        const lang = langFor(code);
        return {
          code,
          name: c.name,
          flag,
          label: flag ? `${flag} ${c.name}` : c.name,
          currencyCode: c.currency_code,
          dialCode: c.dial_code,
          emergencyNumber: c.emergency_number,
          languageCode: lang.code,
          languageLabel: lang.label,
          dir: lang.dir || 'ltr',
        };
      }),
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Resolve country + currency from phone / hint / IP-less defaults.
 * Used by web/mobile to show pricing in the user's local currency.
 */
publicLocalizeRouter.get('/resolve', async (req: Request, res: Response) => {
  try {
    const phone = String(req.query.phone || '');
    const countryHint = String(req.query.country || req.query.hint || '');
    const country = await localization.detectCountry({
      phoneNumber: phone || undefined,
      countryHint: countryHint || undefined,
    });
    const pricing = await localization.getCityPricing(
      undefined,
      undefined,
      country?.code || 'GH'
    );
    const code = String(country?.code || 'GH').toUpperCase();
    const lang = langFor(code);
    res.json({
      status: 'success',
      data: {
        countryCode: code,
        countryName: country?.name || 'Ghana',
        currencyCode: country?.currency_code || pricing.currency_code || 'GHS',
        dialCode: country?.dial_code || '+233',
        city: pricing.city,
        timezone: pricing.timezone,
        languageCode: lang.code,
        languageLabel: lang.label,
        dir: lang.dir || 'ltr',
        samplePricing: {
          baseFare: Number(pricing.base_fare),
          perKm: Number(pricing.per_km_rate),
          perMin: Number(pricing.per_min_rate),
          currencyCode: pricing.currency_code,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Auto-detect visitor market from GPS → edge IP country → IP lookup → timezone → default.
 * Powers homepage booking currency + language.
 */
publicLocalizeRouter.get('/detect', async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat != null ? Number(req.query.lat) : NaN;
    const lng = req.query.lng != null ? Number(req.query.lng) : NaN;
    const tz = String(req.query.timezone || '').trim();
    const acceptLang = String(req.headers['accept-language'] || '')
      .split(',')[0]
      ?.trim()
      .slice(0, 2)
      .toLowerCase();

    let source = 'default';
    let code: string | null = null;

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      code = await countryFromLatLng(lat, lng);
      if (code) source = 'gps';
    }

    if (!code) {
      code = headerCountry(req);
      if (code) source = 'edge_header';
    }

    if (!code) {
      code = await countryFromIp(clientIp(req));
      if (code) source = 'ip';
    }

    if (!code && tz && TZ_TO_COUNTRY[tz]) {
      code = TZ_TO_COUNTRY[tz];
      source = 'timezone';
    }

    if (!code) code = 'GH';

    // Prefer African markets; if detected outside Africa keep code if we have pricing, else GH
    const country = await localization.detectCountry({ countryHint: code });
    const finalCode = String(country?.code || code || 'GH').toUpperCase();
    const pricing = await localization.getCityPricing(
      Number.isFinite(lat) ? lat : undefined,
      Number.isFinite(lng) ? lng : undefined,
      finalCode
    );
    let lang = langFor(finalCode);
    // Soft nudge from Accept-Language when it matches a supported family
    if (['fr', 'pt', 'ar', 'es', 'en'].includes(acceptLang)) {
      const countryLang = lang.code;
      // Prefer browser language when it matches market family, or when GPS/IP was weak
      if (acceptLang === countryLang || source === 'default' || source === 'timezone') {
        lang = {
          code: acceptLang,
          label:
            acceptLang === 'fr'
              ? 'French'
              : acceptLang === 'pt'
                ? 'Portuguese'
                : acceptLang === 'ar'
                  ? 'Arabic'
                  : acceptLang === 'es'
                    ? 'Spanish'
                    : 'English',
          dir: acceptLang === 'ar' ? 'rtl' : 'ltr',
        };
      }
    }

    res.json({
      status: 'success',
      data: {
        countryCode: finalCode,
        countryName: country?.name || finalCode,
        currencyCode: country?.currency_code || pricing.currency_code || 'GHS',
        dialCode: country?.dial_code || '+233',
        city: pricing.city,
        timezone: pricing.timezone || tz || 'Africa/Accra',
        languageCode: lang.code,
        languageLabel: lang.label,
        dir: lang.dir || 'ltr',
        source,
        detectedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

publicLocalizeRouter.get('/city-pricing', async (req: Request, res: Response) => {
  try {
    const country = String(req.query.country || 'GH').toUpperCase();
    const lat = req.query.lat != null ? Number(req.query.lat) : undefined;
    const lng = req.query.lng != null ? Number(req.query.lng) : undefined;
    const pricing = await localization.getCityPricing(lat, lng, country);
    const lang = langFor(country);
    res.json({
      status: 'success',
      data: {
        city: pricing.city,
        countryCode: pricing.country_code,
        currencyCode: pricing.currency_code,
        timezone: pricing.timezone,
        languageCode: lang.code,
        languageLabel: lang.label,
        dir: lang.dir || 'ltr',
        baseFare: Number(pricing.base_fare),
        perKmRate: Number(pricing.per_km_rate),
        perMinRate: Number(pricing.per_min_rate),
        formatted: {
          baseFare: localization.formatCurrency(Number(pricing.base_fare), pricing.currency_code),
          perKm: localization.formatCurrency(Number(pricing.per_km_rate), pricing.currency_code),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
