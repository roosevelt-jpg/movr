import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
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

/** Merchant mobile returns inbox. */
export default function MerchantReturnsScreen({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/merchant/returns`, { headers: authHeaders() });
      const j = await res.json();
      setRows(Array.isArray(j?.data) ? j.data : j?.data?.rows || []);
    } catch (e: any) {
      setMsg(e.message || 'Could not load returns');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, status: string) => {
    const res = await fetch(`${API}/merchant/returns/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    const j = await res.json();
    setMsg(res.ok ? `Marked ${status}` : j.message || 'Failed');
    await load();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Returns</Text>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      {rows.length === 0 ? <Text style={styles.muted}>No returns.</Text> : null}
      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.cardTitle}>{r.reason || r.status || 'Return'}</Text>
          <Text style={styles.muted}>
            {r.status} · {r.order_id ? String(r.order_id).slice(0, 8) : ''}
          </Text>
          {String(r.status || '').toLowerCase() === 'requested' ||
          String(r.status || '').toLowerCase() === 'open' ? (
            <View style={styles.row}>
              <Pressable style={styles.btn} onPress={() => patch(r.id, 'approved')}>
                <Text style={styles.btnText}>Approve</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.deny]} onPress={() => patch(r.id, 'rejected')}>
                <Text style={styles.btnText}>Reject</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', padding: spacing[4] },
  back: { color: '#a1a1aa', marginBottom: 8 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  muted: { color: '#71717a', fontSize: 12, marginTop: 4 },
  msg: { color: '#34d399', marginBottom: 8 },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardTitle: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: {
    flex: 1,
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deny: { backgroundColor: '#7f1d1d' },
  btnText: { color: '#fff', fontWeight: '700' },
});
