import { useMemo } from 'react';
import { useLocaleStore } from '../store/locale.store';
import {
  currencyForCountry,
  formatCurrency,
  formatMoneyForCountry,
  formatCountryLabel,
} from '../lib/currency';

/**
 * Display currency from locale preference (synced from auto-detect / user country /
 * footer country picker).
 */
export function useLocalCurrency(overrideCurrency?: string | null) {
  const country = useLocaleStore((s) => s.country);
  const storeCurrency = useLocaleStore((s) => s.currency);
  const setCountry = useLocaleStore((s) => s.setCountry);
  const currency = (overrideCurrency || storeCurrency || currencyForCountry(country)).toUpperCase();

  return useMemo(
    () => ({
      country: (country || 'GH').toUpperCase(),
      countryName: formatCountryLabel(country),
      currency,
      setCountry: (code: string) => setCountry(code, { manual: true }),
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
