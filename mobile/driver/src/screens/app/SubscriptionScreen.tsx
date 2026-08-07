import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
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

function formatRenews(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Driver subscription — plan, discounts, wallet / DVT pay. */
export default function SubscriptionScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [planId, setPlanId] = useState('weekly_driver');
  const [plans, setPlans] = useState<any[]>([]);
  const [method, setMethod] = useState<'fiat' | 'dvt'>('fiat');
  const [quote, setQuote] = useState<any>(null);
  const [status, setStatus] = useState<string>('inactive');
  const [renews, setRenews] = useState('—');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/subscriptions/plans`)
      .then((r) => r.json())
      .then((j) => {
        const list = j?.data || [];
        setPlans(list);
        const weekly = list.find((p: any) => String(p.id).includes('weekly')) || list[0];
        if (weekly?.id) setPlanId(String(weekly.id));
      })
      .catch(() => undefined);
    fetch(`${API}/subscriptions/me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setStatus(j.data.status || 'inactive');
          setRenews(formatRenews(j.data.next_billing_date));
          if (j.data.plan_id) setPlanId(String(j.data.plan_id));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!planId) return;
    fetch(`${API}/subscriptions/quote`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ planId, paymentMethod: method }),
    })
      .then((r) => r.json())
      .then((j) => setQuote(j.data || null))
      .catch(() => setQuote(null));
  }, [planId, method]);

  const discounts = useMemo(() => {
    if (Array.isArray(quote?.discounts) && quote.discounts.length) {
      return quote.discounts.map((d: any) => ({
        label: d.label,
        pct: Number(d.pct),
        icon: d.key === 'pro_tier' || String(d.label).toLowerCase().includes('tier') ? '🏅' : undefined,
      }));
    }
    const reason = String(quote?.discountReason || '');
    const rows: { label: string; pct: number; icon?: string }[] = [];
    const perf = reason.match(/performance_tier:([\d.]+)/);
    const stake = reason.match(/staking_tier:([\d.]+)/);
    if (perf) rows.push({ label: 'Pro tier discount', pct: Number(perf[1]), icon: '🏅' });
    if (stake) rows.push({ label: 'Staking discount', pct: Number(stake[1]) });
    return rows;
  }, [quote]);

  const list = Number(quote?.listPrice ?? 0);
  const final = Number(quote?.finalPrice ?? list);
  const discountAmt = Math.max(0, list - final);
  const planName =
    quote?.plan?.name ||
    plans.find((p) => String(p.id) === planId)?.name ||
    'Weekly plan';

  const activate = async () => {
    if (!planId) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/subscriptions/activate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planId, paymentMethod: method === 'dvt' ? 'dvt' : 'wallet' }),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setMsg(json.message || 'Activation failed');
      } else {
        setMsg('Subscription updated');
        setStatus(json.data?.subscription?.status || 'active');
        setRenews(formatRenews(json.data?.subscription?.next_billing_date));
      }
    } catch (e: any) {
      setMsg(e.message || 'Activation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Subscription</Text>

      <View style={styles.planCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{planName}</Text>
          <Text style={styles.planMeta}>Renews {renews}</Text>
        </View>
        <View style={[styles.activePill, status !== 'active' && styles.inactivePill]}>
          <Text style={[styles.activeText, status !== 'active' && { color: colors.textSecondary }]}>
            {status === 'active' ? 'Active' : status}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>Your discounts</Text>
      {discounts.length === 0 ? (
        <Text style={styles.empty}>No tier discounts applied yet</Text>
      ) : (
        <View style={styles.discountCard}>
          {discounts.map((d, i) => (
            <View
              key={d.label}
              style={[styles.discountRow, i < discounts.length - 1 && styles.discountBorder]}
            >
              <View style={styles.discountLeft}>
                {d.icon ? <Text style={{ marginRight: 8 }}>{d.icon}</Text> : null}
                <Text style={styles.discountLabel}>{d.label}</Text>
              </View>
              <Text style={styles.discountPct}>-{d.pct}%</Text>
            </View>
          ))}
        </View>
      )}

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

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      {quote?.note ? <Text style={styles.empty}>{quote.note}</Text> : null}

      <Pressable style={styles.cta} onPress={activate} disabled={busy || !planId}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>
          {busy ? 'Confirming…' : `Confirm · ${formatCurrency(final, 'GHS')}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
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
    inactivePill: { backgroundColor: colors.surface },
    activeText: { color: colors.success, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
    section: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing[3] },
    empty: { color: colors.textSecondary, marginBottom: spacing[3] },
    discountCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      marginBottom: spacing[4],
      overflow: 'hidden',
    },
    discountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing[4],
    },
    discountBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    discountLeft: { flexDirection: 'row', alignItems: 'center' },
    discountLabel: { color: colors.pureWhite, fontWeight: '600' },
    discountPct: { color: colors.success, fontWeight: '700' },
    summary: {
      marginBottom: spacing[5],
      borderRadius: radius.lg,
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
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[3],
      alignItems: 'center',
    },
    payActive: { borderColor: colors.motionBlue },
    payText: { color: colors.pureWhite, fontWeight: '600', textAlign: 'center' },
    msg: { color: colors.success, marginBottom: spacing[3] },
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
}
