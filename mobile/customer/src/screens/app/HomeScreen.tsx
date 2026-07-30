import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@movr/design-system/theme';

/** Ride tab content — reused inside SuperAppHomeScreen. */
export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Ride</Text>
      <Text style={styles.sub}>Pickup and destination inputs go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 20, fontWeight: '600' },
  sub: { color: colors.textSecondary, marginTop: spacing[2] },
});
