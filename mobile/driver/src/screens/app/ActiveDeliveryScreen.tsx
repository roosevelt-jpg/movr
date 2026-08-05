import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

/** Confirm delivery — photo, signature pad, OTP digits. */
export default function ActiveDeliveryScreen() {
  const [otp, setOtp] = useState(['4', '8', '2', '']);
  const [orderLabel] = useState('Order #4821 · Ama K.');

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = v;
    setOtp(next);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Confirm delivery</Text>
      <Text style={styles.sub}>{orderLabel}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📷  Proof of delivery photo</Text>
        <Pressable style={styles.photoBox}>
          <Text style={styles.photoIcon}>📷</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>✍️  Receiver signature</Text>
        <Pressable style={styles.signBox}>
          <Text style={styles.signHint}>∿</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>✓  Enter OTP from customer</Text>
        <View style={styles.otpRow}>
          {otp.map((d, i) => (
            <TextInput
              key={i}
              style={[styles.otpBox, i === 2 && styles.otpFocus]}
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

      <Pressable style={styles.cta}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>Confirm delivery</Text>
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
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
  },
  photoIcon: { fontSize: 28, opacity: 0.7 },
  signBox: {
    height: 100,
    borderRadius: radius.md,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signHint: { color: '#444', fontSize: 40 },
  otpRow: { flexDirection: 'row', gap: spacing[3] },
  otpBox: {
    width: 52,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0A0A0A',
    color: colors.pureWhite,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  otpFocus: { borderColor: colors.motionBlue },
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
