import React, { useEffect, useId, useRef, useState } from 'react';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

export type PickedPlace = {
  placeId?: string | null;
  name: string;
  formattedAddress?: string;
  lat: number;
  lng: number;
  countryCode?: string | null;
};

type Prediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
};

type Props = {
  placeholder: string;
  countryBias?: string;
  icon?: 'pickup' | 'dropoff';
  valueLabel?: string;
  onPick: (place: PickedPlace) => void;
  onClear?: () => void;
};

/** Public Places autocomplete — uses Integrations Hub Google Maps key via /public/maps. */
export default function PlacesAutocompleteField({
  placeholder,
  countryBias = 'GH',
  icon = 'pickup',
  valueLabel,
  onPick,
  onClear,
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState(valueLabel || '');
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapsOk, setMapsOk] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (valueLabel != null) setQuery(valueLabel);
  }, [valueLabel]);

  useEffect(() => {
    fetch(`${API}/public/maps/status`)
      .then((r) => r.json())
      .then((j) => setMapsOk(Boolean(j?.data?.configured)))
      .catch(() => setMapsOk(false));
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || mapsOk === false) {
      setPreds([]);
      return;
    }
    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(
          `${API}/public/maps/places?q=${encodeURIComponent(q)}&country=${encodeURIComponent(
            countryBias
          )}`,
          { signal: ctrl.signal }
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j.message || 'Places failed');
        setPreds(j.data || []);
        setOpen(true);
        setMapsOk(true);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setPreds([]);
        if (/not configured/i.test(String(e?.message || ''))) setMapsOk(false);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, countryBias, mapsOk]);

  const select = async (p: Prediction) => {
    setQuery(p.description);
    setOpen(false);
    setPreds([]);
    try {
      const res = await fetch(
        `${API}/public/maps/place-details?placeId=${encodeURIComponent(p.placeId)}`
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Details failed');
      const d = j.data;
      onPick({
        placeId: d.placeId,
        name: d.name || p.mainText,
        formattedAddress: d.formattedAddress || p.description,
        lat: Number(d.lat),
        lng: Number(d.lng),
        countryCode: d.countryCode,
      });
    } catch {
      onPick({
        placeId: p.placeId,
        name: p.mainText,
        formattedAddress: p.description,
        lat: 5.6037,
        lng: -0.187,
        countryCode: countryBias,
      });
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-xl bg-[#f7f7f8] px-3.5 py-3.5 border border-black/15 shadow-sm focus-within:border-black/40 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-shadow">
        <span
          className={`shrink-0 ring-4 ring-black/5 ${
            icon === 'pickup' ? 'h-3 w-3 rounded-full bg-black' : 'h-3 w-3 rounded-[3px] bg-black'
          }`}
          aria-hidden
        />
        <input
          className="flex-1 min-w-0 bg-transparent text-[15px] font-medium text-black outline-none placeholder:text-black/40 placeholder:font-normal"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) onClear?.();
          }}
          onFocus={() => preds.length && setOpen(true)}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
        />
        {loading ? <span className="text-xs text-black/40">…</span> : null}
        {query ? (
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-black/55 hover:bg-black/5 hover:text-black"
            onClick={() => {
              setQuery('');
              setPreds([]);
              onClear?.();
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {mapsOk === false ? (
        <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
          Add Google Maps in Admin → Integrations to enable address search.
        </p>
      ) : null}
      {open && preds.length > 0 ? (
        <ul
          id={listId}
          className="absolute z-30 mt-1.5 max-h-56 w-full overflow-auto rounded-xl border border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
        >
          {preds.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                className="w-full px-3.5 py-2.5 text-left hover:bg-black/[0.04]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p)}
              >
                <span className="block text-sm font-medium text-black">{p.mainText}</span>
                {p.secondaryText ? (
                  <span className="block text-xs text-black/50">{p.secondaryText}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
