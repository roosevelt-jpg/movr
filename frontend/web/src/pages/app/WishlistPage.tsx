import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Heart } from 'lucide-react';
import { mediaUrl } from '../../lib/media';
import { formatCurrency } from '../../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('movr_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Customer wishlist with product cards. */
const WishlistPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/cart/wishlist`, { headers: authHeaders() });
      setItems(r.data?.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (productId: string) => {
    await axios.delete(`${API}/cart/wishlist/${productId}`, { headers: authHeaders() });
    setItems((prev) => prev.filter((p) => String(p.id || p.productId) !== String(productId)));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-8 text-pure-white bg-movr-gradient">
        <h1 className="text-4xl font-bold mb-2 inline-flex items-center gap-3">
          <Heart /> Wishlist
        </h1>
        <p className="text-pure-white/80">Saved products across Movr Shop</p>
      </div>

      {loading ? <p className="text-text-secondary">Loading…</p> : null}
      {error ? <p className="text-error">{error}</p> : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-text-secondary mb-4">Your wishlist is empty.</p>
          <Link to="/marketplace" className="text-motion-blue font-semibold">
            Browse marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((p) => {
            const id = p.id || p.productId;
            const img = p.images?.[0]?.url || p.image_url;
            const currency = p.currency || 'NGN';
            const price = Number(p.price ?? 0);
            return (
              <div
                key={id}
                className="rounded-2xl border border-border bg-surface overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => navigate(`/store/${p.store_id}/product/${id}`)}
                >
                  <div className="aspect-square bg-surface-elevated">
                    {img ? (
                      <img src={mediaUrl(img)} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-4xl opacity-40">🛍️</div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs text-text-secondary truncate">{p.storeName || p.store_name}</p>
                    <h3 className="font-semibold text-sm line-clamp-2">{p.name}</h3>
                    <p className="font-bold">{formatCurrency(price, currency)}</p>
                  </div>
                </button>
                <div className="px-3 pb-3">
                  <button
                    type="button"
                    className="text-sm text-error font-medium"
                    onClick={() => remove(String(id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
