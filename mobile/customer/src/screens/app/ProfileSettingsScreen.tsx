import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
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

/** Profile / settings — ACCOUNT + SUPPORT + Sign out (mockup). */
export default function ProfileSettingsScreen({
  onSignOut,
  onEditProfile,
  onHelp,
  onPrivacy,
  onNotifications,
}: {
  onSignOut?: () => void;
  onEditProfile?: () => void;
  onHelp?: () => void;
  onPrivacy?: () => void;
  onNotifications?: () => void;
}) {
  const [name, setName] = useState('Ama Konadu');
  const [phone, setPhone] = useState('+233 24 000 0000');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [notifications, setNotifications] = useState('On');
  const [region, setRegion] = useState('English, Ghana');

  useEffect(() => {
    fetch(`${API}/users/me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const u = j.data || j;
        if (u.firstName || u.name) {
          setName(u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim());
        }
        if (u.phone) {
          const p = String(u.phone);
          setPhone(p.replace(/^\+233(\d{2})(\d{3})(\d{4})$/, '+233 $1 $2 $3') || p);
        }
        if (u.avatarUrl) setAvatarUrl(u.avatarUrl);
        if (u.languageRegion) setRegion(u.languageRegion);
        else if (u.language || u.region) {
          setRegion(`${u.language || 'English'}, ${u.region || 'Ghana'}`);
        }
        if (typeof u.notificationsEnabled === 'boolean') {
          setNotifications(u.notificationsEnabled ? 'On' : 'Off');
        }
      })
      .catch(() => undefined);
  }, []);

  const toggleNotifications = async () => {
    const nextOn = notifications !== 'On';
    setNotifications(nextOn ? 'On' : 'Off');
    onNotifications?.();
    await fetch(`${API}/users/me/settings`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        notificationsEnabled: nextOn,
        language: 'English',
        region: 'Ghana',
      }),
    }).catch(() => undefined);
  };

  const Row = ({
    icon,
    label,
    value,
    onPress,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
  }) => (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : <Text style={styles.chev}>›</Text>}
    </Pressable>
  );

  const signOut = () => {
    try {
      delete (globalThis as any).__MOVR_TOKEN__;
      if (typeof localStorage !== 'undefined') localStorage.removeItem('movr_token');
    } catch {
      /* ignore */
    }
    onSignOut?.();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.phone}>{phone}</Text>
        </View>
      </View>

      <Text style={styles.section}>ACCOUNT</Text>
      <View style={styles.divider} />
      <View style={styles.group}>
        <Row icon="✎" label="Edit profile" onPress={onEditProfile} />
        <Row icon="🔔" label="Notifications" value={notifications} onPress={toggleNotifications} />
        <Row
          icon="🗺"
          label="Language & region"
          value={region}
          onPress={() => setRegion('English, Ghana')}
        />
      </View>

      <Text style={styles.section}>SUPPORT</Text>
      <View style={styles.divider} />
      <View style={styles.group}>
        <Row icon="?" label="Help centre" onPress={onHelp} />
        <Row icon="🛡" label="Privacy & security" onPress={onPrivacy} />
      </View>

      <Pressable onPress={signOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', paddingHorizontal: spacing[5] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2A2A2A',
  },
  name: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  phone: { color: '#A1A1AA', marginTop: 4, fontSize: 14 },
  section: {
    color: '#71717A',
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2A2A2A',
    marginBottom: 4,
  },
  group: { marginBottom: spacing[5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
  },
  rowIcon: { width: 28, fontSize: 16, color: '#A1A1AA' },
  rowLabel: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  rowValue: { color: '#A1A1AA', fontSize: 14 },
  chev: { color: '#71717A', fontSize: 22, fontWeight: '300' },
  signOut: { alignItems: 'center', marginTop: spacing[6] },
  signOutText: { color: '#F07178', fontSize: 16, fontWeight: '600' },
});
