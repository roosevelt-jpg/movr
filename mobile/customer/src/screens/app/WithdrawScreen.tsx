import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';
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

/** Customer wallet Withdraw — amount chips, SEND TO methods (mockup). */
export default function WithdrawScreen({ onBack }: { onBack?: () => void }) {
  const [available, setAvailable] = useState(18400);
  const [currency, setCurrency] = useState('NGN');
  const [amount, setAmount] = useState('10000');
  const [minAmount, setMinAmount] = useState(500);
  const [feeLabel, setFeeLabel] = useState('Free');
  const [chips, setChips] = useState([2000, 5000, 10000]);
  const [methods, setMethods] = useState<any[]>([
    {
      id: 'visa',
      type: 'card',
      title: 'VISA •••• 4821',
      subtitle: 'Instant · Kwame Asante',
      selected: true,
    },
    {
      id: 'momo',
      type: 'momo',
      title: 'MTN MoMo',
      subtitle: '+234 801 234 5678',
      selected: false,
    },
  ]);
  const [methodId, setMethodId] = useState('visa');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/wallet/withdraw/options`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (!d) return;
        setAvailable(Number(d.available || 18400));
        setCurrency(d.currency || 'NGN');
        setMinAmount(Number(d.minAmount || 500));
        setFeeLabel(d.feeLabel || 'Free');
        if (Array.isArray(d.chips) && d.chips.length) setChips(d.chips);
        if (Array.isArray(d.methods) && d.methods.length) {
          setMethods(d.methods);
          const def = d.methods.find((m: any) => m.selected) || d.methods[0];
          setMethodId(def.id);
        }
      })
      .catch(() => undefined);
  }, []);

  const n = Number(String(amount).replace(/,/g, '')) || 0;
  const selected = methods.find((m) => m.id === methodId) || methods[0];

  const setChip = (v: number | 'all') => {
    if (v === 'all') setAmount(String(Math.floor(available)));
    else setAmount(String(v));
  };

  const withdraw = async () => {
    if (n < minAmount) {
      setMsg(`Minimum is ${formatCurrency(minAmount, currency)}`);
      return;
    }
    if (n > available) {
      setMsg('Amount exceeds available balance');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/wallet/withdraw`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount: n,
          methodId: selected?.id,
          methodLabel: selected?.title,
        }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg(j?.data?.message || 'Withdrawal requested');
        if (j?.data?.available != null) setAvailable(Number(j.data.available));
      } else {
        setMsg(j?.message || 'Withdrawal failed');
      }
    } catch {
      setMsg('Network error');
    } finally {
      setBusy(false);
    }
  };

  const chipActive = useMemo(() => {
    if (n === Math.floor(available)) return 'all';
    return chips.includes(n) ? n : null;
  }, [n, available, chips]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <View style={styles.top}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>Withdraw</Text>
      </View>

      <View style={styles.balance}>
        <Text style={styles.balLab}>AVAILABLE TO WITHDRAW</Text>
        <Text style={styles.balVal}>{formatCurrency(available, currency)}</Text>
        <Text style={styles.balSub}>Wallet balance · Instant payout available</Text>
      </View>

      <Text style={styles.section}>ENTER AMOUNT</Text>
      <View style={styles.amountBox}>
        <Text style={styles.naira}>₦</Text>
        <TextInput
          style={styles.amountInput}
          keyboardType="numeric"
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
        />
        <Pressable onPress={() => setChip('all')}>
          <Text style={styles.max}>MAX</Text>
        </Pressable>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>Min: {formatCurrency(minAmount, currency)}</Text>
        <Text style={styles.meta}>Fee: {feeLabel}</Text>
      </View>
      <View style={styles.chips}>
        {chips.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, chipActive === c && styles.chipOn]}
            onPress={() => setChip(c)}
          >
            <Text style={[styles.chipTxt, chipActive === c && styles.chipTxtOn]}>
              ₦{c >= 1000 ? `${c / 1000}K` : c}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.chip, chipActive === 'all' && styles.chipOn]}
          onPress={() => setChip('all')}
        >
          <Text style={[styles.chipTxt, chipActive === 'all' && styles.chipTxtOn]}>All</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>SEND TO</Text>
      {methods.map((m) => {
        const on = m.id === methodId;
        return (
          <Pressable
            key={m.id}
            style={[styles.method, on && styles.methodOn]}
            onPress={() => setMethodId(m.id)}
          >
            <Text style={styles.methodIcon}>{m.type === 'momo' ? '📱' : '💳'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>{m.title}</Text>
              <Text style={styles.methodSub}>{m.subtitle}</Text>
            </View>
            <View style={[styles.radio, on && styles.radioOn]}>
              {on ? <Text style={styles.radioMark}>✓</Text> : null}
            </View>
          </Pressable>
        );
      })}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={withdraw} disabled={busy}>
        <Text style={styles.ctaText}>
          {busy ? 'Processing…' : `Withdraw ${formatCurrency(n || 0, currency)}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: spacing[3], marginBottom: spacing[4] },
  back: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  balance: {
    borderRadius: 18,
    padding: spacing[5],
    marginBottom: spacing[5],
    backgroundColor: '#5B21B6',
  },
  balLab: { color: '#C4B5FD', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  balVal: { color: '#FFF', fontSize: 36, fontWeight: '800', marginTop: 8 },
  balSub: { color: '#DDD6FE', marginTop: 8, fontSize: 13 },
  section: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#8E2DE2',
    paddingHorizontal: 14,
    height: 56,
  },
  naira: { color: '#71717A', fontSize: 22, fontWeight: '700', marginRight: 8 },
  amountInput: { flex: 1, color: '#FFF', fontSize: 24, fontWeight: '800' },
  max: { color: '#A78BFA', fontWeight: '800' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  meta: { color: '#71717A', fontSize: 12 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: spacing[5] },
  chip: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  chipOn: { borderColor: '#8E2DE2' },
  chipTxt: { color: '#A1A1AA', fontWeight: '700' },
  chipTxtOn: { color: '#FFF' },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#27272A',
    gap: 12,
  },
  methodOn: { borderColor: '#8E2DE2' },
  methodIcon: { fontSize: 22 },
  methodTitle: { color: '#FFF', fontWeight: '700' },
  methodSub: { color: '#71717A', fontSize: 12, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: '#8E2DE2', borderColor: '#8E2DE2' },
  radioMark: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  msg: { color: '#A78BFA', textAlign: 'center', marginVertical: 12 },
  cta: {
    marginTop: spacing[4],
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#6366F1',
  },
  ctaText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
