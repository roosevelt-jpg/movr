import winston from 'winston';
import { DatabaseService } from './database.service';

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
    if (fromCurrency === toCurrency) return amount;
    const direct = await this.db.query(
      `SELECT rate FROM fx_rates WHERE from_currency = $1 AND to_currency = $2`,
      [fromCurrency, toCurrency]
    );
    if (direct.rows[0]) return amount * Number(direct.rows[0].rate);

    const viaUsd = await this.db.query(
      `SELECT
         (SELECT rate FROM fx_rates WHERE from_currency = $1 AND to_currency = 'USD') AS to_usd,
         (SELECT rate FROM fx_rates WHERE from_currency = 'USD' AND to_currency = $2) AS from_usd`,
      [fromCurrency, toCurrency]
    );
    const toUsd = Number(viaUsd.rows[0]?.to_usd);
    const fromUsd = Number(viaUsd.rows[0]?.from_usd);
    if (toUsd && fromUsd) return amount * toUsd * fromUsd;
    return amount;
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
