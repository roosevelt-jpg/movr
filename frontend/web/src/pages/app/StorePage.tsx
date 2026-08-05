import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star, MapPin, ArrowLeft, ShoppingCart, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { mediaUrl } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/** Live storefront — banners, category chips, products from API. */
const StorePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatMoney } = useLocalCurrency();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bannerIdx, setBannerIdx] = useState(0);

  const load = async (cat = category) => {
    if (!id) return;
    setLoading(true);
    try {
      const [storeRes, productsRes] = await Promise.all([
        axios.get(`${API}/stores/${id}`),
        axios.get(`${API}/stores/${id}/products`, {
          params: cat !== 'all' ? { category: cat } : undefined,
        }),
      ]);
      setStore(storeRes.data.data);
      setProducts(productsRes.data.data || []);
      setCategories(productsRes.data.categories || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, category]);

  const banners = useMemo(() => {
    const list = Array.isArray(store?.banners) ? store.banners.filter((b: any) => b.is_active !== false) : [];
    if (list.length) return list;
    if (store?.banner_url) {
      return [{ id: 'hero', image_url: store.banner_url, title: store.name }];
    }
    return [];
  }, [store]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);

  const addToCart = async (productId: string) => {
    try {
      await axios.post(
        `${API}/cart/items`,
        { storeId: id, productId, quantity: 1 },
        { headers: authHeaders() }
      );
      toast.success('Added to cart');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Sign in to add to cart');
    }
  };

  if (loading && !store) {
    return <p className="text-text-secondary">Loading store…</p>;
  }

  if (error && !store) {
    return <p className="text-error">{error}</p>;
  }

  const activeBanner = banners[bannerIdx];

  return (
    <div className="space-y-6 pb-20">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-motion-blue hover:opacity-80 font-semibold"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="rounded-2xl border border-border overflow-hidden bg-surface">
        <div className="h-44 bg-surface-elevated flex items-center justify-center overflow-hidden">
          {activeBanner?.image_url ? (
            <img
              src={mediaUrl(activeBanner.image_url)}
              alt={activeBanner.title || store?.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-5xl opacity-40">🏪</span>
          )}
        </div>
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-2">{store?.name || 'Store'}</h1>
          <div className="flex items-center gap-4 mb-3 text-sm">
            <div className="flex items-center gap-1">
              <Star className="text-warning" size={18} />
              <span className="font-semibold">{Number(store?.rating || 0).toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1 text-text-secondary">
              <MapPin size={16} />
              <span>{store?.category || 'Local store'}</span>
            </div>
          </div>
          <p className="text-text-secondary">
            {store?.hours_json?.mon_sun || store?.description || 'Open today'}
          </p>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`px-4 py-2 rounded-full whitespace-nowrap ${
            category === 'all' ? 'bg-motion-blue text-pure-white' : 'bg-surface-elevated'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.slug)}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              category === c.slug ? 'bg-motion-blue text-pure-white' : 'bg-surface-elevated'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-xl font-bold mb-4">Products</h2>
        {products.length === 0 ? (
          <p className="text-text-secondary">This store has no products in this category yet.</p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-4 p-4 bg-surface-elevated rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {product.image_url ? (
                    <img
                      src={mediaUrl(product.image_url)}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="w-14 h-14 rounded-lg bg-border" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{product.name}</p>
                    <p className="text-sm text-text-secondary">
                      {product.category_name || 'Uncategorized'}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-success">{formatMoney(Number(product.price))}</p>
                  <button
                    type="button"
                    onClick={() => addToCart(product.id)}
                    className="mt-1 bg-motion-blue text-pure-white px-3 py-1 rounded text-sm inline-flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/cart')}
        className="fixed bottom-6 right-6 bg-motion-blue text-pure-white p-4 rounded-full shadow-active-glow hover:opacity-90"
      >
        <ShoppingCart size={24} />
      </button>
    </div>
  );
};

export default StorePage;
