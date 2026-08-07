import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

/** Compact sun/moon control for marketing header and chrome. */
export default function ThemeModeIcon({
  className = '',
  lightChrome = false,
}: {
  className?: string;
  /** When true, style for a light header bar */
  lightChrome?: boolean;
}) {
  const { mode, setPreference } = useTheme();
  const next = mode === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={mode === 'light' ? 'Dark mode' : 'Light mode'}
      className={
        className ||
        (lightChrome
          ? 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-black/70 hover:text-black hover:bg-black/5 transition-colors'
          : 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition-colors')
      }
    >
      {mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
