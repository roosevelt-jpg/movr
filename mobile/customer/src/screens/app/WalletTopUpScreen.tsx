import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const PRESETS = [50, 100, 200];

/** Top up wallet — amount + MoMo / Visa. */
export default function WalletTopUpScreen({
  onDone,
  onBack,
}: {
  onDone?: () => void;
  onBack?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [amount, setAmount] = useState(200);
  const [method, setMethod] = useState<'momo' | 'visa'>('momo');
  const [msg, setMsg] = useState('');

  const topUp = async () => {
    setMsg('');
    try {
      await fetch(`${API}/wallet/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method }),
      });
    } catch {
      /* demo ok */
    }
    setMsg(`Top up GH₵${amount} initiated`);
    onDone?.();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Wallet</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Top up wallet</Text>

      <Text style={styles.label}>Amount</Text>
      <View style={styles.amountBox}>
        <Text style={styles.amount}>GH₵{amount.toFixed(2)}</Text>
      </View>
      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            style={[styles.preset, amount === p && styles.presetOn]}
            onPress={() => setAmount(p)}
          >
            <Text style={styles.presetText}>GH₵{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: spacing[5] }]}>Pay with</Text>
      {(
        [
          { id: 'momo' as const, label: 'MTN MoMo · ****4471' },
          { id: 'visa' as const, label: 'Visa · ****8821' },
        ] as const
      ).map((m) => (
        <Pressable
          key={m.id}
          style={[styles.pay, method === m.id && styles.payOn]}
          onPress={() => setMethod(m.id)}
        >
          <Text style={styles.payText}>👛  {m.label}</Text>
          {method === m.id ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>
      ))}

      <Pressable style={styles.btn} onPress={topUp}>
        <Text style={styles.btnText}>Top up GH₵{amount}</Text>
      </Pressable>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  back: { color: colors.textSecondary, marginBottom: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[5] },
  label: { color: colors.textSecondary, marginBottom: spacing[2], fontSize: 13 },
  amountBox: {
    borderWidth: 2,
    borderColor: colors.motionBlue,
    borderRadius: radius.md,
    paddingVertical: spacing[5],
    marginBottom: spacing[3],
  },
  amount: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  presets: { flexDirection: 'row', gap: 8 },
  preset: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetOn: { borderColor: 'transparent', backgroundColor: colors.motionBlue },
  presetText: { color: colors.pureWhite, fontWeight: '700' },
  pay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  payOn: { borderColor: colors.motionBlue, backgroundColor: colors.surface },
  payText: { color: colors.pureWhite, fontWeight: '500' },
  check: {
    color: colors.pureWhite,
    backgroundColor: colors.motionBlue,
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    overflow: 'hidden',
    lineHeight: 22,
    fontSize: 12,
  },
  btn: {
    marginTop: spacing[6],
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.motionBlue,
  },
  btnText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  msg: { color: colors.success, textAlign: 'center', marginTop: spacing[3] },
});
}
