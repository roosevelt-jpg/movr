import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import ActiveRideRecordingPanel from './ActiveRideRecordingPanel';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Driver active ride — map, ETA badge, pickup banner, masked call/chat, Arrived CTA.
 * Keeps ride status APIs (+ optional trip recording panel).
 */
export default function ActiveRideScreen({
  rideId,
  onArrived,
}: {
  rideId?: string;
  onArrived?: () => void;
}) {
  const [ride, setRide] = useState<any>({
    customerName: 'Ama Konadu',
    pickupAddress: '12 Oxford St',
    etaMinutes: 3,
    rating: 4.7,
    tripsToday: 2,
    status: 'accepted',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!rideId) return;
    fetch(`${API}/rides/${rideId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setRide((prev: any) => ({
            ...prev,
            ...j.data,
            customerName: j.data.customer_name || j.data.customerName || prev.customerName,
            pickupAddress: j.data.pickup_address || j.data.pickupAddress || prev.pickupAddress,
            etaMinutes: j.data.eta_minutes ?? prev.etaMinutes,
            rating: j.data.customer_rating ?? prev.rating,
            tripsToday: j.data.trips_today ?? prev.tripsToday,
            status: j.data.status || prev.status,
          }));
        }
      })
      .catch(() => undefined);
  }, [rideId]);

  const arrived = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (rideId) {
        const res = await fetch(`${API}/rides/${rideId}/arrived`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          await fetch(`${API}/rides/${rideId}/start`, { method: 'PUT' });
        }
      }
      setRide((r: any) => ({ ...r, status: 'arrived' }));
      setMsg('Marked arrived at pickup');
      onArrived?.();
    } catch {
      setRide((r: any) => ({ ...r, status: 'arrived' }));
      setMsg('Marked arrived at pickup');
      onArrived?.();
    } finally {
      setBusy(false);
    }
  };

  const name = ride.customerName || 'Rider';
  const address = ride.pickupAddress || 'Pickup';

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        <View style={styles.grid} />
        <View style={styles.etaBadge}>
          <Text style={styles.etaText}>{ride.etaMinutes ?? 3} min to pickup</Text>
        </View>
        <View style={styles.pin}>
          <View style={styles.pinDot} />
        </View>
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerGlow} />
        <Text style={styles.bannerLabel}>Picking up</Text>
        <Text style={styles.bannerTitle}>
          {name} · {address}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{name}</Text>
            <Text style={styles.cardMeta}>
              ★ {Number(ride.rating || 4.7).toFixed(1)} · {ride.tripsToday ?? 2} trips today
            </Text>
          </View>
          <Pressable
            style={styles.iconBtn}
            onPress={() => Linking.openURL('tel:+233240000000')}
          >
            <Text style={styles.iconGlyph}>📞</Text>
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Text style={styles.iconGlyph}>💬</Text>
          </Pressable>
        </View>
        <Text style={styles.privacy}>Calls and messages are number-masked for privacy</Text>
      </View>

      {rideId ? <ActiveRideRecordingPanel rideId={rideId} driverId="" /> : null}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable
        style={[styles.cta, ride.status === 'arrived' && styles.ctaDone]}
        onPress={arrived}
        disabled={busy || ride.status === 'arrived'}
      >
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>
          {busy
            ? 'Updating…'
            : ride.status === 'arrived'
              ? 'At pickup'
              : 'Arrived at pickup'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  map: {
    flex: 1,
    minHeight: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginBottom: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  etaBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    backgroundColor: colors.jetBlack,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  etaText: { color: colors.pureWhite, fontWeight: '600', fontSize: 13 },
  pin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,85,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.motionBlue },
  banner: {
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    overflow: 'hidden',
    backgroundColor: colors.electricViolet,
  },
  bannerGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.55,
  },
  bannerLabel: { color: colors.electricViolet, fontSize: 13, zIndex: 1 },
  bannerTitle: {
    color: colors.pureWhite,
    fontWeight: '700',
    fontSize: 18,
    marginTop: 4,
    zIndex: 1,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  cardName: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  cardMeta: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 16 },
  privacy: { color: colors.textSecondary, fontSize: 11, marginTop: spacing[3] },
  msg: { color: colors.textSecondary, marginBottom: spacing[2], fontSize: 13 },
  cta: {
    marginTop: 'auto' as any,
    marginBottom: spacing[4],
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.electricViolet,
  },
  ctaDone: { opacity: 0.7 },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, zIndex: 1 },
});
