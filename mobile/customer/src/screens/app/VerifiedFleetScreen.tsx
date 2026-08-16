import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Named, inspected chauffeur vehicles — additive to compare-travel. */
export default function VerifiedFleetScreen({
  onBack,
  onOpenListing,
  onOpenCorporate,
}: {
  onBack?: () => void;
  onOpenListing?: (listingId: string) => void;
  onOpenCorporate?: () => void;
}) {
  const [classes, setClasses] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [cls, setCls] = useState('');
  const [q, setQ] = useState('');

  const load = () => {
    fetch(`${API}/verified/classes`)
      .then((r) => r.json())
      .then((j) => setClasses(j?.data || []))
      .catch(() => undefined);
    const qs = new URLSearchParams();
    if (cls) qs.set('class', cls);
    if (q.trim()) qs.set('q', q.trim());
    fetch(`${API}/verified/listings?${qs}`)
      .then((r) => r.json())
      .then((j) => setRows(j?.data || []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, [cls]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.h1}>Choose this vehicle</Text>
      <Text style={styles.sub}>Escrow until the booked car arrives. On-demand Ride is unchanged.</Text>
      <Pressable onPress={onOpenCorporate}>
        <Text style={styles.link}>Company desk →</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
        <Pressable onPress={() => setCls('')} style={[styles.chip, !cls && styles.chipOn]}>
          <Text style={[styles.chipTxt, !cls && styles.chipTxtOn]}>All</Text>
        </Pressable>
        {classes.map((c) => (
          <Pressable
            key={c.code}
            onPress={() => setCls(c.code)}
            style={[styles.chip, cls === c.code && styles.chipOn]}
          >
            <Text style={[styles.chipTxt, cls === c.code && styles.chipTxtOn]}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor="#71717a"
        />
        <Pressable style={styles.search} onPress={load}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go</Text>
        </Pressable>
      </View>
      {rows.map((l) => (
        <Pressable key={l.listingId} style={styles.card} onPress={() => onOpenListing?.(l.listingId)}>
          {l.photos?.exterior ? (
            <Image source={{ uri: l.photos.exterior }} style={styles.thumb} />
          ) : (
            <View style={styles.thumb} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{l.title}</Text>
            <Text style={styles.meta}>
              {l.className} · {l.inspection?.badge} · {l.plateMasked}
            </Text>
          </View>
          <Text style={styles.price}>
            {l.ownerPrice != null ? formatCurrency(l.ownerPrice, l.currency) : 'Quote'}
          </Text>
        </Pressable>
      ))}
      {!rows.length ? <Text style={styles.meta}>No verified vehicles in this filter yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  back: { color: '#A1A1AA', marginBottom: 8 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '800' },
  sub: { color: '#A1A1AA', marginTop: 6, marginBottom: 8 },
  link: { color: '#C4B5FD', fontWeight: '700', marginBottom: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3F3F46',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#fff' },
  chipTxt: { color: '#d4d4d8', fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: '#111' },
  input: {
    flex: 1,
    backgroundColor: '#18181b',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  search: { backgroundColor: '#3F3F46', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#27272a' },
  title: { color: '#fff', fontWeight: '800' },
  meta: { color: '#A1A1AA', fontSize: 12, marginTop: 4 },
  price: { color: '#fff', fontWeight: '800' },
});
