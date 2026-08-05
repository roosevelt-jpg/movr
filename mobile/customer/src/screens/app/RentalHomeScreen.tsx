import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const VEHICLES = [
  { id: 'standard', name: 'Sedan', meta: '5 seats · Automatic', icon: '🚘' },
  { id: 'suv', name: 'SUV', meta: '7 seats · Automatic', icon: '🚙' },
];

/** Rentals — chauffeur/self-drive (flag-gated), hourly/daily, license + deposit. */
export default function RentalHomeScreen() {
  const [rentalType, setRentalType] = useState<'chauffeur' | 'self_drive'>('chauffeur');
  const [rateUnit, setRateUnit] = useState<'hourly' | 'daily'>('daily');
  const [duration, setDuration] = useState('1');
  const [selected, setSelected] = useState('standard');
  const [selfDriveOn, setSelfDriveOn] = useState(false);
  const [pricing, setPricing] = useState<any[]>([]);
  const [licenseUrl, setLicenseUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/rentals/pricing`)
      .then((r) => r.json())
      .then((j) => setPricing(j.data || []))
      .catch(() => undefined);
    fetch(`${API}/rentals/self-drive-available`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const on = j.data?.enabled === true;
        setSelfDriveOn(on);
        if (!on) setRentalType('chauffeur');
      })
      .catch(() => setSelfDriveOn(false));
  }, []);

  const unitPrice = useMemo(() => {
    const row = pricing.find(
      (p) =>
        p.vehicle_type_id === selected &&
        p.rental_type === rentalType &&
        p.rate_unit === rateUnit
    );
    return Number(row?.rate_amount || 0);
  }, [pricing, selected, rentalType, rateUnit]);

  const days = Math.max(1, Number(duration) || 1);
  const total = unitPrice * days;
  const deposit = rentalType === 'self_drive' ? Math.max(100, total * 0.2) : 0;

  const book = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (rentalType === 'self_drive' && !licenseUrl.trim()) {
        setMsg('License upload URL required for self-drive');
        setBusy(false);
        return;
      }
      const res = await fetch(`${API}/rentals/book`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          vehicleTypeId: selected,
          rentalType,
          rateUnit,
          duration: days,
          licenseUploadUrl: licenseUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setMsg(json.message || 'Booking failed');
      } else {
        setMsg(
          `Booked · ${formatCurrency(Number(json.data?.rental?.total_amount || total), 'GHS')}${
            deposit ? ` · deposit hold ${formatCurrency(deposit, 'GHS')}` : ''
          }`
        );
      }
    } catch (e: any) {
      setMsg(e.message || 'Booking failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Rentals</Text>

      <View style={styles.segment}>
        {selfDriveOn ? (
          <Pressable
            style={[styles.segBtn, rentalType === 'self_drive' && styles.segActive]}
            onPress={() => setRentalType('self_drive')}
          >
            {rentalType === 'self_drive' ? <View style={styles.segGlow} /> : null}
            <Text style={[styles.segText, rentalType === 'self_drive' && styles.segTextOn]}>
              Self-drive
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.segBtn, rentalType === 'chauffeur' && styles.segActive]}
          onPress={() => setRentalType('chauffeur')}
        >
          {rentalType === 'chauffeur' ? <View style={styles.segGlow} /> : null}
          <Text style={[styles.segText, rentalType === 'chauffeur' && styles.segTextOn]}>
            Chauffeur
          </Text>
        </Pressable>
      </View>

      {!selfDriveOn ? (
        <Text style={styles.flagHint}>Self-drive is rolling out gradually in your area</Text>
      ) : null}

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

      <View style={styles.durationRow}>
        <Text style={styles.durationLabel}>Duration ({rateUnit === 'daily' ? 'days' : 'hours'})</Text>
        <TextInput
          style={styles.durationInput}
          keyboardType="number-pad"
          value={duration}
          onChangeText={setDuration}
        />
      </View>

      {VEHICLES.map((v) => {
        const on = selected === v.id;
        const price =
          Number(
            pricing.find(
              (p) =>
                p.vehicle_type_id === v.id &&
                p.rental_type === rentalType &&
                p.rate_unit === rateUnit
            )?.rate_amount || 0
          ) || unitPrice;
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
              <Text style={styles.price}>{formatCurrency(price, 'GHS')}</Text>
              <Text style={styles.per}>{rateUnit === 'daily' ? 'per day' : 'per hour'}</Text>
            </View>
          </Pressable>
        );
      })}

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Estimated total</Text>
        <Text style={styles.totalValue}>{formatCurrency(total, 'GHS')}</Text>
        {deposit > 0 ? (
          <Text style={styles.deposit}>Refundable deposit hold · {formatCurrency(deposit, 'GHS')}</Text>
        ) : null}
      </View>

      {rentalType === 'self_drive' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🪪</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerText}>License upload + deposit required</Text>
            <TextInput
              style={styles.licenseInput}
              placeholder="License image URL (after upload)"
              placeholderTextColor={colors.textSecondary}
              value={licenseUrl}
              onChangeText={setLicenseUrl}
              autoCapitalize="none"
            />
          </View>
        </View>
      ) : null}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={book} disabled={busy || !unitPrice}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>{busy ? 'Booking…' : 'Confirm rental'}</Text>
      </Pressable>
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
  flagHint: { color: colors.textSecondary, marginBottom: spacing[3], fontSize: 12 },
  rateRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
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
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  durationLabel: { color: colors.textSecondary },
  durationInput: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.pureWhite,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
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
  totalCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLabel: { color: colors.textSecondary },
  totalValue: { color: colors.pureWhite, fontWeight: '700', fontSize: 22, marginTop: 4 },
  deposit: { color: colors.warning, marginTop: 6, fontSize: 13 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginTop: spacing[2],
    padding: spacing[4],
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,184,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.35)',
    marginBottom: spacing[3],
  },
  bannerIcon: { fontSize: 18, marginTop: 2 },
  bannerText: { color: colors.warning, fontWeight: '600', fontSize: 13, marginBottom: 8 },
  licenseInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.35)',
    borderRadius: radius.sm,
    color: colors.pureWhite,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  msg: { color: colors.success, marginBottom: spacing[3] },
  cta: {
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
    overflow: 'hidden',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
});
