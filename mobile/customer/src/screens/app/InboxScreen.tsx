import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

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

/** Inbox — category tabs, unread rail, typed icon chips. */
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

  const markAllRead = async () => {
    await fetch(`${API}/inbox/mark-all-read`, { method: 'PATCH' }).catch(() => undefined);
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
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: spacing[6] }}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet</Text>
        }
        renderItem={({ item }) => {
          const meta = ICON_META[item.category] || ICON_META.system;
          return (
            <View style={[styles.card, !item.read && styles.unread]}>
              {!item.read ? <View style={styles.unreadRail} /> : null}
              <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                <Text>{meta.glyph}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.time}>
                  {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  markRead: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  waRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[3],
    marginTop: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  waAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.electricViolet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waTitle: { color: colors.pureWhite, fontWeight: '700', fontSize: 15 },
  waSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  online: { color: colors.success, fontSize: 12, fontWeight: '600' },
  tabs: { gap: spacing[5], paddingVertical: spacing[4] },
  tab: { paddingBottom: spacing[2] },
  tabText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  tabActive: { color: colors.pureWhite },
  underline: { marginTop: 6, height: 3, borderRadius: 2, backgroundColor: colors.motionBlue },
  empty: { color: colors.textSecondary, marginTop: spacing[6], textAlign: 'center' },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  unread: { borderColor: 'rgba(0,85,255,0.35)' },
  unreadRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.motionBlue,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  body: { flex: 1 },
  cardTitle: { color: colors.pureWhite, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textSecondary, marginTop: 4, fontSize: 13, lineHeight: 18 },
  time: { color: colors.textSecondary, marginTop: 8, fontSize: 12 },
});
