import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Linking } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const WEB = String(process.env.EXPO_PUBLIC_WEB_URL || 'https://mymovr.io').replace(/\/$/, '');

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Driver account — legal links and Play Store in-app account deletion. */
export default function DriverAccountScreen({
  onBack,
  onDeleted,
}: {
  onBack?: () => void;
  onDeleted?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const deleteAccount = () => {
    Alert.alert(
      'Delete driver account',
      'This deactivates your Movr Driver account and anonymizes your profile. Withdraw any wallet balance first. Records required for tax, disputes, or safety may be kept in limited form.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await fetch(`${API}/me/account/delete`, {
                method: 'POST',
                headers: authHeaders(),
                body: '{}',
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json.message || 'Could not delete account');
              onDeleted?.();
            } catch (e: any) {
              Alert.alert('Could not delete account', e?.message || 'Email support@mymovr.io');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const open = (path: string) => Linking.openURL(`${WEB}/${path}`).catch(() => undefined);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      {onBack ? (
        <Pressable onPress={onBack} style={{ marginBottom: spacing[3] }}>
          <Text style={styles.back}>← Account</Text>
        </Pressable>
      ) : (
        <Text style={styles.title}>Account</Text>
      )}

      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => open('privacy')}>
          <Text style={styles.label}>Privacy policy</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => open('driver-terms')}>
          <Text style={styles.label}>Driver terms</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => open('support')}>
          <Text style={styles.label}>Support</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={deleteAccount} disabled={busy}>
          <Text style={styles.delete}>{busy ? 'Deleting…' : 'Delete account'}</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[5] },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: spacing[4] },
  back: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: { backgroundColor: '#141414', borderRadius: 16, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#27272A',
  },
  label: { flex: 1, color: '#FAFAFA', fontWeight: '600', fontSize: 16 },
  chev: { color: '#71717A', fontSize: 22 },
  delete: { flex: 1, color: '#F87171', fontWeight: '700', fontSize: 16 },
});
