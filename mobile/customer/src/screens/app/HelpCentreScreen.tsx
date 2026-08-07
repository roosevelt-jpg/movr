import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Category = {
  slug: string;
  title: string;
  description: string;
  icon_key: string;
};

const ICON: Record<string, string> = {
  car: '🚗',
  package: '📦',
  card: '💳',
};

/** Mobile Help centre — live help_categories + Movr AI entry. */
export default function HelpCentreScreen({
  onOpenCategory,
  onOpenAi,
  onOpenSupport,
  onBack,
}: {
  onOpenCategory?: (slug: string) => void;
  onOpenAi?: () => void;
  onOpenSupport?: () => void;
  onBack?: () => void;
}) {
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = q.trim()
      ? `${API}/public/help/categories?q=${encodeURIComponent(q.trim())}`
      : `${API}/public/help/categories`;
    const t = setTimeout(() => {
      fetch(url)
        .then((r) => r.json())
        .then((body) => setCategories(body?.data || []))
        .catch(() => setCategories([]))
        .finally(() => setLoading(false));
    }, q.trim() ? 200 : 0);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>Movr</Text>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>Close</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        style={styles.search}
        placeholder="Search help articles"
        placeholderTextColor="#71717A"
        value={q}
        onChangeText={setQ}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.heading}>How can we help?</Text>
        {onOpenAi || onOpenSupport ? (
          <View style={styles.ctaRow}>
            {onOpenAi ? (
              <Pressable style={styles.ctaPrimary} onPress={onOpenAi}>
                <Text style={styles.ctaPrimaryText}>Talk to Movr AI</Text>
              </Pressable>
            ) : null}
            {onOpenSupport ? (
              <Pressable style={styles.ctaGhost} onPress={onOpenSupport}>
                <Text style={styles.ctaGhostText}>Live support</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {categories.map((c) => (
          <Pressable
            key={c.slug}
            style={styles.card}
            onPress={() => onOpenCategory?.(c.slug)}
          >
            <Text style={styles.cardIcon}>{ICON[c.icon_key] || '•'}</Text>
            <Text style={styles.cardTitle}>{c.title}</Text>
            <Text style={styles.cardBody}>{c.description}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  back: { color: '#A1A1AA', fontWeight: '600' },
  search: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#333',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: spacing[6],
  },
  body: { paddingBottom: 40 },
  heading: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  ctaRow: { gap: 10, marginBottom: spacing[5] },
  ctaPrimary: {
    backgroundColor: '#0055FF',
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  ctaGhost: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaGhostText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  meta: { color: '#A1A1AA', textAlign: 'center', marginBottom: 12 },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: spacing[5],
    marginBottom: spacing[3],
  },
  cardIcon: { fontSize: 20, marginBottom: 10 },
  cardTitle: { color: '#FFFFFF', fontWeight: '700', fontSize: 17 },
  cardBody: { color: '#A1A1AA', marginTop: 6, lineHeight: 20 },
});
