import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { initMobileSentry } from '../../sentry';

initMobileSentry('customer');

/** Brand splash — Movr / MOVE · SHOP · DELIVER. */
export default function SplashScreen({ onDone }: { onDone?: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={styles.root}>
      <View style={styles.glow} />
      <Text style={styles.brand}>Movr</Text>
      <Text style={styles.tag}>MOVE · SHOP · DELIVER</Text>
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
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(142,45,226,0.2)',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tag: {
    color: '#A1A1AA',
    fontSize: 12,
    marginTop: 12,
    fontWeight: '500',
    letterSpacing: 3,
  },
});
