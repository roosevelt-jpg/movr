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
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Msg =
  | { id: string; from: 'user' | 'bot'; kind: 'text'; text: string }
  | { id: string; from: 'user'; kind: 'voice'; duration: string }
  | { id: string; from: 'bot'; kind: 'heard'; route: string }
  | { id: string; from: 'bot'; kind: 'options'; options: any[]; currency: string }
  | { id: string; from: 'bot'; kind: 'prompt'; text: string };

/**
 * WhatsApp-style channel booking chat — uses voice parse/confirm APIs.
 * Mockup conversation: voice note → options → reply 1/2 → booked.
 */
export default function WhatsAppConversationScreen() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      from: 'bot',
      kind: 'text',
      text: 'Send a voice note or type where you want to go.',
    },
  ]);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [awaitingPick, setAwaitingPick] = useState(false);
  const listRef = useRef<FlatList>(null);
  const seq = useRef(1);

  const push = (m: Omit<Msg, 'id'>) => {
    const id = String(seq.current++);
    setMessages((prev) => [...prev, { ...m, id } as Msg]);
  };

  const parse = async (text: string) => {
    const res = await fetch(`${API}/voice/parse-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        currentLat: 5.6037,
        currentLng: -0.187,
        countryCode: 'GH',
      }),
    });
    const json = await res.json();
    const data = json.data;
    setResult(data);

    const from = data?.pickup?.address || 'Osu';
    const to = data?.destination?.address || 'Kotoka Airport';
    push({ from: 'bot', kind: 'heard', route: `${from} → ${to}` });

    const options = data?.options?.length
      ? data.options
      : [
          { code: 'economy', name: 'Economy', price: 45, etaMinutes: 4 },
          { code: 'comfort', name: 'Comfort', price: 62, etaMinutes: 3 },
        ];

    push({
      from: 'bot',
      kind: 'options',
      options: options.slice(0, 2),
      currency: data?.currency || 'GHS',
    });
    push({
      from: 'bot',
      kind: 'prompt',
      text: 'Reply 1 for Economy or 2 for Comfort',
    });
    setAwaitingPick(true);
  };

  const sendVoice = async () => {
    push({ from: 'user', kind: 'voice', duration: '0:07' });
    const sample = "I'm going from Osu to the airport";
    await parse(sample);
  };

  const confirm = async (index: number) => {
    const options =
      result?.options?.length >= 2
        ? result.options
        : [
            { code: 'economy', name: 'Economy', price: 45 },
            { code: 'comfort', name: 'Comfort', price: 62 },
          ];
    const opt = options[index] || options[0];
    setAwaitingPick(false);

    try {
      if (result?.pickup && result?.destination) {
        await fetch(`${API}/voice/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickupLat: result.pickup.lat,
            pickupLng: result.pickup.lng,
            dropoffLat: result.destination.lat,
            dropoffLng: result.destination.lng,
            pickupAddress: result.pickup.address,
            dropoffAddress: result.destination.address,
            rideType: opt.code,
            spoken: String(index + 1),
          }),
        });
      }
    } catch {
      /* keep UI confirmation even if API offline */
    }

    push({
      from: 'bot',
      kind: 'text',
      text: `✅ Booked! Kwesi is on the way in a Toyota Corolla, GR 4471-22.`,
    });
  };

  const sendText = async () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    push({ from: 'user', kind: 'text', text: t });

    if (awaitingPick && (t === '1' || t === '2')) {
      await confirm(Number(t) - 1);
      return;
    }
    await parse(t);
  };

  const renderMsg = ({ item }: { item: Msg }) => {
    const isUser = item.from === 'user';
    if (item.kind === 'voice') {
      return (
        <View style={[styles.bubble, styles.userBubble, styles.voiceBubble]}>
          <Text style={styles.mic}>🎤</Text>
          <View style={styles.wave}>
            <View style={styles.waveBar} />
          </View>
          <Text style={styles.duration}>{item.duration}</Text>
        </View>
      );
    }
    if (item.kind === 'heard') {
      return (
        <View style={[styles.bubble, styles.botBubble]}>
          <Text style={styles.botText}>
            I heard: <Text style={styles.bold}>{item.route}</Text>
          </Text>
          <Text style={styles.hint}>Transcribed from your voice note</Text>
        </View>
      );
    }
    if (item.kind === 'options') {
      return (
        <View style={[styles.bubble, styles.botBubble]}>
          {item.options.map((o: any, i: number) => (
            <Text key={o.code || i} style={styles.botText}>
              <Text style={styles.bold}>{o.name || (i === 0 ? 'Economy' : 'Comfort')}</Text>
              {': '}
              {formatCurrency(o.price, item.currency)} · {o.etaMinutes ?? (i === 0 ? 4 : 3)} min
              away
            </Text>
          ))}
        </View>
      );
    }
    if (item.kind === 'prompt') {
      return (
        <View style={[styles.bubble, styles.botBubble]}>
          <Text style={styles.botText}>{item.text}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
        <Text style={isUser ? styles.userText : styles.botText}>{item.text}</Text>
      </View>
    );
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
          <Text style={styles.title}>Movr</Text>
          <Text style={styles.online}>online</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={renderMsg}
      />

      <View style={styles.composer}>
        <Pressable style={styles.voiceBtn} onPress={() => sendVoice().catch(() => undefined)}>
          <Text style={{ fontSize: 18 }}>🎤</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendText().catch(() => undefined)}
        />
        <Pressable style={styles.sendBtn} onPress={() => sendText().catch(() => undefined)}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surfaceElevated,
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
  online: { color: colors.success, fontSize: 12, marginTop: 2 },
  list: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[6] },
  bubble: {
    maxWidth: '82%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.movrGreen,
    borderTopRightRadius: 4,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 4,
  },
  userText: { color: colors.pureWhite, fontSize: 15, lineHeight: 20 },
  botText: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  voiceBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
  mic: { fontSize: 16 },
  wave: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 },
  waveBar: { width: '40%', height: 3, backgroundColor: colors.pureWhite, borderRadius: 2 },
  duration: { color: colors.pureWhite, fontSize: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.surfaceElevated,
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.movrGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    color: colors.pureWhite,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtn: {
    backgroundColor: colors.movrGreen,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendText: { color: colors.pureWhite, fontWeight: '700' },
});
