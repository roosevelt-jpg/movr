import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function DashboardScreen() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/driver/performance`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, []);

  const m = data?.metrics;
  const next = data?.progressToNext;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Performance</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{(m?.current_tier || 'lite').toUpperCase()}</Text>
      </View>

      <View style={styles.grid}>
        {[
          ['Acceptance', m?.acceptance_rate],
          ['Cancellation', m?.cancellation_rate],
          ['On-time', m?.on_time_rate],
          ['Rides', m?.rides_completed],
        ].map(([label, value]) => (
          <View key={String(label)} style={styles.ring}>
            <Text style={styles.ringValue}>{value ?? '—'}</Text>
            <Text style={styles.ringLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {next ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next tier</Text>
          <Text style={styles.meta}>
            Need {next.ridesNeeded} more rides · +{next.acceptanceGap}% acceptance ·
            -{next.cancellationGap}% cancels · +{next.onTimeGap}% on-time
          </Text>
        </View>
      ) : (
        <Text style={styles.meta}>You are at the top tier. Keep 100% earnings via subscription.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  badge: {
    alignSelf: 'flex-start',
    marginVertical: spacing[4],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.electricViolet,
  },
  badgeText: { color: colors.pureWhite, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  ring: {
    width: '46%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    alignItems: 'center',
  },
  ringValue: { color: colors.pureWhite, fontSize: 24, fontWeight: '700' },
  ringLabel: { color: colors.textSecondary, marginTop: spacing[2], fontSize: 12 },
  card: {
    marginTop: spacing[5],
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '600', marginBottom: spacing[2] },
  meta: { color: colors.textSecondary },
});
