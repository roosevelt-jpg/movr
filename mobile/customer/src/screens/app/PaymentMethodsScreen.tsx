import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
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

/** Payment Methods — Visa default, MC remove, MoMo, MetaMask (mockup). */
export default function PaymentMethodsScreen({
  onBack,
  onAdd,
}: {
  onBack?: () => void;
  onAdd?: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);

  const load = () => {
    fetch(`${API}/me/payment-instruments`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setItems(j.data || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = (id: string) => {
    Alert.alert('Remove method', 'Remove this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${API}/me/payment-instruments/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
          }).catch(() => undefined);
          setItems((list) => list.filter((x) => x.id !== id));
        },
      },
    ]);
  };

  const defaultCard = items.find((i) => i.isDefault && i.type === 'card') || items.find((i) => i.brand === 'visa');
  const others = items.filter((i) => i.id !== defaultCard?.id);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>Payment Methods</Text>
      </View>

      {defaultCard ? (
        <View style={styles.visaCard}>
          <View style={styles.visaTop}>
            <Text style={styles.visaBrand}>VISA</Text>
            <View style={styles.defaultPill}>
              <Text style={styles.defaultText}>DEFAULT</Text>
            </View>
          </View>
          <Text style={styles.visaNum}>**** **** **** {defaultCard.lastFour}</Text>
          <View style={styles.visaBottom}>
            <View>
              <Text style={styles.visaLab}>CARD HOLDER</Text>
              <Text style={styles.visaVal}>{defaultCard.cardholderName || '—'}</Text>
            </View>
            <View>
              <Text style={styles.visaLab}>EXPIRES</Text>
              <Text style={styles.visaVal}>{defaultCard.expires || '08/27'}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {others.map((m) => {
        if (m.type === 'card' || m.brand === 'mastercard') {
          return (
            <View key={m.id} style={styles.row}>
              <View style={styles.iconBox}>
                <Text style={styles.mc}>MC</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>•••• {m.lastFour}</Text>
                <Text style={styles.rowSub}>
                  Mastercard · Expires {m.expires || '03/26'}
                </Text>
              </View>
              <Pressable onPress={() => remove(m.id)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          );
        }
        if (m.type === 'momo' || m.brand === 'momo') {
          return (
            <View key={m.id} style={styles.row}>
              <View style={styles.iconBox}>
                <Text>📱</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>MTN MoMo</Text>
                <Text style={styles.rowSub}>{m.phone || '+234 801 234 5678'}</Text>
              </View>
              <View style={styles.activePill}>
                <Text style={styles.activeText}>Active</Text>
              </View>
            </View>
          );
        }
        return (
          <View key={m.id} style={styles.row}>
            <View style={styles.iconBox}>
              <Text>🦊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>MetaMask</Text>
              <Text style={styles.rowSub}>
                {m.walletAddress || '0x3a4F...9d2c'} · {m.network || 'Polygon'}
              </Text>
            </View>
            <View style={styles.activePill}>
              <Text style={styles.activeText}>Active</Text>
            </View>
          </View>
        );
      })}

      <Pressable
        style={styles.addBtn}
        onPress={() => {
          onAdd?.();
          Alert.alert('Add Payment Method', 'Card, MoMo, or crypto wallet can be linked from Wallet.');
        }}
      >
        <Text style={styles.addText}>＋  Add Payment Method</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: spacing[4], marginBottom: spacing[4] },
  back: { color: '#FFF', fontSize: 22 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  visaCard: {
    borderRadius: 18,
    padding: spacing[4],
    marginBottom: spacing[4],
    backgroundColor: '#1E1B4B',
  },
  visaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visaBrand: { color: '#FFF', fontWeight: '900', fontSize: 18, letterSpacing: 2 },
  defaultPill: {
    backgroundColor: '#8E2DE2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  defaultText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  visaNum: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
    marginVertical: spacing[5],
  },
  visaBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  visaLab: { color: '#A1A1AA', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  visaVal: { color: '#FFF', fontWeight: '700', marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: spacing[3],
    marginBottom: 10,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mc: { color: '#F97316', fontWeight: '900', fontSize: 11 },
  rowTitle: { color: '#FFF', fontWeight: '700' },
  rowSub: { color: '#71717A', fontSize: 12, marginTop: 3 },
  remove: { color: '#EF4444', fontWeight: '700' },
  activePill: {
    backgroundColor: '#14532D',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeText: { color: '#4ADE80', fontWeight: '700', fontSize: 12 },
  addBtn: {
    marginTop: spacing[3],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#8E2DE2',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    alignItems: 'center',
  },
  addText: { color: '#8E2DE2', fontWeight: '800', fontSize: 15 },
});
