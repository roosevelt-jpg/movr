import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TABS = ['Ride', 'Shop', 'Parcel', 'Rentals'] as const;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Send a parcel — Standard GH₵18 / Express GH₵32 (live quote). */
export default function ParcelHomeScreen({
  activeTab = 'Parcel',
  onTabChange,
}: {
  activeTab?: (typeof TABS)[number];
  onTabChange?: (t: (typeof TABS)[number]) => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [tier, setTier] = useState<'standard' | 'express'>('standard');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [fees, setFees] = useState({ standard: 18, express: 32 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const etas = { standard: '45-60 min', express: '15-25 min' };

  useEffect(() => {
    fetch(`${API}/deliveries/quote?tier=standard`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setFees({
            standard: Number(j.data.standardFee || 18),
            express: Number(j.data.expressFee || 32),
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const findCourier = async () => {
    if (!pickup || !dropoff) {
      setMsg('Enter pickup and drop-off');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/deliveries`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          speedTier: tier,
        }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setMsg(
          `Booked ${tier} · ${formatCurrency(Number(json.data?.delivery_fee || fees[tier]), 'GHS')} · #${String(json.data?.id || '').slice(0, 8)}`
        );
      } else {
        setMsg(json.message || 'Could not book parcel');
      }
    } catch (e: any) {
      setMsg(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = activeTab === t;
          return (
            <Pressable key={t} onPress={() => onTabChange?.(t)} style={styles.tab}>
              <Text style={[styles.tabText, on && styles.tabOn]}>{t}</Text>
              {on ? <View style={styles.underline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.title}>Send a parcel</Text>

      <View style={styles.field}>
        <View style={styles.dotFilled} />
        <TextInput
          style={styles.input}
          placeholder="Pickup location"
          placeholderTextColor={colors.textSecondary}
          value={pickup}
          onChangeText={setPickup}
        />
      </View>
      <View style={styles.field}>
        <View style={styles.dotEmpty} />
        <TextInput
          style={styles.input}
          placeholder="Drop-off location"
          placeholderTextColor={colors.textSecondary}
          value={dropoff}
          onChangeText={setDropoff}
        />
      </View>

      <Text style={styles.label}>Speed</Text>
      <View style={styles.cards}>
        {(['standard', 'express'] as const).map((t) => {
          const on = tier === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTier(t)}
              style={[styles.card, on && styles.cardOn]}
            >
              <Text style={[styles.cardTitle, !on && styles.muted]}>
                {t === 'standard' ? 'Standard' : 'Express'}
              </Text>
              <Text style={[styles.cardEta, !on && styles.muted]}>{etas[t]}</Text>
              <Text style={[styles.cardPrice, !on && styles.muted]}>
                {formatCurrency(fees[t], 'GHS')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={findCourier} disabled={loading}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>{loading ? 'Finding…' : 'Find a courier'}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
    tabs: { flexDirection: 'row', gap: spacing[5], marginBottom: spacing[5] },
    tab: { paddingBottom: 8 },
    tabText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
    tabOn: { color: '#FFFFFF' },
    underline: {
      marginTop: 6,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.motionBlue || '#3B5CFF',
    },
    title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#1A1A1A',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 4,
      marginBottom: spacing[3],
    },
    dotFilled: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
    dotEmpty: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
    },
    input: { flex: 1, color: '#FFFFFF', paddingVertical: 14, fontSize: 15 },
    label: { color: colors.textSecondary, marginTop: spacing[3], marginBottom: spacing[2] },
    cards: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
    card: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: '#1A1A1A',
      padding: spacing[4],
    },
    cardOn: { borderColor: colors.motionBlue || '#3B5CFF', backgroundColor: '#111111' },
    cardTitle: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
    cardEta: { color: colors.textSecondary, marginTop: 4, fontSize: 12 },
    cardPrice: { color: '#FFFFFF', fontWeight: '700', marginTop: spacing[3], fontSize: 18 },
    muted: { color: colors.textSecondary, opacity: 0.75 },
    msg: { color: colors.success, marginBottom: spacing[3] },
    cta: {
      marginTop: 'auto' as any,
      marginBottom: spacing[4],
      borderRadius: radius.pill,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0F766E',
      overflow: 'hidden',
    },
    ctaGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.motionBlue || '#3B5CFF',
      opacity: 0.55,
    },
    ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
  });
}
