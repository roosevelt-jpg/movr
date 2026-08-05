import tokens from './tokens.json';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

export type ThemeColors = typeof tokens.colors;

export const darkColors: ThemeColors = tokens.colors;
export const lightColors: ThemeColors = (tokens as any).colorsLight as ThemeColors;

/** Default export stays dark for backwards-compatible static imports. */
export const colors = darkColors;
export const gradient = tokens.gradient;
export const spacing = tokens.spacing;
export const radius = tokens.radius;
export const elevation = tokens.elevation;
export const typography = tokens.typography;
export const adminDensity = (tokens as any).adminDensity;
export const marketing = (tokens as any).marketing;

export const THEME_STORAGE_KEY = 'movr-theme';

export function colorsForMode(mode: ThemeMode): ThemeColors {
  return mode === 'light' ? lightColors : darkColors;
}

export function resolveThemeMode(
  preference: ThemePreference,
  systemDark = true
): ThemeMode {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

export function readStoredThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyDocumentTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.style.colorScheme = mode;
}

export function persistThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }
}

export function bootstrapDocumentTheme(): ThemeMode {
  const preference = readStoredThemePreference();
  const mode = resolveThemeMode(preference, systemPrefersDark());
  applyDocumentTheme(mode);
  return mode;
}

/** Inline script for index.html <head> — avoids FOUC before React. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='movr-theme';var p=localStorage.getItem(k)||'system';var dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var m=p==='light'||p==='dark'?p:(dark?'dark':'light');document.documentElement.setAttribute('data-theme',m);document.documentElement.style.colorScheme=m;}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export const theme = {
  colors,
  darkColors,
  lightColors,
  gradient,
  spacing,
  radius,
  elevation,
  typography,
  adminDensity,
  marketing,
} as const;

export type MovrTheme = typeof theme;

export default theme;
