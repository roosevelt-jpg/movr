import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  Linking,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import { addressesApi, cartApi, walletApi } from '../../services/api';
import { mediaUrl } from '../../lib/media';

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

type Addr = {
  id: string;
  label?: string;
  address?: string;
  lat?: number;
  lng?: number;
  is_default?: boolean;
};

const PAY_METHODS = [
  { id: 'card', label: 'Card', hint: 'Visa / Mastercard' },
  { id: 'mobile_money', label: 'Mobile money', hint: 'MoMo / bank USSD' },
  { id: 'wallet', label: 'Movr Wallet', hint: 'Pay from balance' },
  { id: 'cod', label: 'Cash on delivery', hint: 'Pay the courier' },
  { id: 'bnpl', label: 'Pay later', hint: 'Installments after delivery' },
] as const;

/** Cart + noon-style checkout: address, delivery/pickup, payment, tip. */
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
  const [tip, setTip] = useState(0);
  const [currency, setCurrency] = useState('NGN');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCart, setLoadingCart] = useState(true);
  const [promise, setPromise] = useState<any>(null);
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [addresses, setAddresses] = useState<Addr[]>([]);
  const [addressId, setAddressId] = useState<string>('');
  const [newAddress, setNewAddress] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  useEffect(() => {
    fetch(`${API}/trust/promise`)
      .then((r) => r.json())
      .then((j) => setPromise(j?.data || null))
      .catch(() => undefined);
    addressesApi
      .list()
      .then((res) => {
        const rows = (res.data?.data || []) as Addr[];
        setAddresses(rows);
        const def = rows.find((a) => a.is_default) || rows[0];
        if (def?.id) setAddressId(def.id);
      })
      .catch(() => undefined);
    walletApi
      .balance()
      .then((res) => {
        const b = res.data?.data?.balance ?? res.data?.data?.balance_fiat;
        if (b != null) setWalletBalance(Number(b));
      })
      .catch(() => undefined);
  }, []);

  const refreshQuote = async (nextItems?: CartItem[], code?: string, fulfill?: 'delivery' | 'pickup') => {
    const list = nextItems || items;
    const mode = fulfill || fulfillment;
    try {
      const res = await cartApi.quote({
        storeId,
        couponCode: code ?? coupon,
        fulfillmentType: mode,
        tipAmount: tip,
      });
      const d = res.data?.data;
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
      }
    } catch (e: any) {
      setDeliveryFee(mode === 'pickup' ? 0 : deliveryFee);
      setDiscount(0);
      setRewardsDiscount(0);
      setMessage(e?.response?.data?.message || e?.message || 'Could not refresh cart');
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
        const rows = res.data?.data?.items || [];
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

  useEffect(() => {
    if (items.length) refreshQuote(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment, tip]);

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
  const total = Math.max(0, subtotal + deliveryFee + tip - discount - rewardsDiscount);

  const saveAddress = async () => {
    if (!newAddress.trim()) return;
    try {
      const res = await addressesApi.create({
        label: addresses.length ? `Home ${addresses.length + 1}` : 'Home',
        address: newAddress.trim(),
        isDefault: !addresses.length,
      });
      const row = res.data?.data;
      const list = await addressesApi.list();
      setAddresses(list.data?.data || []);
      if (row?.id) setAddressId(row.id);
      setNewAddress('');
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Could not save address');
    }
  };

  const checkout = async () => {
    setLoading(true);
    setMessage('');
    try {
      const selected = addresses.find((a) => a.id === addressId);
      const res = await cartApi.checkout({
        storeId,
        fulfillmentType: fulfillment,
        couponCode: coupon || undefined,
        paymentMethod,
        tipAmount: tip || 0,
        addressId: fulfillment === 'delivery' ? addressId || undefined : undefined,
        deliveryAddress:
          fulfillment === 'delivery'
            ? selected?.address || selected?.label || newAddress.trim() || undefined
            : undefined,
        deliveryLat: selected?.lat,
        deliveryLng: selected?.lng,
      });
      const json = res.data;
      if (json.status === 'error') {
        setMessage(json.message || 'Checkout failed');
        return;
      }
      const orderId = json.data?.order?.id || json.data?.id;
      const payLink = json.data?.payment?.paymentLink;
      if (payLink) {
        Linking.openURL(payLink).catch(() => undefined);
      }
      setItems([]);
      if (orderId) onCheckedOut?.(String(orderId));
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable onPress={onBack} style={{ marginBottom: 8 }}>
        <Text style={styles.back}>←</Text>
      </Pressable>
      <Text style={styles.title}>Checkout</Text>
      {loadingCart ? <Text style={styles.msg}>Loading cart…</Text> : null}
      <Text style={styles.merchant}>
        {storeName || 'Store'}
        {eta ? `  ·  ${eta}` : ''}
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
            <Text style={styles.price}>{formatCurrency(i.price, currency)}</Text>
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

      <Text style={styles.section}>Fulfillment</Text>
      <View style={styles.row}>
        {(['delivery', 'pickup'] as const).map((m) => (
          <Pressable
            key={m}
            style={[styles.chip, fulfillment === m && styles.chipOn]}
            onPress={() => setFulfillment(m)}
          >
            <Text style={[styles.chipText, fulfillment === m && styles.chipTextOn]}>
              {m === 'delivery' ? 'Delivery' : 'Pickup'}
            </Text>
          </Pressable>
        ))}
      </View>

      {fulfillment === 'delivery' ? (
        <>
          <Text style={styles.section}>Delivery address</Text>
          {addresses.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.addr, addressId === a.id && styles.addrOn]}
              onPress={() => setAddressId(a.id)}
            >
              <Text style={styles.addrLabel}>
                {a.label || 'Address'}
                {a.is_default ? ' · Default' : ''}
              </Text>
              <Text style={styles.addrBody}>{a.address}</Text>
            </Pressable>
          ))}
          <View style={styles.coupon}>
            <TextInput
              style={styles.couponInput}
              placeholder="Add a new address"
              placeholderTextColor="#71717A"
              value={newAddress}
              onChangeText={setNewAddress}
            />
            <Pressable onPress={saveAddress}>
              <Text style={styles.apply}>Save</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.hint}>Pick up at the store — no delivery fee.</Text>
      )}

      <Text style={styles.section}>Payment</Text>
      {PAY_METHODS.map((p) => (
        <Pressable
          key={p.id}
          style={[styles.addr, paymentMethod === p.id && styles.addrOn]}
          onPress={() => setPaymentMethod(p.id)}
        >
          <Text style={styles.addrLabel}>{p.label}</Text>
          <Text style={styles.addrBody}>
            {p.hint}
            {p.id === 'wallet' && walletBalance != null
              ? ` · Balance ${formatCurrency(walletBalance, currency)}`
              : ''}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Courier tip</Text>
      <View style={styles.row}>
        {[0, 50, 100, 200].map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, tip === t && styles.chipOn]}
            onPress={() => setTip(t)}
          >
            <Text style={[styles.chipText, tip === t && styles.chipTextOn]}>
              {t === 0 ? 'No tip' : formatCurrency(t, currency)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.coupon}>
        <Text style={styles.couponIcon}>🎟</Text>
        <TextInput
          style={styles.couponInput}
          placeholder="Add coupon code"
          placeholderTextColor="#71717A"
          value={coupon}
          onChangeText={setCoupon}
        />
        <Pressable onPress={() => refreshQuote(items, coupon)}>
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
        {tip > 0 ? (
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Tip</Text>
            <Text style={styles.sumVal}>{formatCurrency(tip, currency)}</Text>
          </View>
        ) : null}
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
        <Text style={styles.ctaText}>
          {loading ? 'Placing…' : `Place Order · ${formatCurrency(total, currency)}`}
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
  section: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  hint: { color: '#71717A', fontSize: 13, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  chipOn: { backgroundColor: '#A855F7', borderColor: '#A855F7' },
  chipText: { color: '#A1A1AA', fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  addr: {
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  addrOn: { borderColor: '#A855F7' },
  addrLabel: { color: '#fff', fontWeight: '700' },
  addrBody: { color: '#A1A1AA', marginTop: 4, fontSize: 13 },
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
  price: { color: '#A1A1AA', marginTop: 4 },
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
  qtyGlyph: { color: '#fff', fontWeight: '800' },
  qtyNum: { color: '#fff', fontWeight: '700', minWidth: 16, textAlign: 'center' },
  coupon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  couponIcon: { fontSize: 16, marginRight: 8 },
  couponInput: { flex: 1, color: '#fff', paddingVertical: 12 },
  apply: { color: '#A855F7', fontWeight: '800', padding: 8 },
  summary: { marginTop: 8, marginBottom: 8 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: '#A1A1AA' },
  sumVal: { color: '#fff' },
  green: { color: '#6ee7b7' },
  totalLabel: { color: '#fff', fontWeight: '800', fontSize: 16 },
  totalVal: { color: '#fff', fontWeight: '800', fontSize: 16 },
  msg: { color: '#F87171', marginVertical: 8 },
  cta: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
