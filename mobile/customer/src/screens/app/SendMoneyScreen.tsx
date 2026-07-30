import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function SendMoneyScreen() {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
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
    if (json.status === 'error') setMessage(json.message);
    else {
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
      setMessage(json.data.claim_code ? `Sent — claim code ${json.data.claim_code}` : 'Transfer complete');
      setQuote(null);
      loadHistory();
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Send money</Text>
      <TextInput
        style={styles.input}
        placeholder="@handle or phone"
        placeholderTextColor="#666"
        value={to}
        onChangeText={setTo}
      />
      <TextInput
        style={styles.input}
        placeholder="Amount"
        placeholderTextColor="#666"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />
      <TextInput
        style={styles.input}
        placeholder="Currency"
        placeholderTextColor="#666"
        value={currency}
        onChangeText={setCurrency}
      />
      <Pressable style={styles.btn} onPress={fetchQuote}>
        <Text style={styles.btnText}>Get quote</Text>
      </Pressable>

      {quote ? (
        <View style={styles.quote}>
          <Text style={styles.quoteLine}>
            Fee {quote.feeAmount} {currency} · recipient gets {quote.receivedAmount}{' '}
            {quote.receivedCurrency}
          </Text>
          <Text style={styles.quoteLine}>FX {quote.fxRateUsed}</Text>
          {!quote.canSend ? (
            <Text style={styles.warn}>Identity-Linked required for this amount</Text>
          ) : (
            <Pressable style={styles.btn} onPress={send}>
              <Text style={styles.btnText}>Confirm send</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {message ? <Text style={styles.msg}>{message}</Text> : null}

      <Text style={styles.section}>History</Text>
      <FlatList
        data={history}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              {item.sent_amount} {item.sent_currency} → {item.received_amount}{' '}
              {item.received_currency}
            </Text>
            <Text style={styles.rowValue}>{item.status}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700', marginBottom: spacing[3] },
  input: {
    backgroundColor: '#0A0A0A',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.pureWhite,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  btn: {
    backgroundColor: colors.electricViolet,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    marginVertical: spacing[2],
  },
  btnText: { color: colors.pureWhite, fontWeight: '600' },
  quote: { marginTop: spacing[2], marginBottom: spacing[3] },
  quoteLine: { color: colors.pureWhite, marginBottom: 4 },
  warn: { color: '#FF6B6B', marginTop: 8 },
  msg: { color: colors.movrGreen, marginBottom: spacing[2] },
  section: { color: colors.pureWhite, fontWeight: '600', marginTop: spacing[4], marginBottom: spacing[2] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  rowLabel: { color: colors.pureWhite, flex: 1 },
  rowValue: { color: '#A0A0A0' },
});
