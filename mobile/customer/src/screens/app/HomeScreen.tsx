import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type VehicleOption = {
  vehicleTypeId?: string;
  code: string;
  name: string;
  capacity?: number;
  price?: number;
  etaMinutes?: number;
  isRecommended?: boolean;
  surgeReason?: string;
  icon_url?: string;
  passenger_capacity?: number;
  pricing?: { currency_code?: string };
};

/**
 * Ride-type selector — pulls from GET /vehicle-types?region=... (Phase 24).
 * Live estimates when destination coords/available; otherwise shows base pricing.
 */
export default function HomeScreen({
  destination,
  region = 'GH',
  pickupLat = 5.6037,
  pickupLng = -0.187,
  dropoffLat = 5.6052,
  dropoffLng = -0.1668,
  onSelectType,
}: {
  destination?: string;
  region?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  onSelectType?: (code: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<VehicleOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [currency, setCurrency] = useState('GHS');
  const [surgeReason, setSurgeReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams({
          region,
          pickupLat: String(pickupLat),
          pickupLng: String(pickupLng),
          dropoffLat: String(dropoffLat),
          dropoffLng: String(dropoffLng),
        });
        const res = await fetch(`${API}/vehicle-types?${q}`);
        const json = await res.json();
        if (cancelled) return;
        const estimates = json.data?.estimates;
        if (estimates?.options?.length) {
          setOptions(estimates.options);
          setCurrency(estimates.currency || 'GHS');
          setSurgeReason(estimates.surgeReason || null);
          setSelected(estimates.options[0]?.code || null);
        } else {
          const types = (json.data?.vehicleTypes || []).map((t: any) => ({
            code: t.code,
            name: t.name,
            capacity: t.passenger_capacity,
            price: Number(t.pricing?.base_fare || 0),
            icon_url: t.icon_url,
          }));
          setOptions(types);
          setCurrency(types[0]?.pricing?.currency_code || 'GHS');
          setSelected(types[0]?.code || null);
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [region, pickupLat, pickupLng, dropoffLat, dropoffLng, destination]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Choose ride type</Text>
      {destination ? (
        <Text style={styles.sub}>To {destination}</Text>
      ) : (
        <Text style={styles.sub}>Enter a destination above for live fares</Text>
      )}
      {surgeReason ? <Text style={styles.surge}>{surgeReason}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.motionBlue} style={{ marginTop: spacing[4] }} />
      ) : (
        <FlatList
          data={options}
          keyExtractor={(i) => i.code}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const active = selected === item.code;
            return (
              <Pressable
                style={[styles.row, active && styles.rowActive]}
                onPress={() => {
                  setSelected(item.code);
                  onSelectType?.(item.code);
                }}
              >
                <View style={styles.icon}>
                  <Text style={{ fontSize: 18 }}>
                    {item.code.includes('motor')
                      ? '🏍'
                      : item.code.includes('tri')
                        ? '🛺'
                        : item.code.includes('suv')
                          ? '🚙'
                          : item.code.includes('van')
                            ? '🚐'
                            : item.code.includes('lux') || item.code.includes('prem')
                              ? '✨'
                              : '🚗'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.name}
                    {item.isRecommended ? ' · Best value' : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {item.capacity || item.passenger_capacity || 4} seats
                    {item.etaMinutes != null ? ` · ${item.etaMinutes} min` : ''}
                  </Text>
                </View>
                <Text style={styles.price}>
                  {item.price != null ? formatCurrency(item.price, currency) : '—'}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.sub}>No vehicle types available for this region</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: spacing[1], marginBottom: spacing[2], fontSize: 13 },
  surge: { color: colors.warning, fontSize: 12, marginBottom: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[2],
  },
  rowActive: {
    borderColor: colors.electricViolet,
    backgroundColor: colors.surfaceElevated,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.pureWhite, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  price: { color: colors.pureWhite, fontWeight: '700' },
});
