import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing[6], alignItems: 'center' },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  subtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
});

export default EmptyState;
