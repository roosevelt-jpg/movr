import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@movr/design-system/theme';

/** Brand splash — Movr / Move. Shop. Deliver. */
export default function SplashScreen({ onDone }: { onDone?: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Movr</Text>
      <Text style={styles.tag}>Move. Shop. Deliver.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.jetBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: '#fff', fontSize: 42, fontWeight: '800', letterSpacing: -0.5 },
  tag: { color: '#888', fontSize: 16, marginTop: 10, fontWeight: '400' },
});
