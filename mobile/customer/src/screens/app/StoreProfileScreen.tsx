import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView, Image } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
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
}: {
  storeId?: string;
  onOpenProduct?: (productId: string) => void;
  onAddToCart?: (product: any) => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [store, setStore] = useState<any>({
    name: 'Boutique 22',
    category: 'Fashion',
    rating: 4.8,
    reviewCount: 320,
    hours: 'Open until 9:00 PM',
    eta: '20–30 min',
    bannerUrl: null,
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
            reviewCount: Number(s.review_count || 0),
            hours: s.hours_text || s.hours_json?.label || 'Open until 9:00 PM',
            eta: s.eta_text || '20–30 min',
            bannerUrl: s.banner_url || s.image_url || s.banners?.[0]?.image_url || null,
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
              imageUrl: p.image_url || null,
            }))
          );
        }
      })
      .catch(() => undefined);
  }, [storeId]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      {store.bannerUrl ? (
        <Image source={{ uri: store.bannerUrl }} style={styles.banner} />
      ) : (
        <View style={styles.banner} />
      )}
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
          <Pressable style={styles.card} onPress={() => onOpenProduct?.(String(item.id))}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={styles.thumb} />
            )}
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>{formatCurrency(item.price, 'GHS')}</Text>
          </Pressable>
        )}
      />
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    banner: {
      height: 140,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing[4],
      width: '100%',
    },
    title: { color: colors.pureWhite, fontSize: 24, fontWeight: '700' },
    gold: { color: colors.warning, marginTop: 6, fontWeight: '600' },
    meta: { color: colors.textSecondary, marginTop: 4 },
    card: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[3],
    },
    thumb: {
      height: 90,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      marginBottom: spacing[3],
      width: '100%',
    },
    cardTitle: { color: colors.pureWhite, fontWeight: '500', minHeight: 40 },
    price: { color: colors.pureWhite, fontWeight: '700', marginTop: 6 },
  });
}
