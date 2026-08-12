import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatRelativeTime } from '@movr/design-system/format';

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

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'rides', label: 'Rides' },
  { key: 'orders', label: 'Orders' },
  { key: 'rewards', label: 'Rewards' },
] as const;

const ICONS: Record<string, { bg: string; glyph: string }> = {
  order: { bg: '#14532D', glyph: '🍔' },
  orders: { bg: '#14532D', glyph: '🍔' },
  ride: { bg: '#27272A', glyph: '🚗' },
  rides: { bg: '#27272A', glyph: '🚗' },
  promo: { bg: '#27272A', glyph: '🏷' },
  rating: { bg: '#27272A', glyph: '⭐' },
  rewards: { bg: '#14532D', glyph: '✦' },
  points: { bg: '#14532D', glyph: '✦' },
  system: { bg: '#27272A', glyph: '•' },
};

/** Notifications — filters, unread purple rail, mark all read (mockup). */
export default function InboxScreen({
  onOpenWallet,
}: {
  onOpenWhatsApp?: () => void;
  onOpenBot?: () => void;
  onOpenSupport?: () => void;
  onOpenWallet?: () => void;
}) {
  const [category, setCategory] = useState('all');
  const [messages, setMessages] = useState<any[]>([]);

  const load = () => {
    const q = category && category !== 'all' ? `?category=${category}` : '';
    fetch(`${API}/notifications${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setMessages(j.data || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, [category]);

  const markAllRead = async () => {
    await fetch(`${API}/notifications/mark-all-read`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).catch(() => undefined);
    load();
  };

  const markOne = async (id: string, item: any) => {
    await fetch(`${API}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).catch(() => undefined);
    if (item.category === 'tokens' || item.category === 'rewards' || item.icon === 'dvt') {
      onOpenWallet?.();
    }
    load();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Pressable onPress={markAllRead}>
          <Text style={styles.mark}>Mark all read</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, category === t.key && styles.tabOn]}
            onPress={() => setCategory(t.key)}
          >
            <Text style={[styles.tabTxt, category === t.key && styles.tabTxtOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={messages}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const icon = ICONS[item.icon] || ICONS[item.category] || ICONS.system;
          const unread = Boolean(item.unread);
          return (
            <Pressable
              style={[styles.card, unread && styles.cardUnread]}
              onPress={() => markOne(item.id, item)}
            >
              {unread ? <View style={styles.rail} /> : null}
              <View style={[styles.icon, { backgroundColor: icon.bg }]}>
                <Text>{icon.glyph}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemBody} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.when}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No notifications</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  mark: { color: '#A855F7', fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3F3F46',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabOn: { backgroundColor: '#A855F7', borderColor: '#A855F7' },
  tabTxt: { color: '#A1A1AA', fontWeight: '600' },
  tabTxtOn: { color: '#fff' },
  card: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardUnread: { backgroundColor: 'rgba(168,85,247,0.12)' },
  rail: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#A855F7',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { color: '#fff', fontWeight: '700' },
  itemBody: { color: '#A1A1AA', marginTop: 4, fontSize: 13 },
  when: { color: '#71717A', fontSize: 12, marginTop: 6 },
  empty: { color: '#71717A', textAlign: 'center', marginTop: 40 },
});
