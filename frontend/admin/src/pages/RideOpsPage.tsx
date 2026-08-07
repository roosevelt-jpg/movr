import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

function relativeTime(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return h === 1 ? '1 hr ago' : `${h} hrs ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

/** Admin ride ops — force cancel, adjust fare, internal notes (mockup-aligned). */
export default function RideOpsPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rideId = params.id || searchParams.get('id') || searchParams.get('rideId') || '';
  const [lookup, setLookup] = useState(rideId);
  const [ride, setRide] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadNotes = async (id: string) => {
    try {
      const res = await axios.get(`${API}/admin/notes`, {
        headers: headers(),
        params: { entityType: 'ride', entityId: id },
      });
      const rows = res.data.data || [];
      setNotes(
        rows.map((n: any) => ({
          id: n.id,
          note: n.note,
          author: n.author_name || n.admin_name || 'Admin',
          when: relativeTime(n.created_at),
        }))
      );
    } catch {
      setNotes([]);
    }
  };

  const loadRide = async (id: string) => {
    if (!id) {
      setRide(null);
      setNotes([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/rides/${id}`, { headers: headers() });
      const r = res.data.data;
      if (!r) {
        setRide(null);
        setError('Ride not found');
        return;
      }
      const fare = Number(r.actual_fare ?? r.fare ?? r.estimated_fare ?? 0);
      const driver =
        r.driver?.name || r.driver_name || r.driverName || 'Driver';
      const rider =
        r.rider_name || r.customerName || r.customer_name || r.customer?.name || 'Rider';
      const pickup = r.pickup_address || r.pickupAddress || r.pickup?.address || '';
      const dropoff = r.dropoff_address || r.dropoffAddress || r.dropoff?.address || '';
      const disputed =
        String(r.dispute_status || '').toLowerCase() === 'disputed' ||
        String(r.status || '').toLowerCase().includes('disput');
      const publicRef = r.public_ref || r.publicRef || String(r.id).replace(/\D/g, '').slice(-5);

      setRide({
        id: r.id || id,
        publicRef,
        driver,
        rider,
        route: [pickup, dropoff].filter(Boolean).join(' → ') || 'Route unavailable',
        fare,
        currency: r.currency || 'GHS',
        status: disputed ? 'Disputed fare' : r.status || '—',
        disputed,
      });
      setAdjustAmount(String(fare || ''));
      await loadNotes(r.id || id);
    } catch (e: any) {
      setRide(null);
      setNotes([]);
      setError(e?.response?.data?.message || e.message || 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLookup(rideId);
    loadRide(rideId);
  }, [rideId]);

  const goLookup = () => {
    const id = lookup.trim();
    if (!id) return;
    navigate(`/rides/${encodeURIComponent(id)}`);
  };

  const forceCancel = async () => {
    if (!ride?.id) return;
    await axios.post(
      `${API}/admin/rides/${ride.id}/force-cancel`,
      { reason: 'Admin force cancel from ops console' },
      { headers: headers() }
    );
    setMessage('Ride force-cancelled');
    await loadRide(ride.id);
  };

  const adjustFare = async () => {
    if (!ride?.id) return;
    await axios.post(
      `${API}/admin/rides/${ride.id}/adjust-fare`,
      { amount: Number(adjustAmount), reason: 'Dispute adjustment' },
      { headers: headers() }
    );
    setRide((r: any) => ({ ...r, fare: Number(adjustAmount) }));
    setMessage(
      `Fare adjusted to ${formatCurrency(Number(adjustAmount), ride?.currency || 'GHS')}`
    );
    setShowAdjust(false);
  };

  const addNote = async () => {
    if (!draft.trim() || !ride?.id) return;
    await axios.post(
      `${API}/admin/notes`,
      { entityType: 'ride', entityId: ride.id, note: draft },
      { headers: headers() }
    );
    setDraft('');
    await loadNotes(ride.id);
  };

  return (
    <AdminShell>
      <div style={styles.lookupBar}>
        <input
          style={styles.amount}
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder="Ride id or #88213"
          onKeyDown={(e) => e.key === 'Enter' && goLookup()}
        />
        <button style={styles.ghost} type="button" onClick={goLookup}>
          Load ride
        </button>
      </div>

      {!rideId ? (
        <p style={styles.empty}>Enter a ride id to open ops tools</p>
      ) : loading ? (
        <p style={styles.empty}>Loading…</p>
      ) : error || !ride ? (
        <p style={styles.empty}>{error || 'Ride not found'}</p>
      ) : (
        <>
          <div style={styles.top}>
            <div>
              <h1 style={styles.h1}>Ride #{ride.publicRef}</h1>
              <p style={styles.meta}>
                {ride.driver} → {ride.rider} · {ride.route} ·{' '}
                {formatCurrency(Number(ride.fare), ride.currency || 'GHS')}
              </p>
            </div>
            <span style={ride.disputed ? styles.badgeDispute : styles.badge}>{ride.status}</span>
          </div>

          <div style={styles.actions}>
            <button
              style={styles.ghost}
              type="button"
              onClick={() => forceCancel().catch((e) => setMessage(e.message))}
            >
              Force cancel
            </button>
            <button
              style={styles.ghost}
              type="button"
              onClick={() => setShowAdjust((v) => !v)}
            >
              Adjust fare
            </button>
            {showAdjust ? (
              <>
                <input
                  style={styles.amount}
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="New fare"
                />
                <button
                  style={styles.ghost}
                  type="button"
                  onClick={() => adjustFare().catch((e) => setMessage(e.message))}
                >
                  Save fare
                </button>
              </>
            ) : null}
          </div>
          {message ? <p style={{ color: 'var(--success)' }}>{message}</p> : null}

          <div style={styles.grid}>
            <div style={styles.map}>
              <div style={styles.gridBg} />
            </div>
            <aside style={styles.notes}>
              <p style={styles.notesTitle}>Internal notes</p>
              {notes.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>No notes yet</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} style={styles.noteCard}>
                    <p style={{ margin: 0 }}>{n.note}</p>
                    <p style={styles.noteMeta}>
                      Admin: {n.author} · {n.when}
                    </p>
                  </div>
                ))
              )}
              <input
                style={styles.noteInput}
                placeholder="Add a note..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote().catch((err) => setMessage(err.message))}
              />
            </aside>
          </div>
        </>
      )}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  lookupBar: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  empty: { color: 'var(--text-secondary)', marginTop: 24 },
  top: { display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  meta: { color: 'var(--text-secondary)', marginTop: 6 },
  badge: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    borderRadius: 999,
    padding: '6px 12px',
    fontWeight: 700,
    fontSize: 13,
  },
  badgeDispute: {
    alignSelf: 'flex-start',
    background: 'rgba(255,59,92,0.2)',
    color: '#f5a8a8',
    borderRadius: 999,
    padding: '6px 12px',
    fontWeight: 700,
    fontSize: 13,
  },
  actions: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  ghost: {
    background: '#2a2a2a',
    border: '1px solid transparent',
    color: 'var(--pure-white)',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  amount: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--pure-white)',
    borderRadius: 10,
    padding: '10px 12px',
    minWidth: 160,
  },
  grid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 },
  map: {
    minHeight: 360,
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    position: 'relative',
    overflow: 'hidden',
  },
  gridBg: {
    position: 'absolute',
    inset: 0,
    opacity: 0.45,
    backgroundImage:
      'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize: '28px 28px',
  },
  notes: {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  notesTitle: { color: 'var(--text-secondary)', margin: 0, fontSize: 13 },
  noteCard: {
    background: 'var(--surface-elevated)',
    borderRadius: 12,
    padding: 12,
    border: '1px solid var(--border)',
  },
  noteMeta: { color: 'var(--text-secondary)', fontSize: 12, margin: '8px 0 0' },
  noteInput: {
    marginTop: 'auto',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--pure-white)',
    borderRadius: 10,
    padding: '12px 14px',
  },
};
