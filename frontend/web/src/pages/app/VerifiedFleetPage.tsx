import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../../lib/currency';
import { mediaUrl } from '../../lib/media';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

/** Browse named, inspected chauffeur vehicles. Separate from on-demand compare travel. */
export default function VerifiedFleetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [classes, setClasses] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [cls, setCls] = useState(params.get('class') || '');
  const [q, setQ] = useState('');

  const load = () => {
    fetch(`${API}/verified/classes`)
      .then((r) => r.json())
      .then((j) => setClasses(j?.data || []))
      .catch(() => undefined);
    const qs = new URLSearchParams();
    if (cls) qs.set('class', cls);
    if (q.trim()) qs.set('q', q.trim());
    fetch(`${API}/verified/listings?${qs}`)
      .then((r) => r.json())
      .then((j) => setRows(j?.data || []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, [cls]);

  const grouped = useMemo(() => rows, [rows]);

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-3xl mx-auto p-4" data-force-dark>
      <p className="text-xs tracking-wide text-zinc-500 font-bold">VERIFIED MOBILITY</p>
      <h1 className="text-3xl font-extrabold mt-1">Choose this vehicle</h1>
      <p className="text-zinc-400 mt-2 mb-4">
        Photo, chauffeur, and inspection before you confirm. Payment stays in escrow until this
        car arrives. On-demand Ride is unchanged.
      </p>
      <div className="flex gap-3 text-sm mb-4">
        <Link to="/dashboard" className="text-purple-400 font-semibold">
          On-demand rides
        </Link>
        <Link to="/business" className="text-purple-400 font-semibold">
          For organizations
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-3">
        <button
          type="button"
          onClick={() => setCls('')}
          className={`px-3 py-1.5 rounded-full text-sm font-bold ${!cls ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-300'}`}
        >
          All
        </button>
        {classes.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCls(c.code)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${
              cls === c.code ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-300'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Prado, LX570…"
          className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-zinc-800 px-4 font-bold">
          Search
        </button>
      </form>
      <div className="space-y-3">
        {grouped.map((l) => (
          <button
            key={l.listingId}
            type="button"
            onClick={() => navigate(`/verified/book/${l.listingId}`)}
            className="w-full text-left flex gap-3 rounded-2xl bg-zinc-900 p-3 border border-zinc-800"
          >
            <div className="w-20 h-20 rounded-xl bg-zinc-800 overflow-hidden shrink-0">
              {l.photos?.exterior ? (
                <img src={mediaUrl(l.photos.exterior)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🚘</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{l.title}</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {l.year || ''} · {l.className} · {l.seats} seats
              </p>
              <p className="text-xs text-emerald-400 mt-1">
                {l.inspection?.badge} · plate {l.plateMasked}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{l.chauffeur?.name} · ★ {l.chauffeur?.rating}</p>
            </div>
            <div className="text-right">
              <p className="font-extrabold">
                {l.ownerPrice != null ? formatCurrency(l.ownerPrice, l.currency) : 'Quote'}
              </p>
              <p className="text-[11px] text-zinc-500">escrow</p>
            </div>
          </button>
        ))}
        {!grouped.length ? <p className="text-zinc-500 text-sm">No verified vehicles in this filter yet.</p> : null}
      </div>
    </div>
  );
}
