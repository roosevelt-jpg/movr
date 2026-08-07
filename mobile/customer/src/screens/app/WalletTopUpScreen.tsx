import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const PRESETS = [50, 100, 200];

type PayMethod = {
  id: string;
  provider: string;
  method_type: string;
  label: string;
  last_four: string;
  is_default?: boolean;
};

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Top up wallet — amount + live MoMo / Visa methods. */
export default function WalletTopUpScreen({
  onDone,
  onBack,
}: {
  onDone?: () => void;
  onBack?: () => void;
}) {
  const [amount, setAmount] = useState(200);
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [methodId, setMethodId] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/wallet/payment-methods`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((body) => {
        const rows: PayMethod[] = body?.data || [];
        setMethods(
          rows.length
            ? rows
            : [
                {
                  id: 'momo',
                  provider: 'MTN MoMo',
                  method_type: 'momo',
                  label: 'MTN MoMo',
                  last_four: '4471',
                  is_default: true,
                },
                {
                  id: 'visa',
                  provider: 'Visa',
                  method_type: 'visa',
                  label: 'Visa',
                  last_four: '8821',
                  is_default: false,
                },
              ]
        );
        const def = rows.find((m) => m.is_default) || rows[0];
        setMethodId(String(def?.id || 'momo'));
      })
      .catch(() => {
        setMethods([
          {
            id: 'momo',
            provider: 'MTN MoMo',
            method_type: 'momo',
            label: 'MTN MoMo',
            last_four: '4471',
            is_default: true,
          },
          {
            id: 'visa',
            provider: 'Visa',
            method_type: 'visa',
            label: 'Visa',
            last_four: '8821',
            is_default: false,
          },
        ]);
        setMethodId('momo');
      });
  }, []);

  const selected = methods.find((m) => String(m.id) === String(methodId)) || methods[0];

  const topUp = async () => {
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/wallet/topup`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount,
          method: selected?.method_type || 'momo',
          paymentMethodId: selected?.id,
          currency: 'GHS',
        }),
      });
      const json = await res.json();
      if (json.status === 'error') {
        setMsg(json.message || 'Top-up failed');
        return;
      }
      setMsg(`Top up GH₵${amount} completed`);
      onDone?.();
    } catch {
      setMsg('Top-up failed — check connection');
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.amount}>{formatCurrency(amount, 'GHS')}</Text>
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
      {methods.map((m) => {
        const on = String(m.id) === String(methodId);
        return (
          <Pressable
            key={m.id}
            style={[styles.pay, on && styles.payOn]}
            onPress={() => setMethodId(String(m.id))}
          >
            <Text style={styles.payText}>
              💳  {m.label || m.provider} · ****{m.last_four}
            </Text>
            {on ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        );
      })}

      <Pressable style={styles.btn} onPress={topUp} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Top up GH₵{amount}</Text>
        )}
      </Pressable>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
  back: { color: '#A1A1AA', marginBottom: spacing[3] },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: spacing[5] },
  label: { color: '#A1A1AA', marginBottom: spacing[2], fontSize: 13 },
  amountBox: {
    borderWidth: 2,
    borderColor: '#3B5CFF',
    borderRadius: radius.md,
    paddingVertical: spacing[5],
    marginBottom: spacing[3],
    backgroundColor: '#111111',
  },
  amount: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  presets: { flexDirection: 'row', gap: 8 },
  preset: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  presetOn: { backgroundColor: '#3B5CFF' },
  presetText: { color: '#FFFFFF', fontWeight: '700' },
  pay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  payOn: { borderColor: '#3B5CFF', backgroundColor: '#111111' },
  payText: { color: '#FFFFFF', fontWeight: '500' },
  check: {
    color: '#FFFFFF',
    backgroundColor: '#3B5CFF',
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
    backgroundColor: '#3B5CFF',
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  msg: { color: '#4ade80', textAlign: 'center', marginTop: spacing[3] },
});
