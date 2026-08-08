import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { LocalizationService } from '../services/localization.service';

const db = new DatabaseService();
const localization = new LocalizationService(db);

export const publicLocalizeRouter = Router();

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
        return {
          code,
          name: c.name,
          flag,
          label: flag ? `${flag} ${c.name}` : c.name,
          currencyCode: c.currency_code,
          dialCode: c.dial_code,
          emergencyNumber: c.emergency_number,
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
    res.json({
      status: 'success',
      data: {
        countryCode: country?.code || 'GH',
        countryName: country?.name || 'Ghana',
        currencyCode: country?.currency_code || pricing.currency_code || 'GHS',
        dialCode: country?.dial_code || '+233',
        city: pricing.city,
        timezone: pricing.timezone,
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

publicLocalizeRouter.get('/city-pricing', async (req: Request, res: Response) => {
  try {
    const country = String(req.query.country || 'GH').toUpperCase();
    const lat = req.query.lat != null ? Number(req.query.lat) : undefined;
    const lng = req.query.lng != null ? Number(req.query.lng) : undefined;
    const pricing = await localization.getCityPricing(lat, lng, country);
    res.json({
      status: 'success',
      data: {
        city: pricing.city,
        countryCode: pricing.country_code,
        currencyCode: pricing.currency_code,
        timezone: pricing.timezone,
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
