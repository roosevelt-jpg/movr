import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { formatLocalTime } from '../lib/currency';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Collapsible ops notes for ride / order / user detail views (Phase 17). */
export default function OpsNotesPanel({
  entityType,
  entityId,
}: {
  entityType: 'ride' | 'order' | 'user';
  entityId: string;
}) {
  const [open, setOpen] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!entityId) {
      setNotes([]);
      return;
    }
    try {
      const res = await axios.get(`${API}/admin/notes`, {
        headers: headers(),
        params: { entityType, entityId },
      });
      setNotes(res.data.data || []);
      setError('');
    } catch (e: any) {
      setNotes([]);
      setError(e?.response?.data?.message || e.message || 'Failed to load notes');
    }
  };

  useEffect(() => {
    load();
  }, [entityType, entityId]);

  const add = async () => {
    if (!draft.trim() || !entityId) return;
    await axios.post(
      `${API}/admin/notes`,
      { entityType, entityId, note: draft.trim() },
      { headers: headers() }
    );
    setDraft('');
    await load();
  };

  if (!entityId) return null;

  return (
    <div style={styles.wrap}>
      <button type="button" style={styles.toggle} onClick={() => setOpen((o) => !o)}>
        Ops notes {open ? '▾' : '▸'} ({notes.length})
      </button>
      {open ? (
        <div style={styles.body}>
          {error ? <p style={styles.error}>{error}</p> : null}
          <div style={styles.list}>
            {notes.length === 0 ? (
              <p style={styles.empty}>No notes yet</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} style={styles.note}>
                  <div style={styles.meta}>
                    {n.created_at ? formatLocalTime(n.created_at) : ''}
                  </div>
                  <div>{n.note}</div>
                </div>
              ))
            )}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add internal note…"
            rows={3}
            style={styles.input}
          />
          <button type="button" style={styles.btn} onClick={add} disabled={!draft.trim()}>
            Save note
          </button>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    marginTop: 16,
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
    background: 'var(--surface-elevated)',
  },
  toggle: {
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  body: { padding: '0 14px 14px' },
  list: { maxHeight: 200, overflow: 'auto', marginBottom: 10 },
  note: {
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
  },
  meta: { color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 },
  empty: { color: 'var(--text-secondary)', fontSize: 13 },
  error: { color: 'var(--error)', fontSize: 13 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    padding: 10,
    marginBottom: 8,
  },
  btn: { ...adminBtn.primary },
};
