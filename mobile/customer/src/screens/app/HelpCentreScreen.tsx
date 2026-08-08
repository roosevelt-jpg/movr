import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Linking,
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

const TOPIC_ICON: Record<string, string> = {
  car: '🚗',
  ride: '🚗',
  card: '💳',
  pay: '💳',
  package: '📦',
  order: '📦',
  chain: '⛓',
  dvt: '⛓',
};

/** Help Center — search, topics, tickets, contact (mockup). */
export default function HelpCentreScreen({
  onOpenCategory,
  onOpenSupport,
  onOpenAi,
  onBack,
}: {
  onOpenCategory?: (slug: string) => void;
  onOpenAi?: () => void;
  onOpenSupport?: () => void;
  onBack?: () => void;
}) {
  const [q, setQ] = useState('');
  const [topics, setTopics] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = q.trim()
      ? `${API}/public/help/categories?q=${encodeURIComponent(q.trim())}`
      : `${API}/public/help/categories`;
    const t = setTimeout(() => {
      fetch(url)
        .then((r) => r.json())
        .then((body) => {
          const rows = body?.data || [];
          if (Array.isArray(rows)) {
            setTopics(
              rows.map((c: any) => ({
                slug: c.slug,
                title: c.title,
                icon_key: c.icon_key || c.slug,
              }))
            );
          }
        })
        .catch((e) => {
          setTopics([]);
          setMsg(e?.message || 'Could not load help topics');
        })
        .finally(() => setLoading(false));
    }, q.trim() ? 200 : 0);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    fetch(`${API}/me/support/tickets`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data?.tickets)) {
          setTickets(j.data.tickets);
        }
      })
      .catch(() => setTickets([]));
  }, []);

  const raiseTicket = async () => {
    setMsg('');
    try {
      const res = await fetch(`${API}/me/support/tickets`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ subject: 'New support request' }),
      });
      const j = await res.json();
      setMsg(j?.data?.ticketRef ? `Ticket ${j.data.ticketRef} created` : 'Ticket created');
      const list = await fetch(`${API}/me/support/tickets`, { headers: authHeaders() }).then((r) =>
        r.json()
      );
      if (Array.isArray(list?.data?.tickets)) setTickets(list.data.tickets);
    } catch {
      setMsg('Could not create ticket');
    }
  };

  const grid = topics.slice(0, 4);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>
      <Text style={styles.title}>Help Center</Text>
      <Text style={styles.sub}>How can we help you today?</Text>

      {onOpenAi ? (
        <Pressable
          onPress={onOpenAi}
          style={{
            marginHorizontal: spacing[4],
            marginTop: 12,
            backgroundColor: '#1a1228',
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: '#4c1d95',
          }}
        >
          <Text style={{ color: '#e9d5ff', fontWeight: '800' }}>✦ Ask Movr AI</Text>
          <Text style={{ color: '#a78bfa', marginTop: 4, fontSize: 12 }}>
            Rides, rates, stores — or escalate to a human
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.search}
          placeholder="Search help articles..."
          placeholderTextColor="#71717A"
          value={q}
          onChangeText={setQ}
        />
      </View>

      <Text style={styles.section}>POPULAR TOPICS</Text>
      {loading ? <Text style={styles.empty}>Loading help topics…</Text> : null}
      {!loading && !grid.length ? <Text style={styles.empty}>No help topics available.</Text> : null}
      <View style={styles.grid}>
        {grid.map((t) => (
          <Pressable
            key={t.slug}
            style={styles.topic}
            onPress={() => onOpenCategory?.(t.slug)}
          >
            <Text style={styles.topicIcon}>{TOPIC_ICON[t.icon_key] || TOPIC_ICON[t.slug] || '•'}</Text>
            <Text style={styles.topicTitle}>{t.title}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>YOUR TICKETS</Text>
      {!tickets.length ? <Text style={styles.empty}>No support tickets.</Text> : null}
      {tickets.map((t) => (
        <View key={t.id || t.ticketRef} style={styles.ticket}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketTitle}>{t.subject}</Text>
            <Text style={styles.ticketMeta}>
              Ticket #{t.ticketRef} · {t.openedLabel}
            </Text>
          </View>
          <View style={styles.status}>
            <Text style={styles.statusTxt}>{t.status}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.section}>CONTACT US</Text>
      <Pressable style={styles.contact} onPress={onOpenSupport}>
        <Text style={styles.contactIcon}>💬</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactTitle}>Live Chat</Text>
          <Text style={styles.contactSub}>Usually replies in 5 min</Text>
        </View>
        <View style={styles.online} />
      </Pressable>
      <Pressable
        style={styles.contact}
        onPress={() => Linking.openURL('mailto:support@movr.app').catch(() => undefined)}
      >
        <Text style={styles.contactIcon}>✉️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactTitle}>Email Support</Text>
          <Text style={styles.contactSub}>support@movr.app</Text>
        </View>
      </Pressable>
      <Pressable style={styles.contact} onPress={raiseTicket}>
        <Text style={styles.contactIcon}>✏️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactTitle}>Raise a Ticket</Text>
          <Text style={styles.contactSub}>For complex issues</Text>
        </View>
      </Pressable>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  header: { paddingTop: spacing[3], marginBottom: 8 },
  back: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  sub: { color: '#A1A1AA', marginTop: 6, marginBottom: spacing[4] },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: spacing[5],
  },
  searchIcon: { marginRight: 8 },
  search: { flex: 1, color: '#FFF', paddingVertical: 14, fontSize: 15 },
  section: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing[5] },
  topic: {
    width: '47%',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 16,
    minHeight: 88,
  },
  topicIcon: { fontSize: 22, marginBottom: 8 },
  topicTitle: { color: '#FFF', fontWeight: '700' },
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    marginBottom: spacing[5],
    gap: 10,
  },
  ticketTitle: { color: '#FFF', fontWeight: '700' },
  ticketMeta: { color: '#71717A', fontSize: 12, marginTop: 4 },
  status: {
    borderWidth: 1,
    borderColor: '#F97316',
    backgroundColor: '#431407',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusTxt: { color: '#FB923C', fontWeight: '700', fontSize: 11 },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  contactIcon: { fontSize: 22 },
  contactTitle: { color: '#FFF', fontWeight: '700' },
  contactSub: { color: '#71717A', fontSize: 12, marginTop: 2 },
  online: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  msg: { color: '#A78BFA', textAlign: 'center', marginTop: 12 },
  empty: { color: '#71717A', marginBottom: spacing[4] },
});
