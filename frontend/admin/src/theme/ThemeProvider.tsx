import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  applyDocumentTheme,
  colorsForMode,
  persistThemePreference,
  readStoredThemePreference,
  resolveThemeMode,
  systemPrefersDark,
  type ThemeColors,
  type ThemeMode,
  type ThemePreference,
} from '@movr/design-system/theme';

type ThemeContextValue = {
  preference: ThemePreference;
  mode: ThemeMode;
  colors: ThemeColors;
  setPreference: (preference: ThemePreference) => void;
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const CYCLE: ThemePreference[] = ['system', 'light', 'dark'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window !== 'undefined' ? readStoredThemePreference() : 'system'
  );
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' ? systemPrefersDark() : true
  );

  const mode = resolveThemeMode(preference, systemDark);

  useEffect(() => {
    applyDocumentTheme(mode);
  }, [mode]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    persistThemePreference(next);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((prev) => {
      const i = CYCLE.indexOf(prev);
      const next = CYCLE[(i + 1) % CYCLE.length];
      persistThemePreference(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      mode,
      colors: colorsForMode(mode),
      setPreference,
      cyclePreference,
    }),
    [preference, mode, setPreference, cyclePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
