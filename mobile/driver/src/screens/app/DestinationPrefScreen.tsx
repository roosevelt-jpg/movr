import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';

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

/** Driver destination preference — prefer trips toward home/airport. */
export default function DestinationPrefScreen({ onBack }: { onBack?: () => void }) {
  const [label, setLabel] = useState('Home');
  const [destLat, setDestLat] = useState('5.6037');
  const [destLng, setDestLng] = useState('-0.1870');
  const [radiusKm, setRadiusKm] = useState('5');
  const [hours, setHours] = useState('4');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/rails/driver/destination`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          destLat: Number(destLat),
          destLng: Number(destLng),
          label,
          radiusKm: Number(radiusKm),
          hours: Number(hours),
          bonusAccept: 1.05,
        }),
      });
      const j = await res.json();
      setMsg(res.ok ? 'Destination preference set' : j.message || 'Failed');
    } catch (e: any) {
      setMsg(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    const res = await fetch(`${API}/rails/driver/destination`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const j = await res.json();
    setMsg(res.ok ? 'Destination cleared' : j.message || 'Failed');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Earnings</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Destination mode</Text>
      <Text style={styles.sub}>Prefer trips heading toward a place — still 0% take-rate.</Text>
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="Label (Home, Airport…)"
        placeholderTextColor="#666"
      />
      <TextInput
        style={styles.input}
        value={destLat}
        onChangeText={setDestLat}
        placeholder="Dest lat"
        placeholderTextColor="#666"
        keyboardType="decimal-pad"
      />
      <TextInput
        style={styles.input}
        value={destLng}
        onChangeText={setDestLng}
        placeholder="Dest lng"
        placeholderTextColor="#666"
        keyboardType="decimal-pad"
      />
      <TextInput
        style={styles.input}
        value={radiusKm}
        onChangeText={setRadiusKm}
        placeholder="Radius km"
        placeholderTextColor="#666"
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        value={hours}
        onChangeText={setHours}
        placeholder="Hours active"
        placeholderTextColor="#666"
        keyboardType="numeric"
      />
      <Pressable style={styles.btn} onPress={save} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Saving…' : 'Set preference'}</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.mutedBtn]} onPress={clear}>
        <Text style={styles.btnText}>Clear</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  back: { color: '#a1a1aa', marginBottom: 8 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: '#a1a1aa', marginTop: 6, marginBottom: 14, fontSize: 13 },
  ok: { color: '#34d399', marginBottom: 8 },
  input: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  mutedBtn: { backgroundColor: '#27272a' },
  btnText: { color: '#fff', fontWeight: '700' },
});
