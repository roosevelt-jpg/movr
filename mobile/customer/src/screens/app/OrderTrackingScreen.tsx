import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { StatusPill } from '@movr/design-system/components/StatusPill';

const STEPS = ['paid', 'accepted', 'preparing', 'out_for_delivery', 'completed'];

/**
 * Subscribes to Socket.io room delivery:{orderId} when delivery_mode is movr_courier.
 */
export default function OrderTrackingScreen({ orderId = 'demo' }: { orderId?: string }) {
  useEffect(() => {
    // Wire socket: join `delivery:${orderId}` and listen for delivery:location
  }, [orderId]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Order tracking</Text>
      <Text style={styles.meta}>Room: delivery:{orderId}</Text>

      <View style={styles.timeline}>
        {STEPS.map((step, idx) => (
          <View key={step} style={styles.step}>
            <StatusPill label={step.replace(/_/g, ' ')} tone={idx < 2 ? 'success' : 'pending'} />
          </View>
        ))}
      </View>

      <View style={styles.map}>
        <Text style={styles.meta}>Courier live location map</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  meta: { color: colors.textSecondary, marginTop: spacing[2] },
  timeline: { marginTop: spacing[5], gap: spacing[3] },
  step: {},
  map: {
    marginTop: spacing[5],
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
