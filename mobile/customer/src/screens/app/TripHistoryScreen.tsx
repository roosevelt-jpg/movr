import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Item = {
  id: string;
  title: string;
  when: string;
  amount: number;
  kind: 'ride' | 'order';
  sortAt: number;
};

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatHistoryWhen(value: string | Date | null | undefined): string {
  if (!value) return 'Recently';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startToday.getTime() - startThat.getTime()) / 86400000);
  if (dayDiff === 0) {
    const time = d.toLocaleTimeString('en-GH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `Today, ${time}`;
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Unified trip + order history — empty state matches mockup. */
export default function TripHistoryScreen({
  onOpen,
  onBookRide,
  forceEmpty = false,
}: {
  onOpen?: (item: Item) => void;
  onBookRide?: () => void;
  forceEmpty?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyCopy, setEmptyCopy] = useState({
    title: 'No trips yet',
    body: 'Your ride and order history will show up here once you take your first trip.',
    cta_label: 'Book a ride',
  });

  useEffect(() => {
    fetch(`${API}/public/status-copy/trip_history_empty`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data?.title) setEmptyCopy(body.data);
      })
      .catch(() => undefined);

    if (forceEmpty) {
      setItems([]);
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`${API}/rides?limit=20`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${API}/orders?limit=20`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([rides, orders]) => {
      const rideRows: Item[] = (rides?.data?.rides || rides?.data || []).map((r: any) => {
        const at = r.completed_at || r.created_at;
        return {
          id: String(r.id),
          title: `${r.pickup_address || r.pickupAddress || 'Pickup'} → ${
            r.dropoff_address || r.dropoffAddress || 'Dropoff'
          }`,
          when: formatHistoryWhen(at),
          amount: Number(r.actual_fare || r.estimated_fare || r.actualFare || 0),
          kind: 'ride' as const,
          sortAt: at ? new Date(at).getTime() : 0,
        };
      });
      const orderRows: Item[] = (orders?.data || []).map((o: any) => {
        const at = o.created_at || o.createdAt;
        return {
          id: String(o.id),
          title: `${o.store_name || o.storeName || 'Store'} order`,
          when: formatHistoryWhen(at),
          amount: Number(o.total || 0),
          kind: 'order' as const,
          sortAt: at ? new Date(at).getTime() : 0,
        };
      });
      setItems([...rideRows, ...orderRows].sort((a, b) => b.sortAt - a.sortAt));
      setLoading(false);
    });
  }, [forceEmpty]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Trip history</Text>

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Text style={styles.vanGlyph}>🚐</Text>
          </View>
          <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
          <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
          <Pressable style={styles.cta} onPress={onBookRide} accessibilityRole="button">
            <View style={styles.ctaPurple} />
            <View style={styles.ctaBlue} />
            <Text style={styles.ctaText}>{emptyCopy.cta_label}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => `${i.kind}-${i.id}`}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={loading ? <Text style={styles.when}>Loading…</Text> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onOpen?.(item)}>
              <View style={styles.iconBox}>
                <Text style={styles.iconGlyph}>{item.kind === 'order' ? '📦' : '🚗'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
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
    backgroundColor: '#000000',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  vanGlyph: { fontSize: 28 },
  emptyTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  emptyBody: {
    color: '#A1A1AA',
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
    backgroundColor: '#6B21A8',
  },
  ctaPurple: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#6B21A8',
  },
  ctaBlue: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.72,
    left: '35%',
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 16 },
  cardTitle: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  when: { color: '#A1A1AA', marginTop: 4, fontSize: 13 },
  amount: { color: '#FFFFFF', fontWeight: '600' },
});
