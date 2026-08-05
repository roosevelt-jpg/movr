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
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Msg = { id: string; from: 'user' | 'movr'; text: string };

/**
 * SMS booking thread — RIDE pickup, dest → quote → YES → booked.
 * Posts to SMS webhook when available.
 */
export default function SmsConversationScreen() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      from: 'movr',
      text: 'Welcome to Movr SMS. Text: RIDE pickup, destination',
    },
  ]);
  const [input, setInput] = useState('');
  const [pendingQuote, setPendingQuote] = useState(false);
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
      await fetch(`${API.replace('/api/v1', '')}/webhooks/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: '+233240000000', Body: body }),
      });
    } catch {
      /* demo replies */
    }

    const ride = body.match(/^RIDE\s+(.+?),\s*(.+)$/i);
    if (ride) {
      setPendingQuote(true);
      push(
        'movr',
        `Movr: Economy GH₵45, ETA 4 min. Reply YES to confirm.`
      );
      return;
    }
    if (pendingQuote && body.toUpperCase() === 'YES') {
      setPendingQuote(false);
      push(
        'movr',
        'Movr: Booked! Kwesi Boateng, GR 4471-22, arriving in 4 min. Fare GH₵45.'
      );
      return;
    }
    push('movr', 'Movr: Text RIDE pickup, destination — e.g. RIDE Osu, Kotoka Airport');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.header}>MOVR · Text Message</Text>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.from === 'user' ? styles.user : styles.bot,
            ]}
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
          placeholderTextColor={colors.textSecondary}
          onSubmitEditing={send}
        />
        <Pressable style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack },
  header: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  list: { padding: spacing[4], paddingBottom: 24 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: colors.motionBlue,
    borderBottomRightRadius: 4,
  },
  bot: {
    alignSelf: 'flex-start',
    backgroundColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  text: { fontSize: 15, lineHeight: 20 },
  userText: { color: colors.pureWhite },
  botText: { color: colors.pureWhite },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    color: colors.pureWhite,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  send: {
    backgroundColor: colors.motionBlue,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendText: { color: colors.pureWhite, fontWeight: '700' },
});
