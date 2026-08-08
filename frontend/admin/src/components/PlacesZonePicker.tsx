import React, { useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import { API } from '../lib/apiBase';

export type PickedPlace = {
  placeId?: string | null;
  name: string;
  formattedAddress?: string;
  lat: number;
  lng: number;
  countryCode?: string | null;
  locality?: string | null;
};

type Prediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
};

type Props = {
  label?: string;
  placeholder?: string;
  countryBias?: string;
  disabled?: boolean;
  onPick: (place: PickedPlace) => void;
  /** Compact styling for header toolbars */
  compact?: boolean;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}`,
});

/** Search Google Places and fill zone center / name from the selected result. */
export default function PlacesZonePicker({
  label = 'Find place (Google Maps)',
  placeholder = 'Search city, neighbourhood, or landmark…',
  countryBias,
  disabled,
  onPick,
  compact,
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pickedLabel, setPickedLabel] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPreds([]);
      setError('');
      return;
    }

    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`${API}/admin/maps/places`, {
          headers: authHeaders(),
          params: { q, country: countryBias || undefined },
          signal: ctrl.signal,
        });
        setPreds(res.data?.data || []);
        setOpen(true);
      } catch (e: any) {
        if (axios.isCancel?.(e) || e?.code === 'ERR_CANCELED') return;
        setPreds([]);
        setError(e?.response?.data?.message || e.message || 'Places search failed');
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(t);
  }, [query, countryBias]);

  const selectPrediction = async (p: Prediction) => {
    setOpen(false);
    setQuery(p.description);
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/admin/maps/place-details`, {
        headers: authHeaders(),
        params: { placeId: p.placeId },
      });
      const data = res.data?.data as PickedPlace;
      if (data?.lat == null || data?.lng == null || Number.isNaN(Number(data.lat))) {
        throw new Error('Place has no coordinates');
      }
      setPickedLabel(data.formattedAddress || data.name);
      onPick(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Could not load place');
    } finally {
      setLoading(false);
    }
  };

  const geocodeExact = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/admin/maps/geocode`, {
        headers: authHeaders(),
        params: { address: q },
      });
      const data = res.data?.data as PickedPlace;
      setOpen(false);
      setPickedLabel(data.formattedAddress || data.name);
      onPick(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Geocode failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...styles.wrap, ...(compact ? styles.wrapCompact : null) }}>
      {label ? <label style={styles.label}>{label}</label> : null}
      <div style={styles.row}>
        <input
          style={styles.input}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          onChange={(e) => {
            setQuery(e.target.value);
            setPickedLabel('');
          }}
          onFocus={() => {
            if (preds.length) setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (preds[0]) selectPrediction(preds[0]);
              else geocodeExact();
            }
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        <button type="button" style={styles.btn} disabled={disabled || loading} onClick={geocodeExact}>
          {loading ? '…' : 'Use'}
        </button>
      </div>
      {open && preds.length ? (
        <ul
          id={listId}
          role="listbox"
          style={styles.list}
          onMouseDown={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
          }}
        >
          {preds.map((p) => (
            <li key={p.placeId}>
              <button type="button" style={styles.item} onClick={() => selectPrediction(p)}>
                <span style={styles.itemMain}>{p.mainText}</span>
                {p.secondaryText ? <span style={styles.itemSub}>{p.secondaryText}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {pickedLabel ? <p style={styles.hint}>Selected: {pickedLabel}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative', width: '100%', maxWidth: 520, marginBottom: 12 },
  wrapCompact: { maxWidth: 360, marginBottom: 0 },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  row: { display: 'flex', gap: 8, alignItems: 'stretch' },
  input: {
    flex: 1,
    minWidth: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-primary)',
    fontSize: 14,
  },
  btn: {
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '0 12px',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  list: {
    listStyle: 'none',
    margin: '6px 0 0',
    padding: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    maxHeight: 240,
    overflow: 'auto',
    boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
  },
  item: {
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  itemMain: { fontWeight: 600, fontSize: 13 },
  itemSub: { fontSize: 12, color: 'var(--text-secondary)' },
  hint: { margin: '6px 0 0', fontSize: 12, color: 'var(--success)' },
  error: { margin: '6px 0 0', fontSize: 12, color: 'var(--error)' },
};
