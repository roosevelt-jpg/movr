import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ScrollView, Image } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const CATEGORIES = ['All', 'Food', 'Grocery', 'Pharmacy'];

const FALLBACK_STORES = [
  { id: 'c0000000-0000-4000-8000-000000000001', name: 'Boutique 22', category: 'Fashion', rating: 4.8, eta: '20–30 min' },
  { id: 'c0000000-0000-4000-8000-000000000002', name: 'Fresh Mart', category: 'Grocery', rating: 4.6, eta: '15–25 min' },
  { id: 'c0000000-0000-4000-8000-000000000003', name: 'Osu Pharmacy', category: 'Pharmacy', rating: 4.9, eta: '10–20 min' },
  { id: 'c0000000-0000-4000-8000-000000000004', name: 'City Electronics', category: 'Electronics', rating: 4.5, eta: '30–40 min' },
];

/** Shop home — category chips + store list (GET /stores). */
export default function ShopHomeScreen({
  onOpenStore,
}: {
  onOpenStore?: (storeId: string) => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [category, setCategory] = useState('All');
  const [stores, setStores] = useState<any[]>(FALLBACK_STORES);

  useEffect(() => {
    const q = new URLSearchParams();
    if (category !== 'All') q.set('category', category.toLowerCase());
    fetch(`${API}/stores?${q}`)
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data?.rows || j?.data || [];
        if (Array.isArray(rows) && rows.length) {
          setStores(
            rows.map((s: any) => ({
              id: s.id,
              name: s.name,
              category: s.category || 'Store',
              rating: Number(s.rating || 4.5),
              qualityScore: s.quality_score != null ? Number(s.quality_score) : null,
              eta: s.eta_text || `${s.eta_min_minutes || 20}–${s.eta_max_minutes || 30} min`,
              imageUrl: s.image_url || s.banner_url || null,
            }))
          );
        }
      })
      .catch(() => undefined);
  }, [category]);

  const visible = useMemo(() => {
    if (category === 'All') return stores;
    return stores.filter((s) =>
      String(s.category).toLowerCase().includes(category.toLowerCase())
    );
  }, [stores, category]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Shop</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.map((c) => {
          const on = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, on && styles.chipOn]}
            >
              {on ? <View style={styles.chipGlow} /> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        renderItem={({ item, index }) => (
          <Pressable style={styles.card} onPress={() => onOpenStore?.(String(item.id))}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardCat}>{item.category}</Text>
              <Text style={styles.cardMeta}>
                ★ {Number(item.rating).toFixed(1)} · {item.eta}
                {index < 3 && item.qualityScore != null ? ' · Top rated' : ''}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No stores in this category</Text>}
      />
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.jetBlack,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
    },
    title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[3] },
    chips: { gap: spacing[2], paddingBottom: spacing[4] },
    chip: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
    },
    chipOn: { backgroundColor: colors.electricViolet },
    chipGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.motionBlue,
      opacity: 0.45,
    },
    chipText: { color: colors.textSecondary, fontWeight: '600', zIndex: 1 },
    chipTextOn: { color: colors.pureWhite },
    card: {
      flexDirection: 'row',
      gap: spacing[3],
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[3],
      marginBottom: spacing[3],
      alignItems: 'center',
    },
    thumb: {
      width: 64,
      height: 64,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
    },
    cardTitle: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
    cardCat: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
    cardMeta: { color: colors.warning, marginTop: 6, fontSize: 13, fontWeight: '600' },
    empty: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing[6] },
  });
}
