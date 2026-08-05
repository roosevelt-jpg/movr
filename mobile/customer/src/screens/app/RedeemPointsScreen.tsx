import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Redeem points — catalog + redeem CTA. */
export default function RedeemPointsScreen({ onBack }: { onBack?: () => void }) {
  const [balance, setBalance] = useState(0);
  const [catalog, setCatalog] = useState<{ id: string; label: string; points: number }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`${API}/points/balance`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/redeem-catalog`).then((r) => r.json()).catch(() => null),
    ]).then(([b, c]) => {
      if (b?.data?.balance != null) setBalance(Number(b.data.balance));
      if (Array.isArray(c?.data)) {
        setCatalog(c.data);
        if (c.data.length) setSelected(c.data[0].id);
      }
    });
  }, []);

  const choice = catalog.find((r) => r.id === selected) || null;

  const redeem = async () => {
    if (!choice) return;
    setMsg('');
    try {
      const res = await fetch(`${API}/points/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        style={[styles.btn, !choice && styles.btnDisabled]}
        onPress={redeem}
        disabled={!choice}
      >
        <Text style={styles.btnText}>
          {choice ? `Redeem · ${choice.points} pts` : 'Redeem'}
        </Text>
      </Pressable>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  back: { color: colors.textSecondary, marginBottom: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: 8, marginBottom: spacing[5] },
  empty: { color: colors.textSecondary, marginBottom: spacing[5] },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardOn: { borderColor: colors.motionBlue },
  cardLabel: { color: colors.pureWhite, fontWeight: '600', flex: 1, paddingRight: 8 },
  cardPts: { color: colors.motionBlue, fontWeight: '600' },
  btn: {
    marginTop: spacing[4],
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.motionBlue,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  msg: { color: colors.success, textAlign: 'center', marginTop: spacing[3] },
});
