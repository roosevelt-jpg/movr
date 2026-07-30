import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';

export default function CartScreen() {
  const [coupon, setCoupon] = useState('');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('delivery');

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Cart</Text>
      <Text style={styles.meta}>Line items · coupon · checkout</Text>

      <View style={styles.card}>
        <Text style={styles.line}>Sample item × 1</Text>
        <Text style={styles.meta}>GHS 25.00</Text>
      </View>

      <TextInput
        value={coupon}
        onChangeText={setCoupon}
        placeholder="Coupon code"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />

      <View style={styles.row}>
        {(['delivery', 'pickup'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFulfillment(f)}
            style={[styles.chip, fulfillment === f && styles.chipActive]}
          >
            <Text style={styles.chipText}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <Button label="Checkout" onPress={() => undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4], gap: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  meta: { color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  line: { color: colors.pureWhite, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.pureWhite,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  row: { flexDirection: 'row', gap: spacing[2] },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  chipActive: { borderColor: colors.motionBlue },
  chipText: { color: colors.pureWhite, textTransform: 'capitalize', fontWeight: '600' },
});
