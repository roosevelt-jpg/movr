import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency, formatLocalTime } from '../lib/currency';
import OpsNotesPanel from '../components/OpsNotesPanel';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin ride ops — force cancel, adjust fare, internal notes, recording playback (Phase 28). */
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
  const [recordingMeta, setRecordingMeta] = useState<any>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [incidentRef, setIncidentRef] = useState('');

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
          when: n.created_at ? formatLocalTime(n.created_at) : '',
        }))
      );
    } catch {
      setNotes([]);
    }
  };

  const loadRecordingMeta = async (id: string) => {
    try {
      const res = await axios.get(`${API}/admin/recordings/${id}/meta`, { headers: headers() });
      const data = res.data.data;
      setRecordingMeta(data);
      const sosId = data?.incidents?.[0]?.id;
      if (sosId) setIncidentRef(String(sosId));
      else if (data?.recording?.flagged_for_dispute) {
        setIncidentRef((r) => r || `DISPUTE-${id.slice(0, 8)}`);
      }
    } catch {
      setRecordingMeta(null);
    }
  };

  const loadRide = async (id: string) => {
    if (!id) {
      setRide(null);
      setNotes([]);
      setRecordingMeta(null);
      setPlaybackUrl(null);
      return;
    }
    setLoading(true);
    setError('');
    setPlaybackUrl(null);
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
        currency: r.currency || 'GHS',
        status: r.status || '—',
      });
      setAdjustAmount(String(fare || ''));
      await loadNotes(r.id || id);
      await loadRecordingMeta(r.id || id);
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

  const statusOverride = async (status: string) => {
    if (!ride?.id) return;
    await axios.post(
      `${API}/admin/rides/${ride.id}/status-override`,
      { status, reason: `Admin override to ${status}` },
      { headers: headers() }
    );
    setMessage(`Status overridden to ${status}`);
    await loadRide(ride.id);
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

  const flagRecording = async () => {
    if (!ride?.id) return;
    await axios.post(
      `${API}/admin/rides/${ride.id}/recording/flag`,
      { reason: incidentRef || 'Fare dispute / safety review' },
      { headers: headers() }
    );
    setMessage('Recording flagged for dispute retention');
    await loadRecordingMeta(ride.id);
  };

  const viewRecording = async () => {
    if (!ride?.id || !incidentRef.trim()) {
      setMessage('Incident reference required (SOS id or DISPUTE-…)');
      return;
    }
    try {
      const res = await axios.get(`${API}/admin/recordings/${ride.id}`, {
        headers: headers(),
        params: { incidentRef: incidentRef.trim() },
      });
      setPlaybackUrl(res.data.data?.playbackUrl || null);
      setMessage('Secure playback URL issued (5 min, inline — not a download)');
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e.message || 'Playback denied');
      setPlaybackUrl(null);
    }
  };

  const canViewRecording = Boolean(recordingMeta?.recording?.flagged_for_dispute);

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
            <button
              style={styles.ghost}
              type="button"
              onClick={() => statusOverride('completed').catch((e) => setMessage(e.message))}
            >
              Mark completed
            </button>
            <input
              style={styles.amount}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="New fare"
            />
          </div>
          {message ? <p style={{ color: 'var(--success)' }}>{message}</p> : null}

          <div style={styles.grid}>
            <div style={styles.map}>
              <div style={styles.gridBg} />
              {playbackUrl ? (
                <video
                  key={playbackUrl}
                  controls
                  controlsList="nodownload"
                  style={styles.video}
                  src={playbackUrl}
                />
              ) : null}
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

              <p style={{ ...styles.notesTitle, marginTop: 16 }}>Trip recording</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>
                {recordingMeta?.recording
                  ? `Status: ${recordingMeta.recording.status}${
                      recordingMeta.recording.flagged_for_dispute ? ' · flagged' : ''
                    }`
                  : 'No recording row yet'}
              </p>
              <input
                style={styles.noteInput}
                placeholder="Incident ref (SOS uuid or DISPUTE-…)"
                value={incidentRef}
                onChange={(e) => setIncidentRef(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  style={styles.ghost}
                  type="button"
                  onClick={() => flagRecording().catch((e) => setMessage(e.message))}
                >
                  Flag for dispute
                </button>
                {canViewRecording ? (
                  <button
                    style={styles.ghost}
                    type="button"
                    onClick={() => viewRecording().catch((e) => setMessage(e.message))}
                  >
                    View recording
                  </button>
                ) : null}
              </div>
              <OpsNotesPanel entityType="ride" entityId={ride.id} />
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
    background: 'rgba(255,59,92,0.2)',
    color: 'var(--error)',
    borderRadius: 999,
    padding: '6px 12px',
    fontWeight: 700,
    fontSize: 13,
  },
  actions: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  ghost: {
    background: 'transparent',
    border: '1px solid var(--border)',
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
    opacity: 0.35,
    backgroundImage:
      'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
  },
  video: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',
    minHeight: 360,
    objectFit: 'contain',
    background: 'var(--jet-black)',
  },
  notes: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  notesTitle: { color: 'var(--text-secondary)', margin: 0, fontSize: 13 },
  noteCard: {
    background: 'var(--surface)',
    borderRadius: 12,
    padding: 12,
    border: '1px solid var(--border)',
  },
  noteMeta: { color: 'var(--text-secondary)', fontSize: 12, margin: '8px 0 0' },
  noteInput: {
    marginTop: 'auto',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--pure-white)',
    borderRadius: 10,
    padding: '12px 14px',
  },
};
