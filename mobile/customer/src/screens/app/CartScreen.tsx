import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';
import { cartApi } from '../../services/api';

type CartItem = {
  id: string;
  name: string;
  variant?: string;
  price: number;
  qty: number;
  imageUrl?: string | null;
};

/** Cart + checkout — qty controls, delivery/pickup, totals (POST /cart/checkout). */
export default function CartScreen({
  storeId,
  onCheckedOut,
}: {
  storeId?: string;
  onCheckedOut?: (orderId: string) => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

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
              variant: r.variant_label || r.variant_name || r.variant || '',
              price: Number(r.unit_price || r.unitPrice || r.price || 0),
              qty: Number(r.quantity || r.qty || 1),
              imageUrl: r.image_url || null,
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

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);
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
      });
      const json = res.data;
      if (json.status === 'error') setMessage(json.message || 'Checkout failed');
      else {
        const orderId = json.data?.order?.id || json.data?.id;
        setMessage(`Order placed`);
        setItems([]);
        if (orderId) onCheckedOut?.(String(orderId));
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
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
          ) : (
            <View style={styles.thumb} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.name}</Text>
            {!!item.variant && <Text style={styles.itemVar}>{item.variant}</Text>}
            <View style={styles.qty}>
              <Pressable onPress={() => setQty(item.id, -1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qtyVal}>{item.qty}</Text>
              <Pressable onPress={() => setQty(item.id, 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
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

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLine}>Subtotal</Text>
          <Text style={styles.totalLine}>{formatCurrency(subtotal, 'GHS')}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLine}>Delivery fee</Text>
          <Text style={styles.totalLine}>{formatCurrency(fee, 'GHS')}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalBold}>Total</Text>
          <Text style={styles.totalBold}>{formatCurrency(total, 'GHS')}</Text>
        </View>
      </View>

      {message ? <Text style={styles.msg}>{message}</Text> : null}

      <Pressable style={styles.cta} onPress={checkout} disabled={!items.length}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>Checkout · {formatCurrency(total, 'GHS')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
    empty: { color: colors.textSecondary, marginBottom: spacing[4] },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      marginBottom: spacing[3],
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[3],
    },
    thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
    itemName: { color: colors.pureWhite, fontWeight: '700' },
    itemVar: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    qty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 10,
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    qtyBtnText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
    qtyVal: { color: colors.pureWhite, minWidth: 14, textAlign: 'center', fontWeight: '600' },
    itemPrice: { color: colors.pureWhite, fontWeight: '700' },
    fulfillRow: {
      flexDirection: 'row',
      marginVertical: spacing[4],
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      padding: 4,
    },
    fulfillBtn: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingVertical: spacing[3],
      alignItems: 'center',
    },
    fulfillOn: { borderColor: colors.motionBlue },
    fulfillText: { color: colors.textSecondary, fontWeight: '600' },
    fulfillTextOn: { color: colors.pureWhite },
    totals: {
      gap: 10,
      marginBottom: spacing[4],
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[4],
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
    totalLine: { color: colors.textSecondary },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
    totalBold: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
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
}
