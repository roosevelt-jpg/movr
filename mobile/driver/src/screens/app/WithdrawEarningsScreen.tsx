import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const PROVIDERS = ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money', 'Bank transfer'];

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Driver withdraw earnings — MoMo cash-out with editable destination. */
export default function WithdrawEarningsScreen() {
  const [available, setAvailable] = useState(0);
  const [currency, setCurrency] = useState('GHS');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<any>(null);
  const [editingMethod, setEditingMethod] = useState(false);
  const [provider, setProvider] = useState('MTN MoMo');
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [msg, setMsg] = useState('');
  const [kycMsg, setKycMsg] = useState('');
  const [keepNote, setKeepNote] = useState('');

  const n = Number(amount) || 0;

  const load = () => {
    fetch(`${API}/driver/earnings/balance`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.available != null) {
          const v = Number(j.data.available);
          setAvailable(v);
          setAmount(v.toFixed(2));
        }
        if (j?.data?.currency) setCurrency(j.data.currency);
        if (j?.data?.payoutMethod) setMethod(j.data.payoutMethod);
        if (j?.data?.keep100Note) setKeepNote(j.data.keep100Note);
      })
      .catch((e) => {
        setAvailable(0);
        setAmount('');
        setMethod(null);
        setMsg(e?.message || 'Could not load earnings balance');
      })
      .finally(() => setLoadingBalance(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!n) {
      setKycMsg('');
      return;
    }
    fetch(`${API}/trust/kyc-gate?amount=${n}&role=driver`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (d && d.allowed === false) setKycMsg(d.message || 'KYC required for this payout');
        else setKycMsg('');
      })
      .catch(() => setKycMsg(''));
  }, [n]);

  const saveMethod = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/driver/payouts/method`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ provider, accountNumber: account }),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setMsg(json.message || 'Could not save method');
      } else {
        setMethod(json.data);
        setEditingMethod(false);
        setMsg(`Saved · ${json.data?.eta || 'Usually arrives in minutes'}`);
        await fetch(`${API}/trust/rails`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            railType: provider.toLowerCase().includes('bank') ? 'bank' : 'momo',
            provider,
            accountNumber: account,
            isDefault: true,
          }),
        }).catch(() => undefined);
      }
    } catch (e: any) {
      setMsg(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async () => {
    if (!n || n > available || !method) {
      setMsg(!method ? 'Add a MoMo number first' : 'Amount exceeds available balance');
      return;
    }
    if (kycMsg) {
      setMsg(kycMsg);
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
          currency,
          channel: method.label,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(json.message || 'Withdrawal requested — usually arrives in minutes');
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
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Withdraw earnings</Text>
      <Text style={styles.sub}>
        {keepNote || 'Every fare on Movr is yours — withdraw anytime via MoMo.'}
      </Text>
      {loadingBalance ? <Text style={styles.msg}>Loading balance…</Text> : null}

      <View style={styles.balanceCard}>
        <View style={styles.balanceGlow} />
        <Text style={styles.balanceLabel}>Available to withdraw</Text>
        <Text style={styles.balanceValue}>{formatCurrency(available, currency)}</Text>
      </View>

      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.inputFocus}
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Withdraw to</Text>
      {editingMethod || !method ? (
        <View style={styles.editBox}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {PROVIDERS.map((p) => (
              <Pressable
                key={p}
                style={[styles.chip, provider === p && styles.chipOn]}
                onPress={() => setProvider(p)}
              >
                <Text style={styles.chipText}>{p}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            style={styles.inputFocus}
            value={account}
            onChangeText={setAccount}
            keyboardType="phone-pad"
            placeholder="MoMo / account number"
            placeholderTextColor="#666"
          />
          <Pressable style={styles.saveMethod} onPress={saveMethod} disabled={loading}>
            <Text style={styles.saveMethodText}>{loading ? 'Saving…' : 'Save payout method'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.method}>
          <View>
            <Text style={styles.methodText}>
              {method.label} · {method.mask}
            </Text>
            <Text style={styles.eta}>{method.eta || 'Usually arrives in minutes'}</Text>
          </View>
          <Pressable onPress={() => setEditingMethod(true)}>
            <Text style={styles.change}>Change</Text>
          </Pressable>
        </View>
      )}

      {kycMsg ? <Text style={[styles.msg, { color: '#fbbf24' }]}>{kycMsg}</Text> : null}
      {kycMsg ? (
        <Text style={{ color: '#a78bfa', marginBottom: 8, fontSize: 12 }}>
          Complete driver verification to unlock large payouts.
        </Text>
      ) : null}
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable
        style={[styles.cta, (loading || Boolean(kycMsg) || !method) && { opacity: 0.55 }]}
        onPress={withdraw}
        disabled={loading || Boolean(kycMsg) || !method}
      >
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Processing…' : 'Withdraw now'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.55)', marginTop: 6, marginBottom: spacing[5], fontSize: 13 },
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
    fontWeight: '700',
    fontSize: 16,
  },
  method: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 16,
    marginBottom: spacing[4],
  },
  methodText: { color: '#FFFFFF', fontWeight: '700' },
  eta: { color: '#A1A1AA', fontSize: 12, marginTop: 4 },
  change: { color: '#A78BFA', fontWeight: '700' },
  editBox: { marginBottom: spacing[4] },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
  },
  chipOn: { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.2)' },
  chipText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  saveMethod: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveMethodText: { color: '#FFF', fontWeight: '700' },
  msg: { color: '#4ADE80', marginBottom: spacing[3], textAlign: 'center' },
  cta: {
    marginTop: spacing[2],
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#6345ED',
  },
  ctaLeft: {},
  ctaRight: {},
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
