import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { uploadCatalogImage } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const token = () => localStorage.getItem('movr_merchant_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

/** Products table — Product / Variant / Price / Status (+ Add product). */
export default function MerchantProductsPage() {
  const { formatMoney } = useLocalCurrency();
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    storeId: '',
    name: '',
    price: '',
    variant: '',
    description: '',
    categoryId: '',
    imageUrl: '',
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

  const resetForm = () => {
    setForm((f) => ({
      ...f,
      name: '',
      price: '',
      variant: '',
      description: '',
      categoryId: '',
      imageUrl: '',
    }));
    setEditingId(null);
    setShowAdd(false);
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setShowAdd(true);
    setForm({
      storeId: p.store_id,
      name: p.name || '',
      price: String(p.price ?? ''),
      variant: p.variant_label || p.variants?.[0]?.name || '',
      description: p.description || '',
      categoryId: p.category_id || '',
      imageUrl: p.image_url || '',
    });
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

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.patch(
          `${API}/merchant/products/${editingId}`,
          {
            name: form.name,
            price: Number(form.price),
            description: form.description || undefined,
            categoryId: form.categoryId || undefined,
            imageUrl: form.imageUrl || undefined,
          },
          { headers: headers() }
        );
        if (form.variant) {
          await axios.post(
            `${API}/merchant/products/${editingId}/variants`,
            { name: form.variant, priceDelta: 0 },
            { headers: headers() }
          ).catch(() => undefined);
        }
        toast.success('Product updated');
      } else {
        const res = await axios.post(
          `${API}/merchant/products`,
          {
            storeId: form.storeId,
            name: form.name,
            price: Number(form.price),
            description: form.description || undefined,
            categoryId: form.categoryId || undefined,
            imageUrl: form.imageUrl || undefined,
          },
          { headers: headers() }
        );
        if (form.variant) {
          await axios.post(
            `${API}/merchant/products/${res.data.data.id}/variants`,
            { name: form.variant, priceDelta: 0 },
            { headers: headers() }
          );
        }
        toast.success('Product added');
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message);
    }
  };

  const toggleStock = async (p: any) => {
    try {
      await axios.patch(
        `${API}/merchant/products/${p.id}`,
        { inStock: !p.in_stock },
        { headers: headers() }
      );
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  const remove = async (p: any) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try {
      await axios.delete(`${API}/merchant/products/${p.id}`, { headers: headers() });
      toast.success('Deleted');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  return (
    <MerchantShell activePath="/merchant/products">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-white">Products</h1>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowAdd(true);
          }}
          className="rounded-xl px-4 py-2.5 font-semibold bg-movr-gradient text-white"
        >
          + Add product
        </button>
      </div>

      {showAdd ? (
        <form
          onSubmit={create}
          className="grid md:grid-cols-3 gap-3 bg-[#1A1A1A] rounded-2xl p-4 mb-6"
        >
          <select
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.storeId}
            onChange={(e) => setForm({ ...form, storeId: e.target.value })}
            disabled={!!editingId}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">Category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <input
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            placeholder="Variant (e.g. Size M, Blue)"
            value={form.variant}
            onChange={(e) => setForm({ ...form, variant: e.target.value })}
          />
          <label className="rounded-xl border border-dashed border-white/20 px-3 py-2 text-center cursor-pointer text-sm text-[#888888]">
            {form.imageUrl ? 'Change image' : 'Upload image'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onImage(e.target.files?.[0])}
            />
          </label>
          <div className="md:col-span-3 flex gap-2">
            <button type="submit" className="rounded-xl bg-movr-gradient font-semibold py-2 px-6 text-white">
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/15 px-4 text-white/70"
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden">
        <div className="grid grid-cols-[40px_1.4fr_1.2fr_0.8fr_1fr] gap-2 px-2 py-3 text-sm text-[#888888] border-b border-white/10">
          <span />
          <span>Product</span>
          <span>Variant</span>
          <span>Price</span>
          <span>Status</span>
        </div>
        {products.length === 0 ? (
          <p className="px-2 py-8 text-[#888888] text-sm">No products yet. Add your first one.</p>
        ) : (
          products.map((p) => {
            const inStock = p.in_stock !== false;
            const variant =
              p.variant_label ||
              (Array.isArray(p.variants) && p.variants[0]?.name) ||
              '—';
            return (
              <div
                key={p.id}
                className="grid grid-cols-[40px_1.4fr_1.2fr_0.8fr_1fr] gap-2 px-2 py-4 border-b border-white/10 items-center text-sm"
              >
                <button
                  type="button"
                  aria-label="Select"
                  className="w-5 h-5 rounded-md bg-[#2A2A2A] border border-white/10"
                />
                <span className="font-medium text-white truncate">{p.name}</span>
                <span className="text-white/80">{variant}</span>
                <span className="text-white/80">{formatMoney(Number(p.price))}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStock(p)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      inStock
                        ? 'bg-emerald-950 text-emerald-400'
                        : 'bg-red-950 text-red-400'
                    }`}
                  >
                    {inStock ? 'In stock' : 'Out of stock'}
                  </button>
                  <button type="button" className="text-sky-400 text-xs" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button type="button" className="text-red-400 text-xs" onClick={() => remove(p)}>
                    Del
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </MerchantShell>
  );
}
