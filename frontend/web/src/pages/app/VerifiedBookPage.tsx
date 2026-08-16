import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/currency';
import { mediaUrl } from '../../lib/media';
import { useAuthStore } from '../../store/auth.store';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function headers() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

/** Book a named verified vehicle with escrow hold. */
export default function VerifiedBookPage() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [listing, setListing] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupAt, setPickupAt] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [product, setProduct] = useState<'trip' | 'hourly' | 'airport'>('trip');
  const [hours, setHours] = useState(4);
  const [priority, setPriority] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgId, setOrgId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!listingId) return;
    fetch(`${API}/verified/listings/${listingId}`)
      .then((r) => r.json())
      .then((j) => setListing(j?.data))
      .catch(() => undefined);
    fetch(`${API}/verified/orgs`, { headers: headers() })
      .then((r) => r.json())
      .then((j) => setOrgs(j?.data || []))
      .catch(() => undefined);
  }, [listingId]);

  useEffect(() => {
    if (!listingId) return;
    fetch(`${API}/verified/listings/${listingId}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product, hours, priority, pickupAt: pickupAt || null }),
    })
      .then((r) => r.json())
      .then((j) => setQuote(j?.data?.quote))
      .catch(() => undefined);
  }, [listingId, product, hours, priority, pickupAt]);

  const book = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!pickup.trim() || !dropoff.trim()) {
      toast.error('Enter pickup and drop-off');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/verified/book`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          listingId,
          pickupLat: 6.5244,
          pickupLng: 3.3792,
          dropoffLat: 6.4483,
          dropoffLng: 3.39,
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          pickupAt: pickupAt || null,
          passengers,
          product,
          hours: product === 'hourly' ? hours : undefined,
          priority,
          orgId: orgId || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || 'Booking failed');
      toast.success('Held in escrow — confirm the car at pickup');
      const rideId = j?.data?.rideId;
      if (rideId) navigate(`/ride/active/${rideId}`);
      else navigate('/verified');
    } catch (e: any) {
      toast.error(e.message || 'Could not book');
    } finally {
      setBusy(false);
    }
  };

  if (!listing) {
    return <div className="p-6 text-zinc-400">Loading vehicle…</div>;
  }

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4 space-y-4" data-force-dark>
      <Link to="/verified" className="text-zinc-400 text-sm">
        ← Verified fleet
      </Link>
      {listing.photos?.exterior ? (
        <img src={mediaUrl(listing.photos.exterior)} alt="" className="w-full h-40 object-cover rounded-2xl" />
      ) : null}
      <h1 className="text-2xl font-extrabold">{listing.title}</h1>
      <p className="text-zinc-400 text-sm">
        {listing.year} · {listing.className} · plate {listing.plateMasked} · {listing.inspection?.badge}
      </p>
      <p className="text-sm">
        Chauffeur {listing.chauffeur?.name} · ★ {listing.chauffeur?.rating}
      </p>
      <p className="text-xs text-emerald-400">
        Escrow holds your fare until you confirm this is the car that arrived. Class mismatch is
        refunded as a credit.
      </p>
      <div className="flex gap-2">
        {(['trip', 'hourly', 'airport'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProduct(p)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold ${product === p ? 'bg-white text-black' : 'bg-zinc-900'}`}
          >
            {p}
          </button>
        ))}
      </div>
      {product === 'hourly' ? (
        <label className="block text-sm">
          Hours
          <input
            type="number"
            min={1}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2"
          />
        </label>
      ) : null}
      <label className="block text-sm">
        Pickup
        <input value={pickup} onChange={(e) => setPickup(e.target.value)} className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Drop-off
        <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2" />
      </label>
      <label className="block text-sm">
        When (optional — leave empty for now)
        <input
          type="datetime-local"
          value={pickupAt}
          onChange={(e) => setPickupAt(e.target.value)}
          className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} />
        Priority sourcing (+20%)
      </label>
      {orgs.length ? (
        <label className="block text-sm">
          Charge organization
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2"
          >
            <option value="">Personal wallet</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <Link to="/corporate" className="text-sm text-purple-400">
          Book under a company account
        </Link>
      )}
      <p className="font-extrabold text-xl">
        {quote ? formatCurrency(quote.total, quote.currency) : '…'} held in escrow
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={book}
        className="w-full rounded-2xl py-4 font-extrabold bg-purple-600 disabled:opacity-50"
      >
        {busy ? 'Holding…' : 'Book this vehicle'}
      </button>
    </div>
  );
}
