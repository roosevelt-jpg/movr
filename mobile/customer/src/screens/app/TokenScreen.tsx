import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const CHIPS = [500, 1000, 2000, 'all'] as const;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const ICONS: Record<string, string> = {
  car: '🚗',
  bag: '🛍',
  cash: '💰',
};

/** Redeem DVT Tokens — balance, options, amount chips, summary (mockup). */
export default function TokenScreen({ onBack }: { onBack?: () => void }) {
  const [balance, setBalance] = useState(2400);
  const [options, setOptions] = useState<any[]>([]);
  const [optionId, setOptionId] = useState('ride_credits');
  const [chip, setChip] = useState<number | 'all'>(1000);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    Promise.all([
      fetch(`${API}/token/balance`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/token/redeem-options`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([b, o]) => {
      if (b?.data?.total != null) setBalance(Number(b.data.total));
      const list = Array.isArray(o?.data) && o.data.length
        ? o.data
        : [
            {
              id: 'ride_credits',
              label: 'Ride Credits',
              icon: 'car',
              dvtCost: 500,
              rewardValue: 1000,
              rateLabel: '500 DVT → ₦1,000 ride credit',
              tags: ['Best value', 'Most popular'],
              tagTone: 'violet',
              rewardType: 'ride_credit',
              rewardUnit: 'ride credit',
            },
            {
              id: 'order_discount',
              label: 'Order Discount',
              icon: 'bag',
              dvtCost: 300,
              rewardValue: 500,
              rateLabel: '300 DVT → ₦500 off any order',
              tags: [],
              rewardType: 'order_discount',
              rewardUnit: 'off any order',
            },
            {
              id: 'cash_withdrawal',
              label: 'Cash Withdrawal',
              icon: 'cash',
              dvtCost: 1000,
              rewardValue: 1800,
              rateLabel: '1,000 DVT → ₦1,800 to wallet',
              tags: ['Lower rate', 'Instant'],
              tagTone: 'amber',
              rewardType: 'wallet_cash',
              rewardUnit: 'to wallet',
            },
          ];
      setOptions(list);
      if (!list.find((x: any) => x.id === optionId) && list[0]) setOptionId(list[0].id);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const option = options.find((o) => o.id === optionId) || options[0];
  const amount = chip === 'all' ? balance : Number(chip);

  const youReceive = useMemo(() => {
    if (!option || !amount) return '—';
    const units = amount / Number(option.dvtCost || 1);
    const value = Math.round(units * Number(option.rewardValue || 0));
    const unit =
      option.rewardType === 'ride_credit'
        ? 'ride credit'
        : option.rewardType === 'order_discount'
          ? 'order discount'
          : 'to wallet';
    return `₦${value.toLocaleString()} ${unit}`;
  }, [option, amount]);

  const redeem = async () => {
    if (!option || amount <= 0) return;
    if (amount > balance) {
      setMsg('Insufficient DVT');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/token/redeem`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount, optionId: option.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Redeem failed');
      setMsg(json.data?.youReceive ? `Redeemed · ${json.data.youReceive}` : 'Redeemed');
      load();
    } catch (e: any) {
      setMsg(e.message || 'Redeem failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.title}>Redeem DVT Tokens</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.balanceCard}>
        <View style={styles.glowA} />
        <View style={styles.glowB} />
        <Text style={styles.balLab}>YOUR DVT BALANCE</Text>
        <Text style={styles.balVal}>{Number(balance).toLocaleString()} DVT</Text>
      </View>

      <Text style={styles.section}>REDEEM FOR</Text>
      {options.map((o) => {
        const on = o.id === optionId;
        return (
          <Pressable
            key={o.id}
            style={[styles.opt, on && styles.optOn]}
            onPress={() => setOptionId(o.id)}
          >
            <Text style={styles.optIcon}>{ICONS[o.icon] || '⛓'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.optLabel}>{o.label}</Text>
              <Text style={styles.optRate}>{o.rateLabel}</Text>
              {Array.isArray(o.tags) && o.tags.length ? (
                <Text
                  style={[
                    styles.optTags,
                    o.tagTone === 'amber' ? styles.optTagsAmber : styles.optTagsViolet,
                  ]}
                >
                  {o.tags.join(' · ')}
                </Text>
              ) : null}
            </View>
            <View style={[styles.check, on && styles.checkOn]}>
              {on ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
          </Pressable>
        );
      })}

      <Text style={styles.section}>AMOUNT TO REDEEM</Text>
      <View style={styles.chips}>
        {CHIPS.map((c) => {
          const on = chip === c;
          const label = c === 'all' ? 'All' : Number(c).toLocaleString();
          return (
            <Pressable
              key={String(c)}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setChip(c)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summary}>
        <View style={styles.sumRow}>
          <Text style={styles.sumLab}>Redeeming</Text>
          <Text style={styles.sumVal}>{amount.toLocaleString()} DVT</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLab}>You receive</Text>
          <Text style={styles.sumGreen}>{youReceive}</Text>
        </View>
      </View>

      <Pressable
        style={[styles.cta, (busy || amount <= 0) && styles.ctaDisabled]}
        onPress={redeem}
        disabled={busy || amount <= 0}
      >
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>
          {busy ? 'Redeeming…' : `Redeem ${amount.toLocaleString()} DVT`}
        </Text>
      </Pressable>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', paddingHorizontal: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
  },
  back: { color: '#FFFFFF', fontSize: 22 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  balanceCard: {
    borderRadius: 18,
    padding: spacing[5],
    marginBottom: spacing[5],
    overflow: 'hidden',
    backgroundColor: '#5B21B6',
  },
  glowA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#7C3AED', opacity: 0.85 },
  glowB: {
    position: 'absolute',
    right: -40,
    top: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#3B82F6',
    opacity: 0.55,
  },
  balLab: {
    color: 'rgba(237,233,254,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    zIndex: 1,
  },
  balVal: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 8, zIndex: 1 },
  section: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  optOn: { borderColor: '#8B5CF6' },
  optIcon: { fontSize: 22, marginRight: 12 },
  optLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  optRate: { color: 'rgba(255,255,255,0.45)', marginTop: 4, fontSize: 13 },
  optTags: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  optTagsViolet: { color: '#A78BFA' },
  optTagsAmber: { color: '#D97706' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  checkMark: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  chips: { flexDirection: 'row', gap: 10, marginBottom: spacing[5] },
  chip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    backgroundColor: '#141414',
    paddingVertical: 12,
    alignItems: 'center',
  },
  chipOn: { borderColor: '#8B5CF6', backgroundColor: '#1A1228' },
  chipText: { color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  chipTextOn: { color: '#FFFFFF' },
  summary: {
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sumLab: { color: 'rgba(255,255,255,0.5)' },
  sumVal: { color: '#FFFFFF', fontWeight: '600' },
  sumGreen: { color: '#4ADE80', fontWeight: '800' },
  cta: {
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    overflow: 'hidden',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B82F6', opacity: 0.4 },
  ctaText: { color: '#FFFFFF', fontWeight: '800', zIndex: 1 },
  msg: { color: '#4ADE80', textAlign: 'center', marginTop: spacing[3] },
});
