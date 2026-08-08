import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TABS = ['all', 'rides', 'parcels', 'orders'] as const;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function relWhen(iso: string, meta?: any) {
  if (meta?.duration) {
    const d = new Date(iso);
    const month = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${month} · ${meta.duration}`;
  }
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startToday.getTime() - startThat.getTime()) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

const ICONS: Record<string, { bg: string; glyph: string }> = {
  ride: { bg: '#3B0764', glyph: '🚗' },
  parcel: { bg: '#14532D', glyph: '📦' },
  rental: { bg: '#7C2D12', glyph: '🚙' },
  order: { bg: '#1E3A5F', glyph: '🍔' },
};

/** My Trips — filters + empty state (mockup). */
export default function TripHistoryScreen({
  onOpen,
  onReceipt,
  onRebook,
  onRate,
  onBookRide,
  onBrowseStores,
  onDeliver,
  onBack,
  forceEmpty,
}: {
  onOpen?: (item: any) => void;
  onReceipt?: (id: string) => void;
  onRebook?: (id: string) => void;
  onRate?: (id: string) => void;
  onBookRide?: () => void;
  onBrowseStores?: () => void;
  onDeliver?: () => void;
  onBack?: () => void;
  forceEmpty?: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (forceEmpty) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = tab === 'all' ? '' : `?type=${tab}`;
    fetch(`${API}/activity/history${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setItems(j.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tab, forceEmpty]);

  const empty = !loading && items.length === 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.heading}>My Trips</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.chip, tab === t && styles.chipOn]}
          >
            <Text style={[styles.chipText, tab === t && styles.chipTextOn]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {empty ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyCircle}>
            <Text style={styles.emptyCar}>🚗</Text>
            <View style={styles.magnifier}>
              <Text style={{ fontSize: 14 }}>🔍</Text>
            </View>
          </View>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySub}>
            Your rides, parcels, orders and rentals will all appear here.
          </Text>
          <Pressable style={styles.primary} onPress={onBookRide}>
            <Text style={styles.primaryTxt}>Book Your First Ride</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onBrowseStores}>
            <Text style={styles.secondaryTxt}>Browse Stores</Text>
          </Pressable>

          <Text style={styles.tryLab}>TRY THESE</Text>
          <View style={styles.tryRow}>
            {[
              { id: 'ride', label: 'Ride', icon: '🚗', onPress: onBookRide },
              { id: 'shop', label: 'shop', icon: '🛍', onPress: onBrowseStores },
              { id: 'deliver', label: 'Deliver', icon: '📦', onPress: onDeliver },
            ].map((t) => (
              <Pressable key={t.id} style={styles.tryCard} onPress={t.onPress}>
                <Text style={styles.tryIcon}>{t.icon}</Text>
                <Text style={styles.tryLabel}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ paddingBottom: spacing[10], paddingHorizontal: spacing[4] }}
          ListEmptyComponent={
            <Text style={styles.loading}>{loading ? 'Loading…' : 'No trips yet'}</Text>
          }
          renderItem={({ item }) => {
            const icon = ICONS[item.type] || ICONS.ride;
            const showLoc = item.pickup || item.dropoff;
            const actions = item.actions || [];
            return (
              <Pressable style={styles.card} onPress={() => onOpen?.(item)}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
                    <Text style={{ fontSize: 18 }}>{icon.glyph}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.when}>{relWhen(item.occurredAt, item.metadata)}</Text>
                  </View>
                  <Text style={styles.dvt}>+{Number(item.dvtEarned || 0)} DVT</Text>
                </View>

                {showLoc ? (
                  <View style={styles.locBox}>
                    {item.pickup ? (
                      <View style={styles.locRow}>
                        <View style={[styles.dot, { backgroundColor: '#A78BFA' }]} />
                        <Text style={styles.locText}>{item.pickup}</Text>
                      </View>
                    ) : null}
                    {item.pickup && item.dropoff ? <View style={styles.locLine} /> : null}
                    {item.dropoff ? (
                      <View style={styles.locRow}>
                        <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                        <Text style={styles.locText}>{item.dropoff}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : item.title ? (
                  <Text style={styles.titleOnly}>{item.title}</Text>
                ) : null}

                {actions.length > 0 ? (
                  <View style={styles.actions}>
                    {actions.includes('receipt') ? (
                      <Pressable style={styles.actionBtn} onPress={() => onReceipt?.(item.id)}>
                        <Text style={styles.actionText}>📄 Receipt</Text>
                      </Pressable>
                    ) : null}
                    {actions.includes('rebook') ? (
                      <Pressable style={styles.actionBtn} onPress={() => onRebook?.(item.id)}>
                        <Text style={styles.actionText}>↻ Rebook</Text>
                      </Pressable>
                    ) : null}
                    {actions.includes('rate') ? (
                      <Pressable style={styles.actionBtn} onPress={() => onRate?.(item.id)}>
                        <Text style={styles.actionText}>⭐ Rate</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  back: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  heading: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  tabs: { paddingHorizontal: spacing[4], marginVertical: spacing[3], maxHeight: 44 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#18181B',
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#8E2DE2' },
  chipText: { color: '#A1A1AA', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#FFF' },
  loading: { color: '#71717A', textAlign: 'center', marginTop: 40 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingHorizontal: spacing[6], paddingTop: 40 },
  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  emptyCar: { fontSize: 44 },
  magnifier: {
    position: 'absolute',
    right: 22,
    bottom: 22,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  emptySub: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: spacing[5],
    lineHeight: 20,
  },
  primary: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryTxt: { color: '#FFF', fontWeight: '800' },
  secondary: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#141414',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  secondaryTxt: { color: '#FFF', fontWeight: '700' },
  tryLab: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  tryRow: { flexDirection: 'row', gap: 10, width: '100%' },
  tryCard: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tryIcon: { fontSize: 24, marginBottom: 6 },
  tryLabel: { color: '#FFF', fontWeight: '700' },
  card: { marginBottom: spacing[4] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  when: { color: '#A1A1AA', fontSize: 13 },
  dvt: { color: '#22C55E', fontWeight: '800' },
  locBox: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 12,
    marginLeft: 50,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locLine: {
    width: 2,
    height: 12,
    backgroundColor: '#3F3F46',
    marginLeft: 4,
    marginVertical: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  locText: { color: '#E4E4E7', fontSize: 13, flex: 1 },
  titleOnly: { color: '#E4E4E7', marginLeft: 50, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, marginLeft: 50 },
  actionBtn: {
    backgroundColor: '#18181B',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { color: '#E4E4E7', fontSize: 12, fontWeight: '600' },
});
