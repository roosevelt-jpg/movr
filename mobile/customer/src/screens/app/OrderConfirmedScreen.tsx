import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Order Confirmed — stepper, ETA card, Track / Home (mockup). */
export default function OrderConfirmedScreen({
  orderId,
  onTrack,
  onHome,
  onRate,
}: {
  orderId?: string;
  onTrack?: () => void;
  onHome?: () => void;
  onRate?: () => void;
}) {
  const [merchant, setMerchant] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [arrival, setArrival] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('Order not found');
      return;
    }
    fetch(`${API}/orders/${orderId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const o = j?.data;
        if (!o) return;
        if (o.store_name) setMerchant(o.store_name);
        if (o.order_ref || o.public_ref) setOrderRef(o.order_ref || o.public_ref);
        if (o.estimated_arrival) setArrival(o.estimated_arrival);
        if (o.time_left) setTimeLeft(o.time_left);
        else if (o.eta_minutes != null) setTimeLeft(`~${o.eta_minutes} min`);
      })
      .catch((e) => setError(e?.message || 'Could not load order'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const copy = async () => {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(orderRef);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const steps = [
    { key: 'confirmed', label: 'Confirmed', icon: '✓', on: true },
    { key: 'preparing', label: 'Preparing', icon: '🍳', on: true },
    { key: 'way', label: 'On the way', icon: '🛵', on: false },
    { key: 'delivered', label: 'Delivered', icon: '🏠', on: false },
  ];

  if (loading) {
    return (
      <View style={styles.root}>
        <Text style={styles.sub}>Loading order…</Text>
      </View>
    );
  }

  if (error || !orderRef) {
    return (
      <View style={styles.root}>
        <Text style={styles.error}>{error || 'Order not found'}</Text>
        <Pressable style={styles.home} onPress={onHome}>
          <Text style={styles.homeText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.rings}>
        <View style={styles.ringOuter} />
        <View style={styles.ringMid} />
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
      </View>
      <Text style={styles.title}>Order Confirmed!</Text>
      <Text style={styles.sub}>{merchant} is preparing your order</Text>

      <Pressable style={styles.refPill} onPress={copy}>
        <Text style={styles.refText}>
          Order # <Text style={styles.refBold}>{orderRef}</Text>
        </Text>
        <Text style={styles.copy}>{copied ? '✓' : '📋'}</Text>
      </Pressable>

      <View style={styles.stepper}>
        {steps.map((s, i) => (
          <View key={s.key} style={styles.stepCol}>
            <View style={styles.stepRow}>
              <View style={[styles.dot, s.on && styles.dotOn]}>
                <Text style={styles.dotIcon}>{s.icon}</Text>
              </View>
              {i < steps.length - 1 ? (
                <View style={[styles.line, i === 0 && styles.lineOn]} />
              ) : null}
            </View>
            <Text style={[styles.stepLabel, !s.on && styles.stepDim]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.etaCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.etaLabel}>Estimated arrival</Text>
          <Text style={styles.etaVal}>{arrival}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.etaLabel}>Time left</Text>
          <Text style={styles.etaPurple}>{timeLeft}</Text>
        </View>
      </View>

      <Pressable style={styles.track} onPress={onTrack}>
        <View style={styles.trackA} />
        <View style={styles.trackB} />
        <Text style={styles.trackText}>Track Order</Text>
      </Pressable>
      <Pressable style={styles.home} onPress={onRate}>
        <Text style={styles.homeText}>Rate products</Text>
      </Pressable>
      <Pressable style={[styles.home, { marginTop: 12 }]} onPress={onHome}>
        <Text style={styles.homeText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: spacing[5],
    paddingTop: 48,
    alignItems: 'center',
  },
  rings: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ringOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  ringMid: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.25)',
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#000', fontSize: 28, fontWeight: '900' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  sub: { color: '#A1A1AA', marginTop: 8, marginBottom: 20, textAlign: 'center' },
  refPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 28,
  },
  refText: { color: '#A1A1AA' },
  refBold: { color: '#fff', fontWeight: '800' },
  copy: { fontSize: 14 },
  stepper: { flexDirection: 'row', width: '100%', marginBottom: 24 },
  stepCol: { flex: 1, alignItems: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotOn: { backgroundColor: '#A855F7' },
  dotIcon: { fontSize: 14 },
  line: {
    position: 'absolute',
    left: '55%',
    right: '-45%',
    height: 3,
    backgroundColor: '#27272A',
  },
  lineOn: { backgroundColor: '#A855F7' },
  stepLabel: { color: '#fff', fontSize: 11, marginTop: 8, fontWeight: '600' },
  stepDim: { color: '#52525B' },
  etaCard: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#1E1033',
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
  },
  etaLabel: { color: '#A1A1AA', fontSize: 12 },
  etaVal: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  etaPurple: { color: '#A855F7', fontSize: 22, fontWeight: '800', marginTop: 6 },
  track: {
    width: '100%',
    borderRadius: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  trackA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#A855F7' },
  trackB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.85,
    left: '40%',
  },
  trackText: { color: '#fff', fontWeight: '800', zIndex: 1 },
  home: {
    width: '100%',
    borderRadius: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  homeText: { color: '#fff', fontWeight: '700' },
  error: { color: '#F87171', marginTop: 8, textAlign: 'center' },
});
