import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  TextInput,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const CATEGORIES = [
  { id: 'All', label: 'All', icon: '' },
  { id: 'Food', label: 'Food', icon: '🍔' },
  { id: 'Grocery', label: 'Grocery', icon: '🛒' },
  { id: 'Pharmacy', label: 'Pharmacy', icon: '💊' },
];

const FALLBACK_STORES = [
  {
    id: '1',
    name: 'Chicken Republic',
    category: 'Fast Food',
    rating: 4.8,
    eta: '20–35 min',
    distanceKm: 1.2,
    icon: '🍔',
    isOpen: true,
  },
  {
    id: '2',
    name: 'Shoprite',
    category: 'Grocery',
    rating: 4.6,
    eta: '25–40 min',
    distanceKm: 2.1,
    icon: '🛒',
    isOpen: true,
  },
  {
    id: '3',
    name: 'HealthPlus Pharmacy',
    category: 'Pharmacy',
    rating: 4.9,
    eta: '15–25 min',
    distanceKm: 0.8,
    icon: '💊',
    isOpen: true,
  },
];

function catIcon(category: string) {
  const c = category.toLowerCase();
  if (/food|restaurant|burger|fast/.test(c)) return '🍔';
  if (/groc|mart|market/.test(c)) return '🛒';
  if (/pharm|drug|chemist/.test(c)) return '💊';
  return '🏪';
}

/** Shop — search, category chips, nearby store cards with Open. */
export default function ShopHomeScreen({
  onOpenStore,
  userLat = 6.4281,
  userLng = 3.4219,
}: {
  onOpenStore?: (storeId: string) => void;
  userLat?: number;
  userLng?: number;
}) {
  const [category, setCategory] = useState('All');
  const [q, setQ] = useState('');
  const [stores, setStores] = useState<any[]>(FALLBACK_STORES);

  useEffect(() => {
    const params = new URLSearchParams({
      lat: String(userLat),
      lng: String(userLng),
    });
    if (category !== 'All') params.set('category', category.toLowerCase());
    if (q.trim()) params.set('search', q.trim());
    fetch(`${API}/stores?${params}`)
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data?.rows || j?.data || [];
        if (Array.isArray(rows) && rows.length) {
          setStores(
            rows.map((s: any, i: number) => ({
              id: s.id,
              name: s.name,
              category: s.category || 'Store',
              rating: Number(s.rating || 4.5),
              eta: s.eta_text || `${s.eta_min_minutes || 20}–${s.eta_max_minutes || 35} min`,
              distanceKm:
                s.distance_km != null
                  ? Number(s.distance_km)
                  : Math.round((0.6 + i * 0.5) * 10) / 10,
              icon: catIcon(s.category || ''),
              isOpen: s.is_open !== false && s.status !== 'closed',
            }))
          );
        }
      })
      .catch(() => undefined);
  }, [category, q, userLat, userLng]);

  const visible = useMemo(() => {
    return stores.filter((s) => {
      const matchC =
        category === 'All' ||
        String(s.category).toLowerCase().includes(category.toLowerCase()) ||
        (category === 'Food' && /food|restaurant|fast/i.test(s.category));
      const matchQ =
        !q.trim() ||
        String(s.name).toLowerCase().includes(q.toLowerCase()) ||
        String(s.category).toLowerCase().includes(q.toLowerCase());
      return matchC && matchQ;
    });
  }, [stores, category, q]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Shop</Text>
      <Text style={styles.sub}>Browse local merchants near you.</Text>

      <View style={styles.search}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search stores, products..."
          placeholderTextColor="#666"
          value={q}
          onChangeText={setQ}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.map((c) => {
          const on = category === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              style={[styles.chip, on && styles.chipOn]}
            >
              {c.icon ? <Text style={{ marginRight: 4 }}>{c.icon}</Text> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.section}>NEARBY STORES</Text>

      <FlatList
        data={visible}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.thumb}>
              <Text style={{ fontSize: 22 }}>{item.icon || catIcon(item.category)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardCat}>
                {item.category} · {item.distanceKm}km away
              </Text>
              <Text style={styles.cardMeta}>
                ★ {Number(item.rating).toFixed(1)} · {item.eta}
              </Text>
            </View>
            <Pressable style={styles.openBtn} onPress={() => onOpenStore?.(String(item.id))}>
              <Text style={styles.openText}>{item.isOpen ? 'Open' : 'Closed'}</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No stores nearby</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 8 },
  title: { color: '#fff', fontSize: 32, fontWeight: '800' },
  sub: { color: '#888', marginTop: 4, marginBottom: 16 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  chips: { gap: 8, paddingBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: '#8E2DE2' },
  chipText: { color: '#888', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  section: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cardCat: { color: '#888', fontSize: 12, marginTop: 2 },
  cardMeta: { color: '#aaa', fontSize: 12, marginTop: 4 },
  openBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  openText: { color: '#c4b5fd', fontWeight: '700' },
  empty: { color: '#666', textAlign: 'center', marginTop: 24 },
});
