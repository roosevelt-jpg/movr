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

/** Merchant mobile payouts — balance, KYC gate, request payout. */
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
          bankAccount: account,
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
      <Text style={styles.muted}>Available · this week {formatCurrency(summary.thisWeek, summary.currency)}</Text>
      {account ? (
        <Text style={styles.account}>
          {account.bankName || account.bank_name} · {account.accountNumber || account.account_number}
        </Text>
      ) : (
        <Text style={styles.muted}>No payout account on file — add one on web merchant console.</Text>
      )}
      {kycMsg ? <Text style={styles.warn}>{kycMsg}</Text> : null}
      {kycMsg && onKyc ? (
        <Pressable onPress={onKyc}>
          <Text style={styles.link}>Complete merchant KYC →</Text>
        </Pressable>
      ) : null}
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      <Pressable
        style={[styles.btn, (busy || Boolean(kycMsg) || summary.available <= 0) && { opacity: 0.5 }]}
        onPress={request}
        disabled={busy || Boolean(kycMsg) || summary.available <= 0}
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
  btn: {
    marginTop: 20,
    backgroundColor: '#4f46e5',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800' },
});
