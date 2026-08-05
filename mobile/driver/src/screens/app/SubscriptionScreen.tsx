import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Driver subscription — active plan, discounts, pay with wallet/DVT. */
export default function SubscriptionScreen() {
  const [planId, setPlanId] = useState('weekly_driver');
  const [method, setMethod] = useState<'fiat' | 'dvt'>('fiat');
  const [quote, setQuote] = useState<any>(null);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [renews, setRenews] = useState('Fri, 24 Jul');

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

  const discounts = useMemo(() => {
    const reason = String(quote?.discountReason || '');
    const rows: { label: string; pct: number; icon?: string }[] = [];
    const perf = reason.match(/performance_tier:([\d.]+)/);
    const stake = reason.match(/staking_tier:([\d.]+)/);
    if (perf) rows.push({ label: 'Pro tier discount', pct: Number(perf[1]), icon: '🏅' });
    if (stake) rows.push({ label: 'Staking discount', pct: Number(stake[1]) });
    if (!rows.length) {
      rows.push({ label: 'Pro tier discount', pct: 10, icon: '🏅' });
      rows.push({ label: 'Staking discount', pct: 5 });
    }
    return rows;
  }, [quote]);

  const list = Number(quote?.listPrice ?? 60);
  const final = Number(quote?.finalPrice ?? 51);
  const discountAmt = Math.max(0, list - final);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Subscription</Text>

      <View style={styles.planCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>Weekly plan</Text>
          <Text style={styles.planMeta}>Renews {renews}</Text>
        </View>
        <View style={styles.activePill}>
          <Text style={styles.activeText}>{status === 'active' ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

      <Text style={styles.section}>Your discounts</Text>
      {discounts.map((d) => (
        <View key={d.label} style={styles.discountRow}>
          <View style={styles.discountLeft}>
            {d.icon ? <Text style={{ marginRight: 8 }}>{d.icon}</Text> : null}
            <Text style={styles.discountLabel}>{d.label}</Text>
          </View>
          <Text style={styles.discountPct}>-{d.pct}%</Text>
        </View>
      ))}

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.muted}>Base price</Text>
          <Text style={styles.muted}>{formatCurrency(list, 'GHS')}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.green}>Discounts</Text>
          <Text style={styles.green}>-{formatCurrency(discountAmt, 'GHS')}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total due</Text>
          <Text style={styles.totalValue}>{formatCurrency(final, 'GHS')}</Text>
        </View>
      </View>

      <Text style={styles.section}>Pay with</Text>
      <View style={styles.payRow}>
        <Pressable
          style={[styles.payBtn, method === 'fiat' && styles.payActive]}
          onPress={() => setMethod('fiat')}
        >
          <Text style={styles.payText}>👛  Wallet</Text>
        </Pressable>
        <Pressable
          style={[styles.payBtn, method === 'dvt' && styles.payActive]}
          onPress={() => setMethod('dvt')}
        >
          <Text style={[styles.payText, method !== 'dvt' && { color: colors.textSecondary }]}>
            Pay with DVT
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.cta}
        onPress={() => {
          fetch(`${API}/subscriptions/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, paymentMethod: method }),
          }).catch(() => undefined);
        }}
      >
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>Confirm · {formatCurrency(final, 'GHS')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  planName: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  planMeta: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  activePill: {
    backgroundColor: 'rgba(63,112,72,0.35)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  section: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing[3] },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  discountLeft: { flexDirection: 'row', alignItems: 'center' },
  discountLabel: { color: colors.pureWhite, fontWeight: '600' },
  discountPct: { color: colors.success, fontWeight: '700' },
  summary: {
    marginTop: spacing[4],
    marginBottom: spacing[5],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing[4],
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  muted: { color: colors.textSecondary },
  green: { color: colors.success, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[3] },
  totalLabel: { color: colors.pureWhite, fontWeight: '700' },
  totalValue: { color: colors.pureWhite, fontWeight: '700', fontSize: 18 },
  payRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  payBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  payActive: { borderColor: colors.motionBlue },
  payText: { color: colors.pureWhite, fontWeight: '600' },
  cta: {
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
    overflow: 'hidden',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
});
