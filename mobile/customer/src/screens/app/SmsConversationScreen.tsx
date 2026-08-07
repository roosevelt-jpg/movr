import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(
  /\/api\/v1\/?$/,
  ''
);

type Msg = { id: string; from: 'user' | 'movr'; text: string };

/**
 * SMS booking thread — live POST /webhooks/sms (JSON).
 * Mockup: RIDE Osu, Kotoka Airport → quote → YES → booked.
 */
export default function SmsConversationScreen({
  phone = '+233240000000',
}: {
  phone?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const seq = useRef(1);
  const listRef = useRef<FlatList>(null);

  const push = (from: 'user' | 'movr', text: string) => {
    setMessages((m) => [...m, { id: String(seq.current++), from, text }]);
  };

  const send = async () => {
    const body = input.trim();
    if (!body) return;
    setInput('');
    push('user', body);

    try {
      const res = await fetch(`${API_ROOT}/webhooks/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ From: phone, Body: body, format: 'json' }),
      });
      const json = await res.json();
      let reply = json?.message || '';
      if (!reply && typeof json === 'string') {
        const m = json.match(/<Message>([\s\S]*?)<\/Message>/i);
        reply = m?.[1] || json;
      }
      push('movr', reply || 'Movr: Text RIDE pickup, destination — e.g. RIDE Osu, Kotoka Airport');
    } catch {
      push('movr', 'Movr: Network error. Try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.phoneFrame}>
        <Text style={styles.header}>MOVR · Text Message</Text>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.hint}>Text: RIDE Osu, Kotoka Airport</Text>
          }
          renderItem={({ item }) => (
            <View
              style={[styles.bubble, item.from === 'user' ? styles.user : styles.bot]}
            >
              <Text
                style={[
                  styles.text,
                  item.from === 'user' ? styles.userText : styles.botText,
                ]}
              >
                {item.text}
              </Text>
            </View>
          )}
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Text message"
            placeholderTextColor="#9CA3AF"
            onSubmitEditing={send}
            autoCapitalize="characters"
          />
          <Pressable style={styles.send} onPress={send}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111111',
    padding: spacing[4],
    justifyContent: 'center',
  },
  phoneFrame: {
    flex: 1,
    maxHeight: 640,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  list: { padding: spacing[4], paddingBottom: 24, flexGrow: 1 },
  hint: { color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
  },
  bot: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
  },
  text: { fontSize: 15, lineHeight: 20 },
  userText: { color: '#FFFFFF' },
  botText: { color: '#111827' },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  send: {
    backgroundColor: '#2563EB',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendText: { color: '#FFFFFF', fontWeight: '700' },
});
