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

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, mode, setPreference } = useTheme();
  const label =
    preference === 'system' ? `System (${mode})` : preference === 'light' ? 'Light' : 'Dark';

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <p className="text-sm text-text-secondary">Appearance · {label}</p>
      <div className="flex gap-2 flex-wrap">
        {(['system', 'light', 'dark'] as ThemePreference[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreference(p)}
            aria-pressed={preference === p}
            className={`rounded-pill px-4 py-2 text-sm font-semibold border transition-colors ${
              preference === p
                ? 'border-motion-blue bg-motion-blue/15 text-text-primary'
                : 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            {p === 'system' ? 'Auto' : p === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>
    </div>
  );
}
