import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const FILTERS = [
  { id: 'all', label: 'All', icon: '' },
  { id: 'ride', label: 'Ride', icon: '🚗' },
  { id: 'shop', label: 'Shop', icon: '🛍' },
  { id: 'deliver', label: 'Deliver', icon: '📦' },
] as const;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Search Explore — search, filters, merchant grid, service CTAs (mockup). */
export default function ExploreScreen({
  onOpenStore,
  onRide,
  onParcel,
  onRental,
}: {
  onOpenStore?: (id: string) => void;
  onRide?: () => void;
  onParcel?: () => void;
  onRental?: () => void;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [merchants, setMerchants] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (filter) params.set('filter', filter);
    fetch(`${API}/me/explore?${params}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setMerchants(j?.data?.merchants || []))
      .catch(() => undefined);
  }, [q, filter]);

  const showGrid = filter === 'all' || filter === 'shop';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search rides, stores, parcels..."
            placeholderTextColor="#71717A"
            style={styles.search}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, filter === f.id && styles.chipOn]}
            >
              {f.icon ? <Text style={{ marginRight: 4 }}>{f.icon}</Text> : null}
              <Text style={styles.chipText}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {showGrid ? (
          <View style={styles.grid}>
            {merchants.map((m) => (
              <Pressable
                key={m.id}
                style={styles.card}
                onPress={() => onOpenStore?.(String(m.storeId || m.id))}
              >
                <Text style={styles.emoji}>{m.emoji}</Text>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.meta}>{m.meta}</Text>
                <Text style={styles.rating}>★ {Number(m.rating || 4.5).toFixed(1)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>
            {filter === 'ride'
              ? 'Book a ride below to get started'
              : 'Send a parcel with the action below'}
          </Text>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.action, styles.actionPurple]} onPress={onRide}>
          <Text style={styles.actionEmoji}>🚗</Text>
          <Text style={[styles.actionLabel, { color: '#6B21A8' }]}>Book Ride</Text>
        </Pressable>
        <Pressable style={[styles.action, styles.actionBlue]} onPress={onParcel}>
          <Text style={styles.actionEmoji}>📦</Text>
          <Text style={[styles.actionLabel, { color: '#92400E' }]}>Send Parcel</Text>
        </Pressable>
        <Pressable style={[styles.action, styles.actionGreen]} onPress={onRental}>
          <Text style={styles.actionEmoji}>🚙</Text>
          <Text style={[styles.actionLabel, { color: '#166534' }]}>Rent Car</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  searchWrap: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#8E2DE2',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  search: { flex: 1, color: '#FFF', paddingVertical: 14, fontSize: 15 },
  filters: { paddingHorizontal: spacing[4], marginTop: spacing[3], maxHeight: 44 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#8E2DE2' },
  chipText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
    gap: 10,
  },
  card: {
    width: '47%',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: spacing[3],
  },
  emoji: { fontSize: 28, marginBottom: 8 },
  name: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  meta: { color: '#71717A', fontSize: 12, marginTop: 4 },
  rating: { color: '#FFF', marginTop: 8, fontWeight: '600' },
  hint: { color: '#71717A', textAlign: 'center', marginTop: 40 },
  actions: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionPurple: { backgroundColor: '#E9D5FF' },
  actionBlue: { backgroundColor: '#BFDBFE' },
  actionGreen: { backgroundColor: '#BBF7D0' },
  actionEmoji: { fontSize: 20, marginBottom: 4 },
  actionLabel: { fontWeight: '800', fontSize: 12 },
});
