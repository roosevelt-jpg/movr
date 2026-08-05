import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TIPS = [0, 2, 5, 10] as const;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Post-ride tip prompt — 100% credited to driver via POST /rides/:id/tip. */
export default function TipPromptScreen({
  rideId,
  driverName = 'your driver',
  currency = 'GHS',
  onSkip,
  onDone,
}: {
  rideId?: string;
  driverName?: string;
  currency?: string;
  onSkip?: () => void;
  onDone?: (amount: number) => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [amount, setAmount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!rideId || amount <= 0) {
      onSkip?.();
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/rides/${rideId}/tip`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount, currency }),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setMsg(json.message || 'Tip failed');
      } else {
        setMsg('Tip sent — 100% to your driver');
        onDone?.(amount);
      }
    } catch (e: any) {
      setMsg(e.message || 'Tip failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Add a tip?</Text>
      <Text style={styles.sub}>
        100% goes to {driverName}. Tips help drivers earn more on every trip.
      </Text>

      <View style={styles.row}>
        {TIPS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setAmount(t)}
            style={[styles.chip, amount === t && styles.chipOn]}
          >
            <Text style={[styles.chipText, amount === t && styles.chipTextOn]}>
              {t === 0 ? 'No tip' : formatCurrency(t, currency)}
            </Text>
          </Pressable>
        ))}
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={busy}>
        <Text style={styles.ctaText}>
          {busy ? 'Sending…' : amount > 0 ? `Tip ${formatCurrency(amount, currency)}` : 'Continue'}
        </Text>
      </Pressable>
      <Pressable onPress={onSkip}>
        <Text style={styles.skip}>Skip</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4], justifyContent: 'center' },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  sub: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[3],
    marginBottom: spacing[6],
    lineHeight: 22,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], justifyContent: 'center' },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  chipOn: { borderColor: colors.motionBlue, backgroundColor: colors.surfaceElevated },
  chipText: { color: colors.textSecondary, fontWeight: '600' },
  chipTextOn: { color: colors.pureWhite },
  msg: { color: colors.success, textAlign: 'center', marginTop: spacing[4] },
  cta: {
    marginTop: spacing[6],
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  skip: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[4],
    fontWeight: '600',
  },
});
}
