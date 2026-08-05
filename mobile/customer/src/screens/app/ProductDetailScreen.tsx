import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';
import { cartApi, storesApi } from '../../services/api';

type Variant = { id: string; name: string; price_delta?: number };

/** Product detail — loads product/variants, add to cart via API. */
export default function ProductDetailScreen({
  productId,
  storeId,
  name: nameProp = 'Product',
  price: priceProp = 0,
  onAdded,
}: {
  productId?: string;
  storeId?: string;
  name?: string;
  price?: number;
  onAdded?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [name, setName] = useState(nameProp);
  const [price, setPrice] = useState(priceProp);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantId, setVariantId] = useState<string | undefined>();
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
        const p = list.find((x: any) => String(x.id) === String(productId));
        if (!p) return;
        setName(p.name || nameProp);
        setPrice(Number(p.price || priceProp));
        setDescription(p.description || '');
        setImageUrl(p.image_url || null);
        const vs: Variant[] = Array.isArray(p.variants) ? p.variants : [];
        setVariants(vs);
        if (vs[0]) setVariantId(vs[0].id);
      })
      .catch(() => undefined);
  }, [productId, storeId]);

  const unit =
    price + Number(variants.find((v) => v.id === variantId)?.price_delta || 0);

  const addToCart = async () => {
    if (!productId || !storeId) {
      setMsg('Missing product');
      return;
    }
    setAdding(true);
    setMsg('');
    try {
      await cartApi.addItem({
        storeId,
        productId,
        variantId,
        quantity: qty,
      });
      setMsg('Added to cart');
      onAdded?.();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.message || 'Could not add to cart');
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.image} />
        )}
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.price}>{formatCurrency(unit, 'GHS')}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}

        {variants.length ? (
          <>
            <Text style={styles.label}>Variant</Text>
            <View style={styles.row}>
              {variants.map((v) => {
                const active = variantId === v.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setVariantId(v.id)}
                    style={[styles.sizeChip, active && styles.sizeActive]}
                  >
                    <Text style={[styles.sizeText, active && styles.sizeTextOn]}>{v.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.label}>Quantity</Text>
        <View style={styles.row}>
          <Pressable
            style={styles.sizeChip}
            onPress={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Text style={styles.sizeText}>−</Text>
          </Pressable>
          <Text style={styles.qty}>{qty}</Text>
          <Pressable style={styles.sizeChip} onPress={() => setQty((q) => q + 1)}>
            <Text style={styles.sizeText}>+</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setWish((w) => !w)} style={styles.wish}>
          <Text style={styles.wishIcon}>{wish ? '♥' : '♡'}</Text>
          <Text style={styles.wishText}>{wish ? 'Saved' : 'Wishlist'}</Text>
        </Pressable>
      </ScrollView>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={addToCart} disabled={adding}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>{adding ? 'Adding…' : 'Add to cart'}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack },
  scroll: { padding: spacing[4], paddingBottom: 100 },
  image: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing[4],
  },
  title: { color: colors.pureWhite, fontSize: 24, fontWeight: '700' },
  price: { color: colors.success, fontSize: 20, fontWeight: '700', marginTop: 8 },
  desc: { color: colors.textSecondary, marginTop: 10, lineHeight: 20 },
  label: { color: colors.textSecondary, marginTop: spacing[5], marginBottom: spacing[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  sizeChip: {
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sizeActive: { borderColor: colors.motionBlue, backgroundColor: colors.surfaceElevated },
  sizeText: { color: colors.textSecondary, fontWeight: '600' },
  sizeTextOn: { color: colors.pureWhite },
  qty: { color: colors.pureWhite, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  wish: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[5] },
  wishIcon: { color: colors.pureWhite, fontSize: 22 },
  wishText: { color: colors.textSecondary },
  msg: { color: colors.success, textAlign: 'center', marginBottom: 8 },
  cta: {
    margin: spacing[4],
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
