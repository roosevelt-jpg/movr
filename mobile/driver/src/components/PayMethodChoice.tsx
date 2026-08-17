import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export type PayChoice = {
  id: string;
  label: string;
  subtitle?: string;
  methodId?: string | null;
};

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useCheckoutMethods() {
  const [options, setOptions] = useState<PayChoice[]>([
    { id: 'wallet', label: 'Wallet balance', subtitle: 'Pay from balance' },
    { id: 'card', label: 'Card', subtitle: 'Visa / Mastercard' },
    { id: 'momo', label: 'Mobile Money', subtitle: 'MTN / Airtel / Vodafone' },
  ]);
  useEffect(() => {
    fetch(`${API}/me/checkout-methods`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data?.options) && j.data.options.length) {
          setOptions(j.data.options);
        }
      })
      .catch(() => undefined);
  }, []);
  return options;
}

/** Wallet / saved card / MoMo picker. */
export default function PayMethodChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, option?: PayChoice) => void;
}) {
  const list = useCheckoutMethods();
  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>Pay with</Text>
      {list.map((o) => {
        const on = value === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id, o)}
            style={[styles.row, on && styles.rowOn]}
          >
            <Text style={styles.label}>{o.label}</Text>
            <Text style={styles.sub}>{o.subtitle || ''}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  caption: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  row: {
    backgroundColor: '#18181B',
    borderColor: '#27272A',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rowOn: { borderColor: '#8B5CF6', backgroundColor: '#1E1B4B' },
  label: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  sub: { color: '#A1A1AA', fontSize: 12, marginTop: 2 },
});
