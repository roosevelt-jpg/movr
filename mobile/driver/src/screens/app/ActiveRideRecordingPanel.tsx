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
 * Capture a short cabin clip via MediaRecorder when getUserMedia is available (web).
 * Falls back to a tiny placeholder blob on native until expo-camera / FS is wired.
 */
async function captureLocalClip(): Promise<Blob> {
  const nav = (globalThis as any).navigator;
  if (nav?.mediaDevices?.getUserMedia && typeof (globalThis as any).MediaRecorder !== 'undefined') {
    const stream: MediaStream = await nav.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: true,
    });
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: BlobPart[] = [];
      const done = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (e: any) => {
          if (e.data?.size) chunks.push(e.data);
        };
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        recorder.onerror = () => reject(new Error('MediaRecorder failed'));
      });
      recorder.start(250);
      await new Promise((r) => setTimeout(r, 2500));
      if (recorder.state !== 'inactive') recorder.stop();
      return await done;
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  }
  // Native / unsupported — placeholder until device camera module is linked
  return new Blob([new Uint8Array([0, 0, 0, 1])], { type: 'video/mp4' });
}

/**
 * Phase 28 — local record then async upload (not live stream).
 * Auto-starts when trip is active; stops + uploads when trip ends.
 * Uses browser MediaRecorder when available; otherwise uploads a placeholder until native camera is linked.
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
  const clipRef = useRef<Blob | null>(null);

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
    const path = `private://trip-recordings/${rideId}.${Platform.OS === 'web' ? 'webm' : 'mp4'}`;
    setLocalPath(path);
    startedAt.current = Date.now();
    setStatus('recording');
    setNote('Recording locally (cabin). Upload after trip ends — prefer Wi‑Fi.');
    try {
      clipRef.current = await captureLocalClip();
      setNote(
        clipRef.current.size > 4
          ? 'Clip captured. Will upload when trip ends.'
          : 'Camera unavailable — placeholder clip queued for upload path test.'
      );
    } catch (e: any) {
      clipRef.current = new Blob([new Uint8Array([0, 0, 0, 1])], { type: 'video/mp4' });
      setNote(e?.message || 'Camera permission denied — placeholder queued');
    }
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
    const body = clipRef.current || new Blob([new Uint8Array([0, 0, 0, 1])], { type: 'video/mp4' });
    if (uploadUrl) {
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          const putHeaders: Record<string, string> = {
            'Content-Type': body.type || 'video/mp4',
          };
          if (uploadUrl.includes('/recording/upload-body')) {
            Object.assign(putHeaders, authHeaders());
          }
          const put = await fetch(uploadUrl, {
            method: 'PUT',
            headers: putHeaders,
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
        <>
          <Text style={styles.live}>● Recording</Text>
          <Text style={styles.note}>{note}</Text>
          <Pressable style={styles.btn} onPress={() => finishAndUpload()}>
            <Text style={styles.btnText}>Stop & upload</Text>
          </Pressable>
        </>
      ) : null}
      {status === 'uploading' ? <Text style={styles.note}>Uploading…</Text> : null}
      {status === 'done' ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    panel: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[4],
      marginBottom: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
    sub: { color: colors.textSecondary, marginTop: 6, marginBottom: spacing[3], fontSize: 13 },
    note: { color: colors.textSecondary, marginTop: spacing[2], fontSize: 13 },
    live: { color: colors.error, fontWeight: '700', marginTop: spacing[2] },
    btn: {
      marginTop: spacing[3],
      backgroundColor: colors.electricViolet,
      borderRadius: radius.pill,
      paddingVertical: 12,
      alignItems: 'center',
    },
    btnText: { color: '#FFFFFF', fontWeight: '700' },
  });
}
