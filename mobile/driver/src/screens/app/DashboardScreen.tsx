import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';
import { initMobileSentry } from '../../sentry';

initMobileSentry('driver');

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

/** Driver home — greeting, online toggle, earnings, recent trips. */
export default function DashboardScreen({
  onWithdraw,
  onDemand,
  onVehicle,
  onPerformance,
  onSubscription,
}: {
  onWithdraw?: () => void;
  onDemand?: () => void;
  onVehicle?: () => void;
  onPerformance?: () => void;
  onSubscription?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [online, setOnline] = useState(true);
  const [today, setToday] = useState(0);
  const [trips, setTrips] = useState(0);
  const [week, setWeek] = useState(0);
  const [subActive, setSubActive] = useState(false);
  const [name, setName] = useState('Driver');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [recent, setRecent] = useState<
    { id: string; route: string; time: string; amount: number }[]
  >([]);

  const load = async () => {
    const h = authHeaders();
    const [earn, sub, presence] = await Promise.all([
      fetch(`${API}/driver/earnings/today`, { headers: h }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/subscriptions/me`, { headers: h }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/driver/presence`, { headers: h }).then((r) => r.json()).catch(() => null),
    ]);
    if (earn?.data) {
      setToday(Number(earn.data.amount || 0));
      setTrips(Number(earn.data.trips || 0));
      setWeek(Number(earn.data.week || 0));
      if (earn.data.name) setName(earn.data.name);
      if (earn.data.avatarUrl) setAvatarUrl(earn.data.avatarUrl);
      if (Array.isArray(earn.data.recent)) setRecent(earn.data.recent);
      if (typeof earn.data.online === 'boolean') setOnline(earn.data.online);
    }
    setSubActive(sub?.data?.status === 'active' || sub?.data?.status === 'pending');
    if (typeof presence?.data?.online === 'boolean') setOnline(presence.data.online);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const setPresence = async (next: boolean) => {
    setOnline(next);
    try {
      await fetch(`${API}/driver/presence`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isOnline: next }),
      });
    } catch {
      setOnline(!next);
    }
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greet}</Text>
          <Text style={styles.name}>{name}</Text>
        </View>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar} />
        )}
      </View>

      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleBtn, online && styles.toggleOn]}
          onPress={() => setPresence(true)}
        >
          <Text style={[styles.toggleText, online && styles.toggleTextOn]}>
            {online ? '✓  Online' : 'Online'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, !online && styles.toggleOffActive]}
          onPress={() => setPresence(false)}
        >
          <Text style={[styles.toggleText, !online && styles.toggleTextOn]}>Offline</Text>
        </Pressable>
      </View>

      <View style={styles.earnCard}>
        <View style={styles.earnGlow} />
        <View style={styles.earnGlow2} />
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
        <Pressable
          style={styles.statCard}
          onPress={onSubscription}
          disabled={!onSubscription}
        >
          <Text style={styles.statLabel}>Subscription</Text>
          <Text style={styles.statValue}>{subActive ? 'Active' : 'Inactive'}</Text>
        </Pressable>
      </View>

      {onPerformance ? (
        <Pressable style={styles.linkBtn} onPress={onPerformance}>
          <Text style={styles.linkText}>Performance →</Text>
        </Pressable>
      ) : null}
      {onDemand ? (
        <Pressable style={styles.linkBtn} onPress={onDemand}>
          <Text style={styles.linkText}>Demand near you →</Text>
        </Pressable>
      ) : null}
      {onVehicle ? (
        <Pressable style={styles.linkBtn} onPress={onVehicle}>
          <Text style={styles.linkText}>My vehicle →</Text>
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

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    greet: { color: colors.textSecondary, fontSize: 14 },
    name: { color: colors.pureWhite, fontSize: 26, fontWeight: '700', marginTop: 2 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
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
      backgroundColor: colors.electricViolet,
      overflow: 'hidden',
      marginBottom: spacing[3],
    },
    earnGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.motionBlue,
      opacity: 0.55,
    },
    earnGlow2: {
      position: 'absolute',
      right: -40,
      top: -40,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: colors.electricViolet,
      opacity: 0.5,
    },
    earnLabel: { color: 'rgba(220,200,255,0.9)', zIndex: 1 },
    earnValue: { color: colors.pureWhite, fontSize: 36, fontWeight: '700', marginTop: 6, zIndex: 1 },
    earnMeta: { color: 'rgba(220,200,255,0.85)', marginTop: spacing[3], zIndex: 1 },
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
      borderRadius: radius.lg,
      padding: spacing[4],
    },
    statLabel: { color: colors.textSecondary, fontSize: 12 },
    statValue: { color: colors.pureWhite, fontWeight: '700', marginTop: 6, fontSize: 18 },
    linkBtn: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      marginBottom: spacing[2],
    },
    linkText: { color: colors.pureWhite, fontWeight: '600' },
    section: { color: colors.textSecondary, marginTop: spacing[3], marginBottom: spacing[3] },
    empty: { color: colors.textSecondary },
    trip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[4],
      marginBottom: spacing[2],
    },
    tripRoute: { color: colors.pureWhite, fontWeight: '600' },
    tripTime: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    tripAmt: { color: colors.pureWhite, fontWeight: '700' },
  });
}
