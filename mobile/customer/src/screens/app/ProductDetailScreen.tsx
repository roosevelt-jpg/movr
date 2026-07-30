import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';

export default function ProductDetailScreen() {
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState('Regular');

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Product</Text>
      <Text style={styles.meta}>Pick a variant and quantity</Text>

      <View style={styles.row}>
        {['Regular', 'Large'].map((v) => (
          <Pressable
            key={v}
            onPress={() => setVariant(v)}
            style={[styles.chip, variant === v && styles.chipActive]}
          >
            <Text style={styles.chipText}>{v}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <Pressable onPress={() => setQty(Math.max(1, qty - 1))} style={styles.chip}>
          <Text style={styles.chipText}>-</Text>
        </Pressable>
        <Text style={styles.qty}>{qty}</Text>
        <Pressable onPress={() => setQty(qty + 1)} style={styles.chip}>
          <Text style={styles.chipText}>+</Text>
        </Pressable>
      </View>

      <Button label="Add to cart" onPress={() => undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4], gap: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  meta: { color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  chipActive: { borderColor: colors.electricViolet },
  chipText: { color: colors.pureWhite, fontWeight: '600' },
  qty: { color: colors.pureWhite, fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center' },
});
