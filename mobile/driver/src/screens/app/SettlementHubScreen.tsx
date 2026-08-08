import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
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

/** Driver settlement rails — MoMo/bank, cash agents, receipts, disputes. */
export default function SettlementHubScreen({ onBack }: { onBack?: () => void }) {
  const [rails, setRails] = useState<any>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('1000');
  const [momo, setMomo] = useState({ provider: 'MTN MoMo', accountNumber: '', bankCode: '' });
  const [dispute, setDispute] = useState({ domain: 'ride', reason: '' });
  const [confirmCode, setConfirmCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rec] = await Promise.all([
        fetch(`${API}/trust/rails`, { headers: authHeaders() }).then((x) => x.json()),
        fetch(`${API}/trust/receipts`, { headers: authHeaders() }).then((x) => x.json()),
      ]);
      setRails(r.data || null);
      setReceipts(rec.data || []);
      if (r.data?.cashAgents?.[0] && !agentId) setAgentId(r.data.cashAgents[0].id);
    } catch (e: any) {
      setMsg(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveMomo = async () => {
    const res = await fetch(`${API}/trust/rails`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        railType: 'momo',
        provider: momo.provider,
        accountNumber: momo.accountNumber,
        bankCode: momo.bankCode || undefined,
        isDefault: true,
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? 'Payout rail saved' : j.message || 'Failed');
    await load();
  };

  const agentAction = async (kind: 'deposit' | 'withdraw') => {
    const res = await fetch(`${API}/trust/cash-agent/${kind}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ agentId, amount: Number(amount) }),
    });
    const j = await res.json();
    setMsg(res.ok ? j.data?.message || 'Done' : j.message || 'Failed');
    await load();
  };

  const openDispute = async () => {
    const res = await fetch(`${API}/trust/disputes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(dispute),
    });
    const j = await res.json();
    setMsg(res.ok ? 'Dispute opened' : j.message || 'Failed');
    setDispute({ domain: 'ride', reason: '' });
  };

  const confirmAgentCode = async () => {
    const res = await fetch(`${API}/trust/cash-agent/confirm`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ code: confirmCode }),
    });
    const j = await res.json();
    setMsg(
      res.ok
        ? j.data?.credited
          ? 'Deposit credited'
          : j.data?.collected
            ? 'Pickup confirmed'
            : 'Confirmed'
        : j.message || 'Invalid code'
    );
    setConfirmCode('');
    await load();
  };

  const promise = rails?.promise;
  const currency = 'GHS';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Earnings</Text>
        </Pressable>
      ) : null}
      <Text style={styles.kicker}>Trust & Settlement</Text>
      <Text style={styles.title}>Get paid. Stay trusted.</Text>
      <Text style={styles.sub}>
        {promise?.keep100Note || 'Drivers keep 100% of the fare.'}
      </Text>
      <Text style={styles.muted}>
        {promise?.matchSlaText || 'Fast match'} · KYC gate for large payouts
      </Text>
      {loading ? <Text style={styles.muted}>Loading…</Text> : null}
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}

      <Text style={styles.h2}>Rails</Text>
      <Text style={styles.muted}>USSD {rails?.ussdCode || '*920*MOVR#'}</Text>
      {(rails?.channels || []).map((c: any) => (
        <View key={c.id} style={styles.chip}>
          <Text style={styles.chipTitle}>{c.label}</Text>
          <Text style={styles.muted}>{c.eta}</Text>
        </View>
      ))}

      <Text style={styles.h2}>Link MoMo / bank</Text>
      <TextInput
        style={styles.input}
        value={momo.provider}
        onChangeText={(t) => setMomo({ ...momo, provider: t })}
        placeholder="Provider"
        placeholderTextColor="#666"
      />
      <TextInput
        style={styles.input}
        value={momo.bankCode}
        onChangeText={(t) => setMomo({ ...momo, bankCode: t })}
        placeholder="Bank/MoMo code (optional)"
        placeholderTextColor="#666"
      />
      <TextInput
        style={styles.input}
        value={momo.accountNumber}
        onChangeText={(t) => setMomo({ ...momo, accountNumber: t })}
        placeholder="MoMo / account number"
        placeholderTextColor="#666"
        keyboardType="phone-pad"
      />
      <Pressable style={styles.btn} onPress={saveMomo}>
        <Text style={styles.btnText}>Save payout rail</Text>
      </Pressable>

      <Text style={styles.h2}>Cash agents</Text>
      {(rails?.cashAgents || []).slice(0, 4).map((a: any) => (
        <Pressable
          key={a.id}
          style={[styles.chip, agentId === a.id && styles.chipOn]}
          onPress={() => setAgentId(a.id)}
        >
          <Text style={styles.chipTitle}>
            {a.name} · {a.city}
          </Text>
        </Pressable>
      ))}
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholderTextColor="#666"
      />
      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.half, styles.green]} onPress={() => agentAction('deposit')}>
          <Text style={styles.btnText}>Deposit</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.half]} onPress={() => agentAction('withdraw')}>
          <Text style={styles.btnText}>Cash out</Text>
        </Pressable>
      </View>
      <Text style={styles.muted}>Deposits credit after agent confirms your code.</Text>
      <TextInput
        style={styles.input}
        value={confirmCode}
        onChangeText={setConfirmCode}
        placeholder="Agent confirmation code"
        placeholderTextColor="#666"
        keyboardType="number-pad"
      />
      <Pressable style={styles.btn} onPress={confirmAgentCode}>
        <Text style={styles.btnText}>Confirm agent code</Text>
      </Pressable>

      <Text style={styles.h2}>Dispute a fare</Text>
      <TextInput
        style={[styles.input, { minHeight: 72 }]}
        multiline
        value={dispute.reason}
        onChangeText={(t) => setDispute({ ...dispute, reason: t })}
        placeholder="What went wrong?"
        placeholderTextColor="#666"
      />
      <Pressable style={[styles.btn, styles.orange]} onPress={openDispute}>
        <Text style={styles.btnText}>Submit dispute</Text>
      </Pressable>

      <Text style={styles.h2}>Receipts</Text>
      {receipts.length === 0 ? (
        <Text style={styles.muted}>No receipts yet.</Text>
      ) : (
        receipts.slice(0, 6).map((r) => (
          <View key={r.id} style={styles.receipt}>
            <Text style={styles.chipTitle}>{String(r.kind).replace(/_/g, ' ')}</Text>
            <Text style={styles.chipTitle}>
              {formatCurrency(Number(r.amount), r.currency || currency)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  back: { color: '#a1a1aa', marginBottom: 8 },
  kicker: { color: '#a1a1aa', fontSize: 12, marginBottom: 4 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  sub: { color: '#d4d4d8', marginTop: 6, fontSize: 13 },
  muted: { color: '#71717a', fontSize: 12, marginBottom: 6, marginTop: 4 },
  ok: { color: '#34d399', marginBottom: 8 },
  h2: { color: '#fff', fontWeight: '700', fontSize: 17, marginTop: 18, marginBottom: 8 },
  chip: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  chipOn: { borderColor: '#6366f1' },
  chipTitle: { color: '#fff', fontWeight: '600', fontSize: 13 },
  input: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  green: { backgroundColor: '#047857' },
  orange: { backgroundColor: '#c2410c' },
  half: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  receipt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
    paddingVertical: 10,
  },
});
