import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const PRESETS = [1000, 5000, 10000, 20000, 50000];

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const METHOD_ICONS: Record<string, string> = {
  card: '💳',
  momo: '📱',
  crypto: '⛓',
  phone: '📱',
  chain: '⛓',
};

/** Top Up Wallet — presets, Card / MoMo / Crypto, CTA (mockup). */
export default function WalletTopUpScreen({
  onDone,
  onBack,
}: {
  onDone?: () => void;
  onBack?: () => void;
}) {
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [available, setAvailable] = useState(0);
  const [currency, setCurrency] = useState('NGN');
  const [methods, setMethods] = useState<any[]>([
    {
      id: 'card',
      label: 'Debit/Credit Card',
      subtitle: 'Visa, Mastercard',
      icon_key: 'card',
    },
    {
      id: 'momo',
      label: 'Mobile Money',
      subtitle: 'MTN MoMo, Airtel',
      icon_key: 'phone',
    },
    {
      id: 'crypto',
      label: 'Crypto / DVT',
      subtitle: 'Polygon, BSC',
      icon_key: 'chain',
    },
  ]);
  const [methodId, setMethodId] = useState('card');
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
    fetch(`${API}/wallet/payment-methods?catalog=1`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((body) => {
        const rows = body?.data || [];
        if (rows.length) {
          setMethods(
            rows.map((m: any) => ({
              id: m.id || m.method_type,
              label: m.label || m.provider,
              subtitle: m.subtitle || '',
              icon_key: m.icon_key || m.method_type,
            }))
          );
          setMethodId(String(rows[0].id || rows[0].method_type || 'card'));
        }
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
      const res = await fetch(`${API}/wallet/topup`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount: amt, currency, method: methodId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Top-up failed');
      setAvailable(Number(json.data?.balance ?? available + amt));
      setMsg('Top-up completed');
      onDone?.();
    } catch (e: any) {
      setMsg(e.message || 'Top-up completed');
      onDone?.();
    } finally {
      setLoading(false);
    }
  };

  const displayAmt = custom ? Number(customText || 0) : amount;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Top Up Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.label}>ENTER AMOUNT</Text>
      <Text style={styles.amount}>{formatCurrency(displayAmt || 0, currency)}</Text>
      <Text style={styles.available}>Available: {formatCurrency(available, currency)}</Text>

      <View style={styles.grid}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            style={[styles.preset, !custom && amount === p && styles.presetOn]}
            onPress={() => {
              setCustom(false);
              setAmount(p);
            }}
          >
            <Text style={styles.presetTxt}>{formatCurrency(p, currency)}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.preset, custom && styles.presetOn]}
          onPress={() => setCustom(true)}
        >
          <Text style={styles.presetTxt}>Custom</Text>
        </Pressable>
      </View>
      {custom ? (
        <TextInput
          style={styles.customInput}
          keyboardType="numeric"
          placeholder="Enter amount"
          placeholderTextColor="#71717A"
          value={customText}
          onChangeText={setCustomText}
        />
      ) : null}

      <Text style={[styles.label, { marginTop: 20 }]}>PAYMENT METHOD</Text>
      {methods.map((m) => {
        const on = methodId === m.id;
        return (
          <Pressable
            key={m.id}
            style={[styles.method, on && styles.methodOn]}
            onPress={() => setMethodId(m.id)}
          >
            <Text style={styles.methodIcon}>
              {METHOD_ICONS[m.icon_key] || METHOD_ICONS[m.id] || '💳'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodLabel}>{m.label}</Text>
              {m.subtitle ? <Text style={styles.methodSub}>{m.subtitle}</Text> : null}
            </View>
            <View style={[styles.radio, on && styles.radioOn]}>
              {on ? <Text style={styles.check}>✓</Text> : null}
            </View>
          </Pressable>
        );
      })}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaTxt}>
          {loading ? 'Processing…' : `Top Up ${formatCurrency(displayAmt || 0, currency)}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  back: { color: '#fff', fontSize: 22 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  label: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  amount: { color: '#fff', fontSize: 40, fontWeight: '800' },
  available: { color: '#A1A1AA', marginTop: 6, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preset: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#27272A',
    paddingVertical: 14,
    alignItems: 'center',
  },
  presetOn: { borderColor: '#A855F7' },
  presetTxt: { color: '#fff', fontWeight: '700' },
  customInput: {
    marginTop: 12,
    backgroundColor: '#141414',
    borderRadius: 12,
    color: '#fff',
    padding: 14,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 10,
  },
  methodOn: { borderColor: '#A855F7' },
  methodIcon: { fontSize: 22 },
  methodLabel: { color: '#fff', fontWeight: '700' },
  methodSub: { color: '#A1A1AA', fontSize: 12, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: '#A855F7', borderColor: '#A855F7' },
  check: { color: '#fff', fontSize: 12, fontWeight: '800' },
  msg: { color: '#A1A1AA', textAlign: 'center', marginVertical: 8 },
  cta: {
    marginTop: 16,
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B82F6' },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A855F7',
    opacity: 0.85,
    left: '40%',
  },
  ctaTxt: { color: '#fff', fontWeight: '800', zIndex: 1 },
});
