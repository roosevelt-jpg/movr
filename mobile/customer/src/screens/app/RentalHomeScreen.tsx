import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const VEHICLES = [
  { id: 'sedan', name: 'Sedan', meta: '5 seats · Automatic', icon: '🚘', daily: 280, hourly: 45 },
  { id: 'suv', name: 'SUV', meta: '7 seats · Automatic', icon: '🚙', daily: 420, hourly: 70 },
  { id: 'luxury', name: 'Luxury', meta: '4 seats · Chauffeur available', icon: '✦', daily: 950, hourly: 150 },
];

/** Rentals — self-drive / chauffeur + hourly/daily vehicle cards. */
export default function RentalHomeScreen() {
  const [rentalType, setRentalType] = useState<'chauffeur' | 'self_drive'>('self_drive');
  const [rateUnit, setRateUnit] = useState<'hourly' | 'daily'>('daily');
  const [selected, setSelected] = useState('sedan');
  const [selfDriveOn, setSelfDriveOn] = useState(true);
  const [pricing, setPricing] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/rentals/pricing`)
      .then((r) => r.json())
      .then((j) => setPricing(j.data || []))
      .catch(() => undefined);
    fetch(`${API}/rentals/self-drive-available`)
      .then((r) => r.json())
      .then((j) => setSelfDriveOn(j.data?.enabled !== false))
      .catch(() => undefined);
  }, []);

  const priceFor = (v: (typeof VEHICLES)[0]) => {
    const row = pricing.find(
      (p) =>
        String(p.vehicle_type_id || '').includes(v.id) &&
        p.rental_type === rentalType &&
        p.rate_unit === rateUnit
    );
    if (row) return Number(row.rate_amount);
    return rateUnit === 'daily' ? v.daily : v.hourly;
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Rentals</Text>

      <View style={styles.segment}>
        <Pressable
          style={[styles.segBtn, rentalType === 'self_drive' && styles.segActive]}
          onPress={() => selfDriveOn && setRentalType('self_drive')}
        >
          {rentalType === 'self_drive' ? <View style={styles.segGlow} /> : null}
          <Text style={[styles.segText, rentalType === 'self_drive' && styles.segTextOn]}>Self-drive</Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, rentalType === 'chauffeur' && styles.segActive]}
          onPress={() => setRentalType('chauffeur')}
        >
          {rentalType === 'chauffeur' ? <View style={styles.segGlow} /> : null}
          <Text style={[styles.segText, rentalType === 'chauffeur' && styles.segTextOn]}>Chauffeur</Text>
        </Pressable>
      </View>

      <View style={styles.rateRow}>
        {(['hourly', 'daily'] as const).map((u) => (
          <Pressable
            key={u}
            onPress={() => setRateUnit(u)}
            style={[styles.rateChip, rateUnit === u && styles.rateChipOn]}
          >
            <Text style={[styles.rateText, rateUnit === u && styles.rateTextOn]}>
              {u === 'hourly' ? 'Hourly' : 'Daily'}
            </Text>
          </Pressable>
        ))}
      </View>

      {VEHICLES.map((v) => {
        const on = selected === v.id;
        return (
          <Pressable
            key={v.id}
            onPress={() => setSelected(v.id)}
            style={[styles.card, on && styles.cardOn]}
          >
            <View style={styles.iconBox}>
              <Text style={{ fontSize: 22 }}>{v.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{v.name}</Text>
              <Text style={styles.cardMeta}>{v.meta}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{formatCurrency(priceFor(v), 'GHS')}</Text>
              <Text style={styles.per}>{rateUnit === 'daily' ? 'per day' : 'per hour'}</Text>
            </View>
          </Pressable>
        );
      })}

      {rentalType === 'self_drive' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🪪</Text>
          <Text style={styles.bannerText}>License upload + deposit required for self-drive</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing[3],
  },
  segBtn: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing[3],
    alignItems: 'center',
    overflow: 'hidden',
  },
  segActive: { backgroundColor: colors.electricViolet },
  segGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.4,
  },
  segText: { color: colors.textSecondary, fontWeight: '600', zIndex: 1 },
  segTextOn: { color: colors.pureWhite },
  rateRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  rateChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rateChipOn: { borderColor: colors.motionBlue },
  rateText: { color: colors.textSecondary, fontWeight: '600' },
  rateTextOn: { color: colors.pureWhite },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardOn: { borderColor: colors.motionBlue },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  cardMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  price: { color: colors.pureWhite, fontWeight: '700' },
  per: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
    padding: spacing[4],
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,184,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.35)',
  },
  bannerIcon: { fontSize: 18 },
  bannerText: { color: colors.warning, flex: 1, fontWeight: '600', fontSize: 13 },
});
