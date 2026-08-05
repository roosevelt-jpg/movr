import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin ride ops — force cancel, adjust fare, internal notes. */
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
          author: n.author_name || 'Admin',
          when: n.created_at ? new Date(n.created_at).toLocaleString() : '',
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
      const fare = Number(r.actual_fare || r.estimated_fare || 0);
      setRide({
        id: r.id || id,
        driver: r.driver_name || r.driver_id || '—',
        rider: r.rider_name || r.customer_name || r.user_id || '—',
        route:
          [r.pickup_address, r.dropoff_address].filter(Boolean).join(' → ') ||
          'Route unavailable',
        fare,
        status: r.status || '—',
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
          placeholder="Ride id"
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
              <h1 style={styles.h1}>Ride #{ride.id}</h1>
              <p style={styles.meta}>
                {ride.driver} → {ride.rider} · {ride.route} ·{' '}
                {formatCurrency(Number(ride.fare), ride.currency || 'GHS')}
              </p>
            </div>
            <span style={styles.badge}>{ride.status}</span>
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
              onClick={() => adjustFare().catch((e) => setMessage(e.message))}
            >
              Adjust fare
            </button>
            <input
              style={styles.amount}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="New fare"
            />
          </div>
          {message ? <p style={{ color: '#9BE0A8' }}>{message}</p> : null}

          <div style={styles.grid}>
            <div style={styles.map}>
              <div style={styles.gridBg} />
            </div>
            <aside style={styles.notes}>
              <p style={styles.notesTitle}>Internal notes</p>
              {notes.length === 0 ? (
                <p style={{ color: '#666', margin: 0, fontSize: 13 }}>No notes yet</p>
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
  empty: { color: '#888', marginTop: 24 },
  top: { display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  meta: { color: '#A0A0A0', marginTop: 6 },
  badge: {
    alignSelf: 'flex-start',
    background: 'rgba(255,59,92,0.2)',
    color: '#FF8FA0',
    borderRadius: 999,
    padding: '6px 12px',
    fontWeight: 700,
    fontSize: 13,
  },
  actions: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  ghost: {
    background: 'transparent',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  amount: {
    background: '#121212',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 10,
    padding: '10px 12px',
    minWidth: 160,
  },
  grid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 },
  map: {
    minHeight: 360,
    borderRadius: 16,
    border: '1px solid #2A2A2A',
    background: '#0A0A0A',
    position: 'relative',
    overflow: 'hidden',
  },
  gridBg: {
    position: 'absolute',
    inset: 0,
    opacity: 0.35,
    backgroundImage:
      'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)',
    backgroundSize: '32px 32px',
  },
  notes: {
    background: '#121212',
    border: '1px solid #2A2A2A',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  notesTitle: { color: '#A0A0A0', margin: 0, fontSize: 13 },
  noteCard: {
    background: '#0A0A0A',
    borderRadius: 12,
    padding: 12,
    border: '1px solid #2A2A2A',
  },
  noteMeta: { color: '#666', fontSize: 12, margin: '8px 0 0' },
  noteInput: {
    marginTop: 'auto',
    background: '#0A0A0A',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 10,
    padding: '12px 14px',
  },
};
