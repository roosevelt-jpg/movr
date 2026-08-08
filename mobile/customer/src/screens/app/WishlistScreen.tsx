import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image, useWindowDimensions } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import api from '../../services/api';
import { mediaUrl } from '../../lib/media';

/** Customer wishlist list with sale pricing. */
export default function WishlistScreen({
  onBack,
  onOpenProduct,
}: {
  onBack?: () => void;
  onOpenProduct?: (storeId: string, productId: string, name?: string, price?: number) => void;
}) {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/cart/wishlist')
      .then((r) => setItems(r.data?.data || []))
      .catch((e) => setError(e?.message || 'Could not load wishlist'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    await api.delete(`/cart/wishlist/${id}`);
    setItems((prev) => prev.filter((p) => String(p.id || p.productId) !== String(id)));
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backTxt}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Wishlist</Text>
      {loading ? <Text style={styles.muted}>Loading…</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id || i.productId)}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>No saved products</Text> : null}
        renderItem={({ item }) => {
          const id = item.id || item.productId;
          const img = item.images?.[0]?.url || item.image_url;
          const price = Number(item.price || 0);
          const compare = item.compareAtPrice != null ? Number(item.compareAtPrice) : null;
          return (
            <View
              style={[styles.card, width < 360 && { flexDirection: 'column', alignItems: 'stretch' }]}
            >
              <Pressable
                style={{ flexDirection: 'row', flex: 1, gap: 12, minWidth: 0 }}
                onPress={() =>
                  onOpenProduct?.(String(item.store_id), String(id), item.name, price)
                }
              >
                <View style={styles.thumb}>
                  {img ? (
                    <Image source={{ uri: mediaUrl(img) }} style={styles.img} />
                  ) : (
                    <Text style={{ fontSize: 22 }}>🛍️</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.store} numberOfLines={1}>
                    {item.storeName || item.store_name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Text style={styles.price}>
                      {formatCurrency(price, item.currency || 'NGN')}
                    </Text>
                    {compare != null && compare > price ? (
                      <Text style={styles.strike}>
                        {formatCurrency(compare, item.currency || 'NGN')}
                      </Text>
                    ) : null}
                    {item.onSale ? <Text style={styles.sale}>Sale</Text> : null}
                  </View>
                </View>
              </Pressable>
              <Pressable onPress={() => remove(String(id))} style={{ paddingVertical: 4 }}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 8 },
  back: { marginBottom: 8 },
  backTxt: { color: '#c4b5fd', fontWeight: '700' },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 16 },
  muted: { color: '#666', textAlign: 'center', marginTop: 24 },
  err: { color: '#F87171', marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#1f1f1f',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%' },
  name: { color: '#fff', fontWeight: '700' },
  store: { color: '#888', fontSize: 12, marginTop: 2 },
  price: { color: '#fff', fontWeight: '800' },
  strike: { color: '#666', textDecorationLine: 'line-through', fontSize: 11 },
  sale: { color: '#FB923C', fontSize: 10, fontWeight: '800' },
  remove: { color: '#F87171', fontWeight: '600', fontSize: 12 },
});
