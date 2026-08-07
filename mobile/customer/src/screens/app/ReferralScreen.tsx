import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, FlatList, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Invite friends — shareable code + milestone progress bars. */
export default function ReferralScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [code, setCode] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [invitedCount, setInvitedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = authHeaders();
    setLoading(true);
    Promise.all([
      fetch(`${API}/referrals/my-code`, { headers: h }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/referrals/progress`, { headers: h }).then((r) => r.json()).catch(() => null),
    ])
      .then(([c, p]) => {
        if (c?.data?.code) setCode(c.data.code);
        if (c?.data?.shareLink) setShareLink(c.data.shareLink);
        const list = p?.data?.referrals || [];
        setReferrals(list);
        setInvitedCount(Number(p?.data?.invitedCount ?? list.length));
      })
      .finally(() => setLoading(false));
  }, []);

  const share = async () => {
    await Share.share({
      message: `Join MOVR with my code ${code}: ${shareLink || `https://movr.io/r/${code}`}`,
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Invite friends</Text>
      <Text style={styles.sub}>Earn points when they take their first ride</Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Your code</Text>
        <Text style={styles.code}>{code || (loading ? '…' : '—')}</Text>
        <Pressable style={styles.shareBtn} onPress={share} disabled={!code}>
          <View style={styles.shareGlow} />
          <Text style={styles.shareText}>⬡  Share invite link</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>
          {invitedCount} friend{invitedCount === 1 ? '' : 's'} invited
        </Text>
      </View>

      {!loading && referrals.length === 0 ? (
        <Text style={styles.empty}>No referrals yet — share your code to get started</Text>
      ) : null}

      <FlatList
        data={referrals}
        keyExtractor={(i) => String(i.id)}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const progress = Number(item.progress ?? 0.2);
          const label =
            item.status_label ||
            (item.status === 'qualified'
              ? `Qualified · +${item.reward_points || 250} pts`
              : item.status === 'first_ride_pending' || item.status === 'first_ride_completed'
                ? 'First ride pending'
                : 'Signed up');
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>
                  {item.display_name || item.first_name || item.email || 'Friend'}
                </Text>
                <Text style={styles.cardStatus}>{label}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(8, progress * 100)}%` }]}>
                  <View style={styles.barGlow} />
                </View>
              </View>
            </View>
          );
        }}
      />
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
    title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
    sub: { color: '#888888', marginTop: 6, marginBottom: spacing[5], fontSize: 15 },
    codeCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: '#1A1A1A',
      padding: spacing[5],
      alignItems: 'center',
      marginBottom: spacing[5],
    },
    codeLabel: { color: '#888888', fontSize: 13 },
    code: {
      color: '#FFFFFF',
      fontSize: 32,
      fontWeight: '700',
      letterSpacing: 3,
      fontVariant: ['tabular-nums'],
      marginVertical: spacing[3],
    },
    shareBtn: {
      borderRadius: 999,
      paddingHorizontal: spacing[5],
      paddingVertical: 14,
      backgroundColor: '#8E2DE2',
      overflow: 'hidden',
      minWidth: '80%',
      alignItems: 'center',
    },
    shareGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#4A00E0',
      opacity: 0.55,
    },
    shareText: { color: '#FFFFFF', fontWeight: '700', zIndex: 1 },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: spacing[3],
    },
    section: { color: '#888888', fontSize: 14 },
    empty: { color: '#888888', marginBottom: spacing[4] },
    card: {
      backgroundColor: '#1A1A1A',
      borderRadius: 14,
      padding: spacing[4],
      marginBottom: spacing[3],
      overflow: 'hidden',
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    cardTitle: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
    cardStatus: { color: '#888888', fontSize: 13 },
    barTrack: {
      marginTop: spacing[3],
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 999,
      overflow: 'hidden',
    },
    barFill: {
      height: 4,
      backgroundColor: '#8E2DE2',
      borderRadius: 999,
      overflow: 'hidden',
    },
    barGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#4A00E0',
      opacity: 0.65,
    },
  });
}
