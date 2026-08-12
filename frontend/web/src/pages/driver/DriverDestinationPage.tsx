import React, { useState } from 'react';
import toast from 'react-hot-toast';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('movr_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const DriverDestinationPage: React.FC = () => {
  const [label, setLabel] = useState('Home');
  const [destLat, setDestLat] = useState('5.6037');
  const [destLng, setDestLng] = useState('-0.1870');
  const [radiusKm, setRadiusKm] = useState('5');
  const [hours, setHours] = useState('4');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/rails/driver/destination`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          destLat: Number(destLat),
          destLng: Number(destLng),
          label,
          radiusKm: Number(radiusKm),
          hours: Number(hours),
          bonusAccept: 1.05,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Failed');
      toast.success('Destination preference set');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    const res = await fetch(`${API}/rails/driver/destination`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const j = await res.json();
    if (!res.ok) toast.error(j.message || 'Failed');
    else toast.success('Destination cleared');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Destination mode</h2>
        <p className="text-sm opacity-60 mt-1">Prefer trips heading toward a place.</p>
      </div>
      {(
        [
          ['Label', label, setLabel],
          ['Dest lat', destLat, setDestLat],
          ['Dest lng', destLng, setDestLng],
          ['Radius km', radiusKm, setRadiusKm],
          ['Hours active', hours, setHours],
        ] as const
      ).map(([name, value, set]) => (
        <label key={name} className="block text-sm">
          <span className="opacity-70">{name}</span>
          <input
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 bg-white"
            value={value}
            onChange={(e) => set(e.target.value)}
          />
        </label>
      ))}
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="w-full rounded-xl bg-teal-800 text-white py-3 font-semibold disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Set preference'}
      </button>
      <button
        type="button"
        onClick={clear}
        className="w-full rounded-xl bg-black/10 py-3 font-semibold"
      >
        Clear
      </button>
    </div>
  );
};

export default DriverDestinationPage;
