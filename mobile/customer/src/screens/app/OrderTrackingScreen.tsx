import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const STEPS = [
  { key: 'confirmed', label: 'Order confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

/**
 * Order tracking — map card + timeline.
 * Subscribes to Socket.io room delivery:{orderId} when available.
 */
export default function OrderTrackingScreen({
  orderId = '4821',
  storeName = 'Boutique 22',
}: {
  orderId?: string;
  storeName?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(2);
  const [eta, setEta] = useState('12 min away');
  const [fromStore, setFromStore] = useState(storeName);

  useEffect(() => {
    // Wire socket: join `delivery:${orderId}` and listen for delivery:location
    fetch(`${API}/orders/${orderId}`)
      .then((r) => r.json())
      .then((j) => {
        const o = j?.data;
        if (!o) return;
        if (o.store_name) setFromStore(o.store_name);
        if (o.eta_text) setEta(o.eta_text);
        const status = String(o.status || '').toLowerCase();
        if (status.includes('deliver') && !status.includes('out')) setActiveIndex(3);
        else if (status.includes('out') || status.includes('courier')) setActiveIndex(2);
        else if (status.includes('prepar')) setActiveIndex(1);
        else if (status.includes('confirm') || status.includes('accept') || status.includes('paid'))
          setActiveIndex(0);
      })
      .catch(() => undefined);
  }, [orderId]);

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        <View style={styles.mapGrid} />
        <View style={styles.etaPill}>
          <Text style={styles.etaText}>🚚  {eta}</Text>
        </View>
      </View>

      <Text style={styles.title}>Order #{String(orderId).slice(0, 4).toUpperCase()}</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  map: {
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
    marginBottom: spacing[5],
    justifyContent: 'flex-start',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  etaPill: {
    alignSelf: 'flex-start',
    margin: spacing[3],
    backgroundColor: '#000',
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: '#333',
  },
  etaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 13 },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing[5] },
  timeline: {
    backgroundColor: '#0D0D0D',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    gap: spacing[4],
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: '#74D38F' },
  dotCurrent: { backgroundColor: colors.motionBlue },
  dotPending: { backgroundColor: '#2A2A2A' },
  check: { color: '#0A0A0A', fontWeight: '700' },
  stepLabel: { fontSize: 16, fontWeight: '600' },
  stepLabelOn: { color: colors.pureWhite },
  stepLabelOff: { color: '#666' },
});
