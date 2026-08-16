import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Switch } from 'react-native';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function VerifiedBookScreen({
  listingId,
  onBack,
  onBooked,
}: {
  listingId: string;
  onBack?: () => void;
  onBooked?: (rideId: string) => void;
}) {
  const [listing, setListing] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [product, setProduct] = useState('trip');
  const [hours, setHours] = useState('4');
  const [priority, setPriority] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/verified/listings/${listingId}`)
      .then((r) => r.json())
      .then((j) => setListing(j?.data))
      .catch(() => undefined);
  }, [listingId]);

  useEffect(() => {
    fetch(`${API}/verified/listings/${listingId}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product, hours: Number(hours), priority }),
    })
      .then((r) => r.json())
      .then((j) => setQuote(j?.data?.quote))
      .catch(() => undefined);
  }, [listingId, product, hours, priority]);

  const book = async () => {
    if (!pickup.trim() || !dropoff.trim()) {
      setMsg('Enter pickup and drop-off');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/verified/book`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          listingId,
          pickupLat: 6.5244,
          pickupLng: 3.3792,
          dropoffLat: 6.45,
          dropoffLng: 3.4,
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          product,
          hours: product === 'hourly' ? Number(hours) : undefined,
          priority,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Booking failed');
      const rideId = j?.data?.rideId;
      if (rideId) onBooked?.(String(rideId));
      else setMsg('Booked — escrow held');
    } catch (e: any) {
      setMsg(e.message || 'Could not book');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#000' }} contentContainerStyle={{ padding: 16 }}>
      <Pressable onPress={onBack}>
        <Text style={{ color: '#A1A1AA', marginBottom: 8 }}>← Fleet</Text>
      </Pressable>
      <Text style={styles.h1}>{listing?.title || 'Vehicle'}</Text>
      <Text style={styles.sub}>
        {listing?.className} · {listing?.inspection?.badge} · plate {listing?.plateMasked}
      </Text>
      <Text style={styles.note}>Fare is held until you tap “This is the car” at pickup.</Text>
      {(['trip', 'hourly', 'airport'] as const).map((p) => (
        <Pressable key={p} onPress={() => setProduct(p)} style={[styles.chip, product === p && styles.chipOn]}>
          <Text style={{ color: product === p ? '#111' : '#fff', fontWeight: '700' }}>{p}</Text>
        </Pressable>
      ))}
      {product === 'hourly' ? (
        <TextInput
          style={styles.input}
          value={hours}
          onChangeText={setHours}
          keyboardType="numeric"
          placeholder="Hours"
          placeholderTextColor="#71717a"
        />
      ) : null}
      <TextInput
        style={styles.input}
        value={pickup}
        onChangeText={setPickup}
        placeholder="Pickup"
        placeholderTextColor="#71717a"
      />
      <TextInput
        style={styles.input}
        value={dropoff}
        onChangeText={setDropoff}
        placeholder="Drop-off"
        placeholderTextColor="#71717a"
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Switch value={priority} onValueChange={setPriority} />
        <Text style={{ color: '#d4d4d8' }}>Priority sourcing (+20%)</Text>
      </View>
      <Text style={styles.fare}>
        {quote ? formatCurrency(quote.total, quote.currency) : '…'} escrow
      </Text>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <Pressable style={styles.cta} onPress={book} disabled={busy}>
        <Text style={styles.ctaTxt}>{busy ? 'Holding…' : 'Book this vehicle'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: '#A1A1AA', marginTop: 6, marginBottom: 10 },
  note: { color: '#6EE7B7', fontSize: 12, marginBottom: 12 },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3F3F46',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: '#fff' },
  input: {
    backgroundColor: '#18181b',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  fare: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 10 },
  msg: { color: '#FCA5A5', marginBottom: 8 },
  cta: { backgroundColor: '#7C3AED', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '800' },
});
