import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL || API.replace(/\/api\/v1\/?$/, '')) as string;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Live order tracking — map, courier card, timeline, footer (mockup). */
export default function OrderTrackingScreen({
  orderId,
  storeName = '',
  onDetails,
}: {
  orderId?: string;
  storeName?: string;
  onDetails?: () => void;
}) {
  const [orderRef, setOrderRef] = useState(orderId ? String(orderId) : '');
  const [statusLabel, setStatusLabel] = useState('');
  const [eta, setEta] = useState('');
  const [courier, setCourier] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState('NGN');
  const [fromStore, setFromStore] = useState(storeName);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let socket: any = null;
    let cancelled = false;
    if (!orderId) {
      setLoading(false);
      setError('Order not found');
      return;
    }

    fetch(`${API}/orders/${orderId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const o = j?.data;
        if (!o) return;
        if (o.order_ref || o.public_ref) setOrderRef(o.order_ref || o.public_ref);
        if (o.status_label) setStatusLabel(o.status_label);
        if (o.eta_text) setEta(o.eta_text);
        else if (o.eta_minutes != null) setEta(`Courier is ${o.eta_minutes} min away`);
        if (o.store_name) setFromStore(o.store_name);
        if (o.courier) {
          setCourier({
            name: o.courier.name,
            role: o.courier.role || '',
            rating: Number(o.courier.rating || 0),
            phone: o.courier.phone || '',
          });
        }
        if (Array.isArray(o.timeline) && o.timeline.length) setTimeline(o.timeline);
        setItemCount(Number(o.item_count || o.items?.length || 0));
        setTotal(Number(o.total || 0));
        setCurrency(o.currency || 'NGN');

        if (o.delivery_mode === 'movr_courier' || !o.delivery_mode) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { io } = require('socket.io-client');
            socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
            socket.emit('delivery:join', o.id || orderId);
            socket.on('delivery:location', (data: any) => {
              if (data?.eta_text) setEta(data.eta_text);
              if (data?.eta_minutes != null) setEta(`Courier is ${data.eta_minutes} min away`);
            });
          } catch {
            /* optional */
          }
        }
      })
      .catch((e) => setError(e?.message || 'Could not load order'))
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
      if (socket) {
        socket.off('delivery:location');
        socket.disconnect();
      }
    };
  }, [orderId]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={styles.map}>
        <View style={styles.grid} />
        <View style={styles.route} />
        <Text style={styles.storePin}>🍔</Text>
        <Text style={styles.bike}>🛵</Text>
        <Text style={styles.dropPin}>📍</Text>
        <View style={styles.etaPill}>
          <Text style={styles.etaText}>{eta}</Text>
        </View>
      </View>
      {loading ? <Text style={styles.empty}>Loading order…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.headerRow}>
        <Text style={styles.orderNum}>Order #{orderRef}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
      </View>

      {courier ? <View style={styles.courierCard}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 22 }}>🛵</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.courierName}>{courier.name}</Text>
          <Text style={styles.courierRole}>{courier.role}</Text>
          <Text style={styles.rating}>★ {Number(courier.rating).toFixed(1)}</Text>
        </View>
        <Pressable
          style={styles.square}
          onPress={() => courier.phone && Linking.openURL(`tel:${courier.phone}`)}
        >
          <Text>📞</Text>
        </Pressable>
        <Pressable style={styles.square}>
          <Text>💬</Text>
        </Pressable>
      </View> : null}

      <View style={styles.timeline}>
        {timeline.map((step, i) => (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  step.done && styles.dotDone,
                  step.active && styles.dotActive,
                ]}
              />
              {i < timeline.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <Text
              style={[
                styles.stepLabel,
                (step.active || step.done) && styles.stepOn,
                step.active && styles.stepActive,
              ]}
            >
              {step.label}
              {step.icon ? ` ${step.icon}` : ''}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerIcons}>🍔 🍗</Text>
        <Text style={styles.footerMeta}>
          {itemCount} items · {formatCurrency(total, currency)}
        </Text>
        <Pressable onPress={onDetails}>
          <Text style={styles.details}>Details</Text>
        </Pressable>
      </View>
      <Text style={styles.from}>From {fromStore}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', padding: spacing[4] },
  map: {
    height: 200,
    borderRadius: 18,
    backgroundColor: '#0c0c12',
    overflow: 'hidden',
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: '#1f1f28',
  },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.3, borderWidth: 1, borderColor: '#2a2a35' },
  route: {
    position: 'absolute',
    left: '18%',
    top: '48%',
    width: '58%',
    height: 3,
    backgroundColor: '#3B82F6',
    transform: [{ rotate: '-12deg' }],
  },
  storePin: { position: 'absolute', left: '16%', top: '36%', fontSize: 22 },
  bike: { position: 'absolute', left: '46%', top: '42%', fontSize: 20 },
  dropPin: { position: 'absolute', right: '18%', bottom: '28%', fontSize: 22 },
  etaPill: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    left: '20%',
    right: '20%',
    backgroundColor: '#000',
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  etaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  orderNum: { color: '#A1A1AA', fontWeight: '600' },
  badge: {
    borderWidth: 1,
    borderColor: '#F97316',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: '#F97316', fontWeight: '700', fontSize: 12 },
  courierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierName: { color: '#fff', fontWeight: '700' },
  courierRole: { color: '#A1A1AA', fontSize: 12, marginTop: 2 },
  rating: { color: '#F59E0B', fontSize: 12, marginTop: 2 },
  square: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeline: { marginBottom: 18, paddingLeft: 4 },
  stepRow: { flexDirection: 'row', minHeight: 36 },
  rail: { width: 20, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3F3F46', marginTop: 4 },
  dotDone: { backgroundColor: '#22C55E' },
  dotActive: { backgroundColor: '#A855F7' },
  line: { flex: 1, width: 2, backgroundColor: '#27272A', marginVertical: 2 },
  stepLabel: { color: '#52525B', fontSize: 14, paddingTop: 2, flex: 1 },
  stepOn: { color: '#A1A1AA' },
  stepActive: { color: '#fff', fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
  },
  footerIcons: { fontSize: 18 },
  footerMeta: { flex: 1, color: '#fff', fontWeight: '600' },
  details: { color: '#A855F7', fontWeight: '700' },
  from: { color: '#52525B', fontSize: 12, marginTop: 10, textAlign: 'center' },
  empty: { color: '#71717A', textAlign: 'center', marginBottom: 12 },
  error: { color: '#F87171', textAlign: 'center', marginBottom: 12 },
});
