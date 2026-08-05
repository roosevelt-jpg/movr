import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
} from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Send money — recipient, amount, FX quote cards (cross-border transfer APIs). */
export default function SendMoneyScreen() {
  const [to, setTo] = useState('+234 · Adaeze O. · Nigeria');
  const [amount, setAmount] = useState('500');
  const [currency, setCurrency] = useState('GHS');
  const [quote, setQuote] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  const loadHistory = () => {
    fetch(`${API}/wallet/transfers`)
      .then((r) => r.json())
      .then((j) => setHistory(j.data || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const fetchQuote = async () => {
    const q = new URLSearchParams({
      to,
      amount,
      currency,
    });
    const res = await fetch(`${API}/wallet/transfer/quote?${q}`);
    const json = await res.json();
    if (json.status === 'error') {
      setMessage(json.message);
      // Demo FX if API unavailable
      const n = Number(amount) || 0;
      setQuote({
        feeAmount: 5,
        receivedAmount: Math.round(n * 71.4),
        receivedCurrency: 'NGN',
        fxRateUsed: 71.4,
        canSend: true,
        demo: true,
      });
    } else {
      setQuote(json.data);
      setMessage('');
    }
  };

  const send = async () => {
    const res = await fetch(`${API}/wallet/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      setQuote(null);
      loadHistory();
    }
  };

  useEffect(() => {
    if (amount) fetchQuote().catch(() => undefined);
  }, []);

  const sendAmt = Number(amount) || 0;
  const fee = Number(quote?.feeAmount ?? 5);
  const received = Number(quote?.receivedAmount ?? Math.round(sendAmt * 71.4));
  const fx = Number(quote?.fxRateUsed ?? 71.4);
  const recvCur = quote?.receivedCurrency || 'NGN';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Send money</Text>

      <View style={styles.card}>
        <Text style={styles.label}>To</Text>
        <TextInput
          style={styles.cardInput}
          placeholder="+234 · Name · Country"
          placeholderTextColor={colors.textSecondary}
          value={to}
          onChangeText={setTo}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>You send</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>{currency === 'GHS' ? 'GH₵' : currency}</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            onBlur={() => fetchQuote().catch(() => undefined)}
          />
        </View>
      </View>

      <Pressable style={styles.secondary} onPress={() => fetchQuote()}>
        <Text style={styles.secondaryText}>Refresh quote</Text>
      </Pressable>

      <View style={styles.details}>
        <View style={styles.row}>
          <Text style={styles.muted}>Exchange rate</Text>
          <Text style={styles.muted}>
            1 {currency} = {fx} {recvCur}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.muted}>Transfer fee</Text>
          <Text style={styles.muted}>{formatCurrency(fee, currency)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.totalLabel}>
            {String(to).split('·')[1]?.trim() || 'Recipient'} receives
          </Text>
          <Text style={styles.totalValue}>
            {recvCur === 'NGN' ? `₦${received.toLocaleString()}` : `${received} ${recvCur}`}
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

      <Text style={styles.section}>History</Text>
      <FlatList
        data={history}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={styles.muted}>No transfers yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.histRow}>
            <Text style={styles.histLabel}>
              {item.sent_amount} {item.sent_currency} → {item.received_amount}{' '}
              {item.received_currency}
            </Text>
            <Text style={styles.muted}>{item.status}</Text>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
  cardInput: { color: colors.pureWhite, fontSize: 16, padding: 0 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  currency: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  amountInput: {
    flex: 1,
    color: colors.pureWhite,
    fontSize: 28,
    fontWeight: '700',
    padding: 0,
  },
  secondary: { alignSelf: 'flex-start', marginBottom: spacing[3] },
  secondaryText: { color: colors.motionBlue, fontWeight: '600' },
  details: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  muted: { color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[3] },
  totalLabel: { color: colors.pureWhite, fontWeight: '700' },
  totalValue: { color: colors.pureWhite, fontWeight: '700', fontSize: 18 },
  warn: { color: colors.error, marginBottom: spacing[3] },
  cta: {
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
  msg: { color: colors.movrGreen, marginBottom: spacing[3] },
  section: { color: colors.pureWhite, fontWeight: '700', marginTop: spacing[4], marginBottom: spacing[2] },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  histLabel: { color: colors.pureWhite, flex: 1, marginRight: 8 },
});
