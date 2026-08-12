import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

// Point customer screens at production API when not overridden
const extra = Constants.expoConfig?.extra || {};
if (!(globalThis as any).__MOVR_API_URL__ && extra.apiUrl) {
  (globalThis as any).__MOVR_API_URL__ = extra.apiUrl;
  process.env.EXPO_PUBLIC_API_URL = extra.apiUrl;
}

let AppRoot: React.ComponentType;
try {
  AppRoot = require('@movr/customer').default;
} catch {
  AppRoot = require('../customer/src/App').default;
}

/** Expo host for Play Store package io.movr.app */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppRoot />
    </SafeAreaProvider>
  );
}
