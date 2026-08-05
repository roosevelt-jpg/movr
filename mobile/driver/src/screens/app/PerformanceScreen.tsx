import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

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
  suffix = '%',
}: {
  value: number;
  label: string;
  color: string;
  suffix?: string;
}) {
  return (
    <View style={styles.ringCol}>
      <View style={[styles.ringOuter, { borderColor: color }]}>
        <View style={[styles.ringTrack, { borderColor: colors.border }]} />
        <Text style={styles.ringValue}>
          {Math.round(value)}
          {suffix}
        </Text>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

/** Driver performance — tier badge, metric rings, progress to next tier. */
export default function PerformanceScreen() {
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
  const progress = data?.progressToNext;

  const needCopy = useMemo(() => {
    if (!next || !progress) return 'You are at the top tier. Keep up the quality.';
    const bits: string[] = [];
    if (progress.ridesNeeded > 0) bits.push(`${progress.ridesNeeded} more completed rides`);
    if (progress.acceptanceGap > 0) bits.push(`+${progress.acceptanceGap.toFixed(0)}% acceptance`);
    if (progress.cancellationGap > 0)
      bits.push(`−${progress.cancellationGap.toFixed(0)}% cancellations`);
    if (progress.onTimeGap > 0) bits.push(`+${progress.onTimeGap.toFixed(0)}% on-time`);
    if (!bits.length) return `Eligible for ${next.tier} — metrics refreshing.`;
    return `For ${String(next.tier).toUpperCase()}: need ${bits.join(', ')}.`;
  }, [next, progress]);

  const ridesTarget = Number(next?.min_rides || rides || 1);
  const barPct = Math.min(100, (rides / Math.max(1, ridesTarget)) * 100);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Performance</Text>
      <View style={styles.tierRow}>
        <Text style={styles.tierIcon}>🏅</Text>
        <Text style={styles.tierText}>
          {loading ? '…' : `${tier.charAt(0).toUpperCase() + tier.slice(1)} tier`}
        </Text>
      </View>

      <View style={styles.metricsCard}>
        <Ring value={acceptance} label="Acceptance" color={colors.success} />
        <Ring value={cancellation} label="Cancel rate" color={colors.error} />
        <Ring value={onTime} label="On-time" color={colors.motionBlue} />
        <Ring value={rides} label="Rides" color={colors.electricViolet} suffix="" />
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            {next ? `Progress to ${String(next.tier)}` : 'Top tier'}
          </Text>
          <Text style={styles.progressCount}>
            {rides} / {ridesTarget} trips
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${barPct}%` }]} />
        </View>
        <Text style={styles.progressHint}>{needCopy}</Text>
        {next ? (
          <Text style={styles.progressHint}>
            Premium/Pro unlock priority matching and subscription discounts.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[2],
    marginBottom: spacing[4],
  },
  ringCol: { flex: 1, alignItems: 'center' },
  ringOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 5,
    opacity: 0.25,
  },
  ringValue: { color: colors.pureWhite, fontWeight: '700', fontSize: 14 },
  ringLabel: { color: colors.textSecondary, fontSize: 11, marginTop: spacing[2], textAlign: 'center' },
  progressCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.electricViolet,
  },
  progressHint: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing[3],
    lineHeight: 18,
  },
});
