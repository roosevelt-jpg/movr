import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import { cartApi } from '../../services/api';

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
  const [items, setItems] = useState<CartItem[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(15);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    cartApi
      .get(storeId)
      .then((res) => {
        const j = res.data;
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
        } else {
          setItems([]);
        }
        if (j?.data?.delivery_fee != null) setDeliveryFee(Number(j.data.delivery_fee));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [storeId]);

  const setQty = async (id: string, delta: number) => {
    const row = items.find((i) => i.id === id);
    if (!row) return;
    const next = Math.max(0, row.qty + delta);
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: next } : i))
        .filter((i) => i.qty > 0)
    );
    try {
      if (next === 0) await cartApi.removeItem(id);
      else await cartApi.updateItem(id, next);
    } catch {
      /* optimistic UI */
    }
  };

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.qty, 0),
    [items]
  );
  const fee = fulfillment === 'delivery' ? deliveryFee : 0;
  const total = subtotal + fee;

  const checkout = async () => {
    setMessage('');
    if (!storeId) {
      setMessage('Missing store');
      return;
    }
    try {
      const res = await cartApi.checkout({
        storeId,
        fulfillmentType: fulfillment,
        couponCode: coupon || undefined,
      });
      const json = res.data;
      if (json.status === 'error') setMessage(json.message || 'Checkout failed');
      else {
        setMessage(`Order placed · ${json.data?.order?.id || json.data?.id || 'ok'}`);
        setItems([]);
      }
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e.message || 'Checkout failed');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Your cart</Text>
      {loading ? <Text style={styles.empty}>Loading…</Text> : null}
      {!loading && items.length === 0 ? (
        <Text style={styles.empty}>Cart is empty</Text>
      ) : null}

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
        style={styles.coupon}
        placeholder="Coupon code"
        placeholderTextColor={colors.textSecondary}
        value={coupon}
        onChangeText={setCoupon}
        autoCapitalize="characters"
      />

      <View style={styles.totals}>
        <Text style={styles.totalLine}>Subtotal · {formatCurrency(subtotal, 'GHS')}</Text>
        <Text style={styles.totalLine}>Delivery · {formatCurrency(fee, 'GHS')}</Text>
        <Text style={styles.totalBold}>Total · {formatCurrency(total, 'GHS')}</Text>
      </View>

      {message ? <Text style={styles.msg}>{message}</Text> : null}

      <Pressable style={styles.cta} onPress={checkout} disabled={!items.length}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>Checkout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  empty: { color: colors.textSecondary, marginBottom: spacing[4] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface },
  itemName: { color: colors.pureWhite, fontWeight: '700' },
  itemVar: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.border,
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
  },
  fulfillOn: { borderColor: colors.motionBlue, backgroundColor: colors.surfaceElevated },
  fulfillText: { color: colors.textSecondary, fontWeight: '600' },
  fulfillTextOn: { color: colors.pureWhite },
  coupon: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.pureWhite,
    marginBottom: spacing[4],
  },
  totals: { gap: 6, marginBottom: spacing[4] },
  totalLine: { color: colors.textSecondary },
  totalBold: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, marginTop: 4 },
  msg: { color: colors.success, marginBottom: spacing[3] },
  cta: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, zIndex: 1 },
});
