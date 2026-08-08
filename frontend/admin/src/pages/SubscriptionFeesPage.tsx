import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

const AUDIENCES = [
  { id: 'driver', label: 'Drivers (100% fare)' },
  { id: 'bike_listing', label: 'Bicycle / courier listing' },
  { id: 'rental_owner', label: 'Car rental owners' },
  { id: 'merchant', label: 'Merchant stores' },
];

const CATEGORIES = ['', 'bicycle', 'motorcycle', 'tricycle', 'sedan', 'suv', 'van', 'luxury'];

/** Admin — configure recurring subscription fees + intelligent assignment rules. */
export default function SubscriptionFeesPage() {
  const [audience, setAudience] = useState('driver');
  const [plans, setPlans] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'plans' | 'rules' | 'resolver'>('plans');

  const [planForm, setPlanForm] = useState({
    id: '',
    name: '',
    amount: '',
    currency: 'NGN',
    interval: 'monthly',
    audience: 'driver',
    vehicle_category: '',
    country_code: 'NG',
    city: '',
    size_tier: '',
    is_active: true,
  });

  const [ruleForm, setRuleForm] = useState({
    id: '',
    audience: 'driver',
    vehicle_category: '',
    country_code: 'NG',
    city: '',
    interval: 'monthly',
    plan_id: '',
    priority: '200',
    label: '',
    is_active: true,
  });

  const [resolveForm, setResolveForm] = useState({
    audience: 'driver',
    countryCode: 'NG',
    city: 'Lagos',
    vehicleCategory: 'sedan',
    userId: '',
  });
  const [resolved, setResolved] = useState<any>(null);

  const load = async () => {
    setError('');
    try {
      const [p, r, prev] = await Promise.all([
        axios.get(`${API}/admin/subscription-fees/plans`, {
          headers: headers(),
          params: { audience, all: 1 },
        }),
        axios.get(`${API}/admin/subscription-fees/rules`, {
          headers: headers(),
          params: { audience },
        }),
        axios.get(`${API}/admin/subscription-fees/preview`, { headers: headers() }),
      ]);
      setPlans(p.data.data || []);
      setRules(r.data.data || []);
      setPreview((prev.data.data || []).filter((x: any) => x.audience === audience));
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    }
  };

  useEffect(() => {
    load();
    setPlanForm((f) => ({ ...f, audience }));
    setRuleForm((f) => ({ ...f, audience }));
    setResolveForm((f) => ({ ...f, audience }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  const planOptions = useMemo(
    () => plans.map((p) => ({ id: p.id, label: `${p.id} · ${p.amount} ${p.currency}` })),
    [plans]
  );

  const savePlan = async () => {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      await axios.put(
        `${API}/admin/subscription-fees/plans`,
        {
          ...planForm,
          amount: Number(planForm.amount),
          vehicle_category: planForm.vehicle_category || null,
          city: planForm.city || null,
          size_tier: planForm.size_tier || null,
          id: planForm.id || undefined,
        },
        { headers: headers() }
      );
      setMsg('Plan saved');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveRule = async () => {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      await axios.put(
        `${API}/admin/subscription-fees/rules`,
        {
          ...ruleForm,
          priority: Number(ruleForm.priority),
          vehicle_category: ruleForm.vehicle_category || null,
          city: ruleForm.city || null,
          id: ruleForm.id || undefined,
        },
        { headers: headers() }
      );
      setMsg('Rule saved');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const runResolve = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/admin/subscription-fees/resolve`,
        {
          audience: resolveForm.audience,
          countryCode: resolveForm.countryCode || null,
          city: resolveForm.city || null,
          vehicleCategory: resolveForm.vehicleCategory || null,
          userId: resolveForm.userId || undefined,
        },
        { headers: headers() }
      );
      setResolved(res.data.data);
    } catch (e: any) {
      setResolved(null);
      setError(e?.response?.data?.message || e.message || 'Resolve failed');
    } finally {
      setBusy(false);
    }
  };

  const editPlan = (p: any) => {
    setPlanForm({
      id: p.id,
      name: p.name || '',
      amount: String(p.amount ?? ''),
      currency: p.currency || 'NGN',
      interval: p.interval || 'monthly',
      audience: p.audience || audience,
      vehicle_category: p.vehicle_category || '',
      country_code: p.country_code || '',
      city: p.city || '',
      size_tier: p.size_tier || '',
      is_active: p.is_active !== false,
    });
    setTab('plans');
  };

  const editRule = (r: any) => {
    setRuleForm({
      id: r.id,
      audience: r.audience || audience,
      vehicle_category: r.vehicle_category || '',
      country_code: r.country_code || '',
      city: r.city || '',
      interval: r.interval || 'monthly',
      plan_id: r.plan_id || '',
      priority: String(r.priority ?? 100),
      label: r.label || '',
      is_active: r.is_active !== false,
    });
    setTab('rules');
  };

  return (
    <AdminShell activeLabel="Subscription fees">
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Subscription fees</h1>
          <p style={styles.sub}>
            Drivers keep 100% of every fare. MOVR bills recurring subscriptions by vehicle size,
            country, and city — plus bike listings, rental owners, and merchant stores.
          </p>
        </div>
      </div>

      <div style={styles.audienceRow}>
        {AUDIENCES.map((a) => (
          <button
            key={a.id}
            type="button"
            style={{ ...styles.chip, ...(audience === a.id ? styles.chipOn : {}) }}
            onClick={() => setAudience(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div style={styles.tabs}>
        {([
          ['plans', 'Plans'],
          ['rules', 'Assignment rules'],
          ['resolver', 'Intelligent resolver'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            style={{ ...styles.tab, ...(tab === k ? styles.tabOn : {}) }}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}
      {msg ? <p style={{ color: 'var(--success)' }}>{msg}</p> : null}

      {tab === 'plans' ? (
        <div style={styles.grid}>
          <div style={styles.card}>
            <h2 style={styles.h2}>{planForm.id ? 'Edit plan' : 'Create / update plan'}</h2>
            <div style={styles.form}>
              <label>
                ID
                <input
                  style={styles.input}
                  value={planForm.id}
                  onChange={(e) => setPlanForm({ ...planForm, id: e.target.value })}
                  placeholder="auto if empty"
                />
              </label>
              <label>
                Name
                <input
                  style={styles.input}
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                />
              </label>
              <label>
                Amount
                <input
                  style={styles.input}
                  value={planForm.amount}
                  onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })}
                />
              </label>
              <label>
                Currency
                <input
                  style={styles.input}
                  value={planForm.currency}
                  onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                />
              </label>
              <label>
                Interval
                <select
                  style={styles.input}
                  value={planForm.interval}
                  onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value })}
                >
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                </select>
              </label>
              <label>
                Vehicle category
                <select
                  style={styles.input}
                  value={planForm.vehicle_category}
                  onChange={(e) => setPlanForm({ ...planForm, vehicle_category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c || 'any'} value={c}>
                      {c || '(any)'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Country
                <input
                  style={styles.input}
                  value={planForm.country_code}
                  onChange={(e) => setPlanForm({ ...planForm, country_code: e.target.value })}
                />
              </label>
              <label>
                City (optional)
                <input
                  style={styles.input}
                  value={planForm.city}
                  onChange={(e) => setPlanForm({ ...planForm, city: e.target.value })}
                />
              </label>
              <button type="button" style={adminBtn.primary} disabled={busy} onClick={savePlan}>
                {busy ? 'Saving…' : 'Save plan'}
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>Plans ({plans.length})</h2>
            <div style={styles.table}>
              {plans.map((p) => (
                <button key={p.id} type="button" style={styles.rowBtn} onClick={() => editPlan(p)}>
                  <div>
                    <strong>{p.headline || p.name}</strong>
                    <div style={styles.muted}>
                      {p.id} · {p.vehicle_category || 'any'} · {p.country_code || 'any'}
                      {p.city ? ` · ${p.city}` : ''}
                    </div>
                  </div>
                  <div style={styles.amount}>
                    {formatCurrency(Number(p.amount), p.currency)}
                    <span style={styles.muted}> / {p.interval || 'monthly'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'rules' ? (
        <div style={styles.grid}>
          <div style={styles.card}>
            <h2 style={styles.h2}>{ruleForm.id ? 'Edit rule' : 'Add assignment rule'}</h2>
            <p style={styles.muted}>
              Higher priority + more specific matches (city → category → country) win. Leave category
              empty for country-wide defaults.
            </p>
            <div style={styles.form}>
              <label>
                Label
                <input
                  style={styles.input}
                  value={ruleForm.label}
                  onChange={(e) => setRuleForm({ ...ruleForm, label: e.target.value })}
                />
              </label>
              <label>
                Plan
                <select
                  style={styles.input}
                  value={ruleForm.plan_id}
                  onChange={(e) => setRuleForm({ ...ruleForm, plan_id: e.target.value })}
                >
                  <option value="">Select plan</option>
                  {planOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vehicle category
                <select
                  style={styles.input}
                  value={ruleForm.vehicle_category}
                  onChange={(e) => setRuleForm({ ...ruleForm, vehicle_category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c || 'any'} value={c}>
                      {c || '(any)'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Country
                <input
                  style={styles.input}
                  value={ruleForm.country_code}
                  onChange={(e) => setRuleForm({ ...ruleForm, country_code: e.target.value })}
                />
              </label>
              <label>
                City
                <input
                  style={styles.input}
                  value={ruleForm.city}
                  onChange={(e) => setRuleForm({ ...ruleForm, city: e.target.value })}
                />
              </label>
              <label>
                Priority
                <input
                  style={styles.input}
                  value={ruleForm.priority}
                  onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                />
              </label>
              <button type="button" style={adminBtn.primary} disabled={busy} onClick={saveRule}>
                {busy ? 'Saving…' : 'Save rule'}
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>Rules ({rules.length})</h2>
            <div style={styles.table}>
              {rules.map((r) => (
                <button key={r.id} type="button" style={styles.rowBtn} onClick={() => editRule(r)}>
                  <div>
                    <strong>{r.label || r.plan_id}</strong>
                    <div style={styles.muted}>
                      pri {r.priority} · {r.vehicle_category || 'any'} · {r.country_code || 'any'}
                      {r.city ? ` · ${r.city}` : ''} → {r.plan_id}
                    </div>
                  </div>
                  <div style={styles.amount}>
                    {formatCurrency(Number(r.plan_amount || 0), r.plan_currency || 'NGN')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'resolver' ? (
        <div style={styles.grid}>
          <div style={styles.card}>
            <h2 style={styles.h2}>Test intelligent assignment</h2>
            <div style={styles.form}>
              <label>
                Country
                <input
                  style={styles.input}
                  value={resolveForm.countryCode}
                  onChange={(e) => setResolveForm({ ...resolveForm, countryCode: e.target.value })}
                />
              </label>
              <label>
                City
                <input
                  style={styles.input}
                  value={resolveForm.city}
                  onChange={(e) => setResolveForm({ ...resolveForm, city: e.target.value })}
                />
              </label>
              <label>
                Vehicle category
                <select
                  style={styles.input}
                  value={resolveForm.vehicleCategory}
                  onChange={(e) =>
                    setResolveForm({ ...resolveForm, vehicleCategory: e.target.value })
                  }
                >
                  {CATEGORIES.filter(Boolean).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Or user id (auto-infer vehicle / city)
                <input
                  style={styles.input}
                  value={resolveForm.userId}
                  onChange={(e) => setResolveForm({ ...resolveForm, userId: e.target.value })}
                  placeholder="uuid"
                />
              </label>
              <button type="button" style={adminBtn.primary} disabled={busy} onClick={runResolve}>
                {busy ? 'Resolving…' : 'Resolve fee'}
              </button>
            </div>
            {resolved ? (
              <div style={styles.result}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {formatCurrency(resolved.amount, resolved.currency)} / {resolved.interval}
                </p>
                <p style={styles.muted}>{resolved.explanation}</p>
                <p style={styles.muted}>Plan: {resolved.plan?.id}</p>
              </div>
            ) : null}
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>Matrix preview ({preview.length})</h2>
            <div style={styles.table}>
              {preview.slice(0, 40).map((row, i) => (
                <div key={`${row.planId}-${i}`} style={styles.previewRow}>
                  <span>
                    {row.country}
                    {row.city ? `/${row.city}` : ''} · {row.vehicleCategory || 'default'}
                  </span>
                  <span style={styles.amount}>
                    {formatCurrency(row.amount, row.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 16 },
  h1: { margin: 0, fontSize: 28, fontWeight: 700 },
  h2: { margin: '0 0 12px', fontSize: 16, fontWeight: 700 },
  sub: { color: 'var(--text-secondary)', marginTop: 8, maxWidth: 720 },
  audienceRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 999,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  chipOn: {
    background: 'rgba(142,45,226,0.25)',
    color: 'var(--brand-white)',
    borderColor: 'transparent',
  },
  tabs: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  tab: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  tabOn: { background: 'rgba(142,45,226,0.25)', color: 'var(--brand-white)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(0, 1.1fr)',
    gap: 16,
    alignItems: 'start',
  },
  card: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
  },
  form: { display: 'grid', gap: 10 },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 4,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    boxSizing: 'border-box' as const,
  },
  table: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflow: 'auto' },
  rowBtn: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    textAlign: 'left' as const,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'inherit',
    borderRadius: 10,
    padding: 12,
    cursor: 'pointer',
  },
  previewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
  },
  amount: { fontWeight: 700, whiteSpace: 'nowrap' as const },
  muted: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 },
  result: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    background: 'rgba(142,45,226,0.15)',
    border: '1px solid var(--border)',
  },
};
