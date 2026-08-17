import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Linking } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import PayMethodChoice from '../../components/PayMethodChoice';

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

/** Merchant mobile payouts — balance, KYC gate, account + request payout. */
export default function MerchantPayoutScreen({
  onBack,
  onReturns,
  onKyc,
}: {
  onBack?: () => void;
  onReturns?: () => void;
  onKyc?: () => void;
}) {
  const [summary, setSummary] = useState({ available: 0, currency: 'NGN', thisWeek: 0 });
  const [account, setAccount] = useState<any>(null);
  const [kycMsg, setKycMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [walletBal, setWalletBal] = useState(0);
  const [topupAmt, setTopupAmt] = useState('100');
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState('');
  const [payMethod, setPayMethod] = useState('wallet');
  const [payMethodId, setPayMethodId] = useState<string | undefined>();
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountNumber: '',
    accountName: '',
    bankCode: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/merchant/earnings/summary`, { headers: authHeaders() });
      const j = await res.json();
      const d = j?.data;
      if (d) {
        setSummary({
          available: Number(d.available || 0),
          currency: d.currency || 'NGN',
          thisWeek: Number(d.thisWeek || 0),
        });
        if (d.payoutAccount) setAccount(d.payoutAccount);
        else if (d.accounts?.[0]) setAccount(d.accounts[0]);
        else setAccount(null);
      }
      const w = await fetch(`${API}/wallet/portfolio`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null);
      if (w?.data) setWalletBal(Number(w.data.fiatBalance ?? w.data.balance ?? 0));
      const pl = await fetch(`${API}/subscriptions/plans`).then((r) => r.json()).catch(() => null);
      const rows = pl?.data || [];
      if (Array.isArray(rows) && rows.length) {
        setPlans(rows);
        setPlanId((id) => id || String(rows[0].id));
      }
    } catch (e: any) {
      setMsg(e.message || 'Could not load payouts');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const amt = summary.available;
    if (!amt) {
      setKycMsg('');
      return;
    }
    fetch(`${API}/trust/kyc-gate?amount=${amt}&role=merchant`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (d && d.allowed === false) setKycMsg(d.message || 'KYC required');
        else setKycMsg('');
      })
      .catch(() => setKycMsg(''));
  }, [summary.available]);

  const addAccount = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/merchant/payouts/accounts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(bankForm),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.message || 'Could not add account');
        return;
      }
      setShowAdd(false);
      setBankForm({ bankName: '', accountNumber: '', accountName: '', bankCode: '' });
      setMsg('Account saved');
      await load();
    } catch (e: any) {
      setMsg(e.message || 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const request = async () => {
    if (kycMsg) {
      setMsg(kycMsg);
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/merchant/payouts/withdraw`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount: summary.available,
          currency: summary.currency,
          bankAccount: {
            bankName: account?.bankName || account?.bank_name,
            accountNumber: account?.accountNumber || account?.account_number,
            accountName: account?.accountName || account?.account_name,
            bankCode: account?.bankCode || account?.bank_code,
          },
        }),
      });
      const j = await res.json();
      setMsg(res.ok ? 'Payout requested' : j.message || 'Failed');
      await load();
    } catch (e: any) {
      setMsg(e.message || 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Merchant payout</Text>
      <Text style={styles.avail}>{formatCurrency(summary.available, summary.currency)}</Text>
      <Text style={styles.muted}>
        Available · this week {formatCurrency(summary.thisWeek, summary.currency)}
      </Text>
      <Text style={styles.muted}>Wallet {formatCurrency(walletBal, summary.currency)}</Text>
      <TextInput
        style={styles.input}
        value={topupAmt}
        onChangeText={setTopupAmt}
        keyboardType="numeric"
        placeholder="Top up amount"
        placeholderTextColor="#71717A"
      />
      <Pressable
        style={styles.secondary}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const res = await fetch(`${API}/wallet/topup`, {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({ amount: Number(topupAmt), currency: summary.currency, source: payMethod }),
            });
            const j = await res.json();
            setMsg(res.ok ? 'Wallet topped up' : j.message || 'Top-up failed');
            await load();
          } catch (e: any) {
            setMsg(e.message || 'Top-up failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Text style={styles.secondaryText}>Top up wallet</Text>
      </Pressable>
      <PayMethodChoice
        value={payMethod}
        onChange={(id, o) => {
          setPayMethod(id);
          setPayMethodId(o?.methodId || undefined);
        }}
      />
      {plans.length ? (
        <Pressable
          style={styles.secondary}
          disabled={busy || !planId}
          onPress={async () => {
            setBusy(true);
            try {
              const res = await fetch(`${API}/subscriptions/activate`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ planId, paymentMethod: payMethod, paymentMethodId: payMethodId }),
              });
              const j = await res.json();
              const link = j.data?.payment?.paymentLink;
              if (link) Linking.openURL(link).catch(() => undefined);
              setMsg(res.ok ? (link ? 'Complete card or MoMo payment' : 'Plan paid from wallet') : j.message);
              await load();
            } catch (e: any) {
              setMsg(e.message || 'Plan payment failed');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Text style={styles.secondaryText}>Renew plan ({payMethod})</Text>
        </Pressable>
      ) : null}
      {account ? (
        <Text style={styles.account}>
          {account.bankName || account.bank_name} · {account.accountNumber || account.account_number}
          {account.bankCode || account.bank_code
            ? ` · ${account.bankCode || account.bank_code}`
            : ''}
        </Text>
      ) : (
        <Text style={styles.muted}>No payout account on file.</Text>
      )}
      <Pressable onPress={() => setShowAdd((v) => !v)} style={{ marginTop: 8 }}>
        <Text style={styles.link}>{showAdd ? 'Cancel' : account ? 'Update account →' : 'Add payout account →'}</Text>
      </Pressable>
      {showAdd ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Bank / MoMo name"
            placeholderTextColor="#71717a"
            value={bankForm.bankName}
            onChangeText={(t) => setBankForm((f) => ({ ...f, bankName: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Bank / MoMo code (e.g. MTN, 058)"
            placeholderTextColor="#71717a"
            value={bankForm.bankCode}
            onChangeText={(t) => setBankForm((f) => ({ ...f, bankCode: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Account number"
            placeholderTextColor="#71717a"
            keyboardType="number-pad"
            value={bankForm.accountNumber}
            onChangeText={(t) => setBankForm((f) => ({ ...f, accountNumber: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Account name"
            placeholderTextColor="#71717a"
            value={bankForm.accountName}
            onChangeText={(t) => setBankForm((f) => ({ ...f, accountName: t }))}
          />
          <Pressable
            style={[styles.btn, busy && { opacity: 0.5 }]}
            onPress={addAccount}
            disabled={busy}
          >
            <Text style={styles.btnText}>{busy ? 'Saving…' : 'Save account'}</Text>
          </Pressable>
        </View>
      ) : null}
      {kycMsg ? <Text style={styles.warn}>{kycMsg}</Text> : null}
      {kycMsg && onKyc ? (
        <Pressable onPress={onKyc}>
          <Text style={styles.link}>Complete merchant KYC →</Text>
        </Pressable>
      ) : null}
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      <Pressable
        style={[
          styles.btn,
          (busy || Boolean(kycMsg) || summary.available <= 0 || !account) && { opacity: 0.5 },
        ]}
        onPress={request}
        disabled={busy || Boolean(kycMsg) || summary.available <= 0 || !account}
      >
        <Text style={styles.btnText}>{busy ? 'Requesting…' : 'Request payout'}</Text>
      </Pressable>
      {onReturns ? (
        <Pressable onPress={onReturns} style={{ marginTop: 16 }}>
          <Text style={styles.link}>Manage returns →</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', padding: spacing[4] },
  back: { color: '#a1a1aa', marginBottom: 8 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  avail: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 16 },
  muted: { color: '#71717a', marginTop: 6, fontSize: 13 },
  account: { color: '#e4e4e7', marginTop: 12, fontWeight: '600' },
  warn: { color: '#fbbf24', marginTop: 12 },
  ok: { color: '#34d399', marginTop: 8 },
  link: { color: '#a78bfa', fontWeight: '700', marginTop: 8 },
  form: { marginTop: 12, gap: 8 },
  input: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  secondary: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#E9D5FF', fontWeight: '700' },
  btn: {
    marginTop: 20,
    backgroundColor: '#4f46e5',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800' },
});
