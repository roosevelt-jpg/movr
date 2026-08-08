import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(
  /\/api\/v1\/?$/,
  ''
);

const MENU = `MOVR
--------------------
1. Book a ride
2. Track my order
3. Check wallet balance
4. My saved places
5. Cash agents
6. Help / dispute

Reply with a number`;

/**
 * USSD-style text menu — live POST /webhooks/ussd (JSON).
 */
export default function UssdMenuScreen({
  phone = '+233240000000',
  sessionId = 'demo-ussd',
}: {
  onBookRide?: () => void;
  onTrackOrder?: () => void;
  onWallet?: () => void;
  onPlaces?: () => void;
  onHelp?: () => void;
  phone?: string;
  sessionId?: string;
}) {
  const [input, setInput] = useState('');
  const [screen, setScreen] = useState(MENU);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Reset USSD session to menu on mount
    fetch(`${API_ROOT}/webhooks/ussd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, text: '', sessionId, format: 'json' }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body?.message || body?.data?.text) {
          setScreen(body.message || body.data.text);
        }
      })
      .catch(() => setScreen(MENU));
  }, [phone, sessionId]);

  const reply = async (n: string) => {
    const choice = n.trim();
    if (!choice) return;
    setInput('');
    setScreen((prev) => `${prev}\n\n> ${choice}`);

    try {
      const res = await fetch(`${API_ROOT}/webhooks/ussd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          text: choice,
          sessionId,
          format: 'json',
        }),
      });
      const json = await res.json();
      const text = json?.message || json?.data?.text || 'Invalid. Reply 1-6';
      setScreen(text);
    } catch {
      setScreen('Network error. Try again.');
    }
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.term}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        <Text style={styles.mono}>{screen}</Text>
      </ScrollView>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          keyboardType="default"
          placeholder="Reply with a number"
          placeholderTextColor="#3d7a3d"
          autoCapitalize="characters"
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
  root: { flex: 1, backgroundColor: '#0a2e0a' },
  term: { flex: 1 },
  mono: {
    fontFamily: 'Courier',
    color: '#39ff14',
    fontSize: 15,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1a4d1a',
    padding: 8,
    gap: 8,
    backgroundColor: '#062006',
  },
  input: {
    flex: 1,
    color: '#39ff14',
    fontFamily: 'Courier',
    padding: 10,
    backgroundColor: '#0a2e0a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1a4d1a',
  },
  send: {
    backgroundColor: '#1a4d1a',
    borderRadius: 4,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendText: { color: '#39ff14', fontWeight: '700' },
});
