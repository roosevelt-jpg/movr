import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

const STATUS_COLOR: Record<string, string> = {
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  pending: colors.motionBlue,
  default: colors.textSecondary,
};

export function StatusPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: keyof typeof STATUS_COLOR;
}) {
  const color = STATUS_COLOR[tone] || STATUS_COLOR.default;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  text: { fontSize: 12, fontWeight: '600' },
});

export default StatusPill;
