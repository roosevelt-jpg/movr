import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Msg = { id: string; from: 'user' | 'bot'; text: string; hint?: string };

/**
 * Movr Bot (Telegram-style) ride booking chat —
 * location share → destination → Economy/Comfort quotes.
 */
export default function MovrBotConversationScreen() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      from: 'bot',
      text: 'Welcome! Share your location or type your pickup address.',
    },
  ]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState<'pickup' | 'dest' | 'quote' | 'done'>('pickup');
  const [pickup, setPickup] = useState('Osu');
  const listRef = useRef<FlatList>(null);
  const seq = useRef(1);

  const push = (m: Omit<Msg, 'id'>) => {
    setMessages((prev) => [...prev, { ...m, id: String(seq.current++) }]);
  };

  const quote = async (from: string, to: string) => {
    let economy = { price: 45, eta: 4 };
    let comfort = { price: 62, eta: 3 };
    try {
      const res = await fetch(`${API}/voice/parse-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `from ${from} to ${to}`,
          currentLat: 5.6037,
          currentLng: -0.187,
          countryCode: 'GH',
        }),
      });
      const json = await res.json();
      const opts = json.data?.options || [];
      if (opts[0]) economy = { price: opts[0].price, eta: opts[0].etaMinutes ?? 4 };
      if (opts[1]) comfort = { price: opts[1].price, eta: opts[1].etaMinutes ?? 3 };
    } catch {
      /* demo quotes */
    }
    push({
      from: 'bot',
      text: `Economy GH₵${economy.price} · ${economy.eta} min | Comfort GH₵${comfort.price} · ${comfort.eta} min`,
      hint: 'Tap a button below to confirm',
    });
    setStep('quote');
  };

  const shareLocation = async () => {
    push({ from: 'user', text: '📍 Location shared' });
    setPickup('Osu');
    push({ from: 'bot', text: 'Got it — pickup set to Osu. Where are you headed?' });
    setStep('dest');
  };

  const confirm = async (tier: 'economy' | 'comfort') => {
    push({ from: 'user', text: tier === 'economy' ? 'Economy' : 'Comfort' });
    try {
      await fetch(`${API}/voice/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: pickup,
          dropoffAddress: 'Kotoka Airport',
          rideType: tier,
          spoken: tier,
        }),
      });
    } catch {
      /* ok */
    }
    push({
      from: 'bot',
      text: '✅ Booked! Kwesi Boateng, GR 4471-22, arriving soon.',
    });
    setStep('done');
  };

  const sendText = async () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    push({ from: 'user', text: t });

    if (step === 'pickup') {
      setPickup(t);
      push({ from: 'bot', text: `Got it — pickup set to ${t}. Where are you headed?` });
      setStep('dest');
      return;
    }
    if (step === 'dest') {
      await quote(pickup, t);
      return;
    }
    if (step === 'quote') {
      const lower = t.toLowerCase();
      if (lower.includes('comfort') || lower === '2') await confirm('comfort');
      else await confirm('economy');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>M</Text>
        </View>
        <View>
          <Text style={styles.title}>Movr Bot</Text>
          <Text style={styles.botLabel}>bot</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View
            style={[styles.bubble, item.from === 'user' ? styles.userBubble : styles.botBubble]}
          >
            <Text style={styles.msgText}>{item.text}</Text>
            {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
          </View>
        )}
      />

      {step === 'pickup' ? (
        <Pressable style={styles.locBtn} onPress={() => shareLocation()}>
          <Text style={styles.locText}>📍 Share location</Text>
        </Pressable>
      ) : null}

      {step === 'quote' ? (
        <View style={styles.quoteRow}>
          <Pressable style={styles.tierBtn} onPress={() => confirm('economy')}>
            <Text style={styles.tierText}>Economy</Text>
          </Pressable>
          <Pressable style={styles.tierBtn} onPress={() => confirm('comfort')}>
            <Text style={styles.tierText}>Comfort</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendText().catch(() => undefined)}
        />
        <Pressable style={styles.send} onPress={() => sendText().catch(() => undefined)}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.electricViolet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.pureWhite, fontWeight: '700', fontSize: 18 },
  title: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  botLabel: { color: colors.success, fontSize: 12, marginTop: 2 },
  list: { padding: spacing[4], paddingBottom: spacing[6] },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.motionBlue },
  botBubble: { alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated },
  msgText: { color: colors.pureWhite, fontSize: 15, lineHeight: 21 },
  hint: { color: colors.success, fontSize: 12, marginTop: 6 },
  locBtn: {
    marginHorizontal: spacing[4],
    marginBottom: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  locText: { color: colors.pureWhite, fontWeight: '600' },
  quoteRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing[4], marginBottom: 8 },
  tierBtn: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.motionBlue,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tierText: { color: colors.pureWhite, fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    color: colors.pureWhite,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  send: {
    backgroundColor: colors.motionBlue,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendText: { color: colors.pureWhite, fontWeight: '700' },
});
