import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import { cartApi, storesApi } from '../../services/api';
import api from '../../services/api';

const ZINGER_ID = 'd0000000-0000-4000-8000-000000000141';
const CHICKEN_ID = 'c0000000-0000-4000-8000-000000000014';

type SizeOpt = { id: string; label: string; price_delta?: number };
type Addon = { id: string; name: string; priceDelta: number };

/** Food product detail — size, add-ons, qty, Add to Cart (mockup). */
export default function ProductDetailScreen({
  productId = ZINGER_ID,
  storeId = CHICKEN_ID,
  name: nameProp = 'Zinger Burger Meal',
  price: priceProp = 3200,
  onAdded,
  onBack,
}: {
  productId?: string;
  storeId?: string;
  name?: string;
  price?: number;
  onAdded?: () => void;
  onBack?: () => void;
}) {
  const [name, setName] = useState(nameProp);
  const [price, setPrice] = useState(priceProp);
  const [currency, setCurrency] = useState('NGN');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [emoji, setEmoji] = useState('🍔');
  const [merchant, setMerchant] = useState('Chicken Republic · Fast Food');
  const [rating, setRating] = useState(4.8);
  const [reviews, setReviews] = useState(128);
  const [available, setAvailable] = useState(true);
  const [description, setDescription] = useState(
    'Crispy chicken fillet, signature zinger sauce, lettuce and mayo in a toasted bun — served with fries and a soft drink. Freshly prepared when you order.'
  );
  const [sizes, setSizes] = useState<SizeOpt[]>([
    { id: 'regular', label: 'Regular', price_delta: 0 },
    { id: 'large', label: 'Large', price_delta: 0 },
    { id: 'family', label: 'Family', price_delta: 800 },
  ]);
  const [addons, setAddons] = useState<Addon[]>([
    { id: 'fries', name: 'Extra Fries', priceDelta: 400 },
    { id: 'sauce', name: 'Extra Sauce', priceDelta: 200 },
  ]);
  const [variants, setVariants] = useState<any[]>([]);
  const [size, setSize] = useState('Large');
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set(['fries']));
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!productId || !storeId) return;
    storesApi
      .products(storeId)
      .then((res) => {
        const rows = res.data?.data || [];
        const list = Array.isArray(rows) ? rows : rows.products || [];
        const p = list.find((x: any) => String(x.id) === String(productId)) || list[0];
        if (!p) return;
        setName(p.name || nameProp);
        setPrice(Number(p.price || p.base_price || priceProp));
        setCurrency(p.currency || p.currency_code || 'NGN');
        setImageUrl(p.image_url || null);
        setEmoji(p.emoji || '🍔');
        setMerchant(p.merchantLabel || p.merchant_label || 'Chicken Republic · Fast Food');
        setRating(Number(p.rating || 4.8));
        setReviews(Number(p.reviewCount || p.review_count || 128));
        setAvailable(p.available !== false && p.in_stock !== false);
        setDescription(
          p.longDescription ||
            p.long_description ||
            p.description ||
            description
        );
        const vs = Array.isArray(p.variants) ? p.variants : [];
        setVariants(vs);
        const attrs = p.attributes || {};
        if (Array.isArray(attrs.sizes) && attrs.sizes.length) {
          setSizes(
            attrs.sizes.map((s: any) =>
              typeof s === 'string'
                ? { id: s.toLowerCase(), label: s, price_delta: 0 }
                : {
                    id: String(s.id || s.label).toLowerCase(),
                    label: s.label || s.name,
                    price_delta: Number(s.price_delta || 0),
                  }
            )
          );
        } else if (vs.length) {
          setSizes(
            vs.map((v: any) => ({
              id: String(v.id),
              label: v.name,
              price_delta: Number(v.price_delta || 0),
            }))
          );
        }
        if (Array.isArray(p.addons) && p.addons.length) {
          setAddons(
            p.addons.map((a: any) => ({
              id: String(a.id),
              name: a.name,
              priceDelta: Number(a.priceDelta ?? a.price_delta ?? 0),
            }))
          );
          setSelectedAddons(new Set([String(p.addons[0].id)]));
        }
      })
      .catch(() => undefined);

    api
      .get(`/cart/wishlist/${productId}`)
      .then((r) => setWish(Boolean(r.data?.data?.wished)))
      .catch(() => undefined);
  }, [productId, storeId]);

  const sizeDelta = useMemo(() => {
    const s = sizes.find((x) => x.label === size || x.id === size.toLowerCase());
    if (s) return Number(s.price_delta || 0);
    const v = variants.find((x) => x.name === size);
    return Number(v?.price_delta || 0);
  }, [sizes, size, variants]);

  const addonTotal = useMemo(() => {
    let n = 0;
    for (const a of addons) {
      if (selectedAddons.has(a.id)) n += a.priceDelta;
    }
    return n;
  }, [addons, selectedAddons]);

  const lineTotal = (price + sizeDelta + addonTotal) * qty;

  const variantId = useMemo(() => {
    const match = variants.find((v) => String(v.name).toLowerCase() === size.toLowerCase());
    return match?.id || variants[0]?.id;
  }, [variants, size]);

  const toggleWish = async () => {
    if (!productId) {
      setWish((w) => !w);
      return;
    }
    try {
      if (wish) {
        await api.delete(`/cart/wishlist/${productId}`);
        setWish(false);
      } else {
        await api.post(`/cart/wishlist/${productId}`);
        setWish(true);
      }
    } catch {
      setWish((w) => !w);
    }
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addToCart = async () => {
    if (!productId || !storeId) {
      setMsg('Added to cart');
      onAdded?.();
      return;
    }
    setAdding(true);
    setMsg('');
    try {
      const realAddonIds = [...selectedAddons].filter((id) => id.includes('-'));
      await cartApi.addItem({
        storeId,
        productId,
        variantId,
        quantity: qty,
        addonIds: realAddonIds,
      } as any);
      setMsg('Added to cart');
      onAdded?.();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.message || 'Added to cart');
      onAdded?.();
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable style={styles.circleBtn} onPress={onBack}>
          <Text style={styles.circleTxt}>←</Text>
        </Pressable>
        <Pressable style={styles.circleBtn} onPress={toggleWish}>
          <Text style={{ color: wish ? '#EF4444' : '#FFF', fontSize: 18 }}>{wish ? '♥' : '♡'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.heroImg} />
          ) : (
            <Text style={styles.heroEmoji}>{emoji}</Text>
          )}
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.price}>{formatCurrency(price, currency)}</Text>
        </View>
        <Text style={styles.merchant}>{merchant}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.rating}>★ {rating.toFixed(1)} · {reviews} ratings</Text>
          <View style={styles.avail}>
            <Text style={styles.availTxt}>{available ? 'Available' : 'Unavailable'}</Text>
          </View>
        </View>
        <Text style={styles.desc}>{description}</Text>

        <Text style={styles.section}>SIZE</Text>
        <View style={styles.sizeRow}>
          {sizes.map((s) => {
            const on = size === s.label || size.toLowerCase() === s.id;
            return (
              <Pressable
                key={s.id}
                style={[styles.sizeChip, on && styles.sizeOn]}
                onPress={() => setSize(s.label)}
              >
                <Text style={[styles.sizeTxt, on && styles.sizeTxtOn]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>ADD-ONS</Text>
        {addons.map((a) => {
          const on = selectedAddons.has(a.id);
          return (
            <Pressable key={a.id} style={styles.addon} onPress={() => toggleAddon(a.id)}>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.addonName}>{a.name}</Text>
              <Text style={styles.addonPrice}>+{formatCurrency(a.priceDelta, currency)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <View style={styles.footer}>
        <View style={styles.qty}>
          <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={styles.qtyBtn}>
            <Text style={styles.qtyBtnTxt}>−</Text>
          </Pressable>
          <Text style={styles.qtyVal}>{qty}</Text>
          <Pressable onPress={() => setQty((q) => q + 1)} style={styles.qtyBtn}>
            <Text style={styles.qtyBtnTxt}>+</Text>
          </Pressable>
        </View>
        <Pressable style={styles.cta} onPress={addToCart} disabled={adding}>
          <Text style={styles.ctaText}>
            {adding ? 'Adding…' : `Add to Cart · ${formatCurrency(lineTotal, currency)}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    zIndex: 2,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTxt: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: 120 },
  hero: {
    height: 200,
    borderRadius: 20,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    marginTop: -20,
  },
  heroImg: { width: '100%', height: '100%', borderRadius: 20 },
  heroEmoji: { fontSize: 88 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800', flex: 1 },
  price: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  merchant: { color: '#A1A1AA', marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  rating: { color: '#FB923C', fontWeight: '700' },
  avail: {
    backgroundColor: '#052E16',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  availTxt: { color: '#4ADE80', fontWeight: '700', fontSize: 12 },
  desc: { color: '#A1A1AA', marginTop: spacing[3], lineHeight: 20 },
  section: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing[5],
    marginBottom: 10,
  },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeChip: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  sizeOn: { borderColor: '#8E2DE2', backgroundColor: '#1A1025' },
  sizeTxt: { color: '#A1A1AA', fontWeight: '700' },
  sizeTxtOn: { color: '#FFF' },
  addon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#8E2DE2', borderColor: '#8E2DE2' },
  checkMark: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  addonName: { color: '#FFF', fontWeight: '600', flex: 1 },
  addonPrice: { color: '#A1A1AA', fontWeight: '700' },
  msg: { color: '#4ADE80', textAlign: 'center', marginBottom: 6 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[5],
    alignItems: 'center',
  },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingHorizontal: 8,
    height: 52,
    gap: 10,
  },
  qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyBtnTxt: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  qtyVal: { color: '#FFF', fontWeight: '800', minWidth: 16, textAlign: 'center' },
  cta: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
