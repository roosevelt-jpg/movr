import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Profile / settings — ACCOUNT + SUPPORT + Sign out. */
export default function ProfileSettingsScreen({
  onSignOut,
  onEditProfile,
  onHelp,
  onPrivacy,
  onNotifications,
  onSupport,
}: {
  onSignOut?: () => void;
  onEditProfile?: () => void;
  onHelp?: () => void;
  onPrivacy?: () => void;
  onNotifications?: () => void;
  onSupport?: () => void;
}) {
  const [name, setName] = useState('Ama Konadu');
  const [phone, setPhone] = useState('+233 24 000 0000');
  const [notifications, setNotifications] = useState('On');
  const [region, setRegion] = useState('English, Ghana');

  useEffect(() => {
    fetch(`${API}/users/me`)
      .then((r) => r.json())
      .then((j) => {
        const u = j.data || j;
        if (u.firstName || u.name) {
          setName(u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim());
        }
        if (u.phone) setPhone(u.phone);
      })
      .catch(() => undefined);
  }, []);

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

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.avatar} />
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.phone}>{phone}</Text>
        </View>
      </View>

      <Text style={styles.section}>ACCOUNT</Text>
      <View style={styles.group}>
        <Row icon="✏️" label="Edit profile" onPress={onEditProfile} />
        <Row
          icon="🔔"
          label="Notifications"
          value={notifications}
          onPress={() => {
            onNotifications?.();
            setNotifications('On');
          }}
        />
        <Row
          icon="🌐"
          label="Language & region"
          value={region}
          onPress={() => setRegion('English, Ghana')}
        />
      </View>

      <Text style={styles.section}>SUPPORT</Text>
      <View style={styles.group}>
        <Row icon="❓" label="Help centre" onPress={onHelp} />
        <Row icon="💬" label="Chat with support" onPress={onSupport} />
        <Row icon="🛡" label="Privacy & security" onPress={onPrivacy} />
      </View>

      <Pressable onPress={onSignOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, paddingHorizontal: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.border,
  },
  name: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  phone: { color: colors.textSecondary, marginTop: 4, fontSize: 14 },
  section: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  group: { marginBottom: spacing[5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: { width: 28, fontSize: 16 },
  rowLabel: { flex: 1, color: colors.pureWhite, fontSize: 16 },
  rowValue: { color: colors.textSecondary, fontSize: 14 },
  chev: { color: colors.textSecondary, fontSize: 22, fontWeight: '300' },
  signOut: { alignItems: 'center', marginTop: spacing[4] },
  signOutText: { color: colors.error, fontSize: 16, fontWeight: '600' },
});
