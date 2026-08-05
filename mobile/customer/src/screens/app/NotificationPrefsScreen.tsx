import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable } from 'react-native';
import { colors, spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Prefs = {
  driver_assigned: boolean;
  order_status_updates: boolean;
  points_earned: boolean;
  referral_updates: boolean;
  promotions_offers: boolean;
};

const DEFAULT: Prefs = {
  driver_assigned: true,
  order_status_updates: true,
  points_earned: true,
  referral_updates: false,
  promotions_offers: false,
};

const SECTIONS: { title: string; keys: { key: keyof Prefs; label: string }[] }[] = [
  {
    title: 'RIDES & ORDERS',
    keys: [
      { key: 'driver_assigned', label: 'Driver assigned' },
      { key: 'order_status_updates', label: 'Order status updates' },
    ],
  },
  {
    title: 'REWARDS',
    keys: [
      { key: 'points_earned', label: 'Points earned' },
      { key: 'referral_updates', label: 'Referral updates' },
    ],
  },
  {
    title: 'MARKETING',
    keys: [{ key: 'promotions_offers', label: 'Promotions & offers' }],
  },
];

/** Notification preference toggles. */
export default function NotificationPrefsScreen({ onBack }: { onBack?: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);

  useEffect(() => {
    fetch(`${API}/users/notification-prefs`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setPrefs({ ...DEFAULT, ...j.data });
      })
      .catch(() => undefined);
  }, []);

  const toggle = async (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await fetch(`${API}/users/notification-prefs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => undefined);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Notifications</Text>

      {SECTIONS.map((sec) => (
        <View key={sec.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{sec.title}</Text>
          {sec.keys.map((row, i) => (
            <View
              key={row.key}
              style={[styles.row, i < sec.keys.length - 1 && styles.rowBorder]}
            >
              <Text style={styles.label}>{row.label}</Text>
              <Switch
                value={prefs[row.key]}
                onValueChange={() => toggle(row.key)}
                trackColor={{ false: colors.border, true: colors.electricViolet }}
                thumbColor={colors.pureWhite}
                ios_backgroundColor={colors.border}
              />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  back: { color: colors.textSecondary, marginBottom: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[6] },
  section: { marginBottom: spacing[6] },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { color: colors.pureWhite, fontSize: 16, fontWeight: '500' },
});
