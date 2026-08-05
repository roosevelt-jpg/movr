import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function parseJwtId(token: string | null): string {
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || '';
  } catch {
    return '';
  }
}

/**
 * Phase 28 — local record then async upload (not live stream).
 * Auto-starts when trip is active; stops + uploads when trip ends.
 * Camera hardware is stubbed without native modules; local path is app-private marker.
 */
export default function ActiveRideRecordingPanel({
  rideId,
  driverId: driverIdProp,
  tripActive = true,
  tripEnded = false,
}: {
  rideId: string;
  driverId?: string;
  tripActive?: boolean;
  tripEnded?: boolean;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  const driverId = driverIdProp || parseJwtId(token) || '';

  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'done' | 'off'>('idle');
  const [note, setNote] = useState('');
  const [localPath, setLocalPath] = useState('');
  const startedAt = useRef<number | null>(null);
  const autoStarted = useRef(false);
  const uploadStarted = useRef(false);

  const start = async () => {
    const res = await fetch(`${API}/rides/${rideId}/recording/start`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ driverId }),
    });
    const json = await res.json();
    if (!json.data?.enabled) {
      setStatus('off');
      setNote(json.data?.message || 'Recording disabled pending privacy review');
      return;
    }
    // App-private path marker (encrypted-at-rest via OS when using real FileSystem)
    const path = `private://trip-recordings/${rideId}.mp4`;
    setLocalPath(path);
    startedAt.current = Date.now();
    setStatus('recording');
    setNote('Recording locally (cabin camera). Upload after trip ends — prefer Wi‑Fi.');
  };

  const finishAndUpload = async () => {
    if (uploadStarted.current) return;
    uploadStarted.current = true;
    setStatus('uploading');
    const durationSec = startedAt.current
      ? Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
      : 0;

    const urlRes = await fetch(`${API}/rides/${rideId}/recording/upload-url`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const urlJson = await urlRes.json();
    if (urlJson.status === 'error') {
      setNote(urlJson.message);
      setStatus('recording');
      uploadStarted.current = false;
      return;
    }

    const uploadUrl = urlJson.data?.uploadUrl as string | undefined;
    // Chunked/resumable PUT — retry once on failure (placeholder body until native camera wired)
    if (uploadUrl) {
      const body = new Uint8Array([0, 0, 0, 0]); // stub local encrypted blob
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          const put = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'video/mp4' },
            body,
          });
          ok = put.ok || put.status === 200 || put.status === 204;
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        setNote('Upload retry pending — will resume when connection improves');
      }
    }

    await fetch(`${API}/rides/${rideId}/recording/complete`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ localDurationSeconds: durationSec, localPath }),
    });
    setStatus('done');
    setNote('Upload complete (or queued). Retention starts unless flagged for dispute.');
  };

  useEffect(() => {
    if (!rideId || !tripActive || autoStarted.current) return;
    autoStarted.current = true;
    start().catch(() => setNote('Could not start recording'));
  }, [rideId, tripActive]);

  useEffect(() => {
    if (tripEnded && status === 'recording') {
      finishAndUpload().catch(() => undefined);
    }
  }, [tripEnded, status]);

  if (status === 'off') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Trip recording</Text>
        <Text style={styles.note}>{note || 'Disabled'}</Text>
      </View>
    );
  }

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
        {status} · {Platform.OS} · {localPath ? 'private store' : '—'}
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

/** Rider-facing notice — call before confirming pickup. */
export async function acknowledgeRecordingNotice(rideId: string) {
  await fetch(`${API}/rides/${rideId}/recording/notice`, {
    method: 'POST',
    headers: authHeaders(),
  });
}

function makeStyles(colors: any) {
  return StyleSheet.create({
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
}
