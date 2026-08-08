import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../../lib/currency';
import { mediaUrl } from '../../lib/media';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('movr_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Product detail — gallery, variants, sale price, reviews, wishlist. */
const ProductDetailPage: React.FC = () => {
  const { storeId = '', productId = '' } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [size, setSize] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageIdx, setImageIdx] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' });
  const [reviewMsg, setReviewMsg] = useState('');

  const loadReviews = async () => {
    try {
      const r = await axios.get(`${API}/products/${productId}/reviews`);
      setReviews(r.data?.data || []);
    } catch {
      setReviews([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/products/${productId}`, { headers: authHeaders() })
      .then((r) => {
        const p = r.data?.data;
        if (!p) throw new Error('Product not found');
        setProduct(p);
        const addons = p?.addons || [];
        if (addons[0]) setSelected(new Set([String(addons[0].id)]));
        const sizes = p?.attributes?.sizes || p?.variants || [];
        if (sizes.length) {
          const lab = sizes.find((s: any) => (s.label || s.name) === 'Large') || sizes[1] || sizes[0];
          setSize(lab.label || lab.name || '');
        }
        if (Array.isArray(p.reviews)) setReviews(p.reviews);
        else loadReviews();
      })
      .catch(async () => {
        try {
          const r = await axios.get(`${API}/stores/${storeId}/products`, { headers: authHeaders() });
          const rows = r.data?.data || [];
          const p = rows.find((x: any) => String(x.id) === String(productId));
          if (!p) throw new Error('Product not found');
          setProduct(p);
          await loadReviews();
        } catch {
          setError('Could not load product');
        }
      })
      .finally(() => setLoading(false));

    axios
      .get(`${API}/cart/wishlist/${productId}`, { headers: authHeaders() })
      .then((r) => setWish(Boolean(r.data?.data?.wished)))
      .catch(() => undefined);
  }, [storeId, productId]);

  const gallery = useMemo(() => {
    const imgs = Array.isArray(product?.images) ? product.images : [];
    if (imgs.length) return imgs.map((i: any) => i.url).filter(Boolean);
    if (product?.image_url) return [product.image_url];
    return [];
  }, [product]);

  const sizes = useMemo(() => {
    const attrs = product?.attributes?.sizes;
    if (Array.isArray(attrs) && attrs.length) {
      return attrs.map((s: any) => ({
        label: s.label || s.name || s,
        delta: Number(s.price_delta || 0),
      }));
    }
    if (product?.variants?.length) {
      return product.variants.map((v: any) => ({
        label: v.name,
        delta: Number(v.price_delta || 0),
        id: v.id,
      }));
    }
    return [];
  }, [product]);

  const addons = product?.addons || [];
  const base = Number(product?.price || product?.base_price || 0);
  const listPrice = Number(product?.listPrice ?? product?.price ?? 0);
  const compareAt =
    product?.compareAtPrice != null
      ? Number(product.compareAtPrice)
      : product?.onSale && listPrice > base
        ? listPrice
        : null;
  const currency = product?.currency || 'NGN';
  const sizeDelta = Number(sizes.find((s: any) => s.label === size)?.delta || 0);
  const addonTotal = addons.reduce(
    (n: number, a: any) =>
      selected.has(String(a.id)) ? n + Number(a.priceDelta ?? a.price_delta ?? 0) : n,
    0
  );
  const total = (base + sizeDelta + addonTotal) * qty;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleWish = async () => {
    try {
      if (wish) {
        await axios.delete(`${API}/cart/wishlist/${productId}`, { headers: authHeaders() });
        setWish(false);
      } else {
        await axios.post(`${API}/cart/wishlist/${productId}`, {}, { headers: authHeaders() });
        setWish(true);
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Wishlist update failed');
    }
  };

  const add = async () => {
    const variant = product?.variants?.find((v: any) => v.name === size);
    try {
      await axios.post(
        `${API}/cart/items`,
        {
          storeId: storeId || product?.store_id,
          productId,
          variantId: variant?.id,
          quantity: qty,
          addonIds: [...selected].filter((id) => id.includes('-')),
        },
        { headers: authHeaders() }
      );
      setMsg('Added to cart');
      navigate('/cart');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Could not add to cart');
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API}/products/${productId}/reviews`,
        reviewForm,
        { headers: authHeaders() }
      );
      setReviewMsg('Thanks for your review');
      setReviewForm({ rating: 5, title: '', body: '' });
      await loadReviews();
    } catch (err: any) {
      setReviewMsg(err?.response?.data?.message || 'Could not submit review');
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      {loading ? <p className="text-zinc-400">Loading product…</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}
      {!product ? null : (
        <>
          <div className="flex justify-between mb-3">
            <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-zinc-900">
              ←
            </button>
            <button type="button" onClick={toggleWish} className="w-10 h-10 rounded-full bg-zinc-900">
              <span className={wish ? 'text-red-500' : ''}>{wish ? '♥' : '♡'}</span>
            </button>
          </div>

          <div className="h-56 rounded-2xl bg-zinc-900 mb-3 overflow-hidden flex items-center justify-center">
            {gallery[imageIdx] ? (
              <img
                src={mediaUrl(gallery[imageIdx])}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-7xl">{product?.emoji || '🍽️'}</span>
            )}
          </div>
          {gallery.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto mb-4">
              {gallery.map((url: string, i: number) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setImageIdx(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border shrink-0 ${
                    i === imageIdx ? 'border-purple-500' : 'border-zinc-800'
                  }`}
                >
                  <img src={mediaUrl(url)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex justify-between gap-3">
            <h1 className="text-2xl font-extrabold">{product?.name}</h1>
            <div className="text-right">
              <p className="text-xl font-extrabold">{formatCurrency(base, currency)}</p>
              {compareAt != null && compareAt > base ? (
                <p className="text-sm text-zinc-500 line-through">
                  {formatCurrency(compareAt, currency)}
                </p>
              ) : null}
            </div>
          </div>
          {product?.onSale ? (
            <span className="inline-block mt-2 text-xs font-bold uppercase tracking-wide text-orange-400 bg-orange-950 px-2 py-0.5 rounded-full">
              Sale
            </span>
          ) : null}
          <p className="text-zinc-400 mt-1">
            {product?.storeName || product?.store_name || product?.merchantLabel || product?.merchant_label || ''}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-orange-400 font-bold text-sm">
              ★ {Number(product?.rating || 0).toFixed(1)} · {product?.reviewCount || product?.review_count || reviews.length}{' '}
              ratings
            </span>
            <span className="text-xs font-bold text-green-400 bg-green-950 px-2 py-0.5 rounded-full">
              Available
            </span>
          </div>
          <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
            {product?.longDescription || product?.long_description || product?.description || ''}
          </p>

          {sizes.length ? (
            <>
              <p className="text-xs font-bold tracking-wider text-zinc-500 mt-6 mb-2">SIZE</p>
              <div className="grid grid-cols-3 gap-2">
                {sizes.map((s: any) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSize(s.label)}
                    className={`rounded-xl py-3 font-bold border ${
                      size === s.label
                        ? 'border-purple-500 bg-zinc-900'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {addons.length ? (
            <>
              <p className="text-xs font-bold tracking-wider text-zinc-500 mt-6 mb-2">ADD-ONS</p>
              <div className="space-y-2 mb-6">
                {addons.map((a: any) => {
                  const id = String(a.id);
                  const on = selected.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className="w-full flex items-center gap-3 rounded-xl bg-zinc-900 p-3.5 text-left"
                    >
                      <span
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs ${
                          on ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
                        }`}
                      >
                        {on ? '✓' : ''}
                      </span>
                      <span className="flex-1 font-semibold">{a.name}</span>
                      <span className="text-zinc-400 font-bold">
                        +{formatCurrency(Number(a.priceDelta ?? a.price_delta ?? 0), currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {msg ? <p className="text-center text-green-400 text-sm mb-2">{msg}</p> : null}

          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-3 rounded-xl bg-zinc-900 h-12 px-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-8 font-bold text-xl"
              >
                −
              </button>
              <span className="font-extrabold w-4 text-center">{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)} className="w-8 font-bold text-xl">
                +
              </button>
            </div>
            <button
              type="button"
              onClick={add}
              className="flex-1 h-12 rounded-xl bg-indigo-500 font-extrabold"
            >
              Add to Cart · {formatCurrency(total, currency)}
            </button>
          </div>

          <section className="mt-10 border-t border-zinc-800 pt-6">
            <h2 className="text-lg font-bold mb-3">Reviews</h2>
            <div className="space-y-3 mb-6">
              {reviews.length === 0 ? (
                <p className="text-zinc-500 text-sm">No reviews yet.</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="rounded-xl bg-zinc-900 p-3">
                    <p className="font-semibold text-sm">
                      ★ {r.rating} · {r.authorName || 'Customer'}
                    </p>
                    {r.title ? <p className="font-bold mt-1">{r.title}</p> : null}
                    {r.body ? <p className="text-zinc-400 text-sm mt-1">{r.body}</p> : null}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={submitReview} className="space-y-2 rounded-xl bg-zinc-900 p-4">
              <p className="font-semibold text-sm">Write a review</p>
              <select
                className="w-full rounded-lg bg-black border border-zinc-700 px-3 py-2"
                value={reviewForm.rating}
                onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-lg bg-black border border-zinc-700 px-3 py-2"
                placeholder="Title"
                value={reviewForm.title}
                onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
              />
              <textarea
                className="w-full rounded-lg bg-black border border-zinc-700 px-3 py-2 min-h-[80px]"
                placeholder="Your experience"
                value={reviewForm.body}
                onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })}
              />
              {reviewMsg ? <p className="text-sm text-green-400">{reviewMsg}</p> : null}
              <button type="submit" className="w-full rounded-xl bg-purple-600 py-2.5 font-bold">
                Submit review
              </button>
            </form>
          </section>

          <Link to={`/store/${storeId || product.store_id}`} className="block text-center text-zinc-500 text-sm mt-4">
            Back to store
          </Link>
          <Link to="/wishlist" className="block text-center text-zinc-500 text-sm mt-2">
            View wishlist
          </Link>
        </>
      )}
    </div>
  );
};

export default ProductDetailPage;
