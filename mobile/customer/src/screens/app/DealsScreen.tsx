import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TABS = ['all', 'rides', 'food', 'tokens'] as const;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ICONS: Record<string, string> = {
  cart: '🛒',
  dvt: '⛓',
  car: '🚗',
  ride: '🚗',
  promo: '🏷',
};

/** Deals & Promos — exclusive offers feed (mockup). */
export default function DealsScreen({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [deals, setDeals] = useState<any[]>([]);

  useEffect(() => {
    const q = tab === 'all' ? '' : `?category=${tab}`;
    fetch(`${API}/me/deals${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setDeals(j.data || []))
      .catch(() => undefined);
  }, [tab]);

  const copy = (code: string) => {
    Alert.alert('Promo code', `${code} copied`);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : null}
        <View>
          <Text style={styles.sub}>Exclusive deals for Movr users</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.chip, tab === t && styles.chipOn]}
          >
            <Text style={styles.chipText}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.divider} />

      {deals.map((d) => {
        if (d.featured) {
          return (
            <Pressable key={d.id} style={styles.featured} onPress={() => copy(d.code)}>
              <Text style={styles.limited}>LIMITED TIME</Text>
              <Text style={styles.off}>{d.title}</Text>
              <Text style={styles.featDesc}>{d.description}</Text>
              <View style={styles.codeBox}>
                <Text style={styles.code}>{d.code}</Text>
              </View>
              <Text style={styles.exp}>{d.expiresLabel || 'Expires soon'}</Text>
            </Pressable>
          );
        }

        const used = d.status === 'used';
        return (
          <View key={d.id} style={[styles.card, used && styles.cardUsed]}>
            <View style={[styles.iconBox, used && { backgroundColor: '#3F3F46' }]}>
              <Text>{ICONS[d.icon] || '🏷'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, used && { opacity: 0.7 }]}>{d.title}</Text>
              <Text style={styles.cardDesc}>{d.description}</Text>
              {d.code && d.status !== 'used' && d.status !== 'active' ? (
                <Pressable style={styles.miniCode} onPress={() => copy(d.code)}>
                  <Text style={styles.miniCodeText}>{d.code}</Text>
                </Pressable>
              ) : null}
              {d.autoApplied || d.status === 'active' ? (
                <Text style={styles.auto}>Auto-applied · This weekend</Text>
              ) : null}
              {d.expiresLabel && !d.autoApplied ? (
                <Text style={styles.cardExp}>{d.expiresLabel}</Text>
              ) : null}
            </View>
            {d.status === 'active' ? (
              <View style={styles.activePill}>
                <Text style={styles.activeText}>Active</Text>
              </View>
            ) : null}
            {used ? (
              <View style={styles.usedPill}>
                <Text style={styles.usedText}>Used</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: spacing[4] },
  back: { color: '#FFF', fontSize: 22 },
  sub: { color: '#A1A1AA', fontSize: 13 },
  tabs: { marginTop: spacing[3], maxHeight: 44 },
  chip: {
    backgroundColor: '#18181B',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#8E2DE2' },
  chipText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#27272A', marginVertical: spacing[3] },
  featured: {
    borderRadius: 20,
    padding: spacing[4],
    marginBottom: spacing[3],
    backgroundColor: '#4F46E5',
  },
  limited: { color: '#E0E7FF', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  off: { color: '#FFF', fontSize: 36, fontWeight: '900', marginTop: 8 },
  featDesc: { color: '#FFF', fontSize: 16, marginTop: 4 },
  codeBox: {
    marginTop: spacing[4],
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF22',
  },
  code: { color: '#FFF', fontWeight: '800', letterSpacing: 1 },
  exp: { color: '#C7D2FE', alignSelf: 'flex-end', marginTop: 8, fontSize: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: spacing[3],
    marginBottom: 10,
    gap: 12,
    alignItems: 'flex-start',
  },
  cardUsed: { backgroundColor: '#27272A', opacity: 0.85 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#14532D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  cardDesc: { color: '#71717A', fontSize: 12, marginTop: 4 },
  miniCode: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#8E2DE2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  miniCodeText: { color: '#A78BFA', fontWeight: '800', fontSize: 12 },
  auto: { color: '#A78BFA', fontSize: 12, marginTop: 8, fontWeight: '600' },
  cardExp: { color: '#71717A', fontSize: 11, marginTop: 6 },
  activePill: {
    backgroundColor: '#5B21B6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  usedPill: {
    backgroundColor: '#3F3F46',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  usedText: { color: '#A1A1AA', fontWeight: '700', fontSize: 12 },
});
