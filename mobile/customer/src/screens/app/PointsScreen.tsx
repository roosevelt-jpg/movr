import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Points — total and this-month breakdown. */
export default function PointsScreen({ onRedeem }: { onRedeem?: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [totalPoints, setTotalPoints] = useState(0);
  const [breakdown, setBreakdown] = useState<
    { category: string; points: number; timeframe: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const h = authHeaders();
    fetch(`${API}/points/summary`, { headers: h })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setTotalPoints(Number(j.data.totalPoints || 0));
          const rows = (j.data.breakdown || []).filter(
            (row: any) =>
              !String(row.category || '')
                .toLowerCase()
                .includes('staking') &&
              !String(row.category || '')
                .toLowerCase()
                .includes('dvt')
          );
          setBreakdown(rows);
          return;
        }
        // Fallback if summary unavailable
        return Promise.all([
          fetch(`${API}/points/balance`, { headers: h }).then((r) => r.json()),
          fetch(`${API}/points/history`, { headers: h }).then((r) => r.json()),
        ]).then(([b, hist]) => {
          setTotalPoints(Number(b?.data?.balance || 0));
          const month = hist?.data?.byActivityMonth || [];
          const map: Record<string, number> = {
            Rides: 0,
            Orders: 0,
            Referrals: 0,
            Bonuses: 0,
          };
          const labels: Record<string, string> = {
            ride_completed: 'Rides',
            order_completed: 'Orders',
            delivery_completed: 'Orders',
            referral_qualified: 'Referrals',
            referral_confirmed: 'Referrals',
            bonus: 'Bonuses',
            promo: 'Bonuses',
          };
          for (const r of month) {
            const lab = labels[String(r.activity_type || '').toLowerCase()];
            if (lab) map[lab] += Number(r.points || 0);
          }
          setBreakdown(
            Object.entries(map).map(([category, points]) => ({
              category,
              points,
              timeframe: 'This month',
            }))
          );
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Movr points</Text>

      <View style={styles.hero}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />
        <Text style={styles.heroLabel}>Total points</Text>
        <Text style={styles.heroValue}>
          {loading ? '…' : Number(totalPoints).toLocaleString()}
        </Text>
        <Text style={styles.heroMeta}>Earn points on rides, orders, and referrals</Text>
      </View>

      <Text style={styles.section}>Breakdown</Text>
      {(breakdown.length
        ? breakdown
        : [
            { category: 'Rides', points: 0, timeframe: 'This month' },
            { category: 'Orders', points: 0, timeframe: 'This month' },
            { category: 'Referrals', points: 0, timeframe: 'This month' },
            { category: 'Bonuses', points: 0, timeframe: 'This month' },
          ]
      ).map((row) => (
        <View key={row.category} style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>{row.category}</Text>
            <Text style={styles.rowTime}>{row.timeframe || 'This month'}</Text>
          </View>
          <Text style={styles.rowPts}>
            +{Number(row.points).toLocaleString()} pts
          </Text>
        </View>
      ))}

      {onRedeem ? (
        <Pressable style={styles.redeemBtn} onPress={onRedeem}>
          <Text style={styles.redeemText}>Redeem points</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
    title: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
      marginBottom: spacing[4],
    },
    hero: {
      borderRadius: 20,
      paddingVertical: 40,
      paddingHorizontal: spacing[4],
      alignItems: 'center',
      backgroundColor: '#1a0a3c',
      overflow: 'hidden',
      marginBottom: spacing[5],
      minHeight: 160,
      justifyContent: 'center',
    },
    heroGlowA: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#2d1b6e',
      opacity: 0.9,
    },
    heroGlowB: {
      position: 'absolute',
      right: -40,
      bottom: -40,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: '#4A00E0',
      opacity: 0.45,
    },
    heroLabel: { color: 'rgba(255,255,255,0.85)', zIndex: 1, fontSize: 14 },
    heroValue: {
      color: '#FFFFFF',
      fontSize: 52,
      fontWeight: '700',
      marginVertical: 6,
      zIndex: 1,
    },
    heroMeta: {
      color: 'rgba(180,200,255,0.9)',
      fontSize: 14,
      zIndex: 1,
    },
    section: {
      color: '#888888',
      marginBottom: spacing[3],
      fontSize: 15,
      fontWeight: '500',
    },
    row: {
      backgroundColor: '#1A1A1A',
      borderRadius: 14,
      padding: spacing[4],
      marginBottom: spacing[3],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rowLabel: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
    rowTime: { color: '#888888', fontSize: 13, marginTop: 4 },
    rowPts: { color: '#7EB8FF', fontWeight: '700', fontSize: 15 },
    redeemBtn: {
      marginTop: spacing[4],
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.motionBlue,
    },
    redeemText: { color: '#FFFFFF', fontWeight: '700' },
  });
}
