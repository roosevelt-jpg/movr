import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';

/** Driver delivery completion: photo proof, signature URL, OTP (Phase 11). */
export default function ActiveDeliveryScreen() {
  const [otp, setOtp] = useState('');
  const emergency = process.env.EXPO_PUBLIC_EMERGENCY_NUMBER || '191';

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Active delivery</Text>
      <Text style={styles.sub}>Capture proof, signature, then confirm OTP.</Text>

      <Button label="Capture proof photo" onPress={() => undefined} />
      <Button label="Capture signature" variant="secondary" onPress={() => undefined} />

      <TextInput
        style={styles.input}
        placeholder="Receiver OTP"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
      />
      <Button label="Verify OTP & complete" onPress={() => undefined} />

      <Pressable onPress={() => Linking.openURL(`tel:${emergency}`)} style={styles.sos}>
        <Text style={styles.sosText}>Call Police ({emergency})</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4], gap: spacing[3] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.pureWhite,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  sos: {
    marginTop: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  sosText: { color: colors.error, fontWeight: '700' },
});
