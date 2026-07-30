import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const CATEGORIES = ['Food', 'Groceries', 'Electronics', 'Fashion', 'Pharmacy'];

export default function ShopHomeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Shop</Text>
      <Text style={styles.sub}>Sell faster nearby — browse stores by category.</Text>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(i) => i}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2], paddingVertical: spacing[3] }}
        renderItem={({ item }) => (
          <Pressable style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
          </Pressable>
        )}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stores near you</Text>
        <Text style={styles.meta}>Geo-sorted via GET /stores?lat=&lng=</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 24, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: spacing[2] },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.textPrimary, fontWeight: '600' },
  card: {
    marginTop: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '600', fontSize: 16 },
  meta: { color: colors.textSecondary, marginTop: spacing[2], fontSize: 13 },
});
