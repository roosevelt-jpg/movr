import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/currency';

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

/** Organization mobility desk — live trips and evidence pack. */
export default function CorporateDeskPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [desk, setDesk] = useState<any>(null);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('Hospitality');
  const [memberEmail, setMemberEmail] = useState('');
  const [costCenter, setCostCenter] = useState('HQ');
  const [cars, setCars] = useState([{ classCode: 'executive' }, { classCode: 'classic' }]);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOrgs = () =>
    fetch(`${API}/verified/orgs`, { headers: headers() })
      .then((r) => r.json())
      .then((j) => {
        const list = j?.data || [];
        setOrgs(list);
        if (list[0]?.id) return loadDesk(list[0].id);
      })
      .catch(() => undefined);

  const loadDesk = (id: string) =>
    fetch(`${API}/verified/orgs/${id}`, { headers: headers() })
      .then((r) => r.json())
      .then((j) => setDesk(j?.data))
      .catch(() => undefined);

  useEffect(() => {
    loadOrgs();
  }, []);

  const create = async () => {
    if (!name.trim()) return toast.error('Company name required');
    setBusy(true);
    try {
      const res = await fetch(`${API}/verified/orgs`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name, industry }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      toast.success('30-day pilot opened');
      await loadOrgs();
    } catch (e: any) {
      toast.error(e.message || 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  const addMember = async () => {
    if (!desk?.org?.id || !memberEmail) return;
    const res = await fetch(`${API}/verified/orgs/${desk.org.id}/members`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email: memberEmail, role: 'booker', costCenter }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.message || 'Could not add');
    toast.success('Member added');
    setMemberEmail('');
    loadDesk(desk.org.id);
  };

  const movement = async () => {
    if (!desk?.org?.id) return toast.error('Create an organization first');
    if (!pickup || !dropoff) return toast.error('Pickup and drop-off required');
    setBusy(true);
    try {
      const res = await fetch(`${API}/verified/movements`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          orgId: desk.org.id,
          pickupLat: 6.5244,
          pickupLng: 3.3792,
          dropoffLat: 6.45,
          dropoffLng: 3.4,
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          vehicles: cars,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message);
      toast.success(`${j?.data?.bookings?.length || 0} vehicles booked — escrow held`);
      loadDesk(desk.org.id);
    } catch (e: any) {
      toast.error(e.message || 'Movement failed');
    } finally {
      setBusy(false);
    }
  };

  const csv = () => {
    const rows = desk?.evidence || [];
    const header = 'when,vehicle,chauffeur,pickup,dropoff,cost,currency,status,matched';
    const body = rows
      .map((r: any) =>
        [r.when, r.vehicle, r.chauffeur, r.pickup, r.dropoff, r.cost, r.currency, r.status, r.matched]
          .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'movr-mobility-evidence.csv';
    a.click();
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-3xl mx-auto p-4 space-y-5" data-force-dark>
      <p className="text-xs font-bold tracking-wide text-zinc-500">CORPORATE DESK</p>
      <h1 className="text-3xl font-extrabold">Move people, not paperwork</h1>
      <p className="text-zinc-400">
        One request, many verified cars. Live journeys and a structured record. Family ride
        circles stay as they are.
      </p>
      <Link to="/verified" className="text-purple-400 text-sm font-semibold">
        Choose a vehicle →
      </Link>

      {!desk ? (
        <div className="rounded-2xl bg-zinc-900 p-4 space-y-3">
          <p className="font-bold">Start a 30-day pilot</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            className="w-full rounded-xl bg-black px-3 py-2"
          />
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full rounded-xl bg-black px-3 py-2"
          >
            {['Hospitality', 'Oil & gas', 'Financial services', 'Government', 'Events', 'Other'].map(
              (i) => (
                <option key={i}>{i}</option>
              )
            )}
          </select>
          <button type="button" onClick={create} disabled={busy} className="w-full rounded-xl bg-purple-600 py-3 font-bold">
            Open pilot
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-400">
            {desk.org.name} · {desk.org.status} · {desk.members?.length || 0} people ·{' '}
            {desk.live?.length || 0} live
          </p>
          <div className="rounded-2xl bg-zinc-900 p-4 space-y-2">
            <p className="font-bold">Add a booker</p>
            <div className="flex gap-2">
              <input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="Work email already on Movr"
                className="flex-1 rounded-xl bg-black px-3 py-2 text-sm"
              />
              <input
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                className="w-24 rounded-xl bg-black px-3 py-2 text-sm"
              />
              <button type="button" onClick={addMember} className="rounded-xl bg-zinc-700 px-3 font-bold">
                Add
              </button>
            </div>
          </div>
          <div className="rounded-2xl bg-zinc-900 p-4 space-y-3">
            <p className="font-bold">Multi-vehicle movement</p>
            <input
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder="Pickup"
              className="w-full rounded-xl bg-black px-3 py-2"
            />
            <input
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              placeholder="Drop-off"
              className="w-full rounded-xl bg-black px-3 py-2"
            />
            {cars.map((c, i) => (
              <select
                key={i}
                value={c.classCode}
                onChange={(e) => {
                  const next = [...cars];
                  next[i] = { classCode: e.target.value };
                  setCars(next);
                }}
                className="w-full rounded-xl bg-black px-3 py-2"
              >
                {['classic', 'vip', 'security', 'executive', 'executive_plus', 'armored', 'signature'].map(
                  (code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  )
                )}
              </select>
            ))}
            <button
              type="button"
              onClick={() => setCars([...cars, { classCode: 'classic' }])}
              className="text-sm text-purple-400"
            >
              + vehicle
            </button>
            <button type="button" disabled={busy} onClick={movement} className="w-full rounded-xl bg-purple-600 py-3 font-bold">
              Book this movement
            </button>
          </div>
          <div className="flex justify-between items-center">
            <p className="font-bold">Evidence</p>
            <button type="button" onClick={csv} className="text-sm text-purple-400">
              Download CSV
            </button>
          </div>
          <div className="space-y-2">
            {(desk.trips || []).map((t: any) => (
              <div key={t.id} className="rounded-xl bg-zinc-900 p-3 text-sm">
                <p className="font-bold">{t.title}</p>
                <p className="text-zinc-400">
                  {t.status} · {formatCurrency(Number(t.quoted_fare), t.currency_code)} · escrow{' '}
                  {t.escrow_status}
                </p>
                <p className="text-zinc-500 text-xs">
                  {t.pickup_address} → {t.dropoff_address}
                </p>
                {t.ride_id ? (
                  <Link to={`/ride/active/${t.ride_id}`} className="text-purple-400 text-xs">
                    Open tracking
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
