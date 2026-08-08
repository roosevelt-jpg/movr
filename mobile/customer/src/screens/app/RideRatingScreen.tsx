import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TIP_PRESETS = [100, 200, 500];

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Arrival receipt + rate + tip + DVT earned (mockup). */
export default function RideRatingScreen({
  rideId,
  driverName = '',
  onDone,
}: {
  rideId?: string;
  driverName?: string;
  onDone?: () => void;
}) {
  const [name, setName] = useState(driverName);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState<number | 'custom'>(0);
  const [customTip, setCustomTip] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(true);
  const [receiptLoaded, setReceiptLoaded] = useState(false);
  const [msg, setMsg] = useState('');
  const [receipt, setReceipt] = useState({
    destination: '',
    durationMinutes: 0,
    distanceKm: 0,
    baseFare: 0,
    distanceFare: 0,
    dvtDiscount: 0,
    totalPaid: 0,
    dvtEarned: 0,
    currency: 'NGN',
  });

  useEffect(() => {
    if (!rideId) {
      setLoadingReceipt(false);
      setMsg('Ride not found');
      return;
    }
    fetch(`${API}/rides/${rideId}/receipt`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (!d) return;
        setReceipt({
          destination: d.destination || '',
          durationMinutes: Number(d.durationMinutes || 0),
          distanceKm: Number(d.distanceKm || 0),
          baseFare: Number(d.baseFare || 0),
          distanceFare: Number(d.distanceFare || 0),
          dvtDiscount: Number(d.dvtDiscount || 0),
          totalPaid: Number(d.totalPaid || 0),
          dvtEarned: Number(d.dvtEarned || 0),
          currency: d.currency || 'NGN',
        });
        setReceiptLoaded(true);
        if (d.driverFirstName) setName(d.driverFirstName);
      })
      .catch((e) => setMsg(e?.message || 'Could not load receipt'))
      .finally(() => setLoadingReceipt(false));
    fetch(`${API}/rides/${rideId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data?.driver?.name;
        if (d) setName(d.split(' ')[0] || d);
      })
      .catch(() => undefined);
  }, [rideId]);

  const tipAmount = tip === 'custom' ? Number(customTip || 0) : Number(tip);

  const submit = async () => {
    setLoading(true);
    setMsg('');
    try {
      if (rideId) {
        const rateRes = await fetch(`${API}/rides/${rideId}/rate`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ rating }),
        });
        const rateJson = await rateRes.json().catch(() => ({}));
        if (!rateRes.ok) throw new Error(rateJson.message || 'Failed to save rating');
        if (tipAmount > 0) {
          await fetch(`${API}/rides/${rideId}/tip`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ amount: tipAmount }),
          }).catch(() => undefined);
        }
      }
      onDone?.();
    } catch (e: any) {
      setMsg(e.message || 'Could not submit');
    } finally {
      setLoading(false);
    }
  };

  const c = receipt.currency;

  if (loadingReceipt) {
    return (
      <View style={styles.root}>
        <Text style={styles.msg}>Loading receipt…</Text>
      </View>
    );
  }

  if (!receiptLoaded) {
    return (
      <View style={styles.root}>
        <Text style={styles.msg}>{msg || 'Receipt not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.check}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text style={styles.title}>You have arrived!</Text>
      <Text style={styles.sub}>
        {receipt.destination} · {receipt.durationMinutes} min ride
      </Text>

      <View style={styles.fareCard}>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Base fare</Text>
          <Text style={styles.fareVal}>{formatCurrency(receipt.baseFare, c)}</Text>
        </View>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Distance ({receipt.distanceKm}km)</Text>
          <Text style={styles.fareVal}>{formatCurrency(receipt.distanceFare, c)}</Text>
        </View>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>DVT discount</Text>
          <Text style={[styles.fareVal, styles.discount]}>
            -{formatCurrency(receipt.dvtDiscount, c)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.fareRow}>
          <Text style={styles.totalLabel}>Total paid</Text>
          <Text style={styles.totalVal}>{formatCurrency(receipt.totalPaid, c)}</Text>
        </View>
      </View>

      <Text style={styles.how}>How was {name}?</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)}>
            <Text style={[styles.star, n <= rating ? styles.starOn : styles.starOff]}>★</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.how}>Add a tip?</Text>
      <View style={styles.tips}>
        {TIP_PRESETS.map((t) => (
          <Pressable
            key={t}
            style={[styles.tipBtn, tip === t && styles.tipOn]}
            onPress={() => {
              setTip(t);
              setShowCustom(false);
            }}
          >
            <Text style={styles.tipText}>{formatCurrency(t, c)}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.tipBtn, (tip === 'custom' || showCustom) && styles.tipOn]}
          onPress={() => {
            setTip('custom');
            setShowCustom(true);
          }}
        >
          <Text style={styles.tipText}>Custom</Text>
        </Pressable>
      </View>
      {showCustom ? (
        <TextInput
          style={styles.customInput}
          keyboardType="numeric"
          placeholder="Enter tip amount"
          placeholderTextColor="#71717A"
          value={customTip}
          onChangeText={setCustomTip}
        />
      ) : null}

      <View style={styles.dvtBanner}>
        <Text style={styles.dvtIcon}>⛓</Text>
        <View>
          <Text style={styles.dvtTitle}>+{receipt.dvtEarned} DVT tokens earned</Text>
          <Text style={styles.dvtSub}>Added to your wallet</Text>
        </View>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <Text style={styles.ctaText}>{loading ? 'Submitting…' : 'Submit & Done'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  check: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkMark: { color: '#000', fontSize: 28, fontWeight: '900' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#A1A1AA', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  fareCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  fareLabel: { color: '#A1A1AA' },
  fareVal: { color: '#fff', fontWeight: '600' },
  discount: { color: '#22C55E' },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 8 },
  totalLabel: { color: '#fff', fontWeight: '700' },
  totalVal: { color: '#fff', fontWeight: '800', fontSize: 18 },
  how: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 12 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  star: { fontSize: 32 },
  starOn: { color: '#F59E0B' },
  starOff: { color: '#3F3F46' },
  tips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tipBtn: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#141414',
  },
  tipOn: { borderColor: '#A855F7' },
  tipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  customInput: {
    backgroundColor: '#141414',
    borderRadius: 12,
    color: '#fff',
    padding: 12,
    marginBottom: 16,
  },
  dvtBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E1033',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  dvtIcon: { fontSize: 22 },
  dvtTitle: { color: '#fff', fontWeight: '700' },
  dvtSub: { color: '#A1A1AA', fontSize: 12, marginTop: 2 },
  msg: { color: '#F87171', marginBottom: 8 },
  cta: {
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
