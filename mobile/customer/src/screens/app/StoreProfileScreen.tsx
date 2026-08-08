import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { formatCurrency } from '@movr/design-system/format';
import { mediaUrl, isMediaVideo } from '../../lib/media';

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

/** Store menu — categories, sale pricing, images, floating View Cart. */
export default function StoreProfileScreen({
  storeId,
  onOpenCart,
  onBack,
  onAddToCart,
  onOpenProduct,
}: {
  storeId?: string;
  onOpenProduct?: (productId: string) => void;
  onAddToCart?: (product: any) => void;
  onOpenCart?: () => void;
  onBack?: () => void;
}) {
  const { width } = useWindowDimensions();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [cat, setCat] = useState('All');
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCart = () => {
    if (!storeId) return;
    fetch(`${API}/cart?storeId=${storeId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const items = j?.data?.items || [];
        if (!Array.isArray(items)) return;
        const count = items.reduce((n: number, i: any) => n + Number(i.quantity || 0), 0);
        const total = items.reduce(
          (n: number, i: any) =>
            n + Number(i.unit_price || i.unitPrice || i.price || 0) * Number(i.quantity || 0),
          0
        );
        setCartCount(count);
        setCartTotal(total);
      })
      .catch(() => {
        setCartCount(0);
        setCartTotal(0);
      });
  };

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      setError('Store not found');
      return;
    }
    setLoading(true);
    setError('');
    fetch(`${API}/stores/${storeId}`)
      .then((r) => r.json())
      .then((j) => {
        const s = j?.data;
        if (!s) return;
        setStore({
          name: s.name || '',
          category: s.category || '',
          description: s.description || '',
          hours: s.hours_text || s.hours_json?.label || '',
          rating: Number(s.rating || 0),
          eta:
            s.eta_text ||
            (s.eta_min_minutes != null
              ? `${s.eta_min_minutes}-${s.eta_max_minutes ?? s.eta_min_minutes} min`
              : ''),
          minOrder: Number(s.min_order_amount || 0),
          currency: s.currency_code || 'NGN',
          banner: s.banner_url || s.image_url || null,
          banners: Array.isArray(s.banners)
            ? s.banners.filter((b: any) => b.is_active !== false && b.image_url).map((b: any) => b.image_url)
            : [],
        });
      })
      .catch((e) => {
        setStore(null);
        setError(e?.message || 'Could not load store');
      });

    const q = cat !== 'All' ? `?category=${encodeURIComponent(cat)}` : '';
    fetch(`${API}/stores/${storeId}/products${q}`)
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data || [];
        if (Array.isArray(rows)) {
          setProducts(
            rows.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description || '',
              price: Number(p.price || p.base_price || 0),
              listPrice: Number(p.listPrice ?? p.price ?? 0),
              compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
              onSale: Boolean(p.onSale),
              imageUrl: p.images?.[0]?.url || p.image_url || null,
              menu_category: p.menu_category || 'All',
              emoji: p.emoji || '🍽️',
              is_popular: Boolean(p.is_popular || p.is_featured),
            }))
          );
        }
        const cats = j?.categories || [];
        if (Array.isArray(cats) && cats.length) {
          setCategories(['All', ...cats.map((c: any) => c.name || c).filter(Boolean)]);
        }
      })
      .catch((e) => {
        setProducts([]);
        setError(e?.message || 'Could not load products');
      })
      .finally(() => setLoading(false));

    loadCart();
  }, [storeId, cat]);

  const visible = useMemo(() => {
    if (cat === 'All') return products;
    return products.filter((p) => String(p.menu_category).toLowerCase() === cat.toLowerCase());
  }, [products, cat]);

  const popular = visible.filter((p) => p.is_popular);
  const list = popular.length ? popular : visible;

  const add = async (p: any) => {
    onAddToCart?.(p);
    setCartCount((c) => c + 1);
    setCartTotal((t) => t + Number(p.price || 0));
    await fetch(`${API}/cart/items`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ storeId, productId: p.id, quantity: 1 }),
    }).catch(() => undefined);
    loadCart();
  };

  const [bannerIdx, setBannerIdx] = useState(0);

  const heroSlides = useMemo(() => {
    if (store?.banners?.length) return store.banners as string[];
    if (store?.banner) return [store.banner];
    return [] as string[];
  }, [store]);

  useEffect(() => {
    setBannerIdx(0);
  }, [storeId, heroSlides.length]);

  const currency = store?.currency || 'NGN';
  const pad = Math.max(12, Math.min(20, width * 0.04));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.header, { paddingHorizontal: 0 }]}>
          <Pressable style={[styles.back, { left: pad, zIndex: 2 }]} onPress={onBack}>
            <Text style={styles.backTxt}>←</Text>
          </Pressable>
          {heroSlides.length ? (
            <Pressable
              onPress={() => {
                const url = heroSlides[bannerIdx];
                if (isMediaVideo(url) && Platform.OS !== 'web') {
                  Linking.openURL(mediaUrl(url)).catch(() => undefined);
                  return;
                }
                if (heroSlides.length > 1) setBannerIdx((i) => (i + 1) % heroSlides.length);
              }}
              style={{ width: '100%' }}
            >
              {isMediaVideo(heroSlides[bannerIdx]) && Platform.OS === 'web' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={mediaUrl(heroSlides[bannerIdx])}
                  style={{
                    width: '100%',
                    height: Math.min(220, width * 0.45),
                    objectFit: 'cover',
                    backgroundColor: '#111',
                  }}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : isMediaVideo(heroSlides[bannerIdx]) ? (
                <View
                  style={[
                    styles.heroImg,
                    {
                      width: '100%',
                      height: Math.min(220, width * 0.45),
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#111',
                    },
                  ]}
                >
                  <Text style={{ color: '#fff', fontSize: 28 }}>▶</Text>
                  <Text style={{ color: '#aaa', marginTop: 6, fontSize: 12 }}>Tap to play banner</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: mediaUrl(heroSlides[bannerIdx]) }}
                  style={[styles.heroImg, { width: '100%', height: Math.min(220, width * 0.45) }]}
                  resizeMode="cover"
                />
              )}
            </Pressable>
          ) : (
            <Text style={styles.heroEmoji}>🍔</Text>
          )}
        </View>
        {loading ? <Text style={[styles.empty, { paddingHorizontal: pad }]}>Loading store…</Text> : null}
        {error ? <Text style={[styles.error, { paddingHorizontal: pad }]}>{error}</Text> : null}
        <Text style={[styles.title, { paddingHorizontal: pad }]}>{store?.name || ''}</Text>
        <Text style={[styles.sub, { paddingHorizontal: pad }]}>
          {[store?.category, store?.hours].filter(Boolean).join(' · ')}
        </Text>
        {store?.description ? (
          <Text style={[styles.sub, { paddingHorizontal: pad, marginTop: 8 }]}>{store.description}</Text>
        ) : null}
        <Text style={[styles.stats, { paddingHorizontal: pad }]}>
          {store
            ? `★ ${Number(store.rating || 0).toFixed(1)}   ·   ${store.eta || ''}   ·   Min ${formatCurrency(store.minOrder || 0, currency)}`
            : ''}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: pad, gap: 8 }}
          style={styles.cats}
        >
          {categories.map((c) => (
            <Pressable
              key={c}
              style={[styles.pill, cat === c && styles.pillOn]}
              onPress={() => setCat(c)}
            >
              <Text style={[styles.pillTxt, cat === c && styles.pillTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.section, { paddingHorizontal: pad }]}>
          {popular.length ? 'POPULAR' : 'MENU'}
        </Text>
        {list.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.row, { paddingHorizontal: pad }]}
            onPress={() => onOpenProduct?.(p.id)}
          >
            <View style={{ flex: 1, paddingRight: 12, minWidth: 0 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {p.name}
              </Text>
              <Text style={styles.itemDesc} numberOfLines={2}>
                {p.description}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.itemPrice}>{formatCurrency(p.price, currency)}</Text>
                {p.compareAtPrice != null && p.compareAtPrice > p.price ? (
                  <Text style={styles.strike}>{formatCurrency(p.compareAtPrice, currency)}</Text>
                ) : p.listPrice > p.price ? (
                  <Text style={styles.strike}>{formatCurrency(p.listPrice, currency)}</Text>
                ) : null}
                {p.onSale ? <Text style={styles.sale}>Sale</Text> : null}
              </View>
            </View>
            <View style={styles.thumb}>
              {p.imageUrl ? (
                <Image source={{ uri: mediaUrl(p.imageUrl) }} style={styles.thumbImg} />
              ) : (
                <Text style={styles.thumbEmoji}>{p.emoji}</Text>
              )}
              <Pressable
                style={styles.plus}
                onPress={(e) => {
                  (e as any)?.stopPropagation?.();
                  if (onOpenProduct) onOpenProduct(p.id);
                  else add(p);
                }}
              >
                <Text style={styles.plusTxt}>+</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
        {!loading && !list.length ? (
          <Text style={[styles.empty, { paddingHorizontal: pad }]}>No products available.</Text>
        ) : null}
      </ScrollView>

      {cartCount > 0 ? (
        <Pressable style={[styles.cartBar, { left: pad, right: pad }]} onPress={onOpenCart}>
          <Text style={styles.cartLeft}>🛒  View Cart ({cartCount})</Text>
          <Text style={styles.cartRight}>{formatCurrency(cartTotal, currency)} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'relative',
    paddingTop: 0,
    minHeight: 48,
  },
  back: {
    position: 'absolute',
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { color: '#fff', fontSize: 18 },
  heroEmoji: { fontSize: 48, opacity: 0.9, alignSelf: 'flex-end', margin: 16 },
  heroImg: { width: '100%', height: 180, borderRadius: 0 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 8 },
  sub: { color: '#A1A1AA', marginTop: 6 },
  stats: { color: '#E4E4E7', marginTop: 10, fontWeight: '600' },
  cats: { marginTop: 18, marginBottom: 8 },
  pill: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillOn: { backgroundColor: '#A855F7' },
  pillTxt: { color: '#fff', fontWeight: '600' },
  pillTxtOn: { color: '#fff' },
  section: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1F1F1F',
  },
  itemName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  itemDesc: { color: '#A1A1AA', marginTop: 4, fontSize: 13 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  itemPrice: { color: '#fff', fontWeight: '700' },
  strike: { color: '#71717A', textDecorationLine: 'line-through', fontSize: 12 },
  sale: { color: '#FB923C', fontWeight: '800', fontSize: 11 },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbEmoji: { fontSize: 36 },
  plus: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusTxt: { color: '#fff', fontWeight: '900', fontSize: 18, marginTop: -1 },
  cartBar: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  cartLeft: { color: '#fff', fontWeight: '700' },
  cartRight: { color: '#fff', fontWeight: '800' },
  empty: { color: '#71717A', marginVertical: 12 },
  error: { color: '#F87171', marginVertical: 8 },
});
