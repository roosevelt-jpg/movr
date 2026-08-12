import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const FALLBACK_FEATURES = [
  { id: 'history', label: 'View recent trip history', icon: '📋' },
  { id: 'wallet', label: 'View wallet balance', icon: '💳' },
  { id: 'sos', label: 'Access SOS contacts', icon: '🆘' },
];

/**
 * Offline / no connection — Available Offline list, Retry, Settings (mockup).
 */
export default function NoConnectionScreen({
  onRetry,
  onOpenHistory,
  onOpenWallet,
  onOpenSos,
  visible = true,
}: {
  onRetry?: () => void;
  onOpenHistory?: () => void;
  onOpenWallet?: () => void;
  onOpenSos?: () => void;
  visible?: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [copy, setCopy] = useState({
    title: 'No connection',
    body: 'Please check your internet connection and try again. Your data is safe.',
    cta_label: 'Retry Connection',
    secondaryCta: 'Go to Settings',
  });
  const [features, setFeatures] = useState(FALLBACK_FEATURES);

  useEffect(() => {
    fetch(`${API}/public/status-copy/no_connection`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data?.title) {
          setCopy((c) => ({
            ...c,
            ...body.data,
            secondaryCta: body.data.meta?.secondaryCta || body.data.secondaryCta || c.secondaryCta,
          }));
          const list = body.data.meta?.offlineFeatures;
          if (Array.isArray(list) && list.length) {
            setFeatures(
              list.map((f: any) => ({
                id: f.id,
                label: f.label,
                icon: f.icon === 'wallet' ? '💳' : f.icon === 'sos' ? '🆘' : '📋',
              }))
            );
          }
        }
      })
      .catch(() => undefined);

    fetch(`${API}/public/offline-capabilities`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data) && j.data.length) {
          setFeatures(
            j.data.map((f: any) => ({
              id: f.id,
              label: f.label,
              icon: f.icon_key === 'wallet' ? '💳' : f.icon_key === 'sos' ? '🆘' : '📋',
            }))
          );
        }
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

  const openSettings = () => {
    const url =
      Platform.OS === 'ios'
        ? 'App-Prefs:root=WIFI'
        : 'https://support.google.com/android/answer/9089666';
    Linking.openURL(url).catch(() =>
      Linking.openURL('https://mymovr.io/help').catch(() => undefined)
    );
  };

  const onFeature = (id: string) => {
    if (id === 'history') onOpenHistory?.();
    if (id === 'wallet') onOpenWallet?.();
    if (id === 'sos') onOpenSos?.();
  };

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Text style={styles.dish}>📡</Text>
        <View style={styles.xBadge}>
          <Text style={styles.xTxt}>✕</Text>
        </View>
      </View>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      <View style={styles.card}>
        <Text style={styles.section}>AVAILABLE OFFLINE</Text>
        {features.map((f) => (
          <Pressable key={f.id} style={styles.row} onPress={() => onFeature(f.id)}>
            <Text style={styles.rowIcon}>{f.icon}</Text>
            <Text style={styles.rowLab}>{f.label}</Text>
            <Text style={styles.check}>✓</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.retry} onPress={check} disabled={checking}>
        <Text style={styles.retryText}>
          {checking ? 'Checking…' : copy.cta_label || 'Retry Connection'}
        </Text>
      </Pressable>
      <Pressable style={styles.settings} onPress={openSettings}>
        <Text style={styles.settingsText}>{copy.secondaryCta || 'Go to Settings'}</Text>
      </Pressable>
    </View>
  );
}

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
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  dish: { fontSize: 40 },
  xBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xTxt: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  body: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: spacing[5],
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  card: {
    width: '100%',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: spacing[5],
  },
  section: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowIcon: { fontSize: 18 },
  rowLab: { color: '#E4E4E7', fontWeight: '600', flex: 1 },
  check: { color: '#22C55E', fontWeight: '800' },
  retry: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  retryText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  settings: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3F3F46',
    paddingVertical: 16,
    alignItems: 'center',
  },
  settingsText: { color: '#A1A1AA', fontWeight: '700', fontSize: 15 },
});
