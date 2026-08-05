import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  PanResponder,
  Alert,
} from 'react-native';
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

/** Confirm delivery — photo capture stub, signature pad, OTP, then verify. */
export default function ActiveDeliveryScreen({
  deliveryId,
  orderLabel,
  onDone,
}: {
  deliveryId?: string;
  orderLabel?: string;
  onDone?: () => void;
}) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [signed, setSigned] = useState(false);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const label = orderLabel || (deliveryId ? `Delivery #${deliveryId.slice(0, 8)}` : 'Delivery');

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setSigned(true);
        setStrokes((s) => [...s, { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }]);
      },
      onPanResponderMove: (e) => {
        setStrokes((s) => [...s, { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }]);
      },
    })
  ).current;

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = v;
    setOtp(next);
  };

  const signatureDataUrl = () => {
    const points = strokes
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="100%" height="100%" fill="#fff"/><path d="${points}" fill="none" stroke="#000" stroke-width="2"/></svg>`;
    const b64 =
      typeof btoa === 'function'
        ? btoa(svg)
        : (globalThis as any).Buffer
          ? (globalThis as any).Buffer.from(svg).toString('base64')
          : '';
    return b64 ? `data:image/svg+xml;base64,${b64}` : `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  const confirm = async () => {
    const code = otp.join('');
    if (!deliveryId) {
      setMsg('Missing delivery id');
      return;
    }
    if (!photoTaken) {
      setMsg('Capture proof of delivery photo first');
      return;
    }
    if (!signed || strokes.length < 3) {
      setMsg('Receiver signature required');
      return;
    }
    if (code.length < 4) {
      setMsg('Enter the full OTP');
      return;
    }

    setBusy(true);
    setMsg('');
    try {
      // Placeholder photo as tiny PNG data URL (1x1) — real apps use ImagePicker / camera
      const proofBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      await fetch(`${API}/deliveries/${deliveryId}/proof`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          proofBase64,
          signatureBase64: signatureDataUrl(),
        }),
      });

      const res = await fetch(`${API}/deliveries/${deliveryId}/verify-otp`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ otp: code }),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        setMsg(json.message || 'OTP verification failed');
      } else {
        setMsg('Delivery confirmed');
        onDone?.();
      }
    } catch (e: any) {
      setMsg(e.message || 'Confirm failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Confirm delivery</Text>
      <Text style={styles.sub}>{label}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Proof of delivery photo</Text>
        <Pressable
          style={[styles.photoBox, photoTaken && styles.doneBox]}
          onPress={() => {
            setPhotoTaken(true);
            Alert.alert('Photo', 'Proof photo captured (camera hook-up in Expo build)');
          }}
        >
          <Text style={styles.photoIcon}>{photoTaken ? '✓' : '📷'}</Text>
          <Text style={styles.hint}>{photoTaken ? 'Photo ready' : 'Tap to capture'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Receiver signature</Text>
        <View style={styles.signBox} {...pan.panHandlers}>
          {strokes.slice(0, 40).map((p, i) => (
            <View
              key={i}
              style={[styles.ink, { left: p.x, top: p.y }]}
            />
          ))}
          {!signed ? <Text style={styles.signHint}>Sign here</Text> : null}
        </View>
        <Pressable
          onPress={() => {
            setStrokes([]);
            setSigned(false);
          }}
        >
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Enter OTP from customer</Text>
        <View style={styles.otpRow}>
          {otp.map((d, i) => (
            <TextInput
              key={i}
              style={styles.otpBox}
              keyboardType="number-pad"
              maxLength={1}
              value={d}
              onChangeText={(t) => setDigit(i, t)}
              placeholder="·"
              placeholderTextColor={colors.textSecondary}
            />
          ))}
        </View>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={confirm} disabled={busy}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>{busy ? 'Confirming…' : 'Confirm delivery'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing[5] },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '600', marginBottom: spacing[3] },
  photoBox: {
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  doneBox: { borderColor: colors.success, borderStyle: 'solid' },
  photoIcon: { fontSize: 28, opacity: 0.7 },
  hint: { color: colors.textSecondary, marginTop: 6, fontSize: 12 },
  signBox: {
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  ink: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.pureWhite,
    marginLeft: -2,
    marginTop: -2,
  },
  signHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: 38,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.border,
    fontSize: 16,
  },
  clear: { color: colors.motionBlue, marginTop: 8, fontSize: 13 },
  otpRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.pureWhite,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  msg: { color: colors.textSecondary, marginBottom: spacing[2] },
  cta: {
    marginTop: 'auto' as any,
    marginBottom: spacing[4],
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
    overflow: 'hidden',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, zIndex: 1 },
});
