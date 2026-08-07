import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  PanResponder,
  Alert,
  ScrollView,
} from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { pickAndUploadImage } from '../../lib/upload';

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

/** Confirm delivery — POD photo, signature, 4-digit OTP. */
export default function ActiveDeliveryScreen({
  deliveryId,
  orderLabel,
  onDone,
}: {
  deliveryId?: string;
  orderLabel?: string;
  onDone?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [otp, setOtp] = useState(['', '', '', '']);
  const [focusIdx, setFocusIdx] = useState(0);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [signed, setSigned] = useState(false);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [label, setLabel] = useState(
    orderLabel || (deliveryId ? `Order #${String(deliveryId).replace(/-/g, '').slice(-4).toUpperCase()}` : 'Delivery')
  );
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!deliveryId) return;
    fetch(`${API}/deliveries/${deliveryId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.orderLabel) setLabel(j.data.orderLabel);
      })
      .catch(() => undefined);
  }, [deliveryId]);

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
    if (v && index < 3) {
      inputs.current[index + 1]?.focus();
      setFocusIdx(index + 1);
    }
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
    if (!photoTaken || !proofUrl) {
      setMsg('Capture proof of delivery photo first');
      return;
    }
    if (!signed || strokes.length < 3) {
      setMsg('Receiver signature required');
      return;
    }
    if (code.length < 4) {
      setMsg('Enter the 4-digit OTP');
      return;
    }

    setBusy(true);
    setMsg('');
    try {
      await fetch(`${API}/deliveries/${deliveryId}/proof`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          proofOfDeliveryUrl: proofUrl,
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
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Confirm delivery</Text>
      <Text style={styles.sub}>{label}</Text>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardIcon}>📷</Text>
          <Text style={styles.cardTitle}>Proof of delivery photo</Text>
        </View>
        <Pressable
          style={[styles.photoBox, photoTaken && styles.doneBox]}
          onPress={async () => {
            try {
              const url = await pickAndUploadImage({ accept: 'image/*' });
              setProofUrl(url);
              setPhotoTaken(true);
              setMsg('Proof photo uploaded');
            } catch (e: any) {
              setMsg(e.message || 'Photo upload failed');
              Alert.alert('Upload', e.message || 'Photo upload failed');
            }
          }}
        >
          <Text style={styles.photoIcon}>{photoTaken ? '✓' : '📷'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardIcon}>〰️</Text>
          <Text style={styles.cardTitle}>Receiver signature</Text>
        </View>
        <View style={styles.signBox} {...pan.panHandlers}>
          {strokes.slice(0, 80).map((p, i) => (
            <View key={i} style={[styles.ink, { left: p.x, top: p.y }]} />
          ))}
          {!signed ? <Text style={styles.signHint}>〰️</Text> : null}
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
        <View style={styles.cardHead}>
          <Text style={styles.cardIcon}>✓</Text>
          <Text style={styles.cardTitle}>Enter OTP from customer</Text>
        </View>
        <View style={styles.otpRow}>
          {otp.map((d, i) => (
            <TextInput
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              style={[styles.otpBox, focusIdx === i && styles.otpFocus]}
              keyboardType="number-pad"
              maxLength={1}
              value={d}
              onFocus={() => setFocusIdx(i)}
              onChangeText={(t) => setDigit(i, t)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) {
                  inputs.current[i - 1]?.focus();
                  setFocusIdx(i - 1);
                }
              }}
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
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
    sub: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing[5] },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[4],
      marginBottom: spacing[3],
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing[3] },
    cardIcon: { fontSize: 14 },
    cardTitle: { color: colors.pureWhite, fontWeight: '600' },
    photoBox: {
      height: 140,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    doneBox: { borderColor: colors.success, borderStyle: 'solid' },
    photoIcon: { fontSize: 36, opacity: 0.55 },
    signBox: {
      height: 120,
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
      top: 42,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: colors.border,
      fontSize: 28,
      opacity: 0.5,
    },
    clear: { color: colors.motionBlue, marginTop: 8, fontSize: 13 },
    otpRow: { flexDirection: 'row', gap: spacing[3] },
    otpBox: {
      width: 52,
      height: 56,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.pureWhite,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '700',
    },
    otpFocus: { borderColor: colors.motionBlue, borderWidth: 2 },
    msg: { color: colors.textSecondary, marginBottom: spacing[2] },
    cta: {
      marginTop: spacing[4],
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
}
