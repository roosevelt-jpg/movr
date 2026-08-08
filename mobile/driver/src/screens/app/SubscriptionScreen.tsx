import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
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

/** Driver Plans — free trial banner, weekly/monthly cards (mockup). */
export default function SubscriptionScreen({ onBack }: { onBack?: () => void }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [meta, setMeta] = useState({
    tagline: 'Keep 100% of earnings',
    description:
      'No commissions ever. Pay a flat weekly or monthly subscription and earn everything you make.',
  });
  const [selected, setSelected] = useState('monthly_driver');
  const [trial, setTrial] = useState({
    trial: true,
    trialLabel: 'Currently on Free Trial',
    trialHint: '3 days remaining · Subscribe to continue',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/subscriptions/plans`)
      .then((r) => r.json())
      .then((j) => {
        const list = (j?.data || []).filter(
          (p: any) =>
            String(p.id).includes('weekly') ||
            String(p.id).includes('monthly') ||
            p.isFeatured
        );
        const fallback = j?.data || [];
        const use = list.length ? list : fallback.slice(0, 2);
        setPlans(use);
        if (j?.meta) setMeta((m) => ({ ...m, ...j.meta }));
        const featured = use.find((p: any) => p.isFeatured) || use[1] || use[0];
        if (featured?.id) setSelected(String(featured.id));
      })
      .catch(() => {
        setPlans([
          {
            id: 'weekly_driver',
            name: 'Weekly',
            amount: 2500,
            currency: 'NGN',
            interval: 'weekly',
            subtitle: 'Flexible · Cancel anytime',
            features: ['0% commission on all rides', 'Unlimited trips', 'DVT token rewards included'],
          },
          {
            id: 'monthly_driver',
            name: 'Monthly',
            amount: 7000,
            currency: 'NGN',
            interval: 'monthly',
            subtitle: 'Most popular · Auto-renews',
            badgeLabel: 'BEST VALUE · SAVE 30%',
            isFeatured: true,
            features: [
              '0% commission on all rides',
              'Priority ride matching',
              '2x DVT token rewards',
              'Gold driver badge',
            ],
          },
        ]);
      });

    fetch(`${API}/subscriptions/me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setTrial((t) => ({ ...t, ...j.data }));
      })
      .catch(() => undefined);
  }, []);

  const choice = useMemo(
    () => plans.find((p) => String(p.id) === selected) || plans[0],
    [plans, selected]
  );

  const activate = async () => {
    if (!choice?.id) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/subscriptions/activate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planId: choice.id, paymentMethod: 'wallet' }),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setMsg(json.message || 'Activation failed');
      } else {
        setMsg('Subscribed');
        setTrial({
          trial: false,
          trialLabel: null as any,
          trialHint: null as any,
          status: 'active',
        } as any);
      }
    } catch (e: any) {
      setMsg(e.message || 'Activation failed');
    } finally {
      setBusy(false);
    }
  };

  const priceLabel = (p: any) => {
    const cur = p.currency || 'NGN';
    const amt = formatCurrency(Number(p.amount || 0), cur);
    const unit = String(p.interval || '').includes('week') ? '/week' : '/month';
    return `${amt} ${unit}`;
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
        <Text style={styles.title}>Driver Plans</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.hero}>{meta.tagline}</Text>
      <Text style={styles.sub}>{meta.description}</Text>

      {trial.trial ? (
        <View style={styles.trial}>
          <Text style={styles.trialCheck}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.trialTitle}>{trial.trialLabel || 'Currently on Free Trial'}</Text>
            <Text style={styles.trialHint}>
              {trial.trialHint || '3 days remaining · Subscribe to continue'}
            </Text>
          </View>
        </View>
      ) : null}

      {plans.map((p) => {
        const on = String(p.id) === selected;
        const features: string[] = Array.isArray(p.features)
          ? p.features
          : typeof p.features === 'string'
            ? (() => {
                try {
                  return JSON.parse(p.features);
                } catch {
                  return [];
                }
              })()
            : [];
        return (
          <Pressable
            key={p.id}
            style={[styles.card, on && styles.cardOn]}
            onPress={() => setSelected(String(p.id))}
          >
            {(p.badgeLabel || p.badge_label) && on ? (
              <View style={styles.best}>
                <Text style={styles.bestText}>{p.badgeLabel || p.badge_label}</Text>
              </View>
            ) : null}
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{p.headline || p.name}</Text>
                <Text style={styles.cardSub}>{p.subtitle || ''}</Text>
              </View>
              <Text style={styles.cardPrice}>{priceLabel(p)}</Text>
            </View>
            {features.map((f) => (
              <View key={f} style={styles.feat}>
                <Text style={styles.featCheck}>✓</Text>
                <Text style={styles.featText}>{f}</Text>
              </View>
            ))}
            {on ? (
              <Pressable style={styles.cta} onPress={activate} disabled={busy}>
                <View style={styles.ctaGlow} />
                <Text style={styles.ctaText}>
                  {busy
                    ? 'Subscribing…'
                    : `Subscribe · ${formatCurrency(Number(p.amount || 0), p.currency || 'NGN')}/${
                        String(p.interval || '').includes('week') ? 'wk' : 'mo'
                      }`}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <Text style={styles.foot}>Cancel anytime from your profile settings.</Text>
      <Text style={styles.footMuted}>No hidden fees. DVT tokens cover subscription costs.</Text>
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
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  hero: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: spacing[2] },
  sub: { color: 'rgba(255,255,255,0.5)', marginTop: 8, marginBottom: spacing[4], lineHeight: 20 },
  trial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 14,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  trialCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    backgroundColor: '#22C55E',
    color: '#052E16',
    fontWeight: '800',
    overflow: 'hidden',
  },
  trialTitle: { color: '#4ADE80', fontWeight: '700', fontSize: 15 },
  trialHint: { color: 'rgba(74,222,128,0.75)', marginTop: 2, fontSize: 13 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  cardOn: { borderColor: '#8B5CF6' },
  best: {
    alignSelf: 'center',
    marginTop: -26,
    marginBottom: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  bestText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[3] },
  cardName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  cardSub: { color: 'rgba(255,255,255,0.45)', marginTop: 4, fontSize: 13 },
  cardPrice: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  feat: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  featCheck: { color: '#22C55E', marginRight: 10, fontWeight: '800' },
  featText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  cta: {
    marginTop: spacing[3],
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    overflow: 'hidden',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.45,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', zIndex: 1 },
  msg: { color: '#4ADE80', textAlign: 'center', marginBottom: spacing[2] },
  foot: { color: 'rgba(255,255,255,0.45)', textAlign: 'center', fontSize: 12, marginTop: spacing[2] },
  footMuted: {
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 6,
  },
});
