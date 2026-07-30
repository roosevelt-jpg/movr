import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function SubscriptionScreen() {
  const [planId, setPlanId] = useState('basic_driver');
  const [method, setMethod] = useState<'fiat' | 'dvt'>('fiat');
  const [quote, setQuote] = useState<any>(null);

  const loadQuote = () => {
    fetch(`${API}/subscriptions/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, paymentMethod: method }),
    })
      .then((r) => r.json())
      .then((j) => setQuote(j.data))
      .catch(() => undefined);
  };

  useEffect(() => {
    loadQuote();
  }, [planId, method]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Subscription</Text>
      <Text style={styles.sub}>Keep 100% of trip earnings.</Text>

      <View style={styles.row}>
        {(['fiat', 'dvt'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMethod(m)}
            style={[styles.chip, method === m && styles.chipActive]}
          >
            <Text style={styles.chipText}>
              {m === 'fiat' ? 'Pay with Wallet (fiat)' : 'Pay with DVT'}
            </Text>
          </Pressable>
        ))}
      </View>

      {quote ? (
        <View style={styles.card}>
          <Text style={styles.line}>List: GHS {quote.listPrice}</Text>
          <Text style={styles.line}>Discount: {quote.discountAppliedPct}% ({quote.discountReason || 'none'})</Text>
          <Text style={styles.total}>Final: GHS {quote.finalPrice}</Text>
          {quote.note ? <Text style={styles.sub}>{quote.note}</Text> : null}
        </View>
      ) : null}

      <Button label="Confirm subscription" onPress={() => undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4], gap: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textSecondary },
  row: { gap: spacing[2] },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[2],
  },
  chipActive: { borderColor: colors.electricViolet },
  chipText: { color: colors.pureWhite, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    gap: spacing[2],
  },
  line: { color: colors.textSecondary },
  total: { color: colors.pureWhite, fontSize: 20, fontWeight: '700' },
});
