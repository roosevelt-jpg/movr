import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/**
 * Trust Ops — SOS, disputes/refunds, agent confirm codes, reliability credits, receipts.
 * Complements Dispatcher SOS & Disputes tab with a dedicated finance/trust surface.
 */
export default function TrustOpsPage() {
  const [promise, setPromise] = useState<any>(null);
  const [sos, setSos] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [reliability, setReliability] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [retryBusy, setRetryBusy] = useState(false);

  const load = async () => {
    try {
      const [p, s, d, r, rec] = await Promise.all([
        axios.get(`${API}/trust/promise`).catch(() => null),
        axios.get(`${API}/admin/trust/sos`, { headers: headers() }),
        axios.get(`${API}/admin/trust/disputes`, { headers: headers() }),
        axios.get(`${API}/admin/trust/reliability`, { headers: headers() }),
        axios.get(`${API}/admin/trust/receipts`, { headers: headers() }),
      ]);
      setPromise(p?.data?.data || null);
      setSos(s.data?.data || []);
      setDisputes(d.data?.data || []);
      setReliability(r.data?.data || []);
      setReceipts(rec.data?.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load trust ops');
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, []);

  const resolveSos = async (id: string) => {
    const note = window.prompt('Resolution notes') || 'Resolved from Trust Ops';
    await axios.patch(`${API}/admin/trust/sos/${id}/resolve`, { note }, { headers: headers() });
    setMsg('SOS resolved');
    await load();
  };

  const patchDispute = async (id: string, status: string) => {
    let refundAmount = 0;
    if (status === 'resolved') {
      const raw = window.prompt('Refund amount (0 for none)', '0');
      if (raw == null) return;
      refundAmount = Number(raw) || 0;
    }
    await axios.patch(
      `${API}/admin/trust/disputes/${id}`,
      { status, refundAmount, opsNote: `Trust Ops · ${status}` },
      { headers: headers() }
    );
    setMsg(refundAmount ? `Dispute resolved · refund ${refundAmount}` : `Dispute ${status}`);
    await load();
  };

  const confirmCode = async () => {
    try {
      const res = await axios.post(
        `${API}/admin/trust/cash-agent/confirm`,
        { code },
        { headers: headers() }
      );
      const d = res.data?.data;
      setMsg(
        d?.credited
          ? 'Deposit credited'
          : d?.collected
            ? 'Pickup confirmed'
            : d?.alreadyCompleted
              ? 'Already completed'
              : 'Confirmed'
      );
      setCode('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Confirm failed');
    }
  };

  const retryPayouts = async () => {
    setRetryBusy(true);
    setError('');
    try {
      const res = await axios.post(`${API}/admin/trust/payouts/retry`, {}, { headers: headers() });
      const d = res.data?.data;
      setMsg(
        `Retry done · attempted ${d?.attempted ?? 0}, succeeded ${d?.succeeded ?? 0}`
      );
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Retry failed');
    } finally {
      setRetryBusy(false);
    }
  };

  return (
    <AdminShell activeLabel="Trust & Settlement" hidePageTitle>
      <div style={styles.wrap}>
        <div style={styles.head}>
          <div>
            <h1 style={styles.h1}>Trust & Settlement</h1>
            <p style={styles.sub}>
              SOS runbook · disputes/refunds · agent codes · SLA / no-show credits · payout retry
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="admin-btn"
              style={adminBtn.primary}
              disabled={retryBusy}
              onClick={retryPayouts}
            >
              {retryBusy ? 'Retrying…' : 'Retry pending payouts'}
            </button>
            <Link to="/dispatch" style={styles.link}>
              Open Dispatcher →
            </Link>
          </div>
        </div>

        {promise ? (
          <div style={styles.promise}>
            <strong>{promise.matchSlaText}</strong>
            <span> · {promise.noShowText}</span>
            <span> · KYC gate {promise.kycPayoutThreshold}+</span>
            <div style={{ marginTop: 6, opacity: 0.85 }}>{promise.keep100Note}</div>
          </div>
        ) : null}

        {msg ? <p style={styles.ok}>{msg}</p> : null}
        {error ? <p style={styles.err}>{error}</p> : null}

        <section style={styles.card}>
          <h2 style={styles.h2}>Confirm cash-agent code</h2>
          <div style={styles.row}>
            <input
              style={styles.input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
            />
            <button type="button" className="admin-btn" style={adminBtn.primary} onClick={confirmCode}>
              Confirm
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>Active SOS ({sos.length})</h2>
          <div className="admin-table-scroll">
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Driver</th>
                  <th style={styles.th}>Map</th>
                  <th style={styles.th}>When</th>
                  <th style={styles.th} />
                </tr>
              </thead>
              <tbody>
                {sos.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.muted}>
                      No active SOS
                    </td>
                  </tr>
                ) : (
                  sos.map((s) => (
                    <React.Fragment key={s.id}>
                      <tr>
                        <td style={styles.td}>
                          {s.customer_name || '—'}
                          <div style={styles.small}>{s.customer_phone}</div>
                        </td>
                        <td style={styles.td}>
                          {s.driver_name || '—'}
                          <div style={styles.small}>{s.driver_phone}</div>
                        </td>
                        <td style={styles.td}>
                          {s.mapUrl ? (
                            <a href={s.mapUrl} target="_blank" rel="noreferrer">
                              Open map
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={styles.td}>
                          {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                        </td>
                        <td style={styles.td}>
                          <button type="button" className="admin-btn" onClick={() => resolveSos(s.id)}>
                            Resolve
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5} style={{ ...styles.td, fontSize: 12, color: '#a1a1aa' }}>
                          <strong style={{ color: '#fca5a5' }}>Runbook:</strong>{' '}
                          {(s.runbook || []).join(' · ')}
                          {s.emergencyContacts?.length ? (
                            <div style={{ marginTop: 4 }}>
                              Contacts:{' '}
                              {s.emergencyContacts
                                .map(
                                  (c: any) =>
                                    `${c.contact_name || 'Contact'} ${c.phone_number || ''}`
                                )
                                .join(' · ')}
                            </div>
                          ) : (
                            <div style={{ marginTop: 4 }}>No emergency contacts on file</div>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>Disputes</h2>
          <div className="admin-table-scroll">
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Domain</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th} />
                </tr>
              </thead>
              <tbody>
                {disputes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.muted}>
                      No disputes
                    </td>
                  </tr>
                ) : (
                  disputes.map((d) => (
                    <tr key={d.id}>
                      <td style={styles.td}>{d.customer_name || '—'}</td>
                      <td style={styles.td}>{d.domain}</td>
                      <td style={styles.td}>{d.reason}</td>
                      <td style={styles.td}>{d.status}</td>
                      <td style={styles.td}>
                        {d.status === 'open' || d.status === 'investigating' ? (
                          <>
                            <button
                              type="button"
                              className="admin-btn"
                              style={{ marginRight: 6 }}
                              onClick={() => patchDispute(d.id, 'investigating')}
                            >
                              Investigate
                            </button>
                            <button
                              type="button"
                              className="admin-btn"
                              onClick={() => patchDispute(d.id, 'resolved')}
                            >
                              Resolve + refund
                            </button>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div style={styles.grid}>
          <section style={styles.card}>
            <h2 style={styles.h2}>Reliability credits</h2>
            <div className="admin-table-scroll">
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {reliability.slice(0, 20).map((e) => (
                    <tr key={e.id}>
                      <td style={styles.td}>{e.event_type}</td>
                      <td style={styles.td}>{e.customer_name || '—'}</td>
                      <td style={styles.td}>{e.compensation_amount}</td>
                      <td style={styles.td}>
                        {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {reliability.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={styles.muted}>
                        No reliability events
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Settlement receipts</h2>
            <div className="admin-table-scroll">
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Kind</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Code</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.slice(0, 20).map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{r.kind}</td>
                      <td style={styles.td}>{r.status}</td>
                      <td style={styles.td}>
                        {r.amount} {r.currency}
                      </td>
                      <td style={styles.td}>{r.confirm_code || r.metadata?.code || '—'}</td>
                    </tr>
                  ))}
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={styles.muted}>
                        No receipts
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  h1: { margin: 0, fontSize: 28, color: '#fff' },
  sub: { margin: '6px 0 0', color: '#a1a1aa', fontSize: 14 },
  link: { color: '#a78bfa', fontWeight: 700, textDecoration: 'none' },
  promise: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.35)',
    color: '#d1fae5',
    fontSize: 13,
  },
  ok: { color: '#34d399' },
  err: { color: '#f87171' },
  card: {
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    background: '#111',
    border: '1px solid #27272a',
  },
  h2: { margin: '0 0 12px', fontSize: 16, color: '#fff' },
  row: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    background: '#000',
    border: '1px solid #3f3f46',
    borderRadius: 10,
    color: '#fff',
    padding: '10px 12px',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, color: '#71717a', fontSize: 11, padding: '8px 6px' },
  td: { color: '#e4e4e7', fontSize: 13, padding: '10px 6px', borderTop: '1px solid #1f1f23' },
  muted: { color: '#71717a', padding: 12 },
  small: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
};
