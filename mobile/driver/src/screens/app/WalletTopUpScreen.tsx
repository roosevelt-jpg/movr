import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Linking } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const PRESETS = [50, 100, 200, 500, 1000];

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Driver wallet top-up via saved card or MoMo. */
export default function WalletTopUpScreen({
  onDone,
  onBack,
}: {
  onDone?: () => void;
  onBack?: () => void;
}) {
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [available, setAvailable] = useState(0);
  const [currency, setCurrency] = useState('GHS');
  const [methodId, setMethodId] = useState('momo');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/wallet/portfolio`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.fiatBalance != null) setAvailable(Number(j.data.fiatBalance));
        if (j?.data?.currency) setCurrency(j.data.currency);
      })
      .catch(() => undefined);
  }, []);

  const submit = async () => {
    const amt = custom ? Number(customText || 0) : amount;
    if (!amt || amt <= 0) {
      setMsg('Enter a valid amount');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const checkout = await fetch(`${API}/rails/credit/checkout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount: amt,
          currency,
          source: methodId === 'card' ? 'card' : 'momo',
        }),
      });
      const json = await checkout.json();
      if (checkout.ok && (json.data?.payment?.paymentLink || json.data?.mode === 'instant' || json.data?.demo)) {
        const link = json.data?.payment?.paymentLink;
        if (link) Linking.openURL(link).catch(() => undefined);
        setMsg(link ? 'Complete card/MoMo payment' : 'Wallet topped up');
        onDone?.();
        return;
      }
      const res = await fetch(`${API}/wallet/topup`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount: amt, currency, source: methodId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Top-up failed');
      setMsg('Wallet topped up');
      onDone?.();
    } catch (e: any) {
      setMsg(e.message || 'Top-up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Top up wallet</Text>
      <Text style={styles.bal}>
        Balance {formatCurrency(available, currency)}
      </Text>
      <View style={styles.row}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            onPress={() => {
              setCustom(false);
              setAmount(p);
            }}
            style={[styles.chip, !custom && amount === p && styles.chipOn]}
          >
            <Text style={styles.chipText}>{formatCurrency(p, currency)}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Custom amount"
        placeholderTextColor="#71717A"
        keyboardType="numeric"
        value={custom ? customText : ''}
        onChangeText={(t) => {
          setCustom(true);
          setCustomText(t);
        }}
      />
      <Text style={styles.lab}>Pay with</Text>
      {[
        { id: 'momo', label: 'Mobile Money' },
        { id: 'card', label: 'Saved card' },
      ].map((m) => (
        <Pressable
          key={m.id}
          onPress={() => setMethodId(m.id)}
          style={[styles.method, methodId === m.id && styles.methodOn]}
        >
          <Text style={styles.methodText}>{m.label}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <Text style={styles.ctaText}>{loading ? '…' : 'Top up'}</Text>
      </Pressable>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', padding: spacing[4] },
  back: { color: '#A1A1AA', marginBottom: 12 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  bal: { color: '#A1A1AA', marginVertical: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { borderColor: '#8B5CF6', backgroundColor: '#1E1B4B' },
  chipText: { color: '#FFF', fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    color: '#FFF',
    padding: 12,
    marginBottom: 16,
  },
  lab: { color: '#A1A1AA', fontWeight: '700', marginBottom: 8 },
  method: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    marginBottom: 8,
  },
  methodOn: { borderColor: '#8B5CF6' },
  methodText: { color: '#FFF', fontWeight: '700' },
  cta: {
    marginTop: 12,
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#FFF', fontWeight: '800' },
  msg: { color: '#4ADE80', textAlign: 'center', marginTop: 12 },
});
