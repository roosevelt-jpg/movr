import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { formatCurrency } from '@movr/design-system/format';
import { getAppLocale } from '../../services/locale';
import { getCurrentGps } from '../../lib/location';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const WEB_ORIGIN = (API || '').replace(/\/api\/v1\/?$/, '') || 'http://localhost:5180';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function mediaSrc(url?: string) {
  if (!url) return `${WEB_ORIGIN}/brand/compare-map.svg`;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${WEB_ORIGIN}${url}`;
  return url;
}

type CmsPayload = {
  headline?: string;
  subhead?: string;
  formTitle?: string;
  ctaLabel?: string;
  mapImageUrl?: string;
  mapImageAlt?: string;
  countryCode?: string;
};

type FareOpt = {
  code: string;
  name: string;
  price: number;
  etaMinutes?: number;
};

/**
 * App parity for homepage “Compare your travel options”.
 * Loads CMS copy/image from home → booking_engine; quotes via /rails/quote.
 */
export default function CompareTravelScreen({
  onBack,
  onBooked,
  onOpenVerified,
}: {
  onBack?: () => void;
  onBooked?: (rideId: string) => void;
  onOpenVerified?: () => void;
}) {
  const locale = getAppLocale();
  const [cms, setCms] = useState<CmsPayload>({});
  const [when, setWhen] = useState<'now' | 'share'>('now');
  const [pickup, setPickup] = useState('Current location');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState({ lat: 5.6037, lng: -0.187 });
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [options, setOptions] = useState<FareOpt[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [currency, setCurrency] = useState(locale.currencyCode || 'GHS');
  const [message, setMessage] = useState('');
  const countryCode = (cms.countryCode || locale.countryCode || 'GH').toUpperCase();

  useEffect(() => {
    fetch(`${API}/public/cms/pages/home`)
      .then((r) => r.json())
      .then((j) => {
        const section = (j?.data?.sections || []).find((s: any) => s.type === 'booking_engine');
        if (section?.payload) setCms(section.payload);
      })
      .catch(() => undefined);

    getCurrentGps()
      .then((fix) => {
        if (!fix) return;
        setPickupCoords({ lat: fix.latitude, lng: fix.longitude });
        setPickup('Current location');
      })
      .catch(() => undefined);
  }, []);

  const geocode = async (q: string) => {
    const res = await fetch(
      `${API}/public/maps/places?q=${encodeURIComponent(q)}&country=${encodeURIComponent(countryCode)}`
    );
    const j = await res.json();
    const first = j?.data?.[0];
    if (!first?.placeId) return null;
    const dRes = await fetch(
      `${API}/public/maps/place-details?placeId=${encodeURIComponent(first.placeId)}`
    );
    const d = await dRes.json();
    if (!d?.data?.lat) return null;
    return {
      name: d.data.formattedAddress || first.description,
      lat: Number(d.data.lat),
      lng: Number(d.data.lng),
    };
  };

  const seePrices = async () => {
    setMessage('');
    setQuoting(true);
    setOptions([]);
    try {
      let drop = dropoffCoords;
      if (!drop && dropoff.trim().length > 2) {
        const g = await geocode(dropoff.trim());
        if (g) {
          drop = { lat: g.lat, lng: g.lng };
          setDropoffCoords(drop);
          setDropoff(g.name);
        }
      }
      if (!drop) throw new Error('Enter a destination');

      const res = await fetch(`${API}/rails/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLat: pickupCoords.lat,
          pickupLng: pickupCoords.lng,
          dropoffLat: drop.lat,
          dropoffLng: drop.lng,
          countryCode,
          fareMode: when,
          vehicleCode: when === 'share' ? 'shared' : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Could not get prices');
      const opts = (j.data?.options || []).map((o: any) => ({
        code: o.code,
        name: o.name || o.code,
        price: Number(o.riderFare ?? o.price ?? 0),
        etaMinutes: o.etaMinutes,
      }));
      if (!opts.length) throw new Error('No vehicles for this route');
      setOptions(opts);
      setSelected(opts[0].code);
      setCurrency(j.data?.currency || currency);
    } catch (e: any) {
      setMessage(e.message || 'Quote failed');
    } finally {
      setQuoting(false);
    }
  };

  const confirm = async () => {
    if (!dropoffCoords || !selected) return;
    setMessage('');
    try {
      const path = when === 'share' ? '/rails/share/join' : '/rails/book';
      const body =
        when === 'share'
          ? {
              pickupLat: pickupCoords.lat,
              pickupLng: pickupCoords.lng,
              dropoffLat: dropoffCoords.lat,
              dropoffLng: dropoffCoords.lng,
              pickupAddress: pickup,
              dropoffAddress: dropoff,
              countryCode,
            }
          : {
              pickupLat: pickupCoords.lat,
              pickupLng: pickupCoords.lng,
              dropoffLat: dropoffCoords.lat,
              dropoffLng: dropoffCoords.lng,
              pickupAddress: pickup,
              dropoffAddress: dropoff,
              vehicleTypeCode: selected,
              fareMode: 'now',
              countryCode,
              sourceChannel: 'app',
            };
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Booking failed');
      const rideId =
        j.data?.rideId || j.data?.id || j.data?.booking?.rideId || j.data?.booking?.id;
      setMessage(j.data?.confirmationMessage || 'Ride requested');
      if (rideId) {
        try {
          (globalThis as any).__MOVR_NAVIGATE_RIDE__?.(rideId);
        } catch {
          /* */
        }
        onBooked?.(String(rideId));
      }
    } catch (e: any) {
      setMessage(e.message || 'Booking failed');
    }
  };

  const selectedOpt = options.find((o) => o.code === selected) || options[0];
  const styles = makeStyles();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      ) : null}

      <Text style={styles.h1}>{cms.headline || 'Compare your travel options'}</Text>
      <Text style={styles.sub}>
        {cms.subhead ||
          'Enter your pickup and destination to review estimated travel times and pricing across every way to move.'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{cms.formTitle || 'Trip details'}</Text>

        <View style={styles.tabs}>
          {(['now', 'share'] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setWhen(id)}
              style={[styles.tab, when === id && styles.tabOn]}
            >
              <Text style={[styles.tabText, when === id && styles.tabTextOn]}>
                {id === 'now' ? 'Go now' : 'Share'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Pickup</Text>
        <TextInput
          style={styles.input}
          value={pickup}
          onChangeText={setPickup}
          placeholder="Enter pickup"
          placeholderTextColor="#71717a"
        />
        <Text style={styles.label}>Destination</Text>
        <TextInput
          style={styles.input}
          value={dropoff}
          onChangeText={(v) => {
            setDropoff(v);
            setDropoffCoords(null);
          }}
          placeholder="Enter destination"
          placeholderTextColor="#71717a"
        />

        <Pressable style={styles.cta} onPress={seePrices} disabled={quoting}>
          {quoting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{cms.ctaLabel || 'See prices'}</Text>
          )}
        </Pressable>
      </View>

      <Image
        source={{ uri: mediaSrc(cms.mapImageUrl) }}
        style={styles.map}
        resizeMode="cover"
        accessibilityLabel={cms.mapImageAlt || 'Map preview'}
      />

      {message ? <Text style={styles.msg}>{message}</Text> : null}

      {options.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose a ride</Text>
          {options.map((o) => (
            <Pressable
              key={o.code}
              onPress={() => setSelected(o.code)}
              style={[styles.opt, selected === o.code && styles.optOn]}
            >
              <View>
                <Text style={styles.optName}>{o.name}</Text>
                <Text style={styles.optMeta}>
                  {o.etaMinutes != null ? `${o.etaMinutes} min` : 'Nearby'}
                </Text>
              </View>
              <Text style={styles.optPrice}>{formatCurrency(o.price, currency)}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.book} onPress={confirm}>
            <Text style={styles.ctaText}>
              Request {selectedOpt?.name || 'ride'} ·{' '}
              {formatCurrency(selectedOpt?.price || 0, currency)}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {onOpenVerified ? (
        <Pressable onPress={onOpenVerified} style={styles.card}>
          <Text style={styles.cardTitle}>Choose a verified vehicle</Text>
          <Text style={styles.optMeta}>
            Photo, chauffeur passport, escrow until the booked car arrives.
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f3f3f3' },
    pad: { padding: 16, paddingBottom: 40 },
    back: { marginBottom: 8 },
    backText: { color: '#52525b', fontWeight: '600' },
    h1: { fontSize: 28, fontWeight: '800', color: '#111', lineHeight: 34 },
    sub: { marginTop: 8, fontSize: 15, color: '#52525b', lineHeight: 22, marginBottom: 16 },
    card: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      marginBottom: 14,
    },
    cardTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 12 },
    tabs: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      backgroundColor: '#ececec',
      borderRadius: 999,
      padding: 4,
      marginBottom: 14,
    },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
    tabOn: { backgroundColor: '#111' },
    tabText: { fontWeight: '700', color: '#52525b', fontSize: 13 },
    tabTextOn: { color: '#fff' },
    label: { fontSize: 12, color: '#71717a', marginBottom: 4, fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.12)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 12,
      fontSize: 15,
      color: '#111',
      backgroundColor: '#fafafa',
    },
    cta: {
      backgroundColor: '#111',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    map: {
      width: '100%',
      height: 200,
      borderRadius: 16,
      backgroundColor: '#e8eef2',
      marginBottom: 14,
    },
    msg: { color: '#b45309', marginBottom: 10, fontSize: 13 },
    opt: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
      marginBottom: 6,
    },
    optOn: { backgroundColor: 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: '#111' },
    optName: { fontWeight: '700', color: '#111' },
    optMeta: { fontSize: 12, color: '#71717a', marginTop: 2 },
    optPrice: { fontWeight: '800', color: '#111' },
    book: {
      marginTop: 8,
      backgroundColor: '#3B5CFF',
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
  });
}
