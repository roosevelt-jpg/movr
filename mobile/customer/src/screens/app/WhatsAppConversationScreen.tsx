import React, { useEffect, useRef, useState } from 'react';
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
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

type Msg =
  | { id: string; from: 'user' | 'bot'; kind: 'text'; text: string }
  | { id: string; from: 'user'; kind: 'voice'; duration: string }
  | { id: string; from: 'bot'; kind: 'heard'; route: string }
  | { id: string; from: 'bot'; kind: 'options'; options: any[]; currency: string }
  | { id: string; from: 'bot'; kind: 'prompt'; text: string };

/**
 * WhatsApp-style channel booking chat — voice parse/confirm APIs.
 */
export default function WhatsAppConversationScreen({ onBack }: { onBack?: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [awaitingPick, setAwaitingPick] = useState(false);
  const listRef = useRef<FlatList>(null);
  const seq = useRef(1);
  const booted = useRef(false);

  const push = (m: Omit<Msg, 'id'>) => {
    const id = String(seq.current++);
    setMessages((prev) => [...prev, { ...m, id } as Msg]);
  };

  const parse = async (text: string) => {
    const res = await fetch(`${API}/voice/parse-intent`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        text,
        currentLat: 5.6037,
        currentLng: -0.187,
        countryCode: 'GH',
      }),
    });
    const json = await res.json().catch(() => ({}));
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
    await parse("I'm going from Osu to the airport");
  };

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    // Auto-play mockup conversation start
    sendVoice().catch(() => undefined);
  }, []);

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

    let confirmation =
      '✅ Booked! Kwesi is on the way in a Toyota Corolla, GR 4471-22.';
    try {
      if (result?.pickup && result?.destination) {
        const res = await fetch(`${API}/voice/confirm`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            pickupLat: result.pickup.lat,
            pickupLng: result.pickup.lng,
            dropoffLat: result.destination.lat,
            dropoffLng: result.destination.lng,
            pickupAddress: result.pickup.address,
            dropoffAddress: result.destination.address,
            rideType: opt.code,
            spoken: String(index + 1),
            sourceChannel: 'whatsapp',
            countryCode: 'GH',
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (json?.data?.confirmationMessage) confirmation = json.data.confirmationMessage;
        const rideId = json?.data?.rideId || json?.data?.id;
        if (rideId) {
          try {
            (globalThis as any).__MOVR_NAVIGATE_RIDE__?.(rideId);
          } catch {
            /* optional */
          }
        }
      }
    } catch {
      /* keep mockup confirmation */
    }

    push({ from: 'bot', kind: 'text', text: confirmation });
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
              {o.name || (i === 0 ? 'Economy' : 'Comfort')} ·{' '}
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
      {onBack ? (
        <Pressable onPress={onBack} style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ color: '#a78bfa', fontWeight: '700' }}>← Back</Text>
        </Pressable>
      ) : null}
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
          placeholderTextColor="#6b7c6b"
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

function makeStyles(_colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0b1410' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      backgroundColor: '#1f2c24',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#8E2DE2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
    title: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
    online: { color: '#25D366', fontSize: 12, marginTop: 2 },
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
      backgroundColor: '#005c4b',
      borderTopRightRadius: 4,
    },
    botBubble: {
      alignSelf: 'flex-start',
      backgroundColor: '#1f2c24',
      borderTopLeftRadius: 4,
    },
    userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 20 },
    botText: { color: '#e9edef', fontSize: 15, lineHeight: 22 },
    bold: { fontWeight: '700' },
    hint: { color: '#8696a0', fontSize: 12, marginTop: 4 },
    voiceBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
    mic: { fontSize: 16 },
    wave: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 },
    waveBar: { width: '40%', height: 3, backgroundColor: '#FFFFFF', borderRadius: 2 },
    duration: { color: '#FFFFFF', fontSize: 12 },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      backgroundColor: '#1f2c24',
    },
    voiceBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#00a884',
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      backgroundColor: '#2a3942',
      borderRadius: radius.pill,
      color: '#FFFFFF',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    sendBtn: {
      backgroundColor: '#00a884',
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    sendText: { color: '#FFFFFF', fontWeight: '700' },
  });
}
