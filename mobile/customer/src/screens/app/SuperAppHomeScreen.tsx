import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { useWallet } from '../../context/WalletContext';
import HomeScreen from './HomeScreen';
import ShopHomeScreen from './ShopHomeScreen';
import ParcelHomeScreen from './ParcelHomeScreen';
import RentalHomeScreen from './RentalHomeScreen';
import TripHistoryScreen from './TripHistoryScreen';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const MODULES = ['Ride', 'Shop', 'Parcel', 'Rental'] as const;
type Module = (typeof MODULES)[number];

type SavedAddress = { id?: string; label: string; address: string; lat: number; lng: number };

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Super-app landing — Ride / Shop / Parcel / Rental + shortcuts + shared wallet strip.
 * HomeScreen remains the Ride module content; other modules lazy-mount their screens.
 */
export default function SuperAppHomeScreen({
  onOpenVoice,
  onOpenWhatsApp,
  onOpenStore,
  onOpenRecent,
}: {
  onOpenVoice?: () => void;
  onOpenWhatsApp?: () => void;
  onOpenStore?: (storeId: string) => void;
  onOpenRecent?: () => void;
}) {
  const [active, setActive] = useState<Module>('Ride');
  const [mounted, setMounted] = useState<Record<Module, boolean>>({
    Ride: true,
    Shop: false,
    Parcel: false,
    Rental: false,
  });
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [pickup, setPickup] = useState('Current location');
  const [destination, setDestination] = useState('');
  const [showRecent, setShowRecent] = useState(false);
  const { balance, rewardsBalance, currency, refresh, loading } = useWallet();

  const loadAddresses = useCallback(async () => {
    try {
      const res = await fetch(`${API}/wallet/addresses`, { headers: authHeaders() });
      const j = await res.json();
      if (Array.isArray(j?.data)) setAddresses(j.data);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    loadAddresses();
    refresh();
  }, [loadAddresses, refresh]);

  const selectModule = (m: Module) => {
    setActive(m);
    setShowRecent(false);
    setMounted((prev) => (prev[m] ? prev : { ...prev, [m]: true }));
  };

  const applyAddress = (label: 'Home' | 'Work') => {
    const row = addresses.find((a) => a.label.toLowerCase() === label.toLowerCase());
    if (row) {
      setDestination(row.address);
      selectModule('Ride');
      return;
    }
    // Prompt-less UX: switch to Ride and prefill label so user can complete booking
    setDestination(`${label} (set in saved addresses)`);
    selectModule('Ride');
  };

  const shortcuts = useMemo(
    () => [
      {
        id: 'home',
        label: 'Home',
        icon: '⌂',
        onPress: () => applyAddress('Home'),
      },
      {
        id: 'work',
        label: 'Work',
        icon: '▣',
        onPress: () => applyAddress('Work'),
      },
      {
        id: 'recent',
        label: 'Recent Trips',
        icon: '◷',
        onPress: () => {
          setShowRecent(true);
          onOpenRecent?.();
        },
      },
      {
        id: 'favorites',
        label: 'Favorites',
        icon: '★',
        onPress: () => {
          const fav = addresses.find((a) => /fav/i.test(a.label));
          if (fav) {
            setDestination(fav.address);
            selectModule('Ride');
          } else {
            selectModule('Shop');
          }
        },
      },
    ],
    [addresses]
  );

  if (showRecent) {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setShowRecent(false)} style={styles.backRow}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <TripHistoryScreen />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.walletStrip}>
        <View>
          <Text style={styles.walletLabel}>Wallet</Text>
          <Text style={styles.walletBal}>
            {loading ? '…' : `${currency} ${Number(balance).toFixed(2)}`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.walletLabel}>Rewards</Text>
          <Text style={styles.walletPts}>{Number(rewardsBalance).toFixed(0)} pts</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
        {shortcuts.map((s) => (
          <Pressable key={s.id} style={styles.chip} onPress={s.onPress}>
            <Text style={styles.chipIcon}>{s.icon}</Text>
            <Text style={styles.chipText}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {MODULES.map((m) => (
          <Pressable key={m} onPress={() => selectModule(m)} style={styles.tab}>
            <Text style={[styles.tabText, active === m && styles.tabActive]}>{m}</Text>
            {active === m ? <View style={styles.underline} /> : null}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.moduleBody}>
        {mounted.Ride ? (
          <View style={{ display: active === 'Ride' ? 'flex' : 'none', flex: 1 }}>
            <View style={styles.map}>
              <View style={styles.mapGrid} />
              <View style={styles.pulseOuter}>
                <View style={styles.pulseInner} />
              </View>
              {onOpenVoice ? (
                <Pressable style={styles.micFab} onPress={onOpenVoice}>
                  <Text style={styles.micFabText}>🎤</Text>
                </Pressable>
              ) : null}
              {onOpenWhatsApp ? (
                <Pressable style={styles.waFab} onPress={onOpenWhatsApp}>
                  <Text style={styles.micFabText}>💬</Text>
                </Pressable>
              ) : null}
            </View>
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
            {/* Keep HomeScreen reusable as Ride content below the map */}
            <HomeScreen destination={destination} />
          </View>
        ) : null}

        {mounted.Shop ? (
          <View style={{ display: active === 'Shop' ? 'flex' : 'none', flex: 1 }}>
            <ShopHomeScreen onOpenStore={onOpenStore} />
          </View>
        ) : null}

        {mounted.Parcel ? (
          <View style={{ display: active === 'Parcel' ? 'flex' : 'none', flex: 1 }}>
            <ParcelHomeScreen
              activeTab="Parcel"
              onTabChange={(t) => {
                if (t === 'Ride' || t === 'Shop') selectModule(t);
                else if (t === 'Rentals' || t === 'Rental') selectModule('Rental');
              }}
            />
          </View>
        ) : null}

        {mounted.Rental ? (
          <View style={{ display: active === 'Rental' ? 'flex' : 'none', flex: 1 }}>
            <RentalHomeScreen />
          </View>
        ) : null}

        {!mounted[active] ? <ActivityIndicator color={colors.motionBlue} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  backRow: { paddingVertical: spacing[2] },
  backText: { color: colors.motionBlue, fontWeight: '600' },
  walletStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  walletLabel: { color: colors.textSecondary, fontSize: 12 },
  walletBal: { color: colors.pureWhite, fontSize: 20, fontWeight: '700', marginTop: 4 },
  walletPts: { color: colors.success, fontSize: 18, fontWeight: '700', marginTop: 4 },
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
  moduleBody: { flex: 1 },
  map: {
    height: 180,
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
  fields: { gap: spacing[2], marginBottom: spacing[3] },
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
});
