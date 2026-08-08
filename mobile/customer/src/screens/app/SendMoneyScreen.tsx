import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency, formatCountryLabel } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

/** Send money — recipient, amount, FX quote (cross-border transfer APIs). */
export default function SendMoneyScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [to, setTo] = useState(`+234 · Adaeze O. · ${formatCountryLabel('NG')}`);
  const [amount, setAmount] = useState('500.00');
  const [currency] = useState('GHS');
  const [quote, setQuote] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [editingTo, setEditingTo] = useState(false);
  const [editingAmt, setEditingAmt] = useState(false);

  const fetchQuote = useCallback(async () => {
    const q = new URLSearchParams({
      to,
      amount: String(Number(amount) || 0),
      currency,
    });
    const res = await fetch(`${API}/wallet/transfer/quote?${q}`, { headers: authHeaders() });
    const json = await res.json();
    if (json.status === 'error') {
      setMessage(json.message);
      setQuote(null);
    } else {
      setQuote(json.data);
      setMessage(
        json.data?.requiresIdentityLink && !json.data?.identityLinked
          ? 'Identity-Linked status required for this amount'
          : ''
      );
    }
  }, [to, amount, currency]);

  useEffect(() => {
    fetchQuote().catch(() => undefined);
  }, [fetchQuote]);

  const send = async () => {
    const res = await fetch(`${API}/wallet/transfer`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ to, amount: Number(amount), currency }),
    });
    const json = await res.json();
    if (json.status === 'error') setMessage(json.message);
    else {
      setMessage(
        json.data.claim_code
          ? `Sent — claim code ${json.data.claim_code}`
          : 'Transfer complete'
      );
      fetchQuote().catch(() => undefined);
    }
  };

  const sendAmt = Number(amount) || 0;
  const fee = Number(quote?.feeAmount ?? 5);
  const received = Number(quote?.receivedAmount ?? Math.round(sendAmt * 71.4));
  const fx = Number(quote?.fxRateUsed ?? 71.4);
  const recvCur = quote?.receivedCurrency || 'NGN';
  const toDisplay = quote?.recipientDisplay || to;
  const recvName = quote?.recipientFirstName || to.split('·')[1]?.trim()?.split(/\s+/)[0] || 'Recipient';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Send money</Text>

      <Pressable style={styles.card} onPress={() => setEditingTo(true)}>
        <Text style={styles.label}>To</Text>
        {editingTo ? (
          <TextInput
            style={styles.cardValue}
            value={to}
            onChangeText={setTo}
            onBlur={() => {
              setEditingTo(false);
              fetchQuote().catch(() => undefined);
            }}
            autoFocus
            placeholderTextColor="#888888"
          />
        ) : (
          <Text style={styles.cardValue}>{toDisplay}</Text>
        )}
      </Pressable>

      <Pressable style={styles.card} onPress={() => setEditingAmt(true)}>
        <Text style={styles.label}>You send</Text>
        {editingAmt ? (
          <View style={styles.amountRow}>
            <Text style={styles.amountText}>GH₵</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              onBlur={() => {
                setEditingAmt(false);
                const n = Number(amount);
                if (!Number.isNaN(n)) setAmount(n.toFixed(2));
                fetchQuote().catch(() => undefined);
              }}
              autoFocus
            />
          </View>
        ) : (
          <Text style={styles.amountText}>
            {`GH₵${sendAmt.toFixed(2)}`}
          </Text>
        )}
      </Pressable>

      <View style={styles.details}>
        <View style={styles.row}>
          <Text style={styles.muted}>Exchange rate</Text>
          <Text style={styles.detailValue}>
            1 {currency} = {fx} {recvCur}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.muted}>Transfer fee</Text>
          <Text style={styles.detailValue}>{formatCurrency(fee, currency)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.totalLabel}>{recvName} receives</Text>
          <Text style={styles.totalValue}>
            {recvCur === 'NGN'
              ? `₦${Math.round(received).toLocaleString()}`
              : `${received} ${recvCur}`}
          </Text>
        </View>
      </View>

      {quote && !quote.canSend ? (
        <Text style={styles.warn}>Identity-Linked required for this amount</Text>
      ) : (
        <Pressable style={styles.cta} onPress={send}>
          <View style={styles.ctaGlow} />
          <Text style={styles.ctaText}>Confirm & send</Text>
        </Pressable>
      )}

      {!!message && <Text style={styles.msg}>{message}</Text>}
    </ScrollView>
  );
}

function makeStyles(_colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
    title: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
      marginBottom: spacing[4],
    },
    card: {
      backgroundColor: '#1A1A1A',
      borderRadius: 16,
      padding: spacing[4],
      marginBottom: spacing[3],
    },
    label: { color: '#888888', fontSize: 13, marginBottom: 8 },
    cardValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    amountText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
    amountInput: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
      padding: 0,
    },
    details: {
      backgroundColor: '#1A1A1A',
      borderRadius: 16,
      padding: spacing[4],
      marginBottom: spacing[4],
      marginTop: spacing[1],
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing[2],
    },
    muted: { color: '#888888', fontSize: 14 },
    detailValue: { color: '#FFFFFF', fontSize: 14 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.12)',
      marginVertical: spacing[3],
    },
    totalLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    totalValue: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
    warn: { color: '#ff6b6b', marginBottom: spacing[3] },
    cta: {
      borderRadius: 999,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#8E2DE2',
      overflow: 'hidden',
      marginBottom: spacing[3],
    },
    ctaGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#4A00E0',
      opacity: 0.55,
    },
    ctaText: { color: '#FFFFFF', fontWeight: '700', zIndex: 1, fontSize: 16 },
    msg: { color: '#4ade80', marginBottom: spacing[3] },
  });
}
