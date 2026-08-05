import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const SIZES = ['S', 'M', 'L', 'XL'] as const;
const SWATCHES = ['#0055FF', '#2A2A2A', '#E8E8E8'] as const;

/** Product detail — size/color, wishlist, add to cart (keeps cart API when available). */
export default function ProductDetailScreen({
  productId,
  name = 'Cotton shirt',
  price = 120,
  onAdded,
}: {
  productId?: string;
  name?: string;
  price?: number;
  onAdded?: () => void;
}) {
  const [size, setSize] = useState<(typeof SIZES)[number]>('M');
  const [color, setColor] = useState(0);
  const [wish, setWish] = useState(false);
  const [adding, setAdding] = useState(false);

  const addToCart = async () => {
    setAdding(true);
    try {
      if (productId) {
        await fetch(`${API}/cart/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            quantity: 1,
            variant: `${size}, color ${color}`,
          }),
        });
      }
      onAdded?.();
    } catch {
      /* offline / demo */
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.image} />
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.price}>{formatCurrency(price, 'GHS')}</Text>

        <Text style={styles.label}>Size</Text>
        <View style={styles.row}>
          {SIZES.map((s) => {
            const active = size === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSize(s)}
                style={[styles.sizeChip, active && styles.sizeActive]}
              >
                <Text style={[styles.sizeText, active && styles.sizeTextOn]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.row}>
          {SWATCHES.map((c, i) => (
            <Pressable
              key={c}
              onPress={() => setColor(i)}
              style={[
                styles.swatch,
                { backgroundColor: c },
                color === i && styles.swatchOn,
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => setWish((w) => !w)}
          style={[styles.wish, wish && styles.wishOn]}
        >
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack },
  scroll: { padding: spacing[4], paddingBottom: 100 },
  image: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: '#1A1A1A',
    marginBottom: spacing[4],
  },
  title: { color: colors.pureWhite, fontSize: 26, fontWeight: '700' },
  price: { color: colors.pureWhite, fontSize: 22, fontWeight: '700', marginTop: 6 },
  label: { color: colors.textSecondary, marginTop: spacing[5], marginBottom: spacing[2], fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  sizeChip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeActive: { backgroundColor: colors.electricViolet },
  sizeText: { color: colors.textSecondary, fontWeight: '700' },
  sizeTextOn: { color: colors.pureWhite },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: '#fff' },
  footer: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[5],
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'center',
  },
  wish: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishOn: { backgroundColor: 'rgba(106,0,255,0.25)' },
  wishIcon: { color: '#fff', fontSize: 22 },
  cta: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.electricViolet,
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
