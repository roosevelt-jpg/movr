import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TABS = ['Ride', 'Shop', 'Parcel', 'Rentals'] as const;

/** Send a parcel — Standard/Express cards + Find a courier. */
export default function ParcelHomeScreen({
  activeTab = 'Parcel',
  onTabChange,
}: {
  activeTab?: (typeof TABS)[number];
  onTabChange?: (t: (typeof TABS)[number]) => void;
}) {
  const [tier, setTier] = useState<'standard' | 'express'>('standard');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const fees = { standard: 18, express: 32 };
  const etas = { standard: '45–60 min', express: '15–25 min' };

  const findCourier = async () => {
    if (!pickup || !dropoff) {
      setMsg('Enter pickup and drop-off');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/deliveries/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          tier,
          estimatedFee: fees[tier],
        }),
      });
      if (res.ok) {
        setMsg('Courier search started');
      } else {
        setMsg(`Looking for ${tier} courier · ${formatCurrency(fees[tier], 'GHS')}`);
      }
    } catch {
      setMsg(`Looking for ${tier} courier · ${formatCurrency(fees[tier], 'GHS')}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => onTabChange?.(t)} style={styles.tab}>
            <Text style={[styles.tabText, (activeTab === t || t === 'Parcel') && styles.tabOn]}>
              {t}
            </Text>
            {(activeTab === t || (t === 'Parcel' && !onTabChange)) && <View style={styles.underline} />}
          </Pressable>
        ))}
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
              <Text style={styles.cardTitle}>{t === 'standard' ? 'Standard' : 'Express'}</Text>
              <Text style={styles.cardEta}>{etas[t]}</Text>
              <Text style={styles.cardPrice}>{formatCurrency(fees[t], 'GHS')}</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  tabs: { flexDirection: 'row', gap: spacing[5], marginBottom: spacing[5] },
  tab: { paddingBottom: 8 },
  tabText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  tabOn: { color: colors.pureWhite },
  underline: {
    marginTop: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.motionBlue,
  },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
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
  dotFilled: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  dotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  input: { flex: 1, color: colors.pureWhite, paddingVertical: 14, fontSize: 15 },
  label: { color: colors.textSecondary, marginTop: spacing[3], marginBottom: spacing[2], fontSize: 13 },
  cards: { flexDirection: 'row', gap: spacing[3] },
  card: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardOn: { borderColor: colors.motionBlue },
  cardTitle: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  cardEta: { color: colors.textSecondary, marginTop: 6, fontSize: 13 },
  cardPrice: { color: colors.pureWhite, fontWeight: '700', marginTop: 10, fontSize: 16 },
  msg: { color: colors.textSecondary, marginTop: spacing[3] },
  cta: {
    marginTop: 'auto',
    marginBottom: spacing[4],
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#3F7048',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.55,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
