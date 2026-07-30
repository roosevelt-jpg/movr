import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const CATEGORIES = ['system', 'promo', 'order_update', 'ride_update', 'rewards', 'security'];

export default function InboxScreen() {
  const [category, setCategory] = useState<string | undefined>();
  const [messages, setMessages] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const load = () => {
    const q = category ? `?category=${category}` : '';
    fetch(`${API}/inbox${q}`)
      .then((r) => r.json())
      .then((j) => {
        setMessages(j.data?.messages || []);
        setUnread(j.data?.unread || 0);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, [category]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Inbox {unread ? `(${unread})` : ''}</Text>
      <FlatList
        horizontal
        data={[undefined, ...CATEGORIES]}
        keyExtractor={(i) => String(i || 'all')}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2], paddingVertical: spacing[3] }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setCategory(item)}
            style={[styles.chip, category === item && styles.chipActive]}
          >
            <Text style={styles.chipText}>{item || 'all'}</Text>
          </Pressable>
        )}
      />
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.read && styles.unread]}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>{item.body}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  chipActive: { borderColor: colors.electricViolet },
  chipText: { color: colors.pureWhite, fontSize: 12, textTransform: 'capitalize' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  unread: { borderColor: colors.motionBlue },
  cardTitle: { color: colors.pureWhite, fontWeight: '600' },
  meta: { color: colors.textSecondary, marginTop: spacing[2] },
});
