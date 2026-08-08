import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import AdminOpsNav from '../components/AdminOpsNav';
import { API } from '../lib/apiBase';
import { friendlyApiError } from '../lib/apiError';

interface Integration {
  id: string;
  key: string;
  display_name: string;
  category: string;
  status: string;
  is_enabled: boolean;
  last_checked_at?: string;
  last_error?: string;
}

/** Integration catalog sections — cards still render any DB extras under OTHER. */
const SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: 'PAYMENTS',
    keys: ['paystack', 'flutterwave', 'stripe'],
  },
  {
    title: 'MESSAGING',
    keys: ['twilio', 'whatsapp', 'telegram_bot', 'sendgrid', 'africastalking_ussd'],
  },
  {
    title: 'AI & VOICE / MAPS',
    keys: ['openai', 'google_maps', 'mapbox', 'openweathermap'],
  },
  {
    title: 'IDENTITY',
    keys: ['nia_ghana_card', 'dvla_ghana'],
  },
  {
    title: 'INFRASTRUCTURE',
    keys: ['aws_s3', 'sentry'],
  },
];

const SUBTITLE: Record<string, string> = {
  paystack: 'Payments',
  flutterwave: 'Payments',
  stripe: 'Payments',
  twilio: 'SMS / Voice',
  whatsapp: 'WhatsApp Business',
  telegram_bot: 'Telegram',
  sendgrid: 'Transactional email',
  africastalking_ussd: 'USSD',
  openai: 'AI & voice',
  google_maps: 'Maps & places · powers zone pickers',
  mapbox: 'Maps',
  openweathermap: 'Pricing weather signals',
  nia_ghana_card: 'Identity verification',
  dvla_ghana: 'Identity verification',
  aws_s3: 'Asset storage',
  sentry: 'Error monitoring',
};

const CREDENTIAL_FIELDS: Record<string, { key: string; label: string }[]> = {
  paystack: [
    { key: 'secret_key', label: 'secret_key' },
    { key: 'public_key', label: 'public_key' },
  ],
  flutterwave: [
    { key: 'secret_key', label: 'secret_key' },
    { key: 'public_key', label: 'public_key' },
    { key: 'secret_hash', label: 'secret_hash (webhooks)' },
  ],
  stripe: [
    { key: 'secret_key', label: 'secret_key' },
    { key: 'public_key', label: 'publishable_key' },
    { key: 'webhook_secret', label: 'webhook_secret' },
  ],
  twilio: [
    { key: 'account_sid', label: 'account_sid' },
    { key: 'auth_token', label: 'auth_token' },
  ],
  whatsapp: [
    { key: 'account_sid', label: 'Twilio account_sid' },
    { key: 'auth_token', label: 'Twilio auth_token' },
    { key: 'from_number', label: 'WhatsApp from number' },
  ],
  telegram_bot: [{ key: 'bot_token', label: 'bot_token' }],
  sendgrid: [{ key: 'api_key', label: 'api_key' }],
  openai: [
    { key: 'api_key', label: 'api_key' },
    { key: 'model', label: 'model (optional)' },
  ],
  google_maps: [{ key: 'api_key', label: 'api_key (Geocoding + Places)' }],
  mapbox: [{ key: 'access_token', label: 'access_token' }],
  openweathermap: [{ key: 'api_key', label: 'api_key' }],
  africastalking_ussd: [
    { key: 'api_key', label: 'api_key' },
    { key: 'username', label: 'username' },
  ],
  nia_ghana_card: [
    { key: 'api_key', label: 'api_key' },
    { key: 'client_id', label: 'client_id' },
  ],
  dvla_ghana: [
    { key: 'api_key', label: 'api_key' },
    { key: 'client_id', label: 'client_id' },
  ],
  aws_s3: [
    { key: 'access_key_id', label: 'access_key_id' },
    { key: 'secret_access_key', label: 'secret_access_key' },
  ],
  sentry: [{ key: 'dsn', label: 'dsn' }],
};

function statusBadge(status: string) {
  const s = status.toLowerCase().replace(/\s+/g, '_');
  if (s.includes('connected') || s === 'active') {
    return { background: 'rgba(63,112,72,0.35)', color: 'var(--success)', label: 'Connected' };
  }
  if (s.includes('error') || s.includes('fail')) {
    return { background: 'rgba(225,29,72,0.18)', color: 'var(--error)', label: 'Error' };
  }
  if (s.includes('configur') && !s.includes('not')) {
    return { background: 'rgba(255,184,0,0.2)', color: 'var(--warning)', label: 'Configured' };
  }
  return { background: 'rgba(255,59,92,0.2)', color: 'var(--error)', label: 'Not configured' };
}

/** Integrations hub — categorized cards matching admin mockup. */
export default function IntegrationsHubPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const token = localStorage.getItem('movr_admin_token') || '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    const res = await axios.get(`${API}/admin/integrations`, { headers });
    setItems(res.data.data || []);
  };

  useEffect(() => {
    load()
      .then(() => setError(''))
      .catch((e) => {
        setItems([]);
        setError(friendlyApiError(e, 'Failed to load integrations'));
      });
  }, []);

  const byKey = useMemo(() => {
    const map: Record<string, Integration> = {};
    for (const item of items) map[item.key] = item;
    return map;
  }, [items]);

  const other = useMemo(() => {
    const shown = new Set(SECTIONS.flatMap((s) => s.keys));
    return items.filter((i) => !shown.has(i.key));
  }, [items]);

  const open = async (key: string) => {
    setSelected(key);
    try {
      const res = await axios.get(`${API}/admin/integrations/${key}`, { headers });
      setDetail(res.data.data);
    } catch {
      setDetail({ display_name: key, credentials: [] });
    }
    setCreds({});
  };

  const save = async () => {
    if (!selected) return;
    try {
      await axios.put(
        `${API}/admin/integrations/${selected}/credentials`,
        { credentials: creds },
        { headers }
      );
      setMessage('Credentials saved');
      setError('');
      await open(selected);
      await load();
    } catch (e: any) {
      setError(friendlyApiError(e, 'Save failed'));
    }
  };

  const test = async () => {
    if (!selected) return;
    try {
      const res = await axios.post(`${API}/admin/integrations/${selected}/test`, {}, { headers });
      const st = res.data?.data?.status || 'unknown';
      const err = res.data?.data?.lastError;
      setMessage(err ? `Test: ${st} — ${err}` : `Test: ${st}`);
      setError('');
      await load();
      await open(selected);
    } catch (e: any) {
      setError(friendlyApiError(e, 'Test failed'));
    }
  };

  const renderCard = (item: Integration) => {
    const badge = statusBadge(item.status);
    return (
      <div key={item.key} style={styles.card}>
        <div style={styles.cardTop}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={styles.cardTitle}>{item.display_name}</strong>
            <p style={styles.cardCat}>{SUBTITLE[item.key] || item.category}</p>
          </div>
          <span style={{ ...styles.badge, background: badge.background, color: badge.color }}>
            {badge.label}
          </span>
        </div>
        {item.last_error && (item.status === 'error' || item.status === 'not_configured') ? (
          <p style={styles.cardError} title={item.last_error}>
            {item.last_error}
          </p>
        ) : null}
        <button type="button" style={styles.link} onClick={() => open(item.key)}>
          Configure →
        </button>
      </div>
    );
  };

  return (
    <AdminShell activeLabel="Integrations" hidePageTitle>
      <AdminOpsNav />
      <h1 style={styles.pageTitle}>Integrations</h1>
      <p style={styles.pageSub}>
        Google Maps & Places powers zone pickers on Pricing and Dispatcher. OpenWeatherMap feeds weather
        surge — run Test connection after saving keys so badges reflect real status.
      </p>
      {message ? <p style={styles.msg}>{message}</p> : null}
      {error ? (
        <div role="alert" style={styles.alert}>
          <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 13 }}>{error}</p>
        </div>
      ) : null}

      {items.length === 0 && !error ? (
        <p style={{ color: 'var(--text-secondary)' }}>No integrations configured</p>
      ) : null}

      {SECTIONS.map((section) => {
        const cards = section.keys.map((k) => byKey[k]).filter(Boolean);
        if (!cards.length) return null;
        return (
          <section key={section.title} style={styles.section}>
            <p style={styles.cat}>{section.title}</p>
            <div style={styles.grid}>{cards.map(renderCard)}</div>
          </section>
        );
      })}

      {other.length ? (
        <section style={styles.section}>
          <p style={styles.cat}>OTHER</p>
          <div style={styles.grid}>{other.map(renderCard)}</div>
        </section>
      ) : null}

      {selected && detail ? (
        <div style={styles.panel}>
          <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>{detail.display_name}</h3>
          <p style={styles.cardCat}>
            Paste API keys only — runtime reads the Integrations Hub (env is fallback). Secrets are
            masked after save.
          </p>
          {detail.last_error ? (
            <p style={{ ...styles.cardError, marginBottom: 8 }}>Last error: {detail.last_error}</p>
          ) : null}
          {(CREDENTIAL_FIELDS[selected] || [
            { key: 'secret_key', label: 'secret_key / api_key' },
            { key: 'public_key', label: 'public_key' },
          ]).map((field) => (
            <label key={field.key} style={styles.label}>
              {field.label}
              <input
                style={styles.input}
                type="password"
                autoComplete="off"
                value={creds[field.key] || ''}
                onChange={(e) => setCreds({ ...creds, [field.key]: e.target.value })}
                placeholder={
                  detail.credentials?.find((c: any) => c.key === field.key)?.preview
                    ? '•••• saved — enter to rotate'
                    : 'Paste key'
                }
              />
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" style={styles.primary} onClick={save}>
              Save
            </button>
            <button type="button" style={styles.primary} onClick={test}>
              Test connection
            </button>
            <button type="button" style={styles.ghost} onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: { margin: '0 0 6px', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' },
  pageSub: {
    margin: '0 0 16px',
    color: 'var(--text-secondary)',
    fontSize: 14,
    maxWidth: 720,
    lineHeight: 1.45,
  },
  msg: { color: 'var(--electric-violet)' },
  alert: {
    marginBottom: 12,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(225,29,72,0.35)',
    background: 'rgba(225,29,72,0.08)',
  },
  section: { marginTop: 28 },
  cat: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 12,
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
  },
  card: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    minHeight: 120,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border)',
    gap: 8,
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, color: 'var(--text-primary)' },
  cardCat: { color: 'var(--text-secondary)', fontSize: 13, marginTop: 6, marginBottom: 0 },
  cardError: {
    margin: 0,
    fontSize: 11,
    color: 'var(--error)',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as any,
    overflow: 'hidden',
  },
  badge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    height: 'fit-content',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  link: {
    marginTop: 'auto',
    background: 'transparent',
    border: 'none',
    color: 'var(--motion-blue)',
    padding: 0,
    textAlign: 'left',
    cursor: 'pointer',
    fontWeight: 600,
  },
  panel: {
    marginTop: 24,
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 20,
    border: '1px solid var(--border)',
  },
  label: { display: 'block', marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 6,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    boxSizing: 'border-box',
  },
  primary: {
    background: 'var(--movr-gradient)',
    color: 'var(--brand-white)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
  },
};
