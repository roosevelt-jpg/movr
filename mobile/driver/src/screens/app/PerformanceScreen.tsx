import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function Ring({
  value,
  label,
  color,
  max = 100,
}: {
  value: number;
  label: string;
  color: string;
  max?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={styles.ringCol}>
      <View style={[styles.ringOuter, { borderColor: color }]}>
        <View style={[styles.ringTrack, { borderColor: colors.border }]} />
        <Text style={styles.ringValue}>{Math.round(value)}%</Text>
      </View>
      {/* Simple arc hint via colored top border weight */}
      <View style={[styles.ringAccent, { backgroundColor: color, width: `${Math.max(8, pct * 0.4)}%` as any }]} />
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

/** Driver performance — tier badge, metric rings, progress to Premium. */
export default function PerformanceScreen() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/driver/performance`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, []);

  const m = data?.metrics;
  const tier = String(m?.current_tier || 'pro').toLowerCase();
  const acceptance = Number(m?.acceptance_rate ?? 94);
  const cancellation = Number(m?.cancellation_rate ?? 3);
  const onTime = Number(m?.on_time_rate ?? 97);
  const rides = Number(m?.rides_completed ?? 340);
  const nextTarget = Number(data?.progressToNext?.ridesTarget || 500);
  const progress = Math.min(1, rides / nextTarget);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Performance</Text>
      <View style={styles.tierRow}>
        <Text style={styles.tierIcon}>🏅</Text>
        <Text style={styles.tierText}>
          {tier.charAt(0).toUpperCase() + tier.slice(1)} tier
        </Text>
      </View>

      <View style={styles.metricsCard}>
        <Ring value={acceptance} label="Acceptance" color={colors.success} />
        <Ring value={cancellation} label="Cancellation" color={colors.error} />
        <Ring value={onTime} label="On-time" color={colors.motionBlue} />
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Progress to Premium</Text>
          <Text style={styles.progressCount}>
            {rides} / {nextTarget} trips
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressHint}>
          Premium unlocks priority matching and a lower subscription rate.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[2], marginBottom: spacing[4] },
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
    paddingHorizontal: spacing[3],
    marginBottom: spacing[4],
  },
  ringCol: { flex: 1, alignItems: 'center' },
  ringOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    borderWidth: 6,
    opacity: 0.25,
  },
  ringAccent: { height: 0 },
  ringValue: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  ringLabel: { color: colors.textSecondary, fontSize: 12, marginTop: spacing[2] },
  progressCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
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
  progressHint: { color: colors.textSecondary, fontSize: 13, marginTop: spacing[3], lineHeight: 18 },
});
