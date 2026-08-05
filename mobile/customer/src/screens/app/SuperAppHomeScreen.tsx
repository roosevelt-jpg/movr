import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import ParcelHomeScreen from './ParcelHomeScreen';

const MODULES = ['Ride', 'Shop', 'Deliver', 'Parcel', 'Rentals'] as const;
const SHORTCUTS = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'work', label: 'Work', icon: '▣' },
  { id: 'recent', label: 'Recent', icon: '◷' },
  { id: 'starred', label: 'Starred', icon: '★' },
] as const;

/** Customer home — matches brand mockup (dark map + shortcuts + confirm CTA). */
export default function SuperAppHomeScreen({
  onOpenVoice,
  onOpenWhatsApp,
}: {
  onOpenVoice?: () => void;
  onOpenWhatsApp?: () => void;
}) {
  const [active, setActive] = useState<(typeof MODULES)[number]>('Ride');
  const [pickup] = useState('12 Oxford St');
  const [destination, setDestination] = useState('');

  if (active === 'Parcel') {
    return (
      <ParcelHomeScreen
        activeTab="Parcel"
        onTabChange={(t) => {
          if (t === 'Parcel') return;
          if (t === 'Rentals') setActive('Rentals');
          else setActive(t === 'Shop' ? 'Shop' : t === 'Ride' ? 'Ride' : 'Deliver');
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
        {SHORTCUTS.map((s) => (
          <Pressable key={s.id} style={styles.chip}>
            <Text style={styles.chipIcon}>{s.icon}</Text>
            <Text style={styles.chipText}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {MODULES.map((m) => (
          <Pressable key={m} onPress={() => setActive(m)} style={styles.tab}>
            <Text style={[styles.tabText, active === m && styles.tabActive]}>{m}</Text>
            {active === m ? <View style={styles.underline} /> : null}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.map}>
        <View style={styles.mapGrid} />
        <View style={styles.pulseOuter}>
          <View style={styles.pulseInner} />
        </View>
        <Pressable style={styles.recenter} accessibilityLabel="Recenter map">
          <Text style={styles.recenterIcon}>⌖</Text>
        </Pressable>
        {active === 'Ride' ? (
          <>
            <Pressable style={styles.micFab} onPress={onOpenVoice}>
              <Text style={styles.micFabText}>🎤</Text>
            </Pressable>
            {onOpenWhatsApp ? (
              <Pressable style={styles.waFab} onPress={onOpenWhatsApp}>
                <Text style={styles.micFabText}>💬</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>

      {active === 'Ride' ? (
        <View style={styles.fields}>
          <View style={styles.field}>
            <View style={styles.dotFilled} />
            <Text style={styles.fieldText}>Pickup: {pickup}</Text>
          </View>
          <View style={styles.field}>
            <View style={styles.dotOutline} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Enter destination"
              placeholderTextColor={colors.textSecondary}
              value={destination}
              onChangeText={setDestination}
            />
          </View>
        </View>
      ) : (
        <View style={styles.moduleHint}>
          <Text style={styles.moduleHintText}>Open {active}</Text>
        </View>
      )}

      <Pressable style={styles.cta}>
        <View style={styles.ctaGradient} />
        <Text style={styles.ctaText}>
          {active === 'Ride' ? 'Confirm pickup' : `Continue · ${active}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  shortcuts: { gap: spacing[2], paddingBottom: spacing[3] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipIcon: { color: colors.pureWhite, fontSize: 13 },
  chipText: { color: colors.pureWhite, fontSize: 13, fontWeight: '500' },
  tabs: { gap: spacing[5], paddingBottom: spacing[3] },
  tab: { paddingBottom: spacing[2] },
  tabText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
  tabActive: { color: colors.pureWhite },
  underline: { marginTop: 6, height: 3, borderRadius: 2, backgroundColor: colors.motionBlue },
  map: {
    flex: 1,
    minHeight: 220,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pulseOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,85,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.motionBlue,
  },
  recenter: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterIcon: { color: colors.pureWhite, fontSize: 16 },
  micFab: {
    position: 'absolute',
    bottom: spacing[3],
    right: spacing[3],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.electricViolet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waFab: {
    position: 'absolute',
    bottom: spacing[3],
    right: 56,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.movrGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micFabText: { fontSize: 18 },
  fields: { gap: spacing[2], marginBottom: spacing[4] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  dotFilled: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.pureWhite },
  dotOutline: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.pureWhite,
  },
  fieldText: { color: colors.pureWhite, fontSize: 15, flex: 1 },
  fieldInput: { color: colors.pureWhite, fontSize: 15, flex: 1, padding: 0 },
  moduleHint: { marginBottom: spacing[4], padding: spacing[4] },
  moduleHintText: { color: colors.textSecondary },
  cta: {
    marginBottom: spacing[5],
    borderRadius: radius.pill,
    overflow: 'hidden',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
  },
  ctaGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontSize: 16, fontWeight: '700', zIndex: 1 },
});
