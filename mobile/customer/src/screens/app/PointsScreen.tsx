import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function PointsScreen() {
  const [balance, setBalance] = useState(0);
  const [estimate, setEstimate] = useState<any>(null);
  const [byActivity, setByActivity] = useState<any[]>([]);

  useEffect(() => {
    // Wire auth token from app store when available
    Promise.all([
      fetch(`${API}/points/balance`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/history`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/estimated-dvt`).then((r) => r.json()).catch(() => null),
    ]).then(([b, h, e]) => {
      if (b?.data?.balance != null) setBalance(b.data.balance);
      if (h?.data?.byActivity) setByActivity(h.data.byActivity);
      if (e?.data) setEstimate(e.data);
    });
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Points</Text>
      <Text style={styles.balance}>{balance}</Text>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Estimated DVT at TGE: {estimate?.estimatedDvt?.toFixed?.(2) ?? '—'}
        </Text>
      </View>
      <FlatList
        data={byActivity}
        keyExtractor={(i) => i.activity_type}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{item.activity_type}</Text>
            <Text style={styles.rowValue}>{item.points}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  balance: { color: colors.pureWhite, fontSize: 40, fontWeight: '700', marginVertical: spacing[3] },
  banner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.electricViolet,
  },
  bannerText: { color: colors.pureWhite, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textSecondary, textTransform: 'capitalize' },
  rowValue: { color: colors.pureWhite, fontWeight: '600' },
});
