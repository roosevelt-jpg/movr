import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatLocalTime } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const TABS = [
  { key: undefined, label: 'All' },
  { key: 'ride_update', label: 'Ride' },
  { key: 'rewards', label: 'Rewards' },
  { key: 'security', label: 'Security' },
  { key: 'system', label: 'System' },
] as const;

/** Driver inbox — shared pattern with customer InboxScreen (Phase 19). */
export default function InboxScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [category, setCategory] = useState<string | undefined>();
  const [messages, setMessages] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const load = () => {
    const q = category ? `?category=${category}` : '';
    fetch(`${API}/inbox${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        setMessages(j.data?.messages || j.data || []);
        setUnread(j.data?.unread || 0);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, [category]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox{unread ? ` · ${unread}` : ''}</Text>
        <Pressable
          onPress={() =>
            fetch(`${API}/inbox/mark-all-read`, {
              method: 'PATCH',
              headers: authHeaders(),
            }).then(load)
          }
        >
          <Text style={styles.markRead}>Mark all read</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={TABS as any[]}
        keyExtractor={(i) => String(i.key || 'all')}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        renderItem={({ item }) => (
          <Pressable onPress={() => setCategory(item.key)} style={styles.tab}>
            <Text
              style={[styles.tabText, category === item.key && styles.tabActive]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />
      <FlatList
        data={messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.msgTitle}>
              {!item.read ? '● ' : ''}
              {item.title}
            </Text>
            <Text style={styles.msgBody}>{item.body}</Text>
            <Text style={styles.msgWhen}>{formatLocalTime(item.created_at)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, padding: spacing[4] }}>No messages</Text>
        }
      />
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  markRead: { color: colors.motionBlue, fontWeight: '600' },
  tabs: { paddingHorizontal: spacing[4], gap: spacing[3] },
  tab: { marginRight: spacing[3], paddingBottom: spacing[2] },
  tabText: { color: colors.textSecondary, fontWeight: '600' },
  tabActive: { color: colors.pureWhite },
  row: {
    padding: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  msgTitle: { color: colors.pureWhite, fontWeight: '700' },
  msgBody: { color: colors.textSecondary, marginTop: 4 },
  msgWhen: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
});
}
