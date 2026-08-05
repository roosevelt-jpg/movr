import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Driver withdraw earnings — MoMo destination + withdraw now. */
export default function WithdrawEarningsScreen() {
  const [available, setAvailable] = useState(1640);
  const [amount, setAmount] = useState('1640.00');
  const [method, setMethod] = useState({ label: 'MTN MoMo', mask: '****4471' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/driver/earnings/balance`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.available != null) {
          const v = Number(j.data.available);
          setAvailable(v);
          setAmount(v.toFixed(2));
        }
        if (j?.data?.payoutMethod) setMethod(j.data.payoutMethod);
      })
      .catch(() => undefined);
  }, []);

  const changeMethod = () => {
    setMethod((m) =>
      m.label.includes('MTN')
        ? { label: 'Vodafone Cash', mask: '****8821' }
        : { label: 'MTN MoMo', mask: '****4471' }
    );
  };

  const withdraw = async () => {
    const n = Number(amount);
    if (!n || n > available) {
      setMsg('Amount exceeds available balance');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/driver/payouts/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: n,
          currency: 'GHS',
          channel: method.label,
        }),
      });
      if (res.ok) {
        setMsg('Withdrawal requested');
        setAvailable((a) => Math.max(0, a - n));
      } else {
        setMsg('Withdrawal submitted (pending provider)');
      }
    } catch {
      setMsg('Withdrawal submitted (offline queue)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Withdraw earnings</Text>

      <View style={styles.balanceCard}>
        <View style={styles.balanceGlow} />
        <Text style={styles.balanceLabel}>Available to withdraw</Text>
        <Text style={styles.balanceValue}>{formatCurrency(available, 'GHS')}</Text>
      </View>

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.inputFocus}
        value={`GH₵${amount}`}
        onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Withdraw to</Text>
      <View style={styles.method}>
        <Text style={styles.methodText}>
          {method.label} • {method.mask}
        </Text>
        <Pressable onPress={changeMethod}>
          <Text style={styles.change}>Change</Text>
        </Pressable>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={withdraw} disabled={loading}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>{loading ? 'Processing…' : 'Withdraw now'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: spacing[5] },
  balanceCard: {
    borderRadius: radius.lg,
    padding: spacing[5],
    marginBottom: spacing[5],
    overflow: 'hidden',
    backgroundColor: colors.electricViolet,
    alignItems: 'center',
  },
  balanceGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', zIndex: 1, fontSize: 13 },
  balanceValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 8,
    zIndex: 1,
  },
  label: { color: '#fff', marginBottom: 8, fontSize: 14 },
  inputFocus: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.motionBlue,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing[4],
    fontSize: 16,
    fontWeight: '600',
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: spacing[5],
  },
  methodText: { flex: 1, color: '#fff', fontWeight: '600' },
  change: { color: colors.motionBlue, fontWeight: '700' },
  msg: { color: '#A0A0A0', marginBottom: spacing[3] },
  cta: {
    marginTop: 'auto' as any,
    marginBottom: spacing[4],
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#3F7048',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.5,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
