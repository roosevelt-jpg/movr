import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Phase 28 — local record then async upload (not live stream).
 * Gated by TRIP_RECORDING_ENABLED on the backend; camera APIs are stubbed for Expo Go.
 */
export default function ActiveRideRecordingPanel({
  rideId,
  driverId,
}: {
  rideId: string;
  driverId: string;
}) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'done'>('idle');
  const [note, setNote] = useState('');

  const start = async () => {
    const res = await fetch(`${API}/rides/${rideId}/recording/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId }),
    });
    const json = await res.json();
    if (!json.data?.enabled) {
      setNote(json.data?.message || 'Recording disabled');
      return;
    }
    setStatus('recording');
    setNote('Recording locally (cabin camera). Upload after trip ends on Wi‑Fi when possible.');
  };

  const finishAndUpload = async () => {
    setStatus('uploading');
    const urlRes = await fetch(`${API}/rides/${rideId}/recording/upload-url`, { method: 'POST' });
    const urlJson = await urlRes.json();
    if (urlJson.status === 'error') {
      setNote(urlJson.message);
      setStatus('recording');
      return;
    }
    // Production: PUT local encrypted file chunks to urlJson.data.uploadUrl (resumable).
    await fetch(`${API}/rides/${rideId}/recording/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localDurationSeconds: 0 }),
    });
    setStatus('done');
    setNote('Upload queued / complete. Retention starts (default 72h unless disputed).');
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Trip recording</Text>
      <Text style={styles.sub}>
        Local-only until upload. Rider must see the safety notice before pickup.
      </Text>
      {status === 'idle' ? (
        <Pressable style={styles.btn} onPress={start}>
          <Text style={styles.btnText}>Start local recording</Text>
        </Pressable>
      ) : null}
      {status === 'recording' ? (
        <Pressable style={styles.btn} onPress={finishAndUpload}>
          <Text style={styles.btnText}>End trip & upload</Text>
        </Pressable>
      ) : null}
      <Text style={styles.meta}>
        {status} · {Platform.OS} camera stub
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

/** Rider-facing notice — call before confirming pickup. */
export async function acknowledgeRecordingNotice(rideId: string) {
  await fetch(`${API}/rides/${rideId}/recording/notice`, { method: 'POST' });
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[3],
    marginTop: spacing[3],
  },
  title: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  sub: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing[2], fontSize: 13 },
  btn: {
    backgroundColor: colors.electricViolet,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
  },
  btnText: { color: colors.pureWhite, fontWeight: '600' },
  meta: { color: colors.textSecondary, marginTop: spacing[2], fontSize: 12 },
  note: { color: colors.movrGreen, marginTop: spacing[2], fontSize: 13 },
});
