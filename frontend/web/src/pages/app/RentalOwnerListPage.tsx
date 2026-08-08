import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import VehicleCatalogFields, {
  type VehicleCatalogValue,
} from '../../components/forms/VehicleCatalogFields';
import { TextField, fieldClassName, FormField } from '../../components/forms';
import { useAuthStore } from '../../store/auth.store';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  '/api/v1';

type Listed = {
  id: string;
  name: string;
  make: string;
  model: string;
  year?: number;
  daily_rate: number;
  currency_code: string;
  availability_status: string;
};

const EMPTY: VehicleCatalogValue = {
  make: '',
  model: '',
  year: null,
  color: '',
  chassisNumber: '',
  plateNumber: '',
  vehicleType: 'SUV',
  transmission: 'Auto',
  fuelType: '',
};

/** Rental owner — list a car using the global automobile catalog. */
export default function RentalOwnerListPage() {
  const token = useAuthStore((s) => s.token);
  const [form, setForm] = useState<VehicleCatalogValue>(EMPTY);
  const [dailyRate, setDailyRate] = useState('');
  const [seats, setSeats] = useState('5');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Listed[]>([]);

  const loadMine = () => {
    if (!token) return;
    fetch(`${API}/rentals/owner/vehicles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => setMine(j.data || []))
      .catch(() => setMine([]));
  };

  useEffect(() => {
    loadMine();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Sign in to list a vehicle');
      return;
    }
    if (!form.make || !form.model) {
      toast.error('Select make and model from the catalog');
      return;
    }
    if (!(Number(dailyRate) > 0)) {
      toast.error('Enter a daily rate');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/rentals/owner/vehicles`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          make: form.make,
          model: form.model,
          makeId: form.makeId,
          modelId: form.modelId,
          year: form.year,
          color: form.color,
          category: form.vehicleType || form.bodyStyle || 'Economy',
          seats: Number(seats) || 5,
          transmission: form.transmission || 'Auto',
          fuelType: form.fuelType,
          bodyStyle: form.bodyStyle || form.vehicleType,
          vin: form.vin || form.chassisNumber,
          chassisNumber: form.chassisNumber || form.vin,
          plateNumber: form.plateNumber,
          dailyRate: Number(dailyRate),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        throw new Error(json.message || 'Could not list vehicle');
      }
      toast.success(`${json.data?.name || 'Vehicle'} listed`);
      setForm(EMPTY);
      setDailyRate('');
      loadMine();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">List your car</h1>
          <p className="text-text-secondary text-sm mt-1">
            Make, model, year, and chassis autofill from the global automobile database
          </p>
        </div>
        <Link to="/rentals" className="text-sm text-text-secondary hover:underline">
          Browse rentals
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-black/10 p-5 sm:p-6">
        <VehicleCatalogFields value={form} onChange={setForm} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Daily rate"
            type="number"
            min={1}
            step="1"
            required
            value={dailyRate}
            onChange={(e) => setDailyRate(e.target.value)}
            placeholder="45000"
          />
          <FormField label="Seats">
            <select
              className={fieldClassName}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            >
              {[2, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-zinc-900 text-white font-semibold py-3.5 disabled:opacity-50"
        >
          {busy ? 'Listing…' : 'Publish listing'}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-3">Your listings ({mine.length})</h2>
        {mine.length === 0 ? (
          <p className="text-text-secondary text-sm">No cars listed yet.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3"
              >
                <div>
                  <p className="font-semibold">
                    {v.name}
                    {v.year ? ` · ${v.year}` : ''}
                  </p>
                  <p className="text-xs text-text-secondary capitalize">
                    {v.availability_status}
                  </p>
                </div>
                <p className="font-semibold">
                  {v.currency_code} {Number(v.daily_rate).toLocaleString()}
                  <span className="text-text-secondary text-xs font-normal"> /day</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
