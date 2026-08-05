import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocaleState {
  country: string;
  setCountry: (code: string) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      country: 'GH',
      setCountry: (code: string) => set({ country: (code || 'GH').toUpperCase() }),
    }),
    { name: 'movr_locale' }
  )
);
