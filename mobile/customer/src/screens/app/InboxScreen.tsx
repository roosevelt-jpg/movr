import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatRelativeTime } from '@movr/design-system/format';

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

/** Inbox — mockup: title + Mark all read, category tabs, unread blue rail cards. */
export default function InboxScreen({
  onOpenWhatsApp,
  onOpenBot,
  onOpenSupport,
}: {
  onOpenWhatsApp?: () => void;
  onOpenBot?: () => void;
  onOpenSupport?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const iconMeta: Record<string, { bg: string; glyph: string }> = {
    ride_update: { bg: 'rgba(0,85,255,0.25)', glyph: '🚗' },
    order_update: { bg: 'rgba(255,184,0,0.25)', glyph: '📦' },
    rewards: { bg: 'rgba(63,112,72,0.35)', glyph: '🎁' },
    security: { bg: 'rgba(255,59,92,0.25)', glyph: '🛡' },
    promo: { bg: 'rgba(106,0,255,0.25)', glyph: '✨' },
    system: { bg: colors.surfaceElevated, glyph: 'ℹ' },
  };

  const [category, setCategory] = useState<string | undefined>();
  const [messages, setMessages] = useState<any[]>([]);

  const load = () => {
    const q = category ? `?category=${category}` : '';
    fetch(`${API}/inbox${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        setMessages(j.data?.messages || j.data || []);
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
        <Text style={styles.title}>Inbox</Text>
        <Pressable onPress={markAllRead}>
          <Text style={styles.markRead}>Mark all read</Text>
        </Pressable>
      </View>

      <View style={styles.tabsWrap}>
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
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[8] }}
        renderItem={({ item }) => {
          const meta = iconMeta[item.category] || iconMeta.system;
          const unread = !item.read && !item.is_read;
          return (
            <Pressable onPress={() => markOne(item.id)} style={[styles.card, unread && styles.cardUnread]}>
              {unread ? <View style={styles.unreadRail} /> : null}
              <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                <Text>{meta.glyph}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.msgTitle}>{item.title}</Text>
                <Text style={styles.msgBody} numberOfLines={2}>
                  {item.body || item.description}
                </Text>
                <Text style={styles.msgWhen}>{formatRelativeTime(item.created_at)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, padding: spacing[4] }}>No messages</Text>
        }
        ListFooterComponent={
          onOpenWhatsApp || onOpenBot || onOpenSupport ? (
            <View style={{ marginTop: spacing[4], gap: spacing[2] }}>
              {onOpenWhatsApp ? (
                <Pressable onPress={onOpenWhatsApp}>
                  <Text style={styles.channelLink}>WhatsApp booking →</Text>
                </Pressable>
              ) : null}
              {onOpenBot ? (
                <Pressable onPress={onOpenBot}>
                  <Text style={styles.channelLink}>Movr AI →</Text>
                </Pressable>
              ) : null}
              {onOpenSupport ? (
                <Pressable onPress={onOpenSupport}>
                  <Text style={styles.channelLink}>Support →</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null
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
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
    markRead: { color: colors.textSecondary, fontWeight: '500', fontSize: 14 },
    tabsWrap: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: spacing[3],
    },
    tabs: { paddingHorizontal: spacing[4], paddingTop: spacing[2], gap: spacing[4] },
    tab: { marginRight: spacing[4], paddingBottom: spacing[2] },
    tabText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
    tabActive: { color: colors.pureWhite },
    underline: { height: 3, backgroundColor: colors.motionBlue, marginTop: 6, borderRadius: 2 },
    card: {
      flexDirection: 'row',
      gap: spacing[3],
      padding: spacing[4],
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing[3],
      overflow: 'hidden',
      position: 'relative',
    },
    cardUnread: {},
    unreadRail: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: colors.motionBlue,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },
    msgTitle: { color: colors.pureWhite, fontWeight: '700', fontSize: 15 },
    msgBody: { color: colors.textSecondary, marginTop: 4, fontSize: 13, lineHeight: 18 },
    msgWhen: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
    channelLink: { color: colors.motionBlue, fontWeight: '600', marginBottom: spacing[2] },
  });
}
