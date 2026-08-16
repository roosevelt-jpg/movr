import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
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

export default function CorporateDeskScreen({
  onBack,
  onOpenRide,
}: {
  onBack?: () => void;
  onOpenRide?: (rideId: string) => void;
}) {
  const [desk, setDesk] = useState<any>(null);
  const [name, setName] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [msg, setMsg] = useState('');

  const load = () =>
    fetch(`${API}/verified/orgs`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(async (j) => {
        const org = (j?.data || [])[0];
        if (!org) {
          setDesk(null);
          return;
        }
        const d = await fetch(`${API}/verified/orgs/${org.id}`, { headers: authHeaders() }).then((r) =>
          r.json()
        );
        setDesk(d?.data);
      })
      .catch(() => undefined);

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const res = await fetch(`${API}/verified/orgs`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name }),
    });
    const j = await res.json();
    setMsg(res.ok ? 'Pilot opened' : j.message || 'Failed');
    load();
  };

  const movement = async () => {
    if (!desk?.org?.id) return;
    const res = await fetch(`${API}/verified/movements`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        orgId: desk.org.id,
        pickupLat: 6.52,
        pickupLng: 3.37,
        dropoffLat: 6.45,
        dropoffLng: 3.4,
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        vehicles: [{ classCode: 'executive' }, { classCode: 'classic' }],
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? `${j?.data?.bookings?.length || 0} cars booked` : j.message || 'Failed');
    load();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#000' }} contentContainerStyle={{ padding: 16 }}>
      <Pressable onPress={onBack}>
        <Text style={{ color: '#A1A1AA' }}>← Back</Text>
      </Pressable>
      <Text style={styles.h1}>Company desk</Text>
      {!desk ? (
        <View>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Company name"
            placeholderTextColor="#71717a"
          />
          <Pressable style={styles.cta} onPress={create}>
            <Text style={styles.ctaTxt}>Start 30-day pilot</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.sub}>
            {desk.org.name} · {desk.live?.length || 0} live
          </Text>
          <TextInput
            style={styles.input}
            value={pickup}
            onChangeText={setPickup}
            placeholder="Movement pickup"
            placeholderTextColor="#71717a"
          />
          <TextInput
            style={styles.input}
            value={dropoff}
            onChangeText={setDropoff}
            placeholder="Drop-off"
            placeholderTextColor="#71717a"
          />
          <Pressable style={styles.cta} onPress={movement}>
            <Text style={styles.ctaTxt}>Book 2 verified cars</Text>
          </Pressable>
          {(desk.trips || []).map((t: any) => (
            <Pressable
              key={t.id}
              style={styles.card}
              onPress={() => t.ride_id && onOpenRide?.(String(t.ride_id))}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>{t.title}</Text>
              <Text style={{ color: '#A1A1AA', fontSize: 12, marginTop: 4 }}>
                {t.status} · {formatCurrency(Number(t.quoted_fare), t.currency_code)} · {t.escrow_status}
              </Text>
            </Pressable>
          ))}
        </>
      )}
      {msg ? <Text style={{ color: '#A78BFA', marginTop: 10 }}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  sub: { color: '#A1A1AA', marginBottom: 12 },
  input: {
    backgroundColor: '#18181b',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cta: { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  ctaTxt: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: '#18181b', borderRadius: 14, padding: 12, marginBottom: 8 },
});
