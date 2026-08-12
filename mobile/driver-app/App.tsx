import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};
if (!(globalThis as any).__MOVR_API_URL__ && extra.apiUrl) {
  (globalThis as any).__MOVR_API_URL__ = extra.apiUrl;
  process.env.EXPO_PUBLIC_API_URL = extra.apiUrl;
}

let AppRoot: React.ComponentType;
try {
  AppRoot = require('@movr/driver').default;
} catch {
  AppRoot = require('../driver/src/App').default;
}

/** Expo host for Play Store package io.movr.driver */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppRoot />
    </SafeAreaProvider>
  );
}
