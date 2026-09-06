import winston from 'winston';
import { DatabaseService } from './database.service';
import { FLUTTERWAVE_CURRENCIES } from './payment-provider.interface';

const FLW_SET = new Set<string>(FLUTTERWAVE_CURRENCIES as readonly string[]);

/** West African CFA franc zone */
const XOF_COUNTRIES = new Set([
  'BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG',
]);
/** Central African CFA franc zone */
const XAF_COUNTRIES = new Set([
  'CM', 'CF', 'TD', 'CG', 'GQ', 'GA',
]);
/** Southern markets that commonly settle in ZAR when native currency isn't on Flutterwave */
const ZAR_SETTLE = new Set([
  'BW', 'NA', 'SZ', 'LS', 'ZM', 'MW', 'MZ', 'AO', 'ZW',
]);

export class LocalizationService {
  private logger = winston.createLogger({
    defaultMeta: { service: 'localization' },
    transports: [new winston.transports.Console()],
  });

  constructor(private db: DatabaseService) {}

  async detectCountry(input: { phoneNumber?: string; countryHint?: string }) {
    if (input.countryHint) {
      const byCode = await this.db.query(`SELECT * FROM countries WHERE code = $1 AND is_active = TRUE`, [
        input.countryHint.toUpperCase(),
      ]);
      if (byCode.rows[0]) return byCode.rows[0];
    }

    const phone = (input.phoneNumber || '').replace(/\s+/g, '');
    const countries = await this.db.query(
      `SELECT * FROM countries WHERE is_active = TRUE ORDER BY LENGTH(dial_code) DESC`
    );
    for (const c of countries.rows) {
      const dial = c.dial_code.replace('+', '');
      if (phone.startsWith(`+${dial}`) || phone.startsWith(dial) || phone.startsWith(`00${dial}`)) {
        return c;
      }
    }

    const fallback = await this.db.query(`SELECT * FROM countries WHERE code = 'GH'`);
    return fallback.rows[0];
  }

  validateOtp(otp: string, country: { otp_format_regex?: string }) {
    const re = new RegExp(country.otp_format_regex || '^[0-9]{4,8}$');
    return re.test(otp);
  }

  async getCityPricing(lat?: number, lng?: number, countryCode = 'GH') {
    if (lat != null && lng != null) {
      try {
        const nearest = await this.db.query(
          `SELECT *,
             ST_Distance(
               ST_MakePoint(lng, lat)::geography,
               ST_MakePoint($1, $2)::geography
             ) AS distance_m
           FROM city_pricing
           WHERE country_code = $3 AND lat IS NOT NULL AND lng IS NOT NULL
           ORDER BY distance_m ASC
           LIMIT 1`,
          [lng, lat, countryCode]
        );
        if (nearest.rows[0]) return nearest.rows[0];
      } catch {
        this.logger.warn('PostGIS city pricing lookup failed; using country default');
      }
    }

    const row = await this.db.query(
      `SELECT * FROM city_pricing WHERE country_code = $1 ORDER BY city LIMIT 1`,
      [countryCode]
    );
    return (
      row.rows[0] || {
        city: 'Accra',
        country_code: 'GH',
        base_fare: 2.5,
        per_km_rate: 1.5,
        per_min_rate: 0.25,
        currency_code: 'GHS',
        timezone: 'Africa/Accra',
      }
    );
  }

  async convert(amount: number, fromCurrency: string, toCurrency: string) {
    const from = String(fromCurrency || '').toUpperCase();
    const to = String(toCurrency || '').toUpperCase();
    if (!from || !to || from === to) return Number(amount) || 0;
    const direct = await this.db.query(
      `SELECT rate FROM fx_rates WHERE from_currency = $1 AND to_currency = $2`,
      [from, to]
    );
    if (direct.rows[0]) return Number(amount) * Number(direct.rows[0].rate);

    const viaUsd = await this.db.query(
      `SELECT
         (SELECT rate FROM fx_rates WHERE from_currency = $1 AND to_currency = 'USD') AS to_usd,
         (SELECT rate FROM fx_rates WHERE from_currency = 'USD' AND to_currency = $2) AS from_usd`,
      [from, to]
    );
    const toUsd = Number(viaUsd.rows[0]?.to_usd);
    const fromUsd = Number(viaUsd.rows[0]?.from_usd);
    if (toUsd && fromUsd) return Number(amount) * toUsd * fromUsd;
    return Number(amount) || 0;
  }

  async refreshFxRates() {
    // Placeholder: plug a real FX API; keep table fresh for convert()
    await this.db.query(`UPDATE fx_rates SET fetched_at = NOW()`);
    this.logger.info('FX rates refresh touched');
  }

  async listCountries() {
    const rows = await this.db.query(
      `SELECT code, name, currency_code, dial_code, emergency_number
       FROM countries WHERE is_active = TRUE ORDER BY name`
    );
    return rows.rows;
  }

  async currencyForCountry(countryCode = 'GH') {
    const row = await this.db.query(
      `SELECT currency_code FROM countries WHERE code = $1 AND is_active = TRUE`,
      [countryCode.toUpperCase()]
    );
    return row.rows[0]?.currency_code || 'GHS';
  }

  /**
   * Map any African market currency → a currency Flutterwave can charge.
   * Google Location detects the country; this picks the charge currency.
   */
  toFlutterwaveCurrency(currency: string, countryCode?: string): string {
    const cur = String(currency || '').toUpperCase();
    const cc = String(countryCode || '').toUpperCase();
    if (FLW_SET.has(cur)) return cur;
    if (XOF_COUNTRIES.has(cc) || cur === 'XOF') return 'XOF';
    if (XAF_COUNTRIES.has(cc) || cur === 'XAF') return 'XAF';
    if (ZAR_SETTLE.has(cc) || ['BWP', 'NAD', 'SZL', 'LSL', 'ZMW', 'MWK', 'MZN', 'AOA'].includes(cur)) {
      return 'ZAR';
    }
    if (['MAD', 'DZD', 'TND', 'LYD', 'MRU'].includes(cur) || ['MA', 'DZ', 'TN', 'LY', 'MR'].includes(cc)) {
      return FLW_SET.has('MAD') && (cur === 'MAD' || cc === 'MA') ? 'MAD' : 'USD';
    }
    if (cur === 'EGP' || cc === 'EG') return 'EGP';
    return 'USD';
  }

  /**
   * Convert a catalog/plan amount into the user's local display + Flutterwave charge currencies.
   * Detection path: Google geocode / IP / phone → country → currency.
   */
  async localizeMoney(
    amount: number,
    fromCurrency: string,
    countryCode = 'GH'
  ): Promise<{
    countryCode: string;
    fromCurrency: string;
    displayCurrency: string;
    displayAmount: number;
    chargeCurrency: string;
    chargeAmount: number;
  }> {
    const cc = String(countryCode || 'GH').toUpperCase();
    const from = String(fromCurrency || 'GHS').toUpperCase();
    const displayCurrency = await this.currencyForCountry(cc);
    const chargeCurrency = this.toFlutterwaveCurrency(displayCurrency, cc);
    const rawDisplay = await this.convert(amount, from, displayCurrency);
    const rawCharge =
      chargeCurrency === displayCurrency
        ? rawDisplay
        : await this.convert(amount, from, chargeCurrency);
    const round = (n: number, cur: string) => {
      const digits = ['UGX', 'TZS', 'RWF', 'XOF', 'XAF', 'GNF', 'MGA'].includes(cur) ? 0 : 2;
      const f = 10 ** digits;
      return Math.round((Number(n) || 0) * f) / f;
    };
    return {
      countryCode: cc,
      fromCurrency: from,
      displayCurrency,
      displayAmount: round(rawDisplay, displayCurrency),
      chargeCurrency,
      chargeAmount: round(rawCharge, chargeCurrency),
    };
  }

  /** African-friendly symbols (Intl often mis-renders GHS / XOF / KES). */
  formatCurrency(amount: number, currencyCode: string) {
    const code = (currencyCode || 'GHS').toUpperCase();
    const n = Number(amount) || 0;
    const symbols: Record<string, string> = {
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
      AOA: 'Kz',
      MZN: 'MT',
      ZMW: 'ZK',
      BWP: 'P',
      NAD: 'N$',
      USD: '$',
    };
    const zeroDecimal = ['XOF', 'XAF', 'UGX', 'RWF', 'GNF'].includes(code);
    const digits = zeroDecimal ? 0 : 2;
    const formatted = n.toLocaleString('en-GB', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    const symbol = symbols[code];
    if (symbol) {
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

  formatLocalTime(iso: string | Date, timezone = 'Africa/Accra') {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  }
}
