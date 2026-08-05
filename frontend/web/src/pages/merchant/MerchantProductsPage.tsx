import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { mediaUrl, uploadCatalogImage } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const token = () => localStorage.getItem('movr_merchant_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

/** Products CRUD — category picker, image, stock, edit/delete. */
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
      variant: p.variants?.[0]?.name || '',
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
        <h1 className="text-3xl font-bold">Products</h1>
        <button
          onClick={() => {
            resetForm();
            setShowAdd(true);
          }}
          className="rounded-xl px-4 py-2.5 font-semibold bg-movr-gradient"
        >
          + Add product
        </button>
      </div>

      {showAdd ? (
        <form
          onSubmit={create}
          className="grid md:grid-cols-3 gap-3 bg-surface-elevated border border-border rounded-2xl p-4 mb-6"
        >
          <select
            className="rounded-xl bg-surface border border-border px-3 py-2"
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
            className="rounded-xl bg-surface border border-border px-3 py-2"
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
            className="rounded-xl bg-surface border border-border px-3 py-2"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="rounded-xl bg-surface border border-border px-3 py-2"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          {!editingId ? (
            <input
              className="rounded-xl bg-surface border border-border px-3 py-2"
              placeholder="Variant (optional)"
              value={form.variant}
              onChange={(e) => setForm({ ...form, variant: e.target.value })}
            />
          ) : (
            <div />
          )}
          <label className="rounded-xl border border-dashed border-border px-3 py-2 text-center cursor-pointer text-sm text-text-secondary">
            {form.imageUrl ? 'Change image' : 'Upload image'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onImage(e.target.files?.[0])}
            />
          </label>
          <textarea
            className="md:col-span-2 rounded-xl bg-surface border border-border px-3 py-2 min-h-[72px]"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl bg-movr-gradient font-semibold py-2">
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-border px-4"
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>
          {form.imageUrl ? (
            <img
              src={mediaUrl(form.imageUrl)}
              alt=""
              className="md:col-span-3 h-28 w-full object-cover rounded-xl"
            />
          ) : null}
        </form>
      ) : null}

      <div className="rounded-2xl border border-border overflow-hidden bg-surface">
        <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.9fr] gap-2 px-4 py-3 text-sm text-text-secondary">
          <span>Product</span>
          <span>Category</span>
          <span>Price</span>
          <span>Status</span>
          <span />
        </div>
        {products.length === 0 ? (
          <p className="px-4 py-8 text-text-secondary text-sm">No products yet. Add your first one.</p>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.9fr] gap-2 px-4 py-4 border-t border-border items-center text-sm"
            >
              <span className="font-medium flex items-center gap-2 min-w-0">
                {p.image_url ? (
                  <img
                    src={mediaUrl(p.image_url)}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-lg bg-border shrink-0" />
                )}
                <span className="truncate">{p.name}</span>
              </span>
              <span className="text-text-secondary">{p.category_name || '—'}</span>
              <span className="text-text-secondary">{formatMoney(Number(p.price))}</span>
              <button type="button" onClick={() => toggleStock(p)}>
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                    p.in_stock !== false
                      ? 'bg-movr-green/30 text-success'
                      : 'bg-error/20 text-error'
                  }`}
                >
                  {p.in_stock !== false ? 'In stock' : 'Out of stock'}
                </span>
              </button>
              <div className="flex gap-3 justify-end">
                <button type="button" className="text-motion-blue" onClick={() => startEdit(p)}>
                  Edit
                </button>
                <button type="button" className="text-error" onClick={() => remove(p)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </MerchantShell>
  );
}
