import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { pickAndUploadImage } from '../../lib/upload';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type VehicleState = {
  type: string;
  make: string;
  model: string;
  makeId: string;
  modelId: string;
  year: string;
  color: string;
  chassis: string;
  transmission: string;
  fuelType: string;
  plate: string;
  registrationStatus: string;
  photoUrl: string;
};

const EMPTY: VehicleState = {
  type: '',
  make: '',
  model: '',
  makeId: '',
  modelId: '',
  year: '',
  color: '',
  chassis: '',
  transmission: '',
  fuelType: '',
  plate: '',
  registrationStatus: '',
  photoUrl: '',
};

/** Driver — My vehicle with global automobile catalog autocomplete. */
export default function MyVehicleScreen({ onBack }: { onBack?: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [editing, setEditing] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [msg, setMsg] = useState('');
  const [suggestQ, setSuggestQ] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [decoding, setDecoding] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${API}/driver/vehicle`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.data) {
          setVehicle(EMPTY);
          return;
        }
        const d = j.data;
        setVehicle({
          type: d.vehicle_type || d.type || '',
          make: d.make || '',
          model: d.model || '',
          makeId: d.make_id || '',
          modelId: d.model_id || '',
          year: d.year ? String(d.year) : '',
          color: d.color || '',
          chassis: d.chassis_number || d.vin || '',
          transmission: d.transmission || '',
          fuelType: d.fuel_type || '',
          plate: d.plate_number || d.plate || '',
          registrationStatus: d.registration_status
            ? d.registration_status
            : d.verified
              ? 'Verified'
              : d.verified === false
                ? 'Pending'
                : '',
          photoUrl: d.photo_url || '',
        });
        setSuggestQ(
          [d.make, d.model].filter(Boolean).join(' ') || d.make_model || ''
        );
      })
      .catch(() => setVehicle(EMPTY))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!vehicle.make) {
      setYears([]);
      return;
    }
    const q = new URLSearchParams({ make: vehicle.make });
    if (vehicle.model) q.set('model', vehicle.model);
    fetch(`${API}/public/vehicles/years?${q}`)
      .then((r) => r.json())
      .then((j) => setYears(j.data || []))
      .catch(() => setYears([]));
  }, [vehicle.make, vehicle.model]);

  const searchSuggest = (text: string) => {
    setSuggestQ(text);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      fetch(`${API}/public/vehicles/suggest?q=${encodeURIComponent(text)}&limit=12`)
        .then((r) => r.json())
        .then((j) => setSuggestions(j.data || []))
        .catch(() => setSuggestions([]));
    }, 220);
  };

  const applySuggest = (s: any) => {
    setVehicle((v) => ({
      ...v,
      make: s.make || v.make,
      model: s.model || v.model,
      makeId: s.makeId || v.makeId,
      modelId: s.modelId || v.modelId,
      type: s.bodyStyle || v.type,
    }));
    setSuggestQ(s.label || `${s.make} ${s.model || ''}`.trim());
    setSuggestions([]);
  };

  const decodeVin = async () => {
    const vin = vehicle.chassis.trim();
    if (vin.length < 11) {
      setMsg('Enter at least 11 characters of the chassis / VIN');
      return;
    }
    setDecoding(true);
    setMsg('');
    try {
      const res = await fetch(
        `${API}/public/vehicles/decode-vin/${encodeURIComponent(vin)}`
      );
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setMsg(json.message || 'Could not decode chassis / VIN');
        return;
      }
      const d = json.data;
      setVehicle((v) => ({
        ...v,
        make: d.make || v.make,
        model: d.model || v.model,
        makeId: d.makeId || v.makeId,
        modelId: d.modelId || v.modelId,
        year: d.year ? String(d.year) : v.year,
        type: d.vehicleTypeHint || d.bodyStyle || v.type,
        transmission: d.transmission || v.transmission,
        fuelType: d.fuelType || v.fuelType,
        chassis: d.vin || vin,
      }));
      setSuggestQ([d.make, d.model].filter(Boolean).join(' '));
      setMsg(`Matched ${d.make} ${d.model}${d.year ? ` · ${d.year}` : ''}`);
    } catch (e: any) {
      setMsg(e.message || 'Decode failed');
    } finally {
      setDecoding(false);
    }
  };

  const save = async () => {
    await fetch(`${API}/driver/vehicle`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        vehicle_type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        make_id: vehicle.makeId || undefined,
        model_id: vehicle.modelId || undefined,
        make_model: [vehicle.make, vehicle.model].filter(Boolean).join(' '),
        year: vehicle.year ? Number(vehicle.year) : undefined,
        color: vehicle.color,
        vin: vehicle.chassis,
        chassis_number: vehicle.chassis,
        body_style: vehicle.type,
        transmission: vehicle.transmission,
        fuel_type: vehicle.fuelType,
        plate_number: vehicle.plate,
        photo_url: vehicle.photoUrl || undefined,
      }),
    }).catch(() => undefined);
    setEditing(false);
    setSuggestions([]);
  };

  const uploadPhoto = async () => {
    setUploadingPhoto(true);
    setMsg('');
    try {
      const url = await pickAndUploadImage({ accept: 'image/*' });
      setVehicle((v) => ({ ...v, photoUrl: url }));
      await fetch(`${API}/driver/vehicle`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ photo_url: url }),
      });
      setMsg('Vehicle photo uploaded');
    } catch (e: any) {
      setMsg(e.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const display = (value?: string) => (value && value.trim() ? value : '—');

  const mediaSrc = (url: string) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    if (url.startsWith('/uploads') || url.startsWith('/assets')) {
      try {
        return new URL(url, new URL(API).origin).toString();
      } catch {
        return url;
      }
    }
    return url;
  };

  const yearOptions =
    years.length > 0
      ? years
      : Array.from({ length: 40 }, (_, i) => new Date().getFullYear() + 1 - i);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>My vehicle</Text>
      <Text style={styles.sub}>
        Make, model, year & chassis autofill from the global automobile database
      </Text>

      {!loaded ? (
        <Text style={styles.hint}>Loading…</Text>
      ) : (
        <>
          <Pressable style={styles.photo} onPress={uploadPhoto} disabled={uploadingPhoto}>
            {vehicle.photoUrl ? (
              <Image source={{ uri: mediaSrc(vehicle.photoUrl) }} style={styles.photoImg} />
            ) : (
              <Text style={styles.photoHint}>
                {uploadingPhoto ? 'Uploading…' : 'Tap to upload vehicle photo'}
              </Text>
            )}
          </Pressable>
          {vehicle.photoUrl ? (
            <Pressable onPress={uploadPhoto} disabled={uploadingPhoto}>
              <Text style={styles.replacePhoto}>
                {uploadingPhoto ? 'Uploading…' : 'Replace photo'}
              </Text>
            </Pressable>
          ) : null}
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          {editing ? (
            <View style={styles.editBlock}>
              <Text style={styles.fieldLabel}>Search make & model</Text>
              <TextInput
                style={styles.fieldInput}
                value={suggestQ}
                onChangeText={searchSuggest}
                placeholder="e.g. Toyota Corolla"
                placeholderTextColor={colors.textSecondary}
              />
              {suggestions.length > 0 ? (
                <View style={styles.suggestBox}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={`${s.kind}-${s.label}`}
                      style={styles.suggestRow}
                      onPress={() => applySuggest(s)}
                    >
                      <Text style={styles.suggestText}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Year</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {yearOptions.slice(0, 30).map((y) => (
                  <Pressable
                    key={y}
                    style={[styles.chip, vehicle.year === String(y) && styles.chipOn]}
                    onPress={() => setVehicle((v) => ({ ...v, year: String(y) }))}
                  >
                    <Text style={styles.chipText}>{y}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Chassis / VIN</Text>
              <View style={styles.vinRow}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
                  value={vehicle.chassis}
                  onChangeText={(t) =>
                    setVehicle((v) => ({ ...v, chassis: t.toUpperCase() }))
                  }
                  placeholder="Paste chassis to autofill"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                />
                <Pressable style={styles.decodeBtn} onPress={decodeVin} disabled={decoding}>
                  <Text style={styles.decodeText}>{decoding ? '…' : 'Autofill'}</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Color</Text>
              <TextInput
                style={styles.fieldInput}
                value={vehicle.color}
                onChangeText={(t) => setVehicle((v) => ({ ...v, color: t }))}
                placeholder="Silver"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.fieldLabel}>Plate number</Text>
              <TextInput
                style={styles.fieldInput}
                value={vehicle.plate}
                onChangeText={(t) => setVehicle((v) => ({ ...v, plate: t }))}
                placeholder="GR-1234-26"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.fieldLabel}>Vehicle type</Text>
              <TextInput
                style={styles.fieldInput}
                value={vehicle.type}
                onChangeText={(t) => setVehicle((v) => ({ ...v, type: t }))}
                placeholder="Sedan / SUV"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          ) : (
            <>
              <Row
                styles={styles}
                colors={colors}
                label="Make & model"
                value={[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
              />
              <Row styles={styles} colors={colors} label="Year" value={vehicle.year} />
              <Row styles={styles} colors={colors} label="Chassis / VIN" value={vehicle.chassis} />
              <Row styles={styles} colors={colors} label="Color" value={vehicle.color} />
              <Row styles={styles} colors={colors} label="Vehicle type" value={vehicle.type} />
              <Row styles={styles} colors={colors} label="Plate number" value={vehicle.plate} />
              <Row
                styles={styles}
                colors={colors}
                label="Registration"
                badge={vehicle.registrationStatus || undefined}
                value={vehicle.registrationStatus || '—'}
              />
            </>
          )}

          <Pressable
            style={styles.editBtn}
            onPress={() => (editing ? save() : setEditing(true))}
          >
            <Text style={styles.editText}>
              {editing ? 'Save changes' : 'Edit vehicle details'}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  badge,
  styles,
  colors,
}: {
  label: string;
  value?: string;
  badge?: string;
  styles: any;
  colors: any;
}) {
  const display = value && value.trim() ? value : '—';
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Text style={styles.rowValue}>{display}</Text>
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    back: { color: colors.textSecondary, marginBottom: spacing[3] },
    title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
    sub: { color: colors.textSecondary, marginBottom: spacing[5], marginTop: 6, fontSize: 13 },
    hint: { color: colors.textSecondary },
    photo: {
      height: 160,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing[2],
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photoImg: { width: '100%', height: '100%' },
    photoHint: { color: colors.textSecondary },
    replacePhoto: {
      color: colors.motionBlue,
      marginBottom: spacing[4],
      fontWeight: '600',
    },
    msg: { color: colors.movrGreen, marginBottom: spacing[3], fontSize: 13 },
    editBlock: { marginBottom: spacing[3] },
    fieldLabel: { color: colors.textSecondary, marginBottom: 6, fontSize: 13 },
    fieldInput: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingHorizontal: spacing[4],
      paddingVertical: 14,
      color: colors.pureWhite,
      marginBottom: 12,
      fontWeight: '600',
    },
    suggestBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      marginBottom: 12,
      overflow: 'hidden',
    },
    suggestRow: {
      paddingHorizontal: spacing[4],
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    suggestText: { color: colors.pureWhite, fontWeight: '600' },
    vinRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
    decodeBtn: {
      backgroundColor: colors.electricViolet || '#7C3AED',
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    decodeText: { color: colors.pureWhite, fontWeight: '700', fontSize: 13 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    chipOn: { backgroundColor: colors.movrGreen, borderColor: colors.movrGreen },
    chipText: { color: colors.pureWhite, fontWeight: '600', fontSize: 13 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingHorizontal: spacing[4],
      paddingVertical: 16,
      marginBottom: spacing[3],
    },
    rowLabel: { color: colors.textSecondary },
    rowValue: { color: colors.pureWhite, fontWeight: '600', maxWidth: '58%', textAlign: 'right' },
    badge: {
      backgroundColor: colors.movrGreen,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: { color: colors.success, fontWeight: '600', fontSize: 13 },
    editBtn: {
      marginTop: spacing[4],
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.pureWhite,
      paddingVertical: 16,
      alignItems: 'center',
    },
    editText: { color: colors.pureWhite, fontWeight: '700' },
  });
}
