import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Item = {
  id: string;
  title: string;
  when: string;
  amount: number;
  kind: 'ride' | 'order';
};

/** Unified trip + order history — empty state matches mockup. */
export default function TripHistoryScreen({
  onOpen,
  onBookRide,
  showDemoWhenEmpty = false,
}: {
  onOpen?: (item: Item) => void;
  onBookRide?: () => void;
  /** Keep false by default so empty state can show; set true for demos. */
  showDemoWhenEmpty?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/rides?limit=20`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/orders?limit=20`).then((r) => r.json()).catch(() => null),
    ]).then(([rides, orders]) => {
      const rideRows = (rides?.data?.rides || rides?.data || []).map((r: any) => ({
        id: r.id,
        title: `${r.pickup_address || r.pickupAddress || 'Pickup'} → ${
          r.dropoff_address || r.dropoffAddress || 'Dropoff'
        }`,
        when: r.created_at ? new Date(r.created_at).toLocaleString() : 'Recently',
        amount: Number(r.actual_fare || r.estimated_fare || r.actualFare || 0),
        kind: 'ride' as const,
      }));
      const orderRows = (orders?.data || []).map((o: any) => ({
        id: o.id,
        title: `${o.store_name || o.storeName || 'Store'} order`,
        when: o.created_at ? new Date(o.created_at).toLocaleString() : 'Recently',
        amount: Number(o.total || 0),
        kind: 'order' as const,
      }));
      const merged = [...rideRows, ...orderRows];
      if (merged.length) setItems(merged);
      else if (showDemoWhenEmpty) {
        setItems([
          { id: '1', title: 'Osu → Airport', when: 'Today, 2:14 PM', amount: 45, kind: 'ride' },
          { id: '2', title: 'East Legon → Labone', when: 'Yesterday', amount: 28, kind: 'ride' },
          { id: '3', title: 'Boutique 22 order', when: '2 days ago', amount: 330, kind: 'order' },
        ]);
      }
      setLoading(false);
    });
  }, [showDemoWhenEmpty]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Trip history</Text>

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Text style={{ fontSize: 28 }}>🚐</Text>
          </View>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptyBody}>
            Your ride and order history will show up here once you take your first trip.
          </Text>
          <Pressable style={styles.cta} onPress={onBookRide}>
            <View style={styles.ctaGlow} />
            <Text style={styles.ctaText}>Book a ride</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            loading ? <Text style={styles.when}>Loading…</Text> : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onOpen?.(item)}>
              <View style={styles.iconBox}>
                <Text>{item.kind === 'order' ? '📦' : '🚗'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.when}>{item.when}</Text>
              </View>
              <Text style={styles.amount}>{formatCurrency(item.amount, 'GHS')}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.jetBlack,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
  },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: { color: colors.pureWhite, fontSize: 20, fontWeight: '700' },
  emptyBody: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: spacing[6],
    lineHeight: 20,
    maxWidth: 280,
  },
  cta: {
    borderRadius: radius.pill,
    minHeight: 52,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.electricViolet,
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, zIndex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '700', fontSize: 15 },
  when: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  amount: { color: colors.pureWhite, fontWeight: '600' },
});
