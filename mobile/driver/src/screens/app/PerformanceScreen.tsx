import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function Ring({
  value,
  label,
  color,
  trackColor,
}: {
  value: number;
  label: string;
  color: string;
  trackColor: string;
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  // Approximate arc with thick ring; low values show a thin colored tip via opacity
  const ringOpacity = pct < 8 ? 0.35 : 1;
  return (
    <View style={ringStyles.col}>
      <View style={[ringStyles.outer, { borderColor: trackColor }]}>
        <View
          style={[
            ringStyles.fill,
            {
              borderColor: color,
              opacity: ringOpacity,
              // rotate so progress starts at top; for low cancel rates show small arc feel
              transform: [{ rotate: `${-90 + (100 - pct) * 1.8}deg` }],
            },
          ]}
        />
        <Text style={ringStyles.value}>{Math.round(pct)}%</Text>
      </View>
      <Text style={ringStyles.label}>{label}</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  col: { flex: 1, alignItems: 'center' },
  outer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    borderWidth: 6,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  value: { color: '#fff', fontWeight: '700', fontSize: 16 },
  label: { color: '#9CA3AF', fontSize: 12, marginTop: 10, textAlign: 'center' },
});

/** Driver performance — tier badge, metric rings, progress to next tier. */
export default function PerformanceScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/driver/performance`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setData(j.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const m = data?.metrics;
  const tier = String(m?.current_tier || 'lite').toLowerCase();
  const acceptance = Number(m?.acceptance_rate ?? 0);
  const cancellation = Number(m?.cancellation_rate ?? 0);
  const onTime = Number(m?.on_time_rate ?? 0);
  const rides = Number(m?.rides_completed ?? 0);
  const next = data?.nextTier;

  const ridesTarget = Number(next?.min_rides || rides || 1);
  const barPct = Math.min(100, (rides / Math.max(1, ridesTarget)) * 100);

  const tierLabel = loading
    ? '…'
    : `${tier.charAt(0).toUpperCase() + tier.slice(1)} tier`;

  const benefit = useMemo(() => {
    if (!next) return 'You are at the top tier. Keep up the quality.';
    if (String(next.tier) === 'premium') {
      return 'Premium unlocks priority matching and a lower subscription rate.';
    }
    return `${String(next.tier).charAt(0).toUpperCase()}${String(next.tier).slice(1)} unlocks priority matching and subscription discounts.`;
  }, [next]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Performance</Text>
      <View style={styles.tierRow}>
        <Text style={styles.tierIcon}>🏅</Text>
        <Text style={styles.tierText}>{tierLabel}</Text>
      </View>

      <View style={styles.metricsCard}>
        <Ring
          value={acceptance}
          label="Acceptance"
          color={colors.success}
          trackColor={colors.surface}
        />
        <Ring
          value={cancellation}
          label="Cancellation"
          color="#F5A9A0"
          trackColor={colors.surface}
        />
        <Ring
          value={onTime}
          label="On-time"
          color={colors.motionBlue}
          trackColor={colors.surface}
        />
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            {next ? `Progress to ${String(next.tier).charAt(0).toUpperCase()}${String(next.tier).slice(1)}` : 'Top tier'}
          </Text>
          <Text style={styles.progressCount}>
            {rides} / {ridesTarget} trips
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${barPct}%` }]} />
        </View>
        <Text style={styles.progressHint}>{benefit}</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: spacing[2],
      marginBottom: spacing[4],
    },
    tierIcon: { fontSize: 16 },
    tierText: { color: colors.warning, fontWeight: '700', fontSize: 15 },
    metricsCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      paddingVertical: spacing[5],
      paddingHorizontal: spacing[2],
      marginBottom: spacing[4],
    },
    progressCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[4],
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing[3],
    },
    progressTitle: { color: colors.pureWhite, fontWeight: '700' },
    progressCount: { color: colors.textSecondary, fontSize: 13 },
    barTrack: {
      height: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: radius.pill,
      // teal → purple → blue feel via layered opacity on violet base
      backgroundColor: colors.motionBlue,
    },
    progressHint: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: spacing[3],
      lineHeight: 18,
    },
  });
}
