import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';

export default function ParcelHomeScreen() {
  const [tier, setTier] = useState<'standard' | 'express'>('standard');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');

  const standardFee = 10;
  const expressFee = 15;
  const fee = tier === 'express' ? expressFee : standardFee;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Parcel</Text>
      <Text style={styles.sub}>Send packages across town.</Text>

      <TextInput
        style={styles.input}
        placeholder="Pickup address"
        placeholderTextColor={colors.textSecondary}
        value={pickup}
        onChangeText={setPickup}
      />
      <TextInput
        style={styles.input}
        placeholder="Dropoff address"
        placeholderTextColor={colors.textSecondary}
        value={dropoff}
        onChangeText={setDropoff}
      />

      <View style={styles.row}>
        {(['standard', 'express'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTier(t)}
            style={[styles.chip, tier === t && styles.chipActive]}
          >
            <Text style={styles.chipText}>
              {t} · GHS {t === 'express' ? expressFee : standardFee}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sub}>Selected fee: GHS {fee.toFixed(2)}</Text>
      <Button label="Book parcel" onPress={() => undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4], gap: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.pureWhite,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  row: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  chipActive: { borderColor: colors.electricViolet },
  chipText: { color: colors.pureWhite, textTransform: 'capitalize', fontWeight: '600' },
});
