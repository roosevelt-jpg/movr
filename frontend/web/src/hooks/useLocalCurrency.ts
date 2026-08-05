import { useMemo } from 'react';
import { useLocaleStore } from '../store/locale.store';
import {
  currencyForCountry,
  formatCurrency,
  formatMoneyForCountry,
  COUNTRY_NAME,
} from '../lib/currency';

/**
 * Display currency from locale preference (synced from user country on login,
 * or chosen in the footer country picker).
 */
export function useLocalCurrency(overrideCurrency?: string | null) {
  const country = useLocaleStore((s) => s.country);
  const setCountry = useLocaleStore((s) => s.setCountry);
  const currency = (overrideCurrency || currencyForCountry(country)).toUpperCase();

  return useMemo(
    () => ({
      country: (country || 'GH').toUpperCase(),
      countryName: COUNTRY_NAME[country] || country,
      currency,
      setCountry,
      formatMoney: (amount: number) =>
        overrideCurrency
          ? formatCurrency(amount, overrideCurrency)
          : formatMoneyForCountry(amount, country),
      format: (amount: number, code?: string) => formatCurrency(amount, code || currency),
    }),
    [country, currency, overrideCurrency, setCountry]
  );
}

export function getStoredCountry(): string {
  return useLocaleStore.getState().country || 'GH';
}

export function setStoredCountry(code: string) {
  useLocaleStore.getState().setCountry(code);
}
