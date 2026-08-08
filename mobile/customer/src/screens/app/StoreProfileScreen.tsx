import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const CHICKEN_ID = 'c0000000-0000-4000-8000-000000000014';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const FALLBACK = [
  {
    id: 'd0000000-0000-4000-8000-000000000141',
    name: 'Zinger Burger Meal',
    description: 'Crispy chicken burger, fries & drink',
    price: 3200,
    menu_category: 'Burgers',
    emoji: '🍔',
    is_popular: true,
  },
  {
    id: 'd0000000-0000-4000-8000-000000000142',
    name: 'Grilled Chicken Combo',
    description: '2pc chicken, coleslaw & plantain',
    price: 4500,
    menu_category: 'Chicken',
    emoji: '🍗',
    is_popular: true,
  },
];

/** Restaurant menu — categories, popular items, floating View Cart (mockup). */
export default function StoreProfileScreen({
  storeId = CHICKEN_ID,
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
  const [store, setStore] = useState<any>({
    name: 'Chicken Republic',
    category: 'Fast Food',
    hours: 'Open until 10 PM',
    rating: 4.8,
    eta: '20-35 min',
    minOrder: 500,
    currency: 'NGN',
  });
  const [products, setProducts] = useState<any[]>(FALLBACK);
  const [categories, setCategories] = useState<string[]>(['All', 'Burgers', 'Chicken', 'Sides']);
  const [cat, setCat] = useState('All');
  const [cartCount, setCartCount] = useState(2);
  const [cartTotal, setCartTotal] = useState(7700);

  const loadCart = () => {
    fetch(`${API}/cart?storeId=${storeId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const items = j?.data?.items || [];
        if (!Array.isArray(items)) return;
        const count = items.reduce((n: number, i: any) => n + Number(i.quantity || 0), 0);
        const total = items.reduce(
          (n: number, i: any) => n + Number(i.unit_price || i.unitPrice || i.price || 0) * Number(i.quantity || 0),
          0
        );
        if (count > 0) {
          setCartCount(count);
          setCartTotal(total);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    fetch(`${API}/stores/${storeId}`)
      .then((r) => r.json())
      .then((j) => {
        const s = j?.data;
        if (!s) return;
        setStore({
          name: s.name || 'Chicken Republic',
          category: s.category || 'Fast Food',
          hours: s.hours_text || s.hours_json?.label || 'Open until 10 PM',
          rating: Number(s.rating || 4.8),
          eta: `${s.eta_min_minutes || 20}-${s.eta_max_minutes || 35} min`,
          minOrder: Number(s.min_order_amount || 500),
          currency: s.currency_code || 'NGN',
        });
      })
      .catch(() => undefined);

    const q = cat !== 'All' ? `?category=${encodeURIComponent(cat)}` : '';
    fetch(`${API}/stores/${storeId}/products${q}`)
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data || [];
        if (Array.isArray(rows) && rows.length) {
          setProducts(
            rows.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description || '',
              price: Number(p.price || p.base_price || 0),
              menu_category: p.menu_category || 'All',
              emoji: p.emoji || '🍽️',
              is_popular: Boolean(p.is_popular || p.is_featured),
            }))
          );
        }
        const cats = j?.categories || [];
        if (Array.isArray(cats) && cats.length) {
          setCategories(cats.map((c: any) => c.name || c).filter(Boolean));
        }
      })
      .catch(() => undefined);

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

  const currency = store.currency || 'NGN';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={onBack}>
            <Text style={styles.backTxt}>←</Text>
          </Pressable>
          <Text style={styles.heroEmoji}>🍔</Text>
        </View>
        <Text style={styles.title}>{store.name}</Text>
        <Text style={styles.sub}>
          {store.category} · {store.hours}
        </Text>
        <Text style={styles.stats}>
          ★ {Number(store.rating).toFixed(1)}   ·   {store.eta}   ·   Min{' '}
          {formatCurrency(store.minOrder, currency)}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats}>
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

        <Text style={styles.section}>POPULAR</Text>
        {list.map((p) => (
          <Pressable
            key={p.id}
            style={styles.row}
            onPress={() => onOpenProduct?.(p.id)}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemName}>{p.name}</Text>
              <Text style={styles.itemDesc} numberOfLines={2}>
                {p.description}
              </Text>
              <Text style={styles.itemPrice}>{formatCurrency(p.price, currency)}</Text>
            </View>
            <View style={styles.thumb}>
              <Text style={styles.thumbEmoji}>{p.emoji}</Text>
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
      </ScrollView>

      {cartCount > 0 ? (
        <Pressable style={styles.cartBar} onPress={onOpenCart}>
          <Text style={styles.cartLeft}>🛒  View Cart ({cartCount})</Text>
          <Text style={styles.cartRight}>
            {formatCurrency(cartTotal, currency)} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { color: '#fff', fontSize: 18 },
  heroEmoji: { fontSize: 48, opacity: 0.9 },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sub: { color: '#A1A1AA', paddingHorizontal: 16, marginTop: 6 },
  stats: { color: '#E4E4E7', paddingHorizontal: 16, marginTop: 10, fontWeight: '600' },
  cats: { paddingHorizontal: 16, marginTop: 18, marginBottom: 8 },
  pill: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  pillOn: { backgroundColor: '#A855F7' },
  pillTxt: { color: '#fff', fontWeight: '600' },
  pillTxtOn: { color: '#fff' },
  section: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1F1F1F',
  },
  itemName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  itemDesc: { color: '#A1A1AA', marginTop: 4, fontSize: 13 },
  itemPrice: { color: '#fff', fontWeight: '700', marginTop: 8 },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    left: 16,
    right: 16,
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
});
