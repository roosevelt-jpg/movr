import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from './theme';

/**
 * Driver app root — wrap every host (Expo / RN web) with ThemeProvider
 * so light/dark preference and useThemeColors() work across screens.
 */
function ThemedChrome({ children }: { children: React.ReactNode }) {
  const { mode, colors } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.jetBlack }]}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} />
      {children}
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
});
