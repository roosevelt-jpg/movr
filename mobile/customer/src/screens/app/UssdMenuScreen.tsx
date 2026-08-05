import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { colors, spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const MENU = `MOVR
--------------------
1. Book a ride
2. Track my order
3. Check wallet balance
4. My saved places
5. Help

Reply with a number`;

/**
 * USSD-style text menu — numeric replies map to channel/ussd + app actions.
 */
export default function UssdMenuScreen({
  onBookRide,
  onTrackOrder,
  onWallet,
  onPlaces,
  onHelp,
}: {
  onBookRide?: () => void;
  onTrackOrder?: () => void;
  onWallet?: () => void;
  onPlaces?: () => void;
  onHelp?: () => void;
}) {
  const [input, setInput] = useState('');
  const [log, setLog] = useState<string[]>([MENU]);

  const reply = async (n: string) => {
    const choice = n.trim();
    setLog((l) => [...l, `> ${choice}`]);
    setInput('');

    try {
      await fetch(`${API.replace('/api/v1', '')}/webhooks/ussd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: '+233240000000',
          text: choice,
          sessionId: 'demo-ussd',
        }),
      });
    } catch {
      /* local demo */
    }

    if (choice === '1') {
      setLog((l) => [...l, 'Enter pickup,destination\ne.g. Osu, Kotoka Airport']);
      onBookRide?.();
    } else if (choice === '2') {
      setLog((l) => [...l, 'Enter order ID to track']);
      onTrackOrder?.();
    } else if (choice === '3') {
      setLog((l) => [...l, 'Wallet: GH₵0.00 (open app for details)']);
      onWallet?.();
    } else if (choice === '4') {
      setLog((l) => [...l, 'Saved: Home, Work, Osu']);
      onPlaces?.();
    } else if (choice === '5') {
      setLog((l) => [...l, 'Help: Call 0800-MOVR or open in-app Help']);
      onHelp?.();
    } else if (choice.includes(',')) {
      setLog((l) => [
        ...l,
        'Economy GH₵45 · ETA 4 min\nReply YES to confirm',
      ]);
    } else if (choice.toUpperCase() === 'YES') {
      setLog((l) => [
        ...l,
        'Booked! Kwesi Boateng, GR 4471-22, arriving in 4 min. Fare GH₵45.',
      ]);
    } else {
      setLog((l) => [...l, 'Invalid. Reply 1-5']);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.term} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.mono}>{log.join('\n\n')}</Text>
      </ScrollView>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          keyboardType="default"
          placeholder="Reply with a number"
          placeholderTextColor={colors.movrGreen}
          onSubmitEditing={() => reply(input)}
        />
        <Pressable style={styles.send} onPress={() => reply(input)}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.movrGreen },
  term: { flex: 1 },
  mono: {
    fontFamily: 'Courier',
    color: colors.success,
    fontSize: 14,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.movrGreen,
    padding: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.success,
    fontFamily: 'Courier',
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: 4,
  },
  send: {
    backgroundColor: colors.movrGreen,
    borderRadius: 4,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendText: { color: colors.success, fontWeight: '700' },
});
