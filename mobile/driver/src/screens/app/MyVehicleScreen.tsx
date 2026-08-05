import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const EMPTY_VEHICLE = {
  type: '',
  makeModel: '',
  plate: '',
  registrationStatus: '',
  photoUrl: '',
};

/** Driver — My vehicle profile + edit. */
export default function MyVehicleScreen({ onBack }: { onBack?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [vehicle, setVehicle] = useState(EMPTY_VEHICLE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/driver/vehicle`)
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_type: vehicle.type,
        make_model: vehicle.makeModel,
        plate_number: vehicle.plate,
      }),
    }).catch(() => undefined);
    setEditing(false);
  };

  const display = (value?: string) => (value && value.trim() ? value : '—');

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
          <View style={styles.photo}>
            {vehicle.photoUrl ? (
              <Text style={styles.photoHint}>Photo loaded</Text>
            ) : (
              <Text style={styles.photoHint}>No vehicle photo</Text>
            )}
          </View>

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  back: { color: colors.textSecondary, marginBottom: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[5] },
  hint: { color: colors.textSecondary },
  photo: {
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { color: colors.textSecondary },
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
  editText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
});
