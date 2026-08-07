import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL || API.replace(/\/api\/v1\/?$/, '')) as string;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STEPS = [
  { key: 'confirmed', label: 'Order confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

/**
 * Order tracking — map card + timeline.
 * Subscribes to Socket.io room delivery:{orderId} when delivery_mode is movr_courier.
 */
export default function OrderTrackingScreen({
  orderId = '4821',
  storeName = 'Boutique 22',
}: {
  orderId?: string;
  storeName?: string;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [activeIndex, setActiveIndex] = useState(2);
  const [eta, setEta] = useState('12 min away');
  const [fromStore, setFromStore] = useState(storeName);
  const [orderRef, setOrderRef] = useState(
    String(orderId).replace(/-/g, '').slice(-4).toUpperCase() || '4821'
  );
  const [courierPos, setCourierPos] = useState<{ lat?: number; lng?: number } | null>(null);

  useEffect(() => {
    let socket: any = null;
    let cancelled = false;

    const applyStatus = (status: string) => {
      const s = String(status || '').toLowerCase();
      if (s.includes('complet') || s === 'delivered') setActiveIndex(3);
      else if (s.includes('out') || s.includes('courier')) setActiveIndex(2);
      else if (s.includes('prepar') || s.includes('accept')) setActiveIndex(1);
      else if (s.includes('paid') || s.includes('confirm') || s.includes('pending')) setActiveIndex(0);
      else setActiveIndex(0);
    };

    fetch(`${API}/orders/${orderId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const o = j?.data;
        if (!o) return;
        if (o.store_name) setFromStore(o.store_name);
        if (o.eta_text) setEta(o.eta_text);
        else if (o.eta_minutes != null) setEta(`${o.eta_minutes} min away`);
        if (o.order_ref) setOrderRef(o.order_ref);
        applyStatus(o.status);

        if (o.delivery_mode === 'movr_courier' || !o.delivery_mode) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { io } = require('socket.io-client');
            socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
            socket.emit('delivery:join', o.id || orderId);
            socket.on('delivery:location', (data: any) => {
              if (String(data?.orderId) !== String(o.id || orderId)) return;
              setCourierPos({ lat: data.lat, lng: data.lng });
              if (data.eta_text) setEta(data.eta_text);
              if (data.status) applyStatus(data.status);
            });
          } catch {
            /* socket.io-client optional */
          }
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (socket) {
        socket.off('delivery:location');
        socket.disconnect();
      }
    };
  }, [orderId]);

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        <View style={styles.mapGrid} />
        <View style={styles.etaPill}>
          <Text style={styles.etaText}>🚚  {eta}</Text>
        </View>
        {courierPos?.lat != null ? (
          <View style={styles.courierDot}>
            <Text style={styles.courierTxt}>📍</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>Order #{orderRef}</Text>
      <Text style={styles.sub}>From {fromStore}</Text>

      <View style={styles.timeline}>
        {STEPS.map((step, idx) => {
          const done = idx < activeIndex;
          const current = idx === activeIndex;
          return (
            <View key={step.key} style={styles.step}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  current && styles.dotCurrent,
                  !done && !current && styles.dotPending,
                ]}
              >
                {done ? <Text style={styles.check}>✓</Text> : null}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  (done || current) && styles.stepLabelOn,
                  !done && !current && styles.stepLabelOff,
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    map: {
      height: 180,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
      marginBottom: spacing[4],
    },
    mapGrid: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    etaPill: {
      position: 'absolute',
      top: spacing[3],
      left: spacing[3],
      backgroundColor: colors.jetBlack,
      borderRadius: radius.pill,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    etaText: { color: colors.pureWhite, fontWeight: '600', fontSize: 13 },
    courierDot: { position: 'absolute', bottom: 24, left: '45%' },
    courierTxt: { fontSize: 22 },
    title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
    sub: { color: colors.textSecondary, marginTop: 6, marginBottom: spacing[5] },
    timeline: {
      gap: spacing[4],
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[4],
    },
    step: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
    dot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotDone: { backgroundColor: '#A8D5A2' },
    dotCurrent: { backgroundColor: colors.motionBlue },
    dotPending: { backgroundColor: colors.border },
    check: { color: colors.jetBlack, fontWeight: '700' },
    stepLabel: { fontSize: 15 },
    stepLabelOn: { color: colors.pureWhite, fontWeight: '600' },
    stepLabelOff: { color: colors.textSecondary },
  });
}
