import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import PerformanceScreen from './PerformanceScreen';
import { initMobileSentry } from '../../sentry';

initMobileSentry('driver');

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Driver home — Earnings / Performance tabs. */
export default function DashboardScreen({
  onWithdraw,
  onDemand,
  onVehicle,
}: {
  onWithdraw?: () => void;
  onDemand?: () => void;
  onVehicle?: () => void;
}) {
  const [tab, setTab] = useState<'earnings' | 'performance'>('earnings');
  const [online, setOnline] = useState(true);
  const [today, setToday] = useState(0);
  const [trips, setTrips] = useState(0);
  const [week, setWeek] = useState(0);
  const [subActive, setSubActive] = useState(false);
  const [name, setName] = useState('Driver');
  const [tier, setTier] = useState('lite');
  const [recent, setRecent] = useState<
    { id: string; route: string; time: string; amount: number }[]
  >([]);

  useEffect(() => {
    const h = authHeaders();
    fetch(`${API}/driver/performance`, { headers: h })
      .then((r) => r.json())
      .then((j) => {
        const m = j.data?.metrics;
        if (m?.rides_completed != null) setTrips(Number(m.rides_completed));
        if (m?.current_tier) setTier(String(m.current_tier));
      })
      .catch(() => undefined);
    fetch(`${API}/driver/earnings/today`, { headers: h })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.amount != null) setToday(Number(j.data.amount));
        if (j?.data?.trips != null) setTrips(Number(j.data.trips));
        if (j?.data?.week != null) setWeek(Number(j.data.week));
        if (j?.data?.name) setName(j.data.name);
        if (Array.isArray(j?.data?.recent)) setRecent(j.data.recent);
      })
      .catch(() => undefined);
    fetch(`${API}/subscriptions/me`, { headers: h })
      .then((r) => r.json())
      .then((j) =>
        setSubActive(j?.data?.status === 'active' || j?.data?.status === 'pending')
      )
      .catch(() => undefined);
  }, []);

  if (tab === 'performance') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.jetBlack }}>
        <View style={styles.tabs}>
          <Pressable style={styles.tab} onPress={() => setTab('earnings')}>
            <Text style={styles.tabText}>Earnings</Text>
          </Pressable>
          <Pressable style={styles.tab}>
            <Text style={[styles.tabText, styles.tabOn]}>Performance</Text>
            <View style={styles.underline} />
          </Pressable>
        </View>
        <PerformanceScreen />
      </View>
    );
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <View style={styles.tabs}>
        <Pressable style={styles.tab}>
          <Text style={[styles.tabText, styles.tabOn]}>Earnings</Text>
          <View style={styles.underline} />
        </Pressable>
        <Pressable style={styles.tab} onPress={() => setTab('performance')}>
          <Text style={styles.tabText}>Performance</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <View>
          <Text style={styles.greet}>{greet}</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.tierBadge}>
            {tier.charAt(0).toUpperCase() + tier.slice(1)} tier
          </Text>
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
      {recent.length === 0 ? (
        <Text style={styles.empty}>No trips yet this period</Text>
      ) : (
        recent.map((t) => (
          <View key={t.id} style={styles.trip}>
            <View>
              <Text style={styles.tripRoute}>{t.route}</Text>
              <Text style={styles.tripTime}>{t.time}</Text>
            </View>
            <Text style={styles.tripAmt}>+{formatCurrency(t.amount, 'GHS')}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  tabs: { flexDirection: 'row', gap: spacing[5], marginBottom: spacing[4], paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  tab: { paddingBottom: 8 },
  tabText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  tabOn: { color: colors.pureWhite },
  underline: {
    marginTop: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.motionBlue,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet: { color: colors.textSecondary, fontSize: 14 },
  name: { color: colors.pureWhite, fontSize: 24, fontWeight: '700', marginTop: 2 },
  tierBadge: { color: colors.warning, fontWeight: '700', marginTop: 4, fontSize: 13 },
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
  toggleOn: { backgroundColor: colors.movrGreen || colors.success },
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
    borderRadius: radius.pill,
    backgroundColor: colors.pureWhite,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    zIndex: 1,
  },
  withdrawText: { color: colors.jetBlack, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  statLabel: { color: colors.textSecondary, fontSize: 12 },
  statValue: { color: colors.pureWhite, fontWeight: '700', marginTop: 6, fontSize: 16 },
  demandBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  demandText: { color: colors.pureWhite, fontWeight: '600' },
  vehicleBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  vehicleText: { color: colors.pureWhite, fontWeight: '600' },
  section: { color: colors.textSecondary, marginBottom: spacing[3] },
  empty: { color: colors.textSecondary },
  trip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripRoute: { color: colors.pureWhite, fontWeight: '600' },
  tripTime: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  tripAmt: { color: colors.success, fontWeight: '700' },
});
