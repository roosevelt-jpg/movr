import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

export default function StoreProfileScreen() {
  const products = [
    { id: '1', name: 'Sample product', price: 'GHS 25' },
    { id: '2', name: 'Another item', price: 'GHS 12' },
  ];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Store</Text>
      <Text style={styles.meta}>Rating · Hours · Category</Text>
      <FlatList
        data={products}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing[3] }}
        contentContainerStyle={{ gap: spacing[3], paddingTop: spacing[4] }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.meta}>{item.price}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  meta: { color: colors.textSecondary, marginTop: spacing[1] },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[3],
    minHeight: 100,
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '600' },
});
