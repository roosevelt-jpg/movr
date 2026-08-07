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
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';
import ShopHomeScreen from './ShopHomeScreen';
import ParcelHomeScreen from './ParcelHomeScreen';
import RentalHomeScreen from './RentalHomeScreen';
import TripHistoryScreen from './TripHistoryScreen';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const MODULES = ['Ride', 'Shop', 'Deliver', 'Parcel', 'Rentals'] as const;
type Module = (typeof MODULES)[number];

type SavedAddress = { id?: string; label: string; address: string; lat: number; lng: number };
type RideOption = {
  code: string;
  name: string;
  price?: number;
  etaMinutes?: number;
  isRecommended?: boolean;
};

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

/**
 * Super-app home — matches customer home mockup:
 * shortcuts → module tabs → map → pickup/dest → Confirm pickup (wired to rides/request).
 */
export default function SuperAppHomeScreen({
  onOpenVoice,
  onOpenAi,
  onOpenStore,
  onOpenRecent,
}: {
  onOpenVoice?: () => void;
  onOpenAi?: () => void;
  onOpenWhatsApp?: () => void;
  onOpenStore?: (storeId: string) => void;
  onOpenRecent?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [active, setActive] = useState<Module>('Ride');
  const [mounted, setMounted] = useState<Record<string, boolean>>({ Ride: true });
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [pickupLabel, setPickupLabel] = useState('12 Oxford St');
  const [pickup, setPickup] = useState({ lat: 5.5557, lng: -0.182, address: '12 Oxford St' });
  const [destination, setDestination] = useState('');
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number; address: string } | null>(
    null
  );
  const [showRecent, setShowRecent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [options, setOptions] = useState<RideOption[]>([]);
  const [currency, setCurrency] = useState('GHS');
  const [selected, setSelected] = useState<string | null>(null);
  const [bookingMsg, setBookingMsg] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await fetch(`${API}/wallet/addresses`, { headers: authHeaders() });
      const j = await res.json();
      if (Array.isArray(j?.data)) {
        setAddresses(j.data);
        const home = j.data.find((a: SavedAddress) => /home/i.test(a.label));
        if (home) {
          setPickup({ lat: Number(home.lat), lng: Number(home.lng), address: home.address });
          setPickupLabel(home.address);
        }
      }
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const selectModule = (m: Module) => {
    setActive(m);
    setShowRecent(false);
    setMounted((prev) => (prev[m] ? prev : { ...prev, [m]: true }));
  };

  const applyAddress = (label: string, as: 'pickup' | 'destination' = 'destination') => {
    const row = addresses.find((a) => a.label.toLowerCase() === label.toLowerCase());
    if (row) {
      if (as === 'pickup') {
        setPickup({ lat: Number(row.lat), lng: Number(row.lng), address: row.address });
        setPickupLabel(row.address);
      } else {
        setDestination(row.address);
        setDropoff({ lat: Number(row.lat), lng: Number(row.lng), address: row.address });
      }
      selectModule('Ride');
      return;
    }
    if (as === 'destination') setDestination(label);
    selectModule('Ride');
  };

  const shortcuts = useMemo(
    () => [
      { id: 'home', label: 'Home', icon: '⌂', onPress: () => applyAddress('Home') },
      { id: 'work', label: 'Work', icon: '▣', onPress: () => applyAddress('Work') },
      {
        id: 'recent',
        label: 'Recent',
        icon: '◷',
        onPress: () => {
          setShowRecent(true);
          onOpenRecent?.();
        },
      },
      {
        id: 'saved',
        label: 'Saved',
        icon: '★',
        onPress: () => {
          const fav =
            addresses.find((a) => /fav|saved|star/i.test(a.label)) || addresses[0];
          if (fav) {
            setDestination(fav.address);
            setDropoff({ lat: Number(fav.lat), lng: Number(fav.lng), address: fav.address });
            selectModule('Ride');
          }
        },
      },
    ],
    [addresses]
  );

  const resolveDropoff = async () => {
    if (dropoff && dropoff.address === destination) return dropoff;
    const text = destination.trim();
    if (!text) throw new Error('Enter a destination');

    const saved = addresses.find(
      (a) => a.address.toLowerCase() === text.toLowerCase() || a.label.toLowerCase() === text.toLowerCase()
    );
    if (saved) {
      const geo = { lat: Number(saved.lat), lng: Number(saved.lng), address: saved.address };
      setDropoff(geo);
      return geo;
    }

    const res = await fetch(`${API}/voice/parse-intent`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        text: `from ${pickup.address} to ${text}`,
        currentLat: pickup.lat,
        currentLng: pickup.lng,
        countryCode: 'GH',
      }),
    });
    const json = await res.json();
    if (json.data?.destination?.lat != null) {
      const geo = {
        lat: Number(json.data.destination.lat),
        lng: Number(json.data.destination.lng),
        address: json.data.destination.address || text,
      };
      setDropoff(geo);
      return geo;
    }

    // Accra-centric fallback so booking still works offline of geocode
    const known: Record<string, { lat: number; lng: number }> = {
      airport: { lat: 5.6052, lng: -0.1668 },
      kotoka: { lat: 5.6052, lng: -0.1668 },
      osu: { lat: 5.5557, lng: -0.182 },
      accra: { lat: 5.6037, lng: -0.187 },
    };
    const key = Object.keys(known).find((k) => text.toLowerCase().includes(k));
    const geo = {
      lat: key ? known[key].lat : pickup.lat + 0.02,
      lng: key ? known[key].lng : pickup.lng + 0.02,
      address: text,
    };
    setDropoff(geo);
    return geo;
  };

  const confirmPickup = async () => {
    setBookingMsg('');
    setConfirming(true);
    try {
      const dest = await resolveDropoff();
      const est = await fetch(`${API}/rides/estimate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffLat: dest.lat,
          dropoffLng: dest.lng,
          countryCode: 'GH',
        }),
      });
      const ej = await est.json();
      const opts: RideOption[] = ej.data?.options || [];
      if (!opts.length) {
        const vt = await fetch(
          `${API}/vehicle-types?region=GH&pickupLat=${pickup.lat}&pickupLng=${pickup.lng}&dropoffLat=${dest.lat}&dropoffLng=${dest.lng}`
        );
        const vj = await vt.json();
        const fromEst = vj.data?.estimates?.options || [];
        setOptions(fromEst);
        setCurrency(vj.data?.estimates?.currency || 'GHS');
        setSelected(fromEst[0]?.code || null);
      } else {
        setOptions(opts);
        setCurrency(ej.data?.currency || 'GHS');
        setSelected(opts[0]?.code || null);
      }
      setShowOptions(true);
    } catch (e: any) {
      setBookingMsg(e?.message || 'Could not confirm pickup');
    } finally {
      setConfirming(false);
    }
  };

  const requestRide = async () => {
    if (!dropoff || !selected) return;
    setConfirming(true);
    setBookingMsg('');
    try {
      const res = await fetch(`${API}/rides/request`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          pickupAddress: pickup.address,
          dropoffAddress: dropoff.address,
          rideType: selected,
          vehicleTypeCode: selected,
          countryCode: 'GH',
        }),
      });
      const json = await res.json();
      if (json.status === 'error') {
        setBookingMsg(json.message || 'Ride request failed');
      } else {
        setBookingMsg(`Ride requested · ${json.data?.id || json.data?.rideId || 'matching drivers'}`);
      }
    } catch (e: any) {
      setBookingMsg(e?.message || 'Ride request failed');
    } finally {
      setConfirming(false);
    }
  };

  if (showRecent) {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setShowRecent(false)} style={styles.backRow}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <TripHistoryScreen
          onBookRide={() => {
            setShowRecent(false);
            setActive('Ride');
            setMounted((m) => ({ ...m, Ride: true }));
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shortcuts}
      >
        {shortcuts.map((s) => (
          <Pressable key={s.id} style={styles.chip} onPress={s.onPress}>
            <Text style={styles.chipIcon}>{s.icon}</Text>
            <Text style={styles.chipText}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {MODULES.map((m) => (
          <Pressable key={m} onPress={() => selectModule(m)} style={styles.tab}>
            <Text style={[styles.tabText, active === m && styles.tabActive]}>{m}</Text>
            {active === m ? <View style={styles.underline} /> : null}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.moduleBody}>
        {mounted.Ride ? (
          <ScrollView
            style={{ display: active === 'Ride' ? 'flex' : 'none', flex: 1 }}
            contentContainerStyle={{ paddingBottom: spacing[8] }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.map}>
              <View style={styles.mapGrid} />
              <View style={styles.pulseOuter}>
                <View style={styles.pulseInner} />
              </View>
              <Pressable
                style={styles.recenter}
                onPress={() => {
                  setPickupLabel(pickup.address);
                }}
                accessibilityLabel="Re-center map"
              >
                <Text style={styles.recenterGlyph}>⌖</Text>
              </Pressable>
              {onOpenAi || onOpenVoice ? (
                <View style={styles.mapActions}>
                  {onOpenAi ? (
                    <Pressable style={styles.micHint} onPress={onOpenAi}>
                      <Text style={{ color: colors.pureWhite, fontSize: 12 }}>Movr AI</Text>
                    </Pressable>
                  ) : null}
                  {onOpenVoice ? (
                    <Pressable style={styles.micHint} onPress={onOpenVoice}>
                      <Text style={{ color: colors.pureWhite, fontSize: 12 }}>Voice</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.fields}>
              <View style={styles.field}>
                <View style={styles.dotFilled} />
                <Text style={styles.fieldText} numberOfLines={1}>
                  Pickup: {pickupLabel}
                </Text>
              </View>
              <View style={styles.field}>
                <View style={styles.dotOutline} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Enter destination"
                  placeholderTextColor={colors.textSecondary}
                  value={destination}
                  onChangeText={(t) => {
                    setDestination(t);
                    setDropoff(null);
                    setShowOptions(false);
                    setBookingMsg('');
                  }}
                />
              </View>
            </View>

            {!showOptions ? (
              <Pressable
                style={[styles.cta, (!destination.trim() || confirming) && styles.ctaDisabled]}
                disabled={!destination.trim() || confirming}
                onPress={() => confirmPickup().catch(() => undefined)}
              >
                <View style={styles.ctaGlow} />
                <Text style={styles.ctaText}>
                  {confirming ? 'Confirming…' : 'Confirm pickup'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.optionsWrap}>
                <Text style={styles.optionsTitle}>Choose ride</Text>
                {options.map((item) => {
                  const on = selected === item.code;
                  return (
                    <Pressable
                      key={item.code}
                      style={[styles.option, on && styles.optionActive]}
                      onPress={() => setSelected(item.code)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optionName}>
                          {item.name}
                          {item.isRecommended ? ' · Best value' : ''}
                        </Text>
                        <Text style={styles.optionMeta}>
                          {item.etaMinutes != null ? `${item.etaMinutes} min away` : 'Nearby'}
                        </Text>
                      </View>
                      <Text style={styles.optionPrice}>
                        {item.price != null ? formatCurrency(item.price, currency) : '—'}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.cta, confirming && styles.ctaDisabled]}
                  disabled={confirming || !selected}
                  onPress={() => requestRide().catch(() => undefined)}
                >
                  <View style={styles.ctaGlow} />
                  <Text style={styles.ctaText}>
                    {confirming ? 'Requesting…' : 'Request ride'}
                  </Text>
                </Pressable>
              </View>
            )}
            {bookingMsg ? <Text style={styles.msg}>{bookingMsg}</Text> : null}
          </ScrollView>
        ) : null}

        {mounted.Shop ? (
          <View style={{ display: active === 'Shop' ? 'flex' : 'none', flex: 1 }}>
            <ShopHomeScreen onOpenStore={onOpenStore} />
          </View>
        ) : null}

        {mounted.Deliver ? (
          <View style={{ display: active === 'Deliver' ? 'flex' : 'none', flex: 1 }}>
            <ShopHomeScreen onOpenStore={onOpenStore} />
          </View>
        ) : null}

        {mounted.Parcel ? (
          <View style={{ display: active === 'Parcel' ? 'flex' : 'none', flex: 1 }}>
            <ParcelHomeScreen
              activeTab="Parcel"
              onTabChange={(t) => {
                if (t === 'Ride' || t === 'Shop') selectModule(t as Module);
                else if (t === 'Rentals' || t === 'Rental') selectModule('Rentals');
              }}
            />
          </View>
        ) : null}

        {mounted.Rentals ? (
          <View style={{ display: active === 'Rentals' ? 'flex' : 'none', flex: 1 }}>
            <RentalHomeScreen />
          </View>
        ) : null}

        {!mounted[active] ? <ActivityIndicator color={colors.motionBlue} /> : null}
      </View>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.jetBlack,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[3],
    },
    backRow: { paddingVertical: spacing[2] },
    backText: { color: colors.motionBlue, fontWeight: '600' },
    shortcuts: { gap: spacing[2], paddingBottom: spacing[3] },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.pill,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
    },
    chipIcon: { color: colors.pureWhite, fontSize: 13 },
    chipText: { color: colors.pureWhite, fontSize: 13, fontWeight: '500' },
    tabs: { gap: spacing[5], paddingBottom: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { paddingBottom: spacing[2] },
    tabText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
    tabActive: { color: colors.pureWhite },
    underline: { marginTop: 6, height: 3, borderRadius: 2, backgroundColor: colors.motionBlue },
    moduleBody: { flex: 1, marginTop: spacing[3] },
    map: {
      height: 220,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      overflow: 'hidden',
      marginBottom: spacing[4],
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapGrid: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.4,
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
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recenterGlyph: { color: colors.pureWhite, fontSize: 18 },
    mapActions: {
      position: 'absolute',
      bottom: spacing[3],
      right: spacing[3],
      flexDirection: 'row',
      gap: 8,
    },
    micHint: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.electricViolet,
    },
    fields: { gap: spacing[2], marginBottom: spacing[4] },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[4],
    },
    dotFilled: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.pureWhite },
    dotOutline: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.textSecondary,
    },
    fieldText: { color: colors.pureWhite, fontSize: 15, flex: 1 },
    fieldInput: { color: colors.pureWhite, fontSize: 15, flex: 1, padding: 0 },
    cta: {
      borderRadius: radius.lg,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.electricViolet,
      overflow: 'hidden',
    },
    ctaDisabled: { opacity: 0.5 },
    ctaGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.motionBlue,
      opacity: 0.45,
    },
    ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, zIndex: 1 },
    optionsWrap: { gap: spacing[2] },
    optionsTitle: { color: colors.pureWhite, fontWeight: '700', marginBottom: spacing[2] },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing[4],
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing[2],
    },
    optionActive: { borderColor: colors.motionBlue },
    optionName: { color: colors.pureWhite, fontWeight: '700' },
    optionMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    optionPrice: { color: colors.pureWhite, fontWeight: '700' },
    msg: { color: colors.success, marginTop: spacing[3], textAlign: 'center' },
  });
}
