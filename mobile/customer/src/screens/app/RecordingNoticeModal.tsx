import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

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

const NOTICE =
  'This trip is recorded for safety. Recording is stored securely and only reviewed if there\u2019s a dispute or safety report.';

/**
 * Phase 28 — unmissable rider notice before pickup (not buried in ToS).
 */
export default function RecordingNoticeModal({
  visible,
  rideId,
  onAcknowledged,
}: {
  visible: boolean;
  rideId: string;
  onAcknowledged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accept = async () => {
    if (!rideId) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/rides/${rideId}/recording/notice`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (json.status === 'error') {
        setError(json.message || 'Could not log notice');
        return;
      }
      onAcknowledged();
    } catch (e: any) {
      setError(e.message || 'Could not log notice');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.label}>Safety recording</Text>
          <Text style={styles.title}>{NOTICE}</Text>
          <Text style={styles.sub}>
            Footage is recorded on the driver device and uploaded later — not live-streamed. You can
            cancel before the trip starts if you do not accept.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.btn} onPress={accept} disabled={busy}>
            <Text style={styles.btnText}>{busy ? 'Saving…' : 'I understand — continue'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export { NOTICE as RECORDING_NOTICE_COPY };

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: spacing[4],
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.warning,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  title: { color: colors.pureWhite, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  sub: { color: colors.textSecondary, marginTop: spacing[3], fontSize: 14, lineHeight: 20 },
  error: { color: colors.error, marginTop: spacing[2], fontSize: 13 },
  btn: {
    marginTop: spacing[4],
    backgroundColor: colors.motionBlue,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  btnText: { color: colors.pureWhite, fontWeight: '700' },
});
