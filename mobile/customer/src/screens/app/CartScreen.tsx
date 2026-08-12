import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import { cartApi } from '../../services/api';
import { mediaUrl } from '../../lib/media';

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

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  emoji?: string;
  imageUrl?: string | null;
  listPrice?: number | null;
  compareAtPrice?: number | null;
  onSale?: boolean;
};

/** Your Cart — qty, coupon, rewards discount, Place Order (mockup). */
export default function CartScreen({
  storeId,
  onCheckedOut,
  onBack,
}: {
  storeId?: string;
  onCheckedOut?: (orderId: string) => void;
  onBack?: () => void;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storeName, setStoreName] = useState('');
  const [eta, setEta] = useState('');
  const [coupon, setCoupon] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [rewardsDiscount, setRewardsDiscount] = useState(0);
  const [currency, setCurrency] = useState('NGN');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCart, setLoadingCart] = useState(true);
  const [promise, setPromise] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/trust/promise`)
      .then((r) => r.json())
      .then((j) => setPromise(j?.data || null))
      .catch(() => undefined);
  }, []);

  const refreshQuote = async (nextItems?: CartItem[], code?: string) => {
    const list = nextItems || items;
    try {
      const res = await fetch(`${API}/cart/quote`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ storeId, couponCode: code ?? coupon }),
      });
      const j = await res.json();
      const d = j?.data;
      if (d) {
        setDeliveryFee(Number(d.deliveryFee ?? 0));
        setDiscount(Number(d.discount ?? 0));
        setRewardsDiscount(Number(d.dvtDiscount ?? d.rewardsDiscount ?? 0));
        setCurrency(d.currency || 'NGN');
        if (d.storeName) setStoreName(d.storeName);
        if (d.eta) setEta(d.eta);
        if (Array.isArray(d.items) && d.items.length) {
          setItems(
            d.items.map((r: any) => ({
              id: String(r.id || r.product_id),
              name: r.name || r.product_name || 'Item',
              price: Number(r.unit_price || r.unitPrice || r.price || 0),
              qty: Number(r.quantity || r.qty || 1),
              emoji: r.emoji || '🍽️',
              imageUrl: r.image_url || r.images?.[0]?.url || null,
              listPrice: r.listPrice != null ? Number(r.listPrice) : null,
              compareAtPrice: r.compareAtPrice != null ? Number(r.compareAtPrice) : null,
              onSale: Boolean(r.salePrice != null || r.onSale),
            }))
          );
        }
        return;
      }
    } catch (e: any) {
      setDeliveryFee(0);
      setDiscount(0);
      setDvtDiscount(0);
      setMessage(e?.message || 'Could not refresh cart');
    }
  };

  useEffect(() => {
    if (!storeId) {
      setItems([]);
      setMessage('Cart not found');
      setLoadingCart(false);
      return;
    }
    cartApi
      .get(storeId)
      .then((res) => {
        const j = res.data;
        const rows = j?.data?.items || [];
        if (Array.isArray(rows) && rows.length) {
          const mapped = rows.map((r: any) => ({
            id: String(r.id || r.product_id),
            name: r.name || r.product_name || 'Item',
            price: Number(r.unit_price || r.unitPrice || r.price || 0),
            qty: Number(r.quantity || r.qty || 1),
            emoji: r.emoji || '🍽️',
            imageUrl: r.image_url || r.images?.[0]?.url || null,
            listPrice: r.listPrice != null ? Number(r.listPrice) : null,
            compareAtPrice: r.compareAtPrice != null ? Number(r.compareAtPrice) : null,
            onSale: Boolean(r.salePrice != null || r.onSale),
          }));
          setItems(mapped);
          refreshQuote(mapped);
        } else setItems([]);
      })
      .catch((e) => {
        setItems([]);
        setMessage(e?.message || 'Could not load cart');
      })
      .finally(() => setLoadingCart(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const setQty = async (id: string, delta: number) => {
    const row = items.find((i) => i.id === id);
    if (!row) return;
    const next = Math.max(0, row.qty + delta);
    const nextItems = items
      .map((i) => (i.id === id ? { ...i, qty: next } : i))
      .filter((i) => i.qty > 0);
    setItems(nextItems);
    try {
      if (next === 0) await cartApi.removeItem(id);
      else await cartApi.updateItem(id, next);
    } catch {
      /* optimistic */
    }
    refreshQuote(nextItems);
  };

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);
  const total = Math.max(0, subtotal + deliveryFee - discount - rewardsDiscount);

  const applyCoupon = () => refreshQuote(items, coupon);

  const checkout = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await cartApi.checkout({
        storeId,
        fulfillmentType: 'delivery',
        couponCode: coupon || undefined,
      });
      const json = res.data;
      if (json.status === 'error') setMessage(json.message || 'Checkout failed');
      else {
        const orderId = json.data?.order?.id || json.data?.id;
        setItems([]);
        if (orderId) onCheckedOut?.(String(orderId));
      }
    } catch (e: any) {
      setMessage(e.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable onPress={onBack} style={{ marginBottom: 8 }}>
        <Text style={styles.back}>←</Text>
      </Pressable>
      <Text style={styles.title}>Your Cart</Text>
      {loadingCart ? <Text style={styles.msg}>Loading cart…</Text> : null}
      <Text style={styles.merchant}>
        {storeName || 'Store'}{eta ? `  ·  ${eta}` : ''}
      </Text>

      {items.map((i) => (
        <View key={i.id} style={styles.card}>
          <View style={styles.thumb}>
            {i.imageUrl ? (
              <Image source={{ uri: mediaUrl(i.imageUrl) }} style={styles.thumbImg} />
            ) : (
              <Text style={{ fontSize: 28 }}>{i.emoji || '🍽️'}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={2}>
              {i.name}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatCurrency(i.price, currency)}</Text>
              {i.compareAtPrice != null && i.compareAtPrice > i.price ? (
                <Text style={styles.strike}>{formatCurrency(i.compareAtPrice, currency)}</Text>
              ) : i.listPrice != null && i.listPrice > i.price ? (
                <Text style={styles.strike}>{formatCurrency(i.listPrice, currency)}</Text>
              ) : null}
              {i.onSale ? <Text style={styles.sale}>Sale</Text> : null}
            </View>
          </View>
          <View style={styles.qty}>
            <Pressable style={styles.qtyMinus} onPress={() => setQty(i.id, -1)}>
              <Text style={styles.qtyGlyph}>−</Text>
            </Pressable>
            <Text style={styles.qtyNum}>{i.qty}</Text>
            <Pressable style={styles.qtyPlus} onPress={() => setQty(i.id, 1)}>
              <Text style={styles.qtyGlyph}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {!items.length ? <Text style={styles.msg}>Your cart is empty.</Text> : null}

      <View style={styles.coupon}>
        <Text style={styles.couponIcon}>🎟</Text>
        <TextInput
          style={styles.couponInput}
          placeholder="Add coupon code"
          placeholderTextColor="#71717A"
          value={coupon}
          onChangeText={setCoupon}
        />
        <Pressable onPress={applyCoupon}>
          <Text style={styles.apply}>Apply</Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Subtotal</Text>
          <Text style={styles.sumVal}>{formatCurrency(subtotal, currency)}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Delivery fee</Text>
          <Text style={styles.sumVal}>{formatCurrency(deliveryFee, currency)}</Text>
        </View>
        {rewardsDiscount > 0 ? (
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Rewards discount</Text>
            <Text style={[styles.sumVal, styles.green]}>
              -{formatCurrency(rewardsDiscount, currency)}
            </Text>
          </View>
        ) : null}
        {discount > 0 ? (
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Coupon</Text>
            <Text style={[styles.sumVal, styles.green]}>
              -{formatCurrency(discount, currency)}
            </Text>
          </View>
        ) : null}
        <View style={[styles.sumRow, { marginTop: 8 }]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>{formatCurrency(total, currency)}</Text>
        </View>
      </View>

      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {promise?.buyerProtectionNote ? (
        <Text style={{ color: '#6ee7b7', fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
          {promise.buyerProtectionNote}
        </Text>
      ) : null}

      <Pressable style={styles.cta} onPress={checkout} disabled={loading || items.length === 0}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>
          {loading ? 'Placing…' : `Place Order • ${formatCurrency(total, currency)}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  back: { color: '#fff', fontSize: 22 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  merchant: { color: '#A1A1AA', marginTop: 8, marginBottom: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  name: { color: '#fff', fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  price: { color: '#A1A1AA' },
  strike: { color: '#71717A', textDecorationLine: 'line-through', fontSize: 11 },
  sale: { color: '#FB923C', fontWeight: '800', fontSize: 10 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyMinus: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPlus: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyGlyph: { color: '#fff', fontWeight: '800', fontSize: 16 },
  qtyNum: { color: '#fff', fontWeight: '700', minWidth: 16, textAlign: 'center' },
  coupon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3F3F46',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 18,
  },
  couponIcon: { marginRight: 8 },
  couponInput: { flex: 1, color: '#fff' },
  apply: { color: '#A855F7', fontWeight: '700' },
  summary: { marginBottom: 20 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sumLabel: { color: '#A1A1AA' },
  sumVal: { color: '#fff', fontWeight: '600' },
  green: { color: '#22C55E' },
  totalLabel: { color: '#fff', fontWeight: '800', fontSize: 16 },
  totalVal: { color: '#fff', fontWeight: '800', fontSize: 16 },
  msg: { color: '#A1A1AA', textAlign: 'center', marginBottom: 8 },
  cta: {
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B82F6' },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A855F7',
    opacity: 0.8,
    left: '40%',
  },
  ctaText: { color: '#fff', fontWeight: '800', zIndex: 1 },
});
