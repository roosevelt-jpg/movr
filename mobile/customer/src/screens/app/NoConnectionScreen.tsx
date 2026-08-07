import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Offline / no connection — matches mockup; Retry probes /health.
 */
export default function NoConnectionScreen({
  onRetry,
  visible = true,
}: {
  onRetry?: () => void;
  visible?: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [copy, setCopy] = useState({
    title: 'No connection',
    body: 'Check your internet connection and try again. You can still book by SMS or a call.',
    cta_label: 'Retry',
  });

  useEffect(() => {
    fetch(`${API}/public/status-copy/no_connection`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data?.title) setCopy(body.data);
      })
      .catch(() => undefined);
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const health = API.replace(/\/api\/v1\/?$/, '') + '/health';
      const res = await fetch(health, { method: 'GET' });
      if (res.ok) onRetry?.();
    } catch {
      /* still offline */
    } finally {
      setChecking(false);
    }
  }, [onRetry]);

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <View style={styles.arcOuter} />
        <View style={styles.arcMid} />
        <View style={styles.dot} />
        <View style={styles.slash} />
      </View>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      <Pressable style={styles.retry} onPress={check} disabled={checking}>
        <Text style={styles.retryText}>{checking ? 'Checking…' : copy.cta_label || 'Retry'}</Text>
      </Pressable>
    </View>
  );
}

const wifi = '#e8a0a0';

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    zIndex: 100,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(120, 40, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
    overflow: 'hidden',
  },
  arcOuter: {
    position: 'absolute',
    top: 22,
    width: 44,
    height: 22,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: wifi,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  arcMid: {
    position: 'absolute',
    top: 34,
    width: 28,
    height: 14,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: wifi,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  dot: {
    position: 'absolute',
    bottom: 28,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: wifi,
  },
  slash: {
    position: 'absolute',
    width: 2.5,
    height: 52,
    backgroundColor: wifi,
    transform: [{ rotate: '-45deg' }],
    borderRadius: 2,
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 12 },
  body: {
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[6],
    maxWidth: 300,
    fontSize: 15,
  },
  retry: {
    backgroundColor: '#2a2a2a',
    borderRadius: radius.pill,
    paddingHorizontal: 40,
    paddingVertical: 14,
    minWidth: 140,
    alignItems: 'center',
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
