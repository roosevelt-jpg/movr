import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { ThemeProvider, useTheme } from './theme';
import NoConnectionScreen from './screens/app/NoConnectionScreen';
import { bootLocaleDetect } from './services/locale';
import RootNavigator from './RootNavigator';

/**
 * Customer app root — wrap every host (Expo / RN web) with ThemeProvider
 * so light/dark preference and useThemeColors() work across screens.
 * Shows NoConnection overlay when the device / API is unreachable.
 */
function ThemedChrome({ children }: { children: React.ReactNode }) {
  const { mode, colors } = useTheme();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    bootLocaleDetect();

    const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const health = API.replace(/\/api\/v1\/?$/, '') + '/health';

    const probe = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setOffline(true);
          return;
        }
        const res = await fetch(health, { method: 'GET' });
        setOffline(!res.ok);
      } catch {
        setOffline(true);
      }
    };

    probe();
    const id = setInterval(probe, 15000);

    const onOffline = () => setOffline(true);
    const onOnline = () => probe();
    if (typeof window !== 'undefined') {
      window.addEventListener?.('offline', onOffline);
      window.addEventListener?.('online', onOnline);
    }

    return () => {
      clearInterval(id);
      if (typeof window !== 'undefined') {
        window.removeEventListener?.('offline', onOffline);
        window.removeEventListener?.('online', onOnline);
      }
    };
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.jetBlack }]}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} />
      <View style={styles.fill}>{children ?? <RootNavigator />}</View>
      {offline ? (
        <NoConnectionScreen
          visible
          onRetry={() => {
            setOffline(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function App({ children }: { children?: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemedChrome>{children ?? null}</ThemedChrome>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
