import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const FALLBACK_PRODUCTS = [
  { id: '1', name: 'Cotton shirt', price: 120 },
  { id: '2', name: 'Denim jacket', price: 280 },
  { id: '3', name: 'Canvas sneakers', price: 210 },
  { id: '4', name: 'Wool scarf', price: 65 },
];

/** Store profile — banner, meta, 2-col product grid (GET /stores/:id/products). */
export default function StoreProfileScreen({
  storeId,
  onOpenProduct,
  onAddToCart,
}: {
  storeId?: string;
  onOpenProduct?: (productId: string) => void;
  onAddToCart?: (product: any) => void;
}) {
  const [store, setStore] = useState<any>({
    name: 'Boutique 22',
    category: 'Fashion',
    rating: 4.8,
    reviewCount: 320,
    hours: 'Open until 9:00 PM',
    eta: '20–30 min',
  });
  const [products, setProducts] = useState<any[]>(FALLBACK_PRODUCTS);

  useEffect(() => {
    if (!storeId || storeId === 'demo') return;
    fetch(`${API}/stores/${storeId}`)
      .then((r) => r.json())
      .then((j) => {
        const s = j?.data?.rows?.[0] || j?.data;
        if (s) {
          setStore({
            name: s.name,
            category: s.category || 'Store',
            rating: Number(s.rating || 4.8),
            reviewCount: Number(s.review_count || 320),
            hours: s.hours_text || 'Open until 9:00 PM',
            eta: s.eta_text || '20–30 min',
          });
        }
      })
      .catch(() => undefined);

    fetch(`${API}/stores/${storeId}/products`)
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data || [];
        if (Array.isArray(rows) && rows.length) {
          setProducts(
            rows.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price || p.base_price || 0),
            }))
          );
        }
      })
      .catch(() => undefined);
  }, [storeId]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <View style={styles.banner} />
      <Text style={styles.title}>{store.name}</Text>
      <Text style={styles.gold}>
        ★ {Number(store.rating).toFixed(1)} ({store.reviewCount}) · {store.category}
      </Text>
      <Text style={styles.meta}>
        {store.hours} · {store.eta}
      </Text>

      <FlatList
        data={products}
        keyExtractor={(i) => String(i.id)}
        numColumns={2}
        scrollEnabled={false}
        columnWrapperStyle={{ gap: spacing[3] }}
        contentContainerStyle={{ gap: spacing[3], marginTop: spacing[5] }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => onOpenProduct?.(String(item.id))}
          >
            <View style={styles.thumb} />
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>{formatCurrency(item.price, 'GHS')}</Text>
            {onAddToCart ? (
              <Pressable
                style={styles.addBtn}
                onPress={() => onAddToCart(item)}
              >
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            ) : null}
          </Pressable>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  banner: {
    height: 140,
    borderRadius: radius.md,
    backgroundColor: '#1A1A1A',
    marginBottom: spacing[4],
  },
  title: { color: colors.pureWhite, fontSize: 24, fontWeight: '700' },
  gold: { color: '#D4AF37', marginTop: 6, fontWeight: '600' },
  meta: { color: colors.textSecondary, marginTop: 4 },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[3],
  },
  thumb: {
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: '#0A0A0A',
    marginBottom: spacing[3],
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '600', minHeight: 40 },
  price: { color: colors.pureWhite, fontWeight: '700', marginTop: 6 },
  addBtn: {
    marginTop: spacing[2],
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.electricViolet,
  },
  addText: { color: colors.pureWhite, fontWeight: '700', fontSize: 12 },
});
