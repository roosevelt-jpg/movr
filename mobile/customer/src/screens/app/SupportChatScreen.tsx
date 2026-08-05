import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Msg = { id: string; from: 'user' | 'support'; text: string };

/** In-app Movr Support chat — refunds / ride issues. */
export default function SupportChatScreen({ onBack }: { onBack?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);
  const seq = useRef(1);

  const send = async () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    setMessages((m) => [...m, { id: String(seq.current++), from: 'user', text: t }]);

    try {
      await fetch(`${API}/inbox/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t }),
      });
    } catch {
      /* network */
    }

    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: String(seq.current++),
          from: 'support',
          text: 'Thanks — a specialist is reviewing this. We typically reply in 2 min.',
        },
      ]);
    }, 600);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={{ marginRight: 8 }}>
            <Text style={{ color: '#888', fontSize: 18 }}>←</Text>
          </Pressable>
        ) : null}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>?</Text>
        </View>
        <View>
          <Text style={styles.title}>Movr Support</Text>
          <Text style={styles.eta}>Typically replies in 2 min</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Send a message to start a conversation with support.</Text>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.from === 'user' ? styles.userBubble : styles.supportBubble,
            ]}
          >
            <Text style={styles.msg}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#666"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
        />
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
    borderBottomColor: '#2A2A2A',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A6B45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  title: { color: '#fff', fontWeight: '600', fontSize: 16 },
  eta: { color: '#7CFC9A', fontSize: 12, marginTop: 2 },
  list: { padding: spacing[4], paddingBottom: spacing[6], flexGrow: 1 },
  empty: { color: '#A0A0A0', textAlign: 'center', marginTop: 32, fontSize: 14 },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6A00FF',
  },
  supportBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A1A1A',
  },
  msg: { color: '#fff', fontSize: 15, lineHeight: 21 },
  composer: { padding: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: radius.pill,
    color: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
});
