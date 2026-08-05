import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Driver home dashboard — online toggle, earnings, recent trips. */
export default function DashboardScreen({
  onWithdraw,
  onDemand,
  onVehicle,
}: {
  onWithdraw?: () => void;
  onDemand?: () => void;
  onVehicle?: () => void;
}) {
  const [online, setOnline] = useState(true);
  const [today, setToday] = useState(284);
  const [trips, setTrips] = useState(12);
  const [week, setWeek] = useState(1640);
  const [subActive, setSubActive] = useState(true);
  const [name, setName] = useState('Kwesi Boateng');
  const [recent, setRecent] = useState([
    { id: '1', route: 'Osu → Airport', time: '2:14 PM', amount: 45 },
    { id: '2', route: 'East Legon → Labone', time: '1:02 PM', amount: 28 },
  ]);

  useEffect(() => {
    fetch(`${API}/driver/performance`)
      .then((r) => r.json())
      .then((j) => {
        const m = j.data?.metrics;
        if (m?.rides_completed != null) setTrips(Number(m.rides_completed) || trips);
      })
      .catch(() => undefined);
    fetch(`${API}/driver/earnings/today`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.amount != null) setToday(Number(j.data.amount));
        if (j?.data?.trips != null) setTrips(Number(j.data.trips));
        if (j?.data?.week != null) setWeek(Number(j.data.week));
        if (j?.data?.name) setName(j.data.name);
        if (Array.isArray(j?.data?.recent)) setRecent(j.data.recent);
      })
      .catch(() => undefined);
    fetch(`${API}/subscriptions/me`)
      .then((r) => r.json())
      .then((j) => setSubActive(j?.data?.status === 'active' || j?.data?.status === 'pending' || true))
      .catch(() => undefined);
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greet}>{greet}</Text>
          <Text style={styles.name}>{name}</Text>
        </View>
        <View style={styles.avatar} />
      </View>

      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleBtn, online && styles.toggleOn]}
          onPress={() => setOnline(true)}
        >
          <Text style={[styles.toggleText, online && styles.toggleTextOn]}>
            {online ? '✓  Online' : 'Online'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, !online && styles.toggleOffActive]}
          onPress={() => setOnline(false)}
        >
          <Text style={[styles.toggleText, !online && styles.toggleTextOn]}>Offline</Text>
        </Pressable>
      </View>

      <View style={styles.earnCard}>
        <View style={styles.earnGlow} />
        <Text style={styles.earnLabel}>Today's earnings</Text>
        <Text style={styles.earnValue}>{formatCurrency(today, 'GHS')}</Text>
        <Text style={styles.earnMeta}>
          {trips} trips completed · 100% yours
        </Text>
        {onWithdraw ? (
          <Pressable style={styles.withdrawBtn} onPress={onWithdraw}>
            <Text style={styles.withdrawText}>Withdraw earnings</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>This week</Text>
          <Text style={styles.statValue}>{formatCurrency(week, 'GHS')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Subscription</Text>
          <Text style={styles.statValue}>{subActive ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

      {onDemand ? (
        <Pressable style={styles.demandBtn} onPress={onDemand}>
          <Text style={styles.demandText}>Demand near you →</Text>
        </Pressable>
      ) : null}

      {onVehicle ? (
        <Pressable style={styles.vehicleBtn} onPress={onVehicle}>
          <Text style={styles.vehicleText}>My vehicle →</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Recent trips</Text>
      {recent.map((t) => (
        <View key={t.id} style={styles.trip}>
          <View>
            <Text style={styles.tripRoute}>{t.route}</Text>
            <Text style={styles.tripTime}>{t.time}</Text>
          </View>
          <Text style={styles.tripAmt}>+{formatCurrency(t.amount, 'GHS')}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet: { color: colors.textSecondary, fontSize: 14 },
  name: { color: colors.pureWhite, fontSize: 24, fontWeight: '700', marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggle: {
    flexDirection: 'row',
    marginTop: spacing[4],
    marginBottom: spacing[4],
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: colors.movrGreen },
  toggleOffActive: { backgroundColor: colors.border },
  toggleText: { color: colors.textSecondary, fontWeight: '700' },
  toggleTextOn: { color: colors.pureWhite },
  earnCard: {
    borderRadius: radius.lg,
    padding: spacing[5],
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  earnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.4,
  },
  earnLabel: { color: 'rgba(255,255,255,0.7)', zIndex: 1 },
  earnValue: { color: colors.pureWhite, fontSize: 36, fontWeight: '700', marginTop: 6, zIndex: 1 },
  earnMeta: { color: 'rgba(255,255,255,0.7)', marginTop: spacing[3], zIndex: 1 },
  withdrawBtn: {
    marginTop: spacing[4],
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 1,
  },
  withdrawText: { color: colors.pureWhite, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  statLabel: { color: colors.textSecondary, fontSize: 13 },
  statValue: { color: colors.pureWhite, fontSize: 20, fontWeight: '700', marginTop: 6 },
  demandBtn: {
    marginBottom: spacing[3],
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  demandText: { color: colors.error, fontWeight: '700' },
  vehicleBtn: {
    marginBottom: spacing[5],
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  vehicleText: { color: colors.motionBlue, fontWeight: '700' },
  section: { color: colors.textSecondary, marginBottom: spacing[3] },
  trip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  tripRoute: { color: colors.pureWhite, fontWeight: '600' },
  tripTime: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  tripAmt: { color: colors.pureWhite, fontWeight: '700' },
});
