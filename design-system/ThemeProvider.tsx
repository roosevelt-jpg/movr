import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, StatusBar } from 'react-native';
import {
  colorsForMode,
  darkColors,
  resolveThemeMode,
  THEME_STORAGE_KEY,
  type ThemeColors,
  type ThemeMode,
  type ThemePreference,
} from './theme';

type ThemeContextValue = {
  preference: ThemePreference;
  mode: ThemeMode;
  colors: ThemeColors;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  mode: 'dark',
  colors: darkColors,
  setPreference: () => undefined,
});

async function readPreference(): Promise<ThemePreference> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(THEME_STORAGE_KEY);
        if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
      }
    } catch {
      /* ignore */
    }
  }
  return 'system';
}

async function writePreference(preference: ThemePreference) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
    return;
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, preference);
      }
    } catch {
      /* ignore */
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(
    () => Appearance.getColorScheme() !== 'light'
  );

  useEffect(() => {
    readPreference().then(setPreferenceState);
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemDark(colorScheme !== 'light');
    });
    return () => sub.remove();
  }, []);

  const mode = resolveThemeMode(preference, systemDark);
  const colors = colorsForMode(mode);

  useEffect(() => {
    StatusBar.setBarStyle(mode === 'light' ? 'dark-content' : 'light-content', true);
  }, [mode]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void writePreference(next);
  }, []);

  const value = useMemo(
    () => ({ preference, mode, colors, setPreference }),
    [preference, mode, colors, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}
