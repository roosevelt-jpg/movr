import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
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
  { key: 'order_update', label: 'Order' },
  { key: 'ride_update', label: 'Ride' },
  { key: 'rewards', label: 'Rewards' },
  { key: 'security', label: 'Security' },
] as const;

const ICON_META: Record<string, { bg: string; glyph: string }> = {
  ride_update: { bg: colors.motionBlue, glyph: '🚗' },
  order_update: { bg: colors.warning, glyph: '📦' },
  rewards: { bg: colors.movrGreen, glyph: '🎁' },
  security: { bg: colors.error, glyph: '🛡' },
  promo: { bg: colors.electricViolet, glyph: '✨' },
  system: { bg: colors.surfaceElevated, glyph: 'ℹ' },
};

/** Inbox — category tabs, unread rail, typed icon chips (Phase 19). */
export default function InboxScreen({
  onOpenWhatsApp,
  onOpenBot,
  onOpenSupport,
}: {
  onOpenWhatsApp?: () => void;
  onOpenBot?: () => void;
  onOpenSupport?: () => void;
}) {
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

  const markAllRead = async () => {
    await fetch(`${API}/inbox/mark-all-read`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).catch(() => undefined);
    load();
  };

  const markOne = async (id: string) => {
    await fetch(`${API}/inbox/${id}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).catch(() => undefined);
    load();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox{unread ? ` · ${unread}` : ''}</Text>
        <Pressable onPress={markAllRead}>
          <Text style={styles.markRead}>Mark all read</Text>
        </Pressable>
      </View>

      {onOpenWhatsApp ? (
        <Pressable onPress={onOpenWhatsApp} style={styles.waRow}>
          <View style={styles.waAvatar}>
            <Text style={{ color: colors.pureWhite, fontWeight: '700' }}>M</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.waTitle}>Movr</Text>
            <Text style={styles.waSub}>Book by voice note · WhatsApp</Text>
          </View>
          <Text style={styles.online}>online</Text>
        </Pressable>
      ) : null}

      {onOpenBot ? (
        <Pressable onPress={onOpenBot} style={styles.waRow}>
          <View style={[styles.waAvatar, { backgroundColor: colors.electricViolet }]}>
            <Text style={{ color: colors.pureWhite, fontWeight: '700' }}>M</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.waTitle}>Movr Bot</Text>
            <Text style={styles.waSub}>Book by chat · Telegram</Text>
          </View>
          <Text style={[styles.online, { color: colors.success }]}>bot</Text>
        </Pressable>
      ) : null}

      {onOpenSupport ? (
        <Pressable onPress={onOpenSupport} style={styles.waRow}>
          <View style={[styles.waAvatar, { backgroundColor: colors.movrGreen }]}>
            <Text style={{ color: colors.pureWhite, fontWeight: '700' }}>?</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.waTitle}>Movr Support</Text>
            <Text style={styles.waSub}>Typically replies in 2 min</Text>
          </View>
        </Pressable>
      ) : null}

      <FlatList
        horizontal
        data={TABS as any[]}
        keyExtractor={(i) => String(i.key || 'all')}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        renderItem={({ item }) => {
          const active = category === item.key;
          return (
            <Pressable onPress={() => setCategory(item.key)} style={styles.tab}>
              <Text style={[styles.tabText, active && styles.tabActive]}>{item.label}</Text>
              {active ? <View style={styles.underline} /> : null}
            </Pressable>
          );
        }}
      />

      <FlatList
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        renderItem={({ item }) => {
          const meta = ICON_META[item.category] || ICON_META.system;
          return (
            <Pressable onPress={() => markOne(item.id)} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                <Text>{meta.glyph}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.msgTitle}>
                  {!item.read ? '● ' : ''}
                  {item.title}
                </Text>
                <Text style={styles.msgBody} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.msgWhen}>{formatLocalTime(item.created_at)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, padding: spacing[4] }}>No messages</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  markRead: { color: colors.motionBlue, fontWeight: '600' },
  waRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  waAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.movrGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waTitle: { color: colors.pureWhite, fontWeight: '700' },
  waSub: { color: colors.textSecondary, fontSize: 12 },
  online: { color: colors.success, fontSize: 12, fontWeight: '600' },
  tabs: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[4] },
  tab: { marginRight: spacing[4] },
  tabText: { color: colors.textSecondary, fontWeight: '600' },
  tabActive: { color: colors.pureWhite },
  underline: { height: 2, backgroundColor: colors.electricViolet, marginTop: 4, borderRadius: 1 },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgTitle: { color: colors.pureWhite, fontWeight: '600' },
  msgBody: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
  msgWhen: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
});
