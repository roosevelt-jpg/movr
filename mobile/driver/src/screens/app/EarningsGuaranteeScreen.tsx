import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';
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

/** Driver earnings floor guarantee enrollment. */
export default function EarningsGuaranteeScreen({ onBack }: { onBack?: () => void }) {
  const [minAmount, setMinAmount] = useState('80');
  const [windowHours, setWindowHours] = useState('8');
  const [currency, setCurrency] = useState('GHS');
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API}/rails/driver/guarantee`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setRows(j?.data || []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, []);

  const enroll = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/rails/driver/guarantee`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          minAmount: Number(minAmount),
          windowHours: Number(windowHours),
          currency,
        }),
      });
      const j = await res.json();
      setMsg(res.ok ? 'Guarantee enrolled' : j.message || 'Failed');
      load();
    } catch (e: any) {
      setMsg(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Earnings</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Income floor</Text>
      <Text style={styles.sub}>
        Enroll in a shift guarantee — platform tops up if you miss the floor after online hours.
      </Text>
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      <TextInput
        style={styles.input}
        value={minAmount}
        onChangeText={setMinAmount}
        placeholder="Min amount"
        placeholderTextColor="#666"
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        value={windowHours}
        onChangeText={setWindowHours}
        placeholder="Window hours"
        placeholderTextColor="#666"
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        value={currency}
        onChangeText={setCurrency}
        placeholder="Currency"
        placeholderTextColor="#666"
        autoCapitalize="characters"
      />
      <Pressable style={styles.btn} onPress={enroll} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Enrolling…' : 'Enroll guarantee'}</Text>
      </Pressable>

      <Text style={styles.h2}>Your guarantees</Text>
      {rows.length === 0 ? (
        <Text style={styles.sub}>None yet</Text>
      ) : (
        rows.slice(0, 8).map((r) => (
          <View key={r.id} style={styles.chip}>
            <Text style={styles.chipTitle}>
              {r.status} · {formatCurrency(Number(r.min_amount || 0), r.currency || currency)} /{' '}
              {r.window_hours}h
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  back: { color: '#a1a1aa', marginBottom: 8 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: '#a1a1aa', marginTop: 6, marginBottom: 14, fontSize: 13 },
  ok: { color: '#34d399', marginBottom: 8 },
  h2: { color: '#fff', fontWeight: '700', fontSize: 17, marginTop: 18, marginBottom: 8 },
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
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  chip: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  chipTitle: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
