import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import { ordersApi } from '../../services/api';

/** Customer shop order history (marketplace orders). */
export default function OrdersHistoryScreen({
  onBack,
  onOpenOrder,
}: {
  onBack?: () => void;
  onOpenOrder?: (orderId: string) => void;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [returns, setReturns] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      ordersApi.list().then((r) => r.data?.data || []),
      ordersApi.myReturns().then((r) => r.data?.data || []).catch(() => []),
    ])
      .then(([list, rets]) => {
        setOrders(Array.isArray(list) ? list : []);
        setReturns(Array.isArray(rets) ? rets : []);
      })
      .catch((e) => setError(e?.response?.data?.message || e?.message || 'Could not load orders'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack} style={{ marginBottom: 8 }}>
        <Text style={styles.back}>←</Text>
      </Pressable>
      <Text style={styles.title}>My orders</Text>
      <Text style={styles.sub}>Track deliveries, pickups, and returns</Text>

      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#fff" />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Loading…' : error || 'No shop orders yet. Browse stores to get started.'}
          </Text>
        }
        ListFooterComponent={
          returns.length ? (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.section}>Returns</Text>
              {returns.map((r) => (
                <View key={r.id} style={styles.card}>
                  <Text style={styles.name}>{r.store_name || 'Store'}</Text>
                  <Text style={styles.meta}>
                    {r.status} · {r.public_ref || r.order_id}
                  </Text>
                  {r.reason ? <Text style={styles.meta}>{r.reason}</Text> : null}
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const currency = item.currency || item.currency_code || 'NGN';
          return (
            <Pressable style={styles.card} onPress={() => onOpenOrder?.(String(item.id))}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.store_name || 'Store'}
                </Text>
                <Text style={styles.badge}>{String(item.status || '').replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.meta}>
                {item.public_ref || item.id?.slice?.(0, 8)} ·{' '}
                {item.fulfillment_type === 'pickup' ? 'Pickup' : 'Delivery'}
                {item.payment_method ? ` · ${item.payment_method}` : ''}
              </Text>
              <Text style={styles.total}>{formatCurrency(Number(item.total || 0), currency)}</Text>
            </Pressable>
          );
        }}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  back: { color: '#fff', fontSize: 22 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  sub: { color: '#A1A1AA', marginTop: 6, marginBottom: 16 },
  section: {
    color: '#A1A1AA',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  empty: { color: '#71717A', marginTop: 24, lineHeight: 20 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  name: { color: '#fff', fontWeight: '800', flex: 1 },
  badge: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  meta: { color: '#A1A1AA', marginTop: 6, fontSize: 13 },
  total: { color: '#fff', fontWeight: '800', marginTop: 10 },
});
