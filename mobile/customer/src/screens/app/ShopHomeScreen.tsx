import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const CATEGORIES = [
  { id: 'All', label: 'All', icon: '' },
  { id: 'Food', label: 'Food', icon: '🍔' },
  { id: 'Grocery', label: 'Grocery', icon: '🛒' },
  { id: 'Pharmacy', label: 'Pharmacy', icon: '💊' },
];

function catIcon(category: string) {
  const c = category.toLowerCase();
  if (/food|restaurant|burger|fast/.test(c)) return '🍔';
  if (/groc|mart|market/.test(c)) return '🛒';
  if (/pharm|drug|chemist/.test(c)) return '💊';
  return '🏪';
}

/** Shop — search products + stores, category chips. */
export default function ShopHomeScreen({
  onOpenStore,
  onOpenProduct,
  onOpenWishlist,
  userLat = 6.4281,
  userLng = 3.4219,
}: {
  onOpenStore?: (storeId: string) => void;
  onOpenProduct?: (storeId: string, productId: string, name?: string, price?: number) => void;
  onOpenWishlist?: () => void;
  userLat?: number;
  userLng?: number;
}) {
  const [category, setCategory] = useState('All');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [mode, setMode] = useState<'products' | 'stores'>('products');
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    if (mode === 'stores') {
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
          if (Array.isArray(rows)) {
            setStores(
              rows.map((s: any) => ({
                id: s.id,
                name: s.name,
                category: s.category || 'Store',
                rating: Number(s.rating || 0),
                eta:
                  s.eta_text ||
                  (s.eta_min_minutes != null
                    ? `${s.eta_min_minutes}–${s.eta_max_minutes ?? s.eta_min_minutes} min`
                    : ''),
                distanceKm: s.distance_km != null ? Number(s.distance_km) : null,
                icon: catIcon(s.category || ''),
                isOpen: s.is_open !== false && s.status !== 'closed',
              }))
            );
          }
        })
        .catch((e) => {
          setStores([]);
          setError(e?.message || 'Could not load stores');
        })
        .finally(() => setLoading(false));
    } else {
      const params = new URLSearchParams({ sort });
      if (category !== 'All') params.set('category', category.toLowerCase());
      if (q.trim()) params.set('q', q.trim());
      fetch(`${API}/products?${params}`)
        .then((r) => r.json())
        .then((j) => {
          setProducts(Array.isArray(j?.data) ? j.data : []);
        })
        .catch((e) => {
          setProducts([]);
          setError(e?.message || 'Could not load products');
        })
        .finally(() => setLoading(false));
    }
  }, [category, q, userLat, userLng, mode, sort]);

  const visibleStores = useMemo(() => {
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
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Shop</Text>
          <Text style={styles.sub}>Search products or browse stores.</Text>
        </View>
        <Pressable onPress={onOpenWishlist} style={styles.wishBtn}>
          <Text style={styles.wishTxt}>♡ Wishlist</Text>
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        {(['products', 'stores'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.modeChip, mode === m && styles.modeOn]}
          >
            <Text style={[styles.modeTxt, mode === m && styles.modeTxtOn]}>{m}</Text>
          </Pressable>
        ))}
      </View>

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

      {mode === 'products' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[
            { id: 'newest', label: 'Newest' },
            { id: 'rating', label: 'Top rated' },
            { id: 'price_asc', label: 'Price ↑' },
            { id: 'price_desc', label: 'Price ↓' },
          ].map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSort(s.id)}
              style={[styles.chip, sort === s.id && styles.chipOn]}
            >
              <Text style={[styles.chipText, sort === s.id && styles.chipTextOn]}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Text style={styles.section}>{mode === 'products' ? 'PRODUCTS' : 'NEARBY STORES'}</Text>
      {loading ? <Text style={styles.empty}>Loading…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {mode === 'stores' ? (
        <FlatList
          data={visibleStores}
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
                  {item.category}
                  {item.distanceKm != null ? ` · ${item.distanceKm}km away` : ''}
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
          ListEmptyComponent={!loading ? <Text style={styles.empty}>No stores nearby</Text> : null}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(i) => String(i.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ paddingBottom: spacing[8], gap: 10 }}
          renderItem={({ item }) => {
            const img = item.images?.[0]?.url || item.image_url;
            const price = Number(item.price || 0);
            const compare = item.compareAtPrice != null ? Number(item.compareAtPrice) : null;
            const currency = item.currency || 'NGN';
            return (
              <Pressable
                style={styles.productCard}
                onPress={() =>
                  onOpenProduct?.(
                    String(item.store_id),
                    String(item.id),
                    item.name,
                    price
                  )
                }
              >
                <View style={styles.productImgWrap}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.productImg} />
                  ) : (
                    <Text style={{ fontSize: 28 }}>{item.emoji || '🛍️'}</Text>
                  )}
                </View>
                <Text style={styles.productStore} numberOfLines={1}>
                  {item.storeName || item.store_name || ''}
                </Text>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.productPrice}>{formatCurrency(price, currency)}</Text>
                  {compare != null && compare > price ? (
                    <Text style={styles.strike}>{formatCurrency(compare, currency)}</Text>
                  ) : null}
                  {item.onSale ? <Text style={styles.sale}>Sale</Text> : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={!loading ? <Text style={styles.empty}>No products found</Text> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: '#fff', fontSize: 32, fontWeight: '800' },
  sub: { color: '#888', marginTop: 4, marginBottom: 12 },
  wishBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  wishTxt: { color: '#c4b5fd', fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeChip: {
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modeOn: { backgroundColor: '#3b82f6' },
  modeTxt: { color: '#888', fontWeight: '700', textTransform: 'capitalize' },
  modeTxtOn: { color: '#fff' },
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
  chips: { gap: 8, paddingBottom: 12 },
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
  productCard: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 10,
    marginBottom: 4,
  },
  productImgWrap: {
    height: 110,
    borderRadius: 10,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  productImg: { width: '100%', height: '100%' },
  productStore: { color: '#666', fontSize: 11 },
  productName: { color: '#fff', fontWeight: '700', fontSize: 13, marginTop: 2 },
  productPrice: { color: '#fff', fontWeight: '800', fontSize: 13, marginTop: 4 },
  strike: { color: '#666', textDecorationLine: 'line-through', fontSize: 11 },
  sale: { color: '#FB923C', fontSize: 10, fontWeight: '800' },
  empty: { color: '#666', textAlign: 'center', marginTop: 24 },
  error: { color: '#F87171', textAlign: 'center', marginBottom: 12 },
});
