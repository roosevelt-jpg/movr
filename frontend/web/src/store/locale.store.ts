// frontend/web/src/store/locale.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { currencyForCountry } from '../lib/currency';
import { AFRICA_LOCALES } from '../lib/africaLocales';

export type LocaleState = {
  country: string;
  currency: string;
  language: string;
  languageLabel: string;
  dir: 'ltr' | 'rtl';
  city: string;
  dialCode: string;
  /** User or footer manually overrode auto-detect */
  manual: boolean;
  detected: boolean;
  source: string | null;
  setCountry: (code: string, opts?: { manual?: boolean }) => void;
  applyDetect: (data: {
    countryCode: string;
    currencyCode?: string;
    languageCode?: string;
    languageLabel?: string;
    dir?: 'ltr' | 'rtl';
    city?: string;
    dialCode?: string;
    source?: string;
  }) => void;
};

function langMeta(country: string) {
  const row = AFRICA_LOCALES.find((r) => r.country_code === country.toUpperCase());
  return {
    language: row?.language_code || 'en',
    languageLabel: row?.language_label || 'English',
    dir: (row?.language_code === 'ar' ? 'rtl' : 'ltr') as 'ltr' | 'rtl',
  };
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      country: 'GH',
      currency: 'GHS',
      language: 'en',
      languageLabel: 'English',
      dir: 'ltr',
      city: 'Accra',
      dialCode: '+233',
      manual: false,
      detected: false,
      source: null,

      setCountry: (code: string, opts) => {
        const country = (code || 'GH').toUpperCase();
        const lang = langMeta(country);
        const row = AFRICA_LOCALES.find((r) => r.country_code === country);
        set({
          country,
          currency: currencyForCountry(country),
          language: lang.language,
          languageLabel: lang.languageLabel,
          dir: lang.dir,
          dialCode: row?.dial_code || get().dialCode,
          city: row?.country_name || get().city,
          manual: opts?.manual !== false,
        });
        try {
          document.documentElement.lang = lang.language;
          document.documentElement.dir = lang.dir;
        } catch {
          /* ssr */
        }
      },

      applyDetect: (data) => {
        if (get().manual) return;
        const country = (data.countryCode || 'GH').toUpperCase();
        const lang = langMeta(country);
        set({
          country,
          currency: (data.currencyCode || currencyForCountry(country)).toUpperCase(),
          language: data.languageCode || lang.language,
          languageLabel: data.languageLabel || lang.languageLabel,
          dir: data.dir || lang.dir,
          city: data.city || get().city,
          dialCode: data.dialCode || get().dialCode,
          detected: true,
          source: data.source || 'detect',
          manual: false,
        });
        try {
          document.documentElement.lang = data.languageCode || lang.language;
          document.documentElement.dir = data.dir || lang.dir;
        } catch {
          /* */
        }
      },
    }),
    {
      name: 'movr_locale',
      partialize: (s) => ({
        country: s.country,
        currency: s.currency,
        language: s.language,
        languageLabel: s.languageLabel,
        dir: s.dir,
        city: s.city,
        dialCode: s.dialCode,
        manual: s.manual,
      }),
    }
  )
);
