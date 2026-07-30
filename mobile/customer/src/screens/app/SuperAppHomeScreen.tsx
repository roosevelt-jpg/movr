import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const MODULES = ['Ride', 'Shop', 'Parcel', 'Rental'] as const;
const SHORTCUTS = ['Home', 'Work', 'Recent', 'Favorites'] as const;

/** Super-app home. Mic → VoiceBookingScreen (Phase 23). */
export default function SuperAppHomeScreen({ onOpenVoice }: { onOpenVoice?: () => void }) {
  const [active, setActive] = useState<(typeof MODULES)[number]>('Ride');

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MOVR</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcuts}>
        {SHORTCUTS.map((s) => (
          <Pressable key={s} style={styles.chip}>
            <Text style={styles.chipText}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.tabs}>
        {MODULES.map((m) => (
          <Pressable key={m} onPress={() => setActive(m)} style={styles.tab}>
            <Text style={[styles.tabText, active === m && styles.tabActive]}>{m}</Text>
            {active === m ? <View style={styles.underline} /> : null}
          </Pressable>
        ))}
      </View>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>{active} module</Text>
        {active === 'Ride' ? (
          <Pressable style={styles.mic} onPress={onOpenVoice}>
            <Text style={styles.micText}>Speak to order</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable style={styles.cta}>
        <Text style={styles.ctaText}>{active === 'Ride' ? 'Set destination' : `Open ${active}`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  brand: { color: colors.pureWhite, fontSize: 22, fontWeight: '700', marginBottom: spacing[4] },
  shortcuts: { maxHeight: 44, marginBottom: spacing[4] },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
  },
  chipText: { color: colors.textPrimary, fontSize: 13 },
  tabs: { flexDirection: 'row', marginBottom: spacing[4], gap: spacing[4] },
  tab: { paddingBottom: spacing[2] },
  tabText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
  tabActive: { color: colors.pureWhite },
  underline: { marginTop: 4, height: 3, borderRadius: 2, backgroundColor: colors.electricViolet },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  mapText: { color: colors.pureWhite, fontSize: 20, fontWeight: '600' },
  mic: {
    marginTop: spacing[4],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.electricViolet,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  micText: { color: colors.pureWhite, fontWeight: '600' },
  cta: {
    backgroundColor: colors.electricViolet,
    borderRadius: radius.pill,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
});
