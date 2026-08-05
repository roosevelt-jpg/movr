import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image } from 'react-native';
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

const EMPTY_VEHICLE = {
  type: '',
  makeModel: '',
  plate: '',
  registrationStatus: '',
  photoUrl: '',
};

/** Driver — My vehicle profile + edit. */
export default function MyVehicleScreen({ onBack }: { onBack?: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [editing, setEditing] = useState(false);
  const [vehicle, setVehicle] = useState(EMPTY_VEHICLE);
  const [loaded, setLoaded] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/driver/vehicle`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.data) {
          setVehicle(EMPTY_VEHICLE);
          return;
        }
        setVehicle({
          type: j.data.vehicle_type || j.data.type || '',
          makeModel: j.data.make_model || j.data.makeModel || '',
          plate: j.data.plate_number || j.data.plate || '',
          registrationStatus: j.data.registration_status
            ? j.data.registration_status
            : j.data.verified
              ? 'Verified'
              : j.data.verified === false
                ? 'Pending'
                : '',
          photoUrl: j.data.photo_url || '',
        });
      })
      .catch(() => setVehicle(EMPTY_VEHICLE))
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    await fetch(`${API}/driver/vehicle`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        vehicle_type: vehicle.type,
        make_model: vehicle.makeModel,
        plate_number: vehicle.plate,
        photo_url: vehicle.photoUrl || undefined,
      }),
    }).catch(() => undefined);
    setEditing(false);
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
    if (url.startsWith('/uploads')) {
      try {
        return new URL(url, new URL(API).origin).toString();
      } catch {
        return url;
      }
    }
    return url;
  };

  const Row = ({
    label,
    value,
    badge,
  }: {
    label: string;
    value?: string;
    badge?: string;
  }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : editing && label !== 'Registration' ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => {
            if (label === 'Vehicle type') setVehicle((v) => ({ ...v, type: t }));
            if (label === 'Make & model') setVehicle((v) => ({ ...v, makeModel: t }));
            if (label === 'Plate number') setVehicle((v) => ({ ...v, plate: t }));
          }}
          placeholder="—"
          placeholderTextColor={colors.textSecondary}
        />
      ) : (
        <Text style={styles.rowValue}>{display(value)}</Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>My vehicle</Text>

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

          <Row label="Vehicle type" value={vehicle.type} />
          <Row label="Make & model" value={vehicle.makeModel} />
          <Row label="Plate number" value={vehicle.plate} />
          <Row
            label="Registration"
            badge={vehicle.registrationStatus || undefined}
            value={vehicle.registrationStatus || '—'}
          />

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

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  back: { color: colors.textSecondary, marginBottom: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[5] },
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
  rowValue: { color: colors.pureWhite, fontWeight: '600' },
  input: { color: colors.pureWhite, fontWeight: '600', textAlign: 'right', minWidth: 120 },
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
