import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';
import { cartApi, storesApi } from '../../services/api';
import api from '../../services/api';

type Variant = { id: string; name: string; price_delta?: number };
type ColorOpt = { name: string; hex: string };

const DEFAULT_SIZES = ['S', 'M', 'L', 'XL'];
const DEFAULT_COLORS: ColorOpt[] = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Charcoal', hex: '#374151' },
  { name: 'White', hex: '#E5E7EB' },
];

/** Product detail — size/color, wishlist, add to cart. */
export default function ProductDetailScreen({
  productId,
  storeId,
  name: nameProp = 'Cotton shirt',
  price: priceProp = 120,
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [sizes, setSizes] = useState<string[]>(DEFAULT_SIZES);
  const [colorOpts, setColorOpts] = useState<ColorOpt[]>(DEFAULT_COLORS);
  const [size, setSize] = useState('M');
  const [color, setColor] = useState('Blue');
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
        setImageUrl(p.image_url || null);
        const vs: Variant[] = Array.isArray(p.variants) ? p.variants : [];
        setVariants(vs);
        const attrs = p.attributes || {};
        if (Array.isArray(attrs.sizes) && attrs.sizes.length) setSizes(attrs.sizes);
        if (Array.isArray(attrs.colors) && attrs.colors.length) {
          setColorOpts(
            attrs.colors.map((c: any) =>
              typeof c === 'string' ? { name: c, hex: '#888' } : { name: c.name, hex: c.hex || '#888' }
            )
          );
        }
      })
      .catch(() => undefined);

    api
      .get(`/cart/wishlist/${productId}`)
      .then((r) => setWish(Boolean(r.data?.data?.wished)))
      .catch(() => undefined);
  }, [productId, storeId]);

  const variantId = useMemo(() => {
    const needle = `${size} · ${color}`.toLowerCase();
    const match = variants.find((v) => String(v.name).toLowerCase() === needle);
    if (match) return match.id;
    // fallback: any variant containing size + color
    const loose = variants.find((v) => {
      const n = String(v.name).toLowerCase();
      return n.includes(size.toLowerCase()) && n.includes(color.toLowerCase());
    });
    return loose?.id || variants[0]?.id;
  }, [variants, size, color]);

  const unit =
    price + Number(variants.find((v) => v.id === variantId)?.price_delta || 0);

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
        quantity: 1,
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

        <Text style={styles.label}>Size</Text>
        <View style={styles.row}>
          {sizes.map((s) => {
            const active = size === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSize(s)}
                style={[styles.sizeChip, active && styles.sizeActive]}
              >
                {active ? <View style={styles.sizeGlow} /> : null}
                <Text style={[styles.sizeText, active && styles.sizeTextOn]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.row}>
          {colorOpts.map((c) => {
            const active = color === c.name;
            return (
              <Pressable
                key={c.name}
                onPress={() => setColor(c.name)}
                style={[styles.swatchRing, active && styles.swatchRingOn]}
              >
                <View style={[styles.swatch, { backgroundColor: c.hex }]} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <View style={styles.footer}>
        <Pressable onPress={toggleWish} style={styles.wishBtn} accessibilityLabel="Favorite">
          <Text style={styles.wishIcon}>{wish ? '♥' : '♡'}</Text>
        </Pressable>
        <Pressable style={styles.cta} onPress={addToCart} disabled={adding}>
          <View style={styles.ctaGlow} />
          <Text style={styles.ctaText}>{adding ? 'Adding…' : 'Add to cart'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000' },
    scroll: { padding: spacing[4], paddingBottom: 120 },
    image: {
      height: 260,
      borderRadius: 16,
      backgroundColor: '#1A1A1A',
      marginBottom: spacing[4],
    },
    title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
    price: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 8 },
    label: { color: '#888888', marginTop: spacing[5], marginBottom: spacing[2], fontSize: 13 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
    sizeChip: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#1A1A1A',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    sizeActive: { backgroundColor: '#8E2DE2' },
    sizeGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#4A00E0',
      opacity: 0.55,
    },
    sizeText: { color: '#888888', fontWeight: '700', zIndex: 1 },
    sizeTextOn: { color: '#FFFFFF' },
    swatchRing: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchRingOn: { borderColor: '#FFFFFF' },
    swatch: { width: 26, height: 26, borderRadius: 13 },
    msg: { color: '#4ade80', textAlign: 'center', marginBottom: 8 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[4],
    },
    wishBtn: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: '#1A1A1A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    wishIcon: { color: '#FFFFFF', fontSize: 22 },
    cta: {
      flex: 1,
      borderRadius: 14,
      overflow: 'hidden',
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#8E2DE2',
    },
    ctaGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#4A00E0',
      opacity: 0.55,
    },
    ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
  });
}
