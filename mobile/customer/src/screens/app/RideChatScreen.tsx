import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** In-ride chat — online header, bubbles, quick replies, encryption banner (mockup). */
export default function RideChatScreen({
  rideId = 'active',
  onBack,
}: {
  rideId?: string;
  onBack?: () => void;
}) {
  const [driver, setDriver] = useState<any>({ name: 'Driver', online: true });
  const [messages, setMessages] = useState<any[]>([]);
  const [quick, setQuick] = useState([
    { label: '👍 OK', body: '👍 OK' },
    { label: 'I am ready', body: 'I am ready' },
    { label: 'Wait 2 mins', body: 'Wait 2 mins' },
  ]);
  const [banner, setBanner] = useState(
    'These messages are secure. Messages are encrypted and will be deleted after the ride ends.'
  );
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const load = () => {
    fetch(`${API}/rides/${rideId}/chat`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setDriver(j.data.driver || { name: 'Driver', online: true });
          setMessages(j.data.messages || []);
          if (j.data.quickReplies?.length) setQuick(j.data.quickReplies);
          if (j.data.privacyBanner) setBanner(j.data.privacyBanner);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [rideId]);

  const send = async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setText('');
    const optimistic = {
      id: `local-${Date.now()}`,
      body: trimmed,
      mine: true,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch(`${API}/rides/${rideId}/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ body: trimmed }),
      });
      const json = await res.json();
      if (json?.data?.message) {
        setMessages((m) =>
          m.map((x) => (x.id === optimistic.id ? { ...json.data.message, mine: true } : x))
        );
      }
    } catch {
      /* keep optimistic */
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : null}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(driver.name || 'D')[0]}</Text>
        </View>
        <Text style={styles.online}>
          {driver.online !== false ? '• Online - Driver' : '• Offline - Driver'}
        </Text>
        <Pressable onPress={() => Linking.openURL('tel:').catch(() => undefined)}>
          <Text style={styles.call}>📞</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[4] }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.datePill}>
          <Text style={styles.dateText}>Today · 9:08 AM</Text>
        </View>

        {messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bubbleRow, m.mine ? styles.rowMine : styles.rowTheirs]}
          >
            {!m.mine ? (
              <View style={styles.miniAvatar}>
                <Text style={{ fontSize: 10 }}>D</Text>
              </View>
            ) : null}
            <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={styles.bubbleText}>{m.body}</Text>
              <Text style={styles.time}>
                {fmtTime(m.createdAt)}
                {m.mine && m.status === 'read' ? ' ✓✓' : m.mine ? ' ✓' : ''}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
        {quick.map((q) => (
          <Pressable key={q.label} style={styles.quick} onPress={() => send(q.body)}>
            <Text style={styles.quickText}>{q.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.banner}>
        <Text style={styles.lock}>🔐</Text>
        <Text style={styles.bannerText}>{banner}</Text>
      </View>

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#71717A"
          style={styles.input}
          onSubmitEditing={() => send(text)}
        />
        <Pressable style={styles.send} onPress={() => send(text)}>
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#111',
    gap: 10,
    backgroundColor: '#FFF',
  },
  back: { fontSize: 20, color: '#111' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800' },
  online: { flex: 1, color: '#16A34A', fontWeight: '700', fontSize: 14 },
  call: { fontSize: 20 },
  chat: { flex: 1, backgroundColor: '#FAFAFA' },
  datePill: {
    alignSelf: 'center',
    backgroundColor: '#3F3F46',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: spacing[3],
  },
  dateText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  bubbleRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', gap: 6 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D4D4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleTheirs: { backgroundColor: '#111' },
  bubbleMine: { backgroundColor: '#7C3AED' },
  bubbleText: { color: '#FFF', fontSize: 15 },
  time: { color: '#A1A1AA', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  quickRow: { maxHeight: 44, paddingHorizontal: spacing[3], marginBottom: 8 },
  quick: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  quickText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  banner: {
    marginHorizontal: spacing[3],
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  lock: { fontSize: 16 },
  bannerText: { flex: 1, color: '#5B21B6', fontSize: 11, lineHeight: 16 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[4],
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#FFF', fontSize: 20, fontWeight: '800' },
});
