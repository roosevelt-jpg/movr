import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

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

/** Redeem points — live catalog + balance (mockup: 1,280 pts). */
export default function RedeemPointsScreen({ onBack }: { onBack?: () => void }) {
  const [balance, setBalance] = useState(0);
  const [catalog, setCatalog] = useState<{ id: string; label: string; points: number }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/points/balance`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${API}/points/redeem-catalog`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([b, c]) => {
      if (b?.data?.balance != null) setBalance(Number(b.data.balance));
      if (Array.isArray(c?.data) && c.data.length) {
        setCatalog(c.data);
        setSelected(c.data[0].id);
      }
    });
  }, []);

  const choice = catalog.find((r) => r.id === selected) || null;

  const redeem = async () => {
    if (!choice) return;
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/points/redeem`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          rewardId: choice.id,
          points: choice.points,
          label: choice.label,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed');
      setBalance(json.data?.balance ?? Math.max(0, balance - choice.points));
      setMsg(`Redeemed · ${choice.points} pts`);
    } catch (e: any) {
      setMsg(e?.message || 'Redeem failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Redeem points</Text>
      <Text style={styles.sub}>You have {balance.toLocaleString()} points</Text>

      {catalog.length === 0 ? (
        <Text style={styles.empty}>No redeem options available right now.</Text>
      ) : (
        catalog.map((r) => (
          <Pressable
            key={r.id}
            style={[styles.card, selected === r.id && styles.cardOn]}
            onPress={() => setSelected(r.id)}
          >
            <Text style={styles.cardLabel}>{r.label}</Text>
            <Text style={styles.cardPts}>{r.points} pts</Text>
          </Pressable>
        ))
      )}

      <Pressable
        style={[styles.btn, (!choice || loading) && styles.btnDisabled]}
        onPress={redeem}
        disabled={!choice || loading}
      >
        <Text style={styles.btnText}>
          {loading ? 'Redeeming…' : choice ? `Redeem · ${choice.points} pts` : 'Redeem'}
        </Text>
      </Pressable>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
  back: { color: 'rgba(255,255,255,0.5)', marginBottom: spacing[3] },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.55)', marginTop: 8, marginBottom: spacing[5] },
  empty: { color: 'rgba(255,255,255,0.5)', marginBottom: spacing[5] },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardOn: { borderColor: '#3B5CFF' },
  cardLabel: { color: '#FFFFFF', fontWeight: '600', flex: 1, paddingRight: 8 },
  cardPts: { color: '#7EB6FF', fontWeight: '600' },
  btn: {
    marginTop: spacing[4],
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#3B5CFF',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  msg: { color: '#4ADE80', textAlign: 'center', marginTop: spacing[3] },
});
