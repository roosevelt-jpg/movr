import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { mediaUrl, uploadCatalogImage } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const token = () => localStorage.getItem('movr_merchant_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

function stockLabel(p: any) {
  const qty = Number(p.stock_qty ?? (p.in_stock === false ? 0 : 50));
  if (qty <= 0 || p.in_stock === false) return { text: 'Out of Stock', cls: 'bg-red-950 text-red-400' };
  if (qty <= 10) return { text: 'Low Stock', cls: 'bg-orange-950 text-orange-400' };
  return { text: 'In stock', cls: 'bg-emerald-950 text-emerald-400' };
}

/** Products — searchable table + edit side panel matching merchant mockup. */
export default function MerchantProductsPage() {
  const { formatMoney } = useLocalCurrency();
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    storeId: '',
    name: '',
    price: '',
    description: '',
    categoryId: '',
    imageUrl: '',
    isAvailable: true,
    isFeatured: false,
    isActive: true,
    stockQty: '50',
  });

  const load = async () => {
    const [p, s, c] = await Promise.all([
      axios.get(`${API}/merchant/products`, { headers: headers() }),
      axios.get(`${API}/merchant/stores`, { headers: headers() }),
      axios.get(`${API}/merchant/categories`, { headers: headers() }),
    ]);
    setProducts(p.data.data || []);
    setStores(s.data.data || []);
    setCategories(c.data.data || []);
    if (s.data.data?.[0] && !form.storeId) {
      setForm((f) => ({ ...f, storeId: s.data.data[0].id }));
    }
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  const categoryChips = useMemo(() => {
    const names = Array.from(
      new Set(products.map((p) => p.category_name).filter(Boolean))
    ) as string[];
    return ['All', ...names];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchQ = !q || String(p.name || '').toLowerCase().includes(q.toLowerCase());
      const matchC =
        cat === 'all' ||
        String(p.category_name || '').toLowerCase() === cat.toLowerCase();
      return matchQ && matchC;
    });
  }, [products, q, cat]);

  const activeCount = products.filter((p) => p.is_active !== false && p.in_stock !== false).length;

  const openEdit = (p: any) => {
    setCreating(false);
    setEditing(p);
    setForm({
      storeId: p.store_id,
      name: p.name || '',
      price: String(p.price ?? ''),
      description: p.description || '',
      categoryId: p.category_id || '',
      imageUrl: p.image_url || '',
      isAvailable: p.is_available !== false && p.in_stock !== false,
      isFeatured: Boolean(p.is_featured),
      isActive: p.is_active !== false,
      stockQty: String(p.stock_qty ?? 50),
    });
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm((f) => ({
      ...f,
      name: '',
      price: '',
      description: '',
      categoryId: '',
      imageUrl: '',
      isAvailable: true,
      isFeatured: false,
      isActive: true,
      stockQty: '50',
      storeId: f.storeId || stores[0]?.id || '',
    }));
  };

  const closePanel = () => {
    setEditing(null);
    setCreating(false);
  };

  const onImage = async (file?: File | null) => {
    if (!file) return;
    try {
      const url = await uploadCatalogImage(file, token());
      setForm((f) => ({ ...f, imageUrl: url }));
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        price: Number(form.price),
        description: form.description || undefined,
        categoryId: form.categoryId || undefined,
        imageUrl: form.imageUrl || undefined,
        isAvailable: form.isAvailable,
        isFeatured: form.isFeatured,
        isActive: form.isActive,
        inStock: form.isAvailable && Number(form.stockQty) > 0,
        stockQty: Number(form.stockQty),
      };
      if (editing) {
        await axios.patch(`${API}/merchant/products/${editing.id}`, payload, { headers: headers() });
        toast.success('Product updated');
      } else {
        await axios.post(
          `${API}/merchant/products`,
          { ...payload, storeId: form.storeId },
          { headers: headers() }
        );
        toast.success('Product added');
      }
      closePanel();
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message);
    }
  };

  const panelOpen = Boolean(editing || creating);

  return (
    <MerchantShell activePath="/merchant/products">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Products</h1>
          <p className="text-[#888888] mt-1">
            {products.length} products · {activeCount} active
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl px-4 py-2.5 font-semibold bg-gradient-to-r from-[#8E2DE2] to-[#4A00E0] text-white"
        >
          + Add Product
        </button>
      </div>

      <div className={`grid gap-4 ${panelOpen ? 'lg:grid-cols-[1fr_340px]' : ''}`}>
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              className="flex-1 min-w-[200px] rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-2.5 text-white"
              placeholder="Search products..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {categoryChips.map((c) => {
              const key = c === 'All' ? 'all' : c;
              const on = cat.toLowerCase() === key.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(key)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    on ? 'bg-[#8E2DE2] text-white' : 'bg-[#1A1A1A] text-[#888888]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-2xl bg-[#1A1A1A]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#888888] text-left border-b border-white/10">
                  {['Product', 'Price', 'Category', 'Stock', 'Orders (wk)', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[#888888]">
                      No products yet.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const stock = stockLabel(p);
                    const active = p.is_active !== false && p.in_stock !== false;
                    return (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#2A2A2A] overflow-hidden shrink-0">
                              {p.image_url ? (
                                <img
                                  src={mediaUrl(p.image_url)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                            <span className="text-white font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white">{formatMoney(Number(p.price))}</td>
                        <td className="px-4 py-3 text-[#AAAAAA]">{p.category_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stock.cls}`}>
                            {stock.text}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white">{Number(p.orders_week || 0)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              active ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                            }`}
                          >
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="text-[#c4b5fd] font-medium"
                            onClick={() => openEdit(p)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {panelOpen ? (
          <form onSubmit={save} className="rounded-2xl bg-[#1A1A1A] p-5 h-fit sticky top-4">
            <h2 className="text-lg font-bold text-white mb-4">
              {editing ? `Edit: ${editing.name}` : 'Add Product'}
            </h2>
            <label className="block w-24 h-24 rounded-xl bg-[#2A2A2A] overflow-hidden mb-4 cursor-pointer relative">
              {form.imageUrl ? (
                <img src={mediaUrl(form.imageUrl)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-[#666] text-xs">
                  Image
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onImage(e.target.files?.[0])}
              />
            </label>
            {!editing ? (
              <select
                className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : null}
            <label className="text-xs text-[#888888]">Product Name</label>
            <input
              className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="text-xs text-[#888888]">Price</label>
            <input
              className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
            <label className="text-xs text-[#888888]">Category</label>
            <select
              className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-[#888888]">Description</label>
            <textarea
              className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label className="text-xs text-[#888888]">Stock qty</label>
            <input
              className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
              value={form.stockQty}
              onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
            />
            <label className="flex items-center justify-between py-3 border-b border-white/10 text-white text-sm">
              Available Now
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between py-3 text-white text-sm">
              Featured Item
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              />
            </label>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="flex-1 rounded-xl py-3 font-semibold bg-gradient-to-r from-[#3b82f6] to-[#8E2DE2] text-white"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-xl px-4 border border-white/15 text-white/70"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </MerchantShell>
  );
}
