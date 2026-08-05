import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type CartItem = {
  id: string;
  name: string;
  variant?: string;
  price: number;
  qty: number;
};

/** Cart + checkout — qty controls, delivery/pickup, totals (POST /cart/checkout). */
export default function CartScreen({ storeId }: { storeId?: string }) {
  const [coupon, setCoupon] = useState('');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('delivery');
  const [items, setItems] = useState<CartItem[]>([
    { id: '1', name: 'Cotton shirt', variant: 'Size M, Blue', price: 120, qty: 1 },
    { id: '2', name: 'Canvas sneakers', variant: 'Size 42', price: 210, qty: 1 },
  ]);
  const [deliveryFee, setDeliveryFee] = useState(15);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${API}/cart`)
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data?.items || j?.data?.lines || [];
        if (Array.isArray(rows) && rows.length) {
          setItems(
            rows.map((r: any) => ({
              id: String(r.id || r.product_id),
              name: r.name || r.product_name || 'Item',
              variant: r.variant_label || r.variant || '',
              price: Number(r.unit_price || r.price || 0),
              qty: Number(r.quantity || r.qty || 1),
            }))
          );
        }
        if (j?.data?.delivery_fee != null) setDeliveryFee(Number(j.data.delivery_fee));
      })
      .catch(() => undefined);
  }, [storeId]);

  const setQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.qty, 0),
    [items]
  );
  const fee = fulfillment === 'delivery' ? deliveryFee : 0;
  const total = subtotal + fee;

  const checkout = async () => {
    setMessage('');
    try {
      const res = await fetch(`${API}/cart/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfillment,
          coupon: coupon || undefined,
          storeId,
        }),
      });
      const json = await res.json();
      if (json.status === 'error') setMessage(json.message || 'Checkout failed');
      else setMessage(`Order placed · ${json.data?.id || 'ok'}`);
    } catch (e: any) {
      setMessage(e.message || 'Checkout failed');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Your cart</Text>

      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <View style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.name}</Text>
            {!!item.variant && <Text style={styles.itemVar}>{item.variant}</Text>}
          </View>
          <View style={styles.qty}>
            <Pressable style={styles.qtyBtn} onPress={() => setQty(item.id, -1)}>
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qtyVal}>{item.qty}</Text>
            <Pressable style={styles.qtyBtn} onPress={() => setQty(item.id, 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.itemPrice}>{formatCurrency(item.price * item.qty, 'GHS')}</Text>
        </View>
      ))}

      <View style={styles.fulfillRow}>
        {(['delivery', 'pickup'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFulfillment(f)}
            style={[styles.fulfillBtn, fulfillment === f && styles.fulfillOn]}
          >
            <Text style={[styles.fulfillText, fulfillment === f && styles.fulfillTextOn]}>
              {f === 'delivery' ? 'Delivery' : 'Pickup'}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={coupon}
        onChangeText={setCoupon}
        placeholder="Coupon code"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />

      <View style={styles.summary}>
        <View style={styles.sumRow}>
          <Text style={styles.muted}>Subtotal</Text>
          <Text style={styles.muted}>{formatCurrency(subtotal, 'GHS')}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.muted}>Delivery fee</Text>
          <Text style={styles.muted}>{formatCurrency(fee, 'GHS')}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.sumRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, 'GHS')}</Text>
        </View>
      </View>

      <Pressable style={styles.cta} onPress={checkout}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>Checkout · {formatCurrency(total, 'GHS')}</Text>
      </Pressable>
      {!!message && <Text style={styles.msg}>{message}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: '#0A0A0A' },
  itemName: { color: colors.pureWhite, fontWeight: '700' },
  itemVar: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: colors.pureWhite, fontWeight: '700' },
  qtyVal: { color: colors.pureWhite, minWidth: 16, textAlign: 'center' },
  itemPrice: { color: colors.pureWhite, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  fulfillRow: { flexDirection: 'row', gap: spacing[3], marginVertical: spacing[3] },
  fulfillBtn: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing[3],
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  fulfillOn: { borderColor: colors.motionBlue },
  fulfillText: { color: colors.textSecondary, fontWeight: '700' },
  fulfillTextOn: { color: colors.pureWhite },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.pureWhite,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
  },
  summary: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  muted: { color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[3] },
  totalLabel: { color: colors.pureWhite, fontWeight: '700' },
  totalValue: { color: colors.pureWhite, fontWeight: '700', fontSize: 18 },
  cta: {
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
    overflow: 'hidden',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.4,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
  msg: { color: colors.movrGreen, marginTop: spacing[3], textAlign: 'center' },
});
