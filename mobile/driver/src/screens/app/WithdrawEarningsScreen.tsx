import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

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

/** Driver withdraw earnings — MoMo destination + withdraw now (mockup). */
export default function WithdrawEarningsScreen() {
  const [available, setAvailable] = useState(1640);
  const [amount, setAmount] = useState('1640.00');
  const [method, setMethod] = useState({ label: 'MTN MoMo', mask: '****4471' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/driver/earnings/balance`, { headers: authHeaders() })
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

  const changeMethod = async () => {
    const next = method.label.includes('MTN')
      ? { label: 'Vodafone Cash', mask: '****8821' }
      : { label: 'MTN MoMo', mask: '****4471' };
    setMethod(next);
    await fetch(`${API}/driver/payout-methods/default`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ provider: next.label, mask: next.mask }),
    }).catch(() => undefined);
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
        headers: authHeaders(),
        body: JSON.stringify({
          amount: n,
          currency: 'GHS',
          channel: method.label,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg('Withdrawal requested');
        setAvailable((a) => Math.max(0, a - n));
        setAmount(Math.max(0, available - n).toFixed(2));
      } else {
        setMsg(json.message || 'Withdrawal failed');
      }
    } catch {
      setMsg('Network error — try again');
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
        value={`GH₵${Number(amount || 0).toLocaleString('en-GH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Withdraw to</Text>
      <View style={styles.method}>
        <Text style={styles.methodText}>
          {method.label} · {method.mask}
        </Text>
        <Pressable onPress={changeMethod}>
          <Text style={styles.change}>Change</Text>
        </Pressable>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={withdraw} disabled={loading}>
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Processing…' : 'Withdraw now'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: spacing[5] },
  balanceCard: {
    borderRadius: 20,
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[5],
    marginBottom: spacing[5],
    overflow: 'hidden',
    backgroundColor: '#6345ED',
    alignItems: 'center',
  },
  balanceGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1E3A8A',
    opacity: 0.55,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', zIndex: 1, fontSize: 13 },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 8,
    zIndex: 1,
  },
  label: { color: '#A1A1AA', marginBottom: 8, fontSize: 13 },
  inputFocus: {
    backgroundColor: '#000000',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#6345ED',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing[4],
    fontSize: 16,
    fontWeight: '700',
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: spacing[5],
  },
  methodText: { flex: 1, color: '#FFFFFF', fontWeight: '600' },
  change: { color: '#5B8AFF', fontWeight: '700' },
  msg: { color: '#A1A1AA', marginBottom: spacing[3] },
  cta: {
    marginTop: 'auto' as any,
    marginBottom: spacing[4],
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#6345ED',
  },
  ctaLeft: { ...StyleSheet.absoluteFillObject, backgroundColor: '#6345ED' },
  ctaRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.75,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
