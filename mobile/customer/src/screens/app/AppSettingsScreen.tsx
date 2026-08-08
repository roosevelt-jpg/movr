import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Alert } from 'react-native';
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

type Prefs = {
  language: string;
  currencyLabel: string;
  darkMode: boolean;
  locationEnabled: boolean;
  rideNotifications: boolean;
  shoppingNotifications: boolean;
  dvtEnabled: boolean;
  walletPaymentEnabled: boolean;
};

/** Settings — language, currency, toggles, delete account (mockup). */
export default function AppSettingsScreen({
  onBack,
  onDeleted,
}: {
  onBack?: () => void;
  onDeleted?: () => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>({
    language: 'English',
    currencyLabel: 'NGN (₦)',
    darkMode: true,
    locationEnabled: true,
    rideNotifications: true,
    shoppingNotifications: true,
    dvtEnabled: true,
    walletPaymentEnabled: false,
  });

  const load = () => {
    fetch(`${API}/me/settings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setPrefs((p) => ({ ...p, ...j.data }));
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (partial: Partial<Prefs> & Record<string, any>) => {
    setPrefs((p) => ({ ...p, ...partial }));
    await fetch(`${API}/me/settings`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(partial),
    }).catch(() => undefined);
  };

  const deleteAccount = () => {
    Alert.alert('Delete Account', 'This will deactivate your Movr account. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${API}/me/account/delete`, {
            method: 'POST',
            headers: authHeaders(),
            body: '{}',
          }).catch(() => undefined);
          onDeleted?.();
        },
      },
    ]);
  };

  const RowNav = ({
    icon,
    value,
    onPress,
  }: {
    icon: string;
    value: string;
    onPress?: () => void;
  }) => (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );

  const RowToggle = ({
    icon,
    value,
    onChange,
  }: {
    icon: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={{ flex: 1 }} />
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#3F3F46', true: '#8E2DE2' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      {onBack ? (
        <Pressable onPress={onBack} style={{ marginBottom: spacing[3] }}>
          <Text style={styles.back}>← Settings</Text>
        </Pressable>
      ) : (
        <Text style={styles.title}>Settings</Text>
      )}

      <View style={styles.card}>
        <RowNav
          icon="🌐"
          value={prefs.language}
          onPress={() => patch({ language: prefs.language === 'English' ? 'Français' : 'English' })}
        />
        <RowNav
          icon="💰"
          value={prefs.currencyLabel || 'NGN (₦)'}
          onPress={() =>
            patch(
              prefs.currencyLabel?.includes('GHS')
                ? { currency: 'NGN', currencyLabel: 'NGN (₦)' }
                : { currency: 'GHS', currencyLabel: 'GHS (GH₵)' }
            )
          }
        />
        <RowToggle
          icon="🌙"
          value={prefs.darkMode}
          onChange={(v) => patch({ darkMode: v })}
        />
        <RowToggle
          icon="📍"
          value={prefs.locationEnabled}
          onChange={(v) => patch({ locationEnabled: v })}
        />
        <RowToggle
          icon="🚗"
          value={prefs.rideNotifications}
          onChange={(v) => patch({ rideNotifications: v })}
        />
        <RowToggle
          icon="🛍"
          value={prefs.shoppingNotifications}
          onChange={(v) => patch({ shoppingNotifications: v })}
        />
        <RowToggle icon="⛓" value={prefs.dvtEnabled} onChange={(v) => patch({ dvtEnabled: v })} />
        <RowToggle
          icon="💳"
          value={prefs.walletPaymentEnabled}
          onChange={(v) => patch({ walletPaymentEnabled: v })}
        />
        <Pressable style={styles.row} onPress={deleteAccount}>
          <Text style={styles.icon}>🗑</Text>
          <Text style={styles.delete}>Delete Account</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: spacing[4], paddingTop: spacing[5] },
  title: { color: '#111', fontSize: 28, fontWeight: '800', marginBottom: spacing[4] },
  back: { color: '#111', fontWeight: '700', fontSize: 16 },
  card: { backgroundColor: '#FAFAFA', borderRadius: 16, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  icon: { fontSize: 22, width: 36 },
  value: { flex: 1, color: '#18181B', fontWeight: '600', fontSize: 16 },
  chev: { color: '#A1A1AA', fontSize: 22 },
  delete: { flex: 1, color: '#DC2626', fontWeight: '700', fontSize: 16 },
});
