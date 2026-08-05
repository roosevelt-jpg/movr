import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AdminShell from '../layouts/AdminShell';
import DataTable, { DataTableColumn } from '../components/DataTable';
import FilterBar from '../components/FilterBar';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}`,
});

async function uploadImage(file: File) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers: headers(),
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || 'Upload failed');
  return json.data.url as string;
}

/** Admin marketplace catalog — categories + store banners. */
export default function MarketplaceCatalogPage() {
  const [tab, setTab] = useState<'categories' | 'banners'>('categories');
  const [categories, setCategories] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState('');
  const [banners, setBanners] = useState<any[]>([]);
  const [catForm, setCatForm] = useState({ name: '', slug: '', sortOrder: '0' });

  const loadCategories = async () => {
    const res = await axios.get(`${API}/admin/marketplace/categories`, { headers: headers() });
    setCategories(res.data.data || []);
  };

  const loadStores = async () => {
    const res = await axios.get(`${API}/admin/marketplace/stores`, { headers: headers() });
    const rows = res.data.data || [];
    setStores(rows);
    if (rows[0] && !storeId) setStoreId(rows[0].id);
  };

  const loadBanners = async (id = storeId) => {
    if (!id) return;
    const res = await axios.get(`${API}/admin/marketplace/stores/${id}/banners`, {
      headers: headers(),
    });
    setBanners(res.data.data || []);
  };

  useEffect(() => {
    loadCategories().catch((e) => toast.error(e.message));
    loadStores().catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    if (tab === 'banners' && storeId) {
      loadBanners(storeId).catch((e) => toast.error(e.message));
    }
  }, [tab, storeId]);

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API}/admin/marketplace/categories`,
        {
          name: catForm.name,
          slug: catForm.slug || catForm.name.toLowerCase().replace(/\s+/g, '-'),
          sortOrder: Number(catForm.sortOrder) || 0,
        },
        { headers: headers() }
      );
      setCatForm({ name: '', slug: '', sortOrder: '0' });
      toast.success('Category created');
      await loadCategories();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message);
    }
  };

  const toggleCategory = async (c: any) => {
    await axios.patch(
      `${API}/admin/marketplace/categories/${c.id}`,
      { isActive: !c.is_active },
      { headers: headers() }
    );
    await loadCategories();
  };

  const addBanner = async (file?: File | null) => {
    if (!file || !storeId) return;
    try {
      const imageUrl = await uploadImage(file);
      await axios.post(
        `${API}/admin/marketplace/stores/${storeId}/banners`,
        { imageUrl, sortOrder: banners.length },
        { headers: headers() }
      );
      toast.success('Banner added');
      await loadBanners();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeBanner = async (b: any) => {
    await axios.delete(`${API}/admin/marketplace/stores/${storeId}/banners/${b.id}`, {
      headers: headers(),
    });
    await loadBanners();
  };

  const catColumns: DataTableColumn<any>[] = [
    { key: 'name', header: 'Name' },
    { key: 'slug', header: 'Slug' },
    { key: 'sort_order', header: 'Order' },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (c.is_active ? 'Active' : 'Off'),
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <button type="button" className="text-motion-blue" onClick={() => toggleCategory(c)}>
          Toggle
        </button>
      ),
    },
  ];

  const bannerColumns: DataTableColumn<any>[] = [
    {
      key: 'image',
      header: 'Image',
      render: (b) => (
        <img src={b.image_url} alt="" className="h-10 w-20 object-cover rounded" />
      ),
    },
    { key: 'title', header: 'Title', accessor: (b) => b.title || '—' },
    {
      key: 'active',
      header: 'Active',
      accessor: (b) => (b.is_active ? 'Yes' : 'No'),
    },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <button type="button" className="text-error" onClick={() => removeBanner(b)}>
          Delete
        </button>
      ),
    },
  ];

  return (
    <AdminShell activeLabel="Marketplace">
      <h1 className="text-2xl font-bold mb-admin-4">Marketplace catalog</h1>

      <div className="flex gap-admin-3 mb-admin-4">
        <button
          type="button"
          className={`px-admin-3 py-admin-2 rounded-md ${
            tab === 'categories' ? 'bg-motion-blue text-pure-white' : 'bg-surface-elevated'
          }`}
          onClick={() => setTab('categories')}
        >
          Categories
        </button>
        <button
          type="button"
          className={`px-admin-3 py-admin-2 rounded-md ${
            tab === 'banners' ? 'bg-motion-blue text-pure-white' : 'bg-surface-elevated'
          }`}
          onClick={() => setTab('banners')}
        >
          Store banners
        </button>
      </div>

      {tab === 'categories' ? (
        <>
          <form
            onSubmit={createCategory}
            className="flex flex-wrap gap-admin-2 mb-admin-4 items-end"
          >
            <input
              className="rounded-md bg-surface-elevated border border-border px-admin-3 py-admin-2"
              placeholder="Name"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              required
            />
            <input
              className="rounded-md bg-surface-elevated border border-border px-admin-3 py-admin-2"
              placeholder="slug"
              value={catForm.slug}
              onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
            />
            <input
              className="rounded-md bg-surface-elevated border border-border px-admin-3 py-admin-2 w-24"
              placeholder="Order"
              value={catForm.sortOrder}
              onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value })}
            />
            <button type="submit" className="rounded-md bg-motion-blue px-admin-3 py-admin-2">
              Add category
            </button>
          </form>
          <DataTable columns={catColumns} rows={categories} emptyMessage="No categories" />
        </>
      ) : (
        <>
          <FilterBar
            filters={[
              {
                key: 'store',
                label: 'Store',
                value: storeId,
                options: stores.map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.merchant_name ? ` · ${s.merchant_name}` : ''}`,
                })),
                onChange: setStoreId,
              },
            ]}
            actions={
              <label className="rounded-md bg-motion-blue px-admin-3 py-admin-2 cursor-pointer text-admin-sm">
                Upload banner
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => addBanner(e.target.files?.[0])}
                />
              </label>
            }
          />
          <DataTable columns={bannerColumns} rows={banners} emptyMessage="No banners for this store" />
        </>
      )}
    </AdminShell>
  );
}
