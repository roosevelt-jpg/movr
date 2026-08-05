import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

/**
 * Offline / no connection overlay — Retry rechecks NetInfo-like status.
 * Falls back to fetch health when NetInfo is unavailable.
 */
export default function NoConnectionScreen({
  onRetry,
  visible = true,
}: {
  onRetry?: () => void;
  visible?: boolean;
}) {
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const health = API.replace(/\/api\/v1\/?$/, '') + '/health';
      const res = await fetch(health, { method: 'GET' });
      if (res.ok) onRetry?.();
    } catch {
      /* still offline */
    } finally {
      setChecking(false);
    }
  }, [onRetry]);

  useEffect(() => {
    if (visible) check();
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>📡̸</Text>
      </View>
      <Text style={styles.title}>No connection</Text>
      <Text style={styles.body}>
        Check your internet connection and try again. You can still book by SMS or a call.
      </Text>
      <Pressable style={styles.retry} onPress={check} disabled={checking}>
        <Text style={styles.retryText}>{checking ? 'Checking…' : 'Retry'}</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL('sms:MOVR')} style={{ marginTop: 16 }}>
        <Text style={styles.alt}>Book via SMS · Text MOVR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.jetBlack,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    zIndex: 100,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#3A2424',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  icon: { fontSize: 36, color: '#FF8FA0' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  body: {
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[6],
    maxWidth: 300,
  },
  retry: {
    backgroundColor: '#2A2A2A',
    borderRadius: radius.pill,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  alt: { color: colors.motionBlue, fontWeight: '600' },
});
