import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function RentalHomeScreen() {
  const [rentalType, setRentalType] = useState<'chauffeur' | 'self_drive'>('chauffeur');
  const [rateUnit, setRateUnit] = useState<'hourly' | 'daily'>('daily');
  const [duration, setDuration] = useState('1');
  const [selfDriveOn, setSelfDriveOn] = useState(false);
  const [pricing, setPricing] = useState<any[]>([]);
  const [licenseUrl, setLicenseUrl] = useState('');

  useEffect(() => {
    fetch(`${API}/rentals/pricing`)
      .then((r) => r.json())
      .then((j) => setPricing(j.data || []))
      .catch(() => undefined);
    fetch(`${API}/rentals/self-drive-available`)
      .then((r) => r.json())
      .then((j) => setSelfDriveOn(!!j.data?.enabled))
      .catch(() => undefined);
  }, []);

  const rate = pricing.find(
    (p) =>
      p.vehicle_type_id === 'standard' &&
      p.rental_type === rentalType &&
      p.rate_unit === rateUnit
  );
  const total = rate ? Number(rate.rate_amount) * Number(duration || 1) : 0;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Rental</Text>
      <Text style={styles.sub}>Chauffeur or self-drive. Hourly or daily.</Text>

      <View style={styles.row}>
        <Pressable
          style={[styles.chip, rentalType === 'chauffeur' && styles.chipActive]}
          onPress={() => setRentalType('chauffeur')}
        >
          <Text style={styles.chipText}>Chauffeur</Text>
        </Pressable>
        {selfDriveOn ? (
          <Pressable
            style={[styles.chip, rentalType === 'self_drive' && styles.chipActive]}
            onPress={() => setRentalType('self_drive')}
          >
            <Text style={styles.chipText}>Self-drive</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.row}>
        {(['hourly', 'daily'] as const).map((u) => (
          <Pressable
            key={u}
            style={[styles.chip, rateUnit === u && styles.chipActive]}
            onPress={() => setRateUnit(u)}
          >
            <Text style={styles.chipText}>{u}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
        placeholder="Duration"
        placeholderTextColor={colors.textSecondary}
      />

      {rentalType === 'self_drive' ? (
        <TextInput
          style={styles.input}
          value={licenseUrl}
          onChangeText={setLicenseUrl}
          placeholder="License upload URL"
          placeholderTextColor={colors.textSecondary}
        />
      ) : null}

      <Text style={styles.total}>Total: GHS {total.toFixed(2)}</Text>
      <Button label="Continue" onPress={() => undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4], gap: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textSecondary },
  row: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  chipActive: { borderColor: colors.motionBlue },
  chipText: { color: colors.pureWhite, fontWeight: '600', textTransform: 'capitalize' },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.pureWhite,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  total: { color: colors.pureWhite, fontSize: 18, fontWeight: '700' },
});
