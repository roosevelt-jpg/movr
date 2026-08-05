import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Products table — checkboxes, variants, stock badges, add product. */
export default function MerchantProductsPage() {
  const { formatMoney } = useLocalCurrency();
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ storeId: '', name: '', price: '', variant: '' });

  const load = async () => {
    const [p, s] = await Promise.all([
      axios.get(`${API}/merchant/products`, { headers: headers() }),
      axios.get(`${API}/merchant/stores`, { headers: headers() }),
    ]);
    const rows = p.data.data || [];
    setProducts(rows);
    setStores(s.data.data || []);
    if (s.data.data?.[0] && !form.storeId) setForm((f) => ({ ...f, storeId: s.data.data[0].id }));
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await axios.post(
      `${API}/merchant/products`,
      { storeId: form.storeId, name: form.name, price: Number(form.price) },
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
    setForm((f) => ({ ...f, name: '', price: '', variant: '' }));
    setShowAdd(false);
    await load();
  };

  const toggleStock = async (p: any) => {
    try {
      await axios.patch(
        `${API}/merchant/products/${p.id}`,
        { inStock: !p.in_stock },
        { headers: headers() }
      );
      await load();
    } catch {
      setProducts((prev) =>
        prev.map((row) => (row.id === p.id ? { ...row, in_stock: !row.in_stock } : row))
      );
    }
  };

  return (
    <MerchantShell activePath="/merchant/products">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-xl px-4 py-2.5 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
        >
          + Add product
        </button>
      </div>

      {showAdd ? (
        <form
          onSubmit={create}
          className="grid md:grid-cols-5 gap-3 bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 mb-6"
        >
          <select
            className="rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2"
            value={form.storeId}
            onChange={(e) => setForm({ ...form, storeId: e.target.value })}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2"
            placeholder="Variant"
            value={form.variant}
            onChange={(e) => setForm({ ...form, variant: e.target.value })}
          />
          <input
            className="rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <button className="rounded-xl bg-gradient-to-r from-[#6A00FF] to-[#0055FF] font-semibold">
            Save
          </button>
        </form>
      ) : null}

      <div className="rounded-2xl border border-[#2A2A2A] overflow-hidden bg-[#0A0A0A]">
        <div className="grid grid-cols-[40px_1.4fr_1.2fr_0.8fr_0.9fr] gap-2 px-4 py-3 text-sm text-[#888]">
          <span />
          <span>Product</span>
          <span>Variant</span>
          <span>Price</span>
          <span>Status</span>
        </div>
        {products.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[40px_1.4fr_1.2fr_0.8fr_0.9fr] gap-2 px-4 py-4 border-t border-[#1A1A1A] items-center text-sm"
          >
            <input
              type="checkbox"
              checked={!!selected[p.id]}
              onChange={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
              className="accent-[#6A00FF]"
            />
            <span className="font-medium">{p.name}</span>
            <span className="text-[#A0A0A0]">
              {p.variant || p.variants?.[0]?.name || '—'}
            </span>
            <span className="text-[#A0A0A0]">{formatMoney(Number(p.price))}</span>
            <button onClick={() => toggleStock(p)}>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                  p.in_stock !== false
                    ? 'bg-[#3F7048]/30 text-[#9BE0A8]'
                    : 'bg-[#FF3B5C]/20 text-[#FF8FA0]'
                }`}
              >
                {p.in_stock !== false ? 'In stock' : 'Out of stock'}
              </span>
            </button>
          </div>
        ))}
      </div>
    </MerchantShell>
  );
}
