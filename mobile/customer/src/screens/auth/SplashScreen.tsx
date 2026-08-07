import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { initMobileSentry } from '../../sentry';

initMobileSentry('customer');

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
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tag: {
    color: '#A1A1AA',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '400',
  },
});
