import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

/** Crypto claim removed for store compliance. */
export default function ClaimScreen({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Rewards</Text>
      <Text style={styles.body}>
        Token claims are not available. Use Wallet for fiat balance, ride credit, and loyalty points.
      </Text>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.btn}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0a0a0a' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  body: { color: '#a1a1aa', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnText: { fontWeight: '700', color: '#000' },
});
