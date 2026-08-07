import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Mobile Terms of Service — live legal_documents. */
export default function TermsScreen({
  slug = 'terms',
  onBack,
}: {
  slug?: string;
  onBack?: () => void;
}) {
  const [doc, setDoc] = useState<{
    title: string;
    updated_label: string;
    sections: { section_number: number; title: string; body: string }[];
  } | null>(null);

  useEffect(() => {
    fetch(`${API}/public/legal/${slug}`)
      .then((r) => r.json())
      .then((body) => setDoc(body?.data || null))
      .catch(() => setDoc(null));
  }, [slug]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>Movr</Text>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.divider} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{doc?.title || 'Terms of Service'}</Text>
        {doc?.updated_label ? <Text style={styles.updated}>{doc.updated_label}</Text> : null}
        {(doc?.sections || []).map((s) => (
          <Text key={s.section_number} style={styles.clause}>
            <Text style={styles.clauseTitle}>
              {s.section_number}. {s.title}
            </Text>
            {' — '}
            {s.body}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  close: { color: '#A1A1AA', fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#2A2A2A' },
  body: { paddingHorizontal: spacing[4], paddingTop: spacing[6], paddingBottom: 48 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  updated: { color: '#A1A1AA', marginTop: 10, marginBottom: 28 },
  clause: { color: '#FFFFFF', lineHeight: 24, marginBottom: 20, fontSize: 15 },
  clauseTitle: { fontWeight: '700' },
});
