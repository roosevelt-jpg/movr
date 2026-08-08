import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const ICONS: Record<string, string> = { sprout: '🌱', bolt: '⚡', lock: '🔒' };

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** DVT Staking dashboard — summary + pools + Stake More (mockup). */
export default function StakingScreen({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<any>({
    staked: 500,
    apy: 14.5,
    rewardsEarned: 72.5,
    lockPeriodDays: 30,
    pools: [],
  });
  const [selected, setSelected] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API}/staking/dashboard`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setData(j.data);
          setSelected(j.data.yourPoolId || j.data.pools?.[1]?.id || '');
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const stakeMore = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/staking/stake`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ poolId: selected || data.yourPoolId, amount: 100 }),
      });
      const json = await res.json();
      setMsg(json.message || (res.ok ? 'Staked +100 DVT' : 'Stake queued'));
      load();
    } catch (e: any) {
      setMsg(e.message || 'Stake queued');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {onBack ? (
          <Pressable onPress={onBack} style={{ marginBottom: 8 }}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
        ) : null}

        <View style={styles.summary}>
          <Text style={styles.sumLab}>YOUR STAKED TOKENS</Text>
          <Text style={styles.sumVal}>{Number(data.staked || 0).toLocaleString()} DVT</Text>
          <View style={styles.sumRow}>
            <View>
              <Text style={styles.statLab}>APY</Text>
              <Text style={styles.apy}>{Number(data.apy || 0)}%</Text>
            </View>
            <View>
              <Text style={styles.statLab}>Rewards Earned</Text>
              <Text style={styles.statVal}>{Number(data.rewardsEarned || 0)} DVT</Text>
            </View>
            <View>
              <Text style={styles.statLab}>Lock Period</Text>
              <Text style={styles.statVal}>{Number(data.lockPeriodDays || 30)} days</Text>
            </View>
          </View>
        </View>

        {(data.pools || []).map((p: any) => (
          <Pressable
            key={p.id}
            onPress={() => setSelected(p.id)}
            style={[
              styles.pool,
              (p.isYourPool || selected === p.id) && styles.poolActive,
            ]}
          >
            {p.isYourPool ? (
              <View style={styles.yourBadge}>
                <Text style={styles.yourText}>YOUR POOL</Text>
              </View>
            ) : null}
            <View style={styles.poolIcon}>
              <Text>{ICONS[p.icon] || '🔒'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.poolName}>{p.name}</Text>
              <Text style={styles.poolSub}>{p.subtitle}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.poolApy}>{Number(p.apy)}%</Text>
              <Text style={styles.poolApyLab}>APY</Text>
            </View>
          </Pressable>
        ))}
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.stakeBtn} onPress={stakeMore} disabled={busy}>
          <Text style={styles.stakeText}>{busy ? 'Staking…' : 'Stake More'}</Text>
        </Pressable>
        <Pressable style={styles.unstakeBox} onPress={() => setMsg('Unstake available after lock')}>
          <Text style={styles.unstakeHint}> </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  back: { color: '#A78BFA', fontWeight: '700' },
  summary: {
    backgroundColor: '#1A1028',
    borderRadius: 18,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sumLab: { color: '#C4B5FD', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sumVal: { color: '#FFF', fontSize: 32, fontWeight: '800', marginTop: 8 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[4] },
  statLab: { color: '#A1A1AA', fontSize: 11 },
  apy: { color: '#4ADE80', fontWeight: '800', fontSize: 16, marginTop: 4 },
  statVal: { color: '#FFF', fontWeight: '700', fontSize: 15, marginTop: 4 },
  pool: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: spacing[3],
    marginBottom: 10,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  poolActive: { borderColor: '#8E2DE2' },
  yourBadge: {
    position: 'absolute',
    right: 10,
    top: 8,
    backgroundColor: '#8E2DE2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  yourText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  poolIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2E1065',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolName: { color: '#FFF', fontWeight: '800' },
  poolSub: { color: '#71717A', fontSize: 12, marginTop: 3 },
  poolApy: { color: '#4ADE80', fontWeight: '800', fontSize: 16 },
  poolApyLab: { color: '#71717A', fontSize: 11 },
  msg: { color: '#A1A1AA', textAlign: 'center', marginTop: 8 },
  footer: { flexDirection: 'row', gap: 10, paddingBottom: spacing[4] },
  stakeBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#6D28D9',
  },
  stakeText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  unstakeBox: {
    width: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  unstakeHint: { color: 'transparent' },
});
