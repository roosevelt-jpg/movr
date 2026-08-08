import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapPin, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';

const API =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  '/api/v1';

function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem('movr_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Ride details — loads live ride by id (no hardcoded trip data). */
const RideDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Ride not found');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const paths = [`${API}/rides/${id}`, `${API}/rides/${id}/receipt`];
        let data: any = null;
        for (const url of paths) {
          const res = await fetch(url, { headers: authHeaders() });
          const json = await res.json().catch(() => null);
          if (res.ok && json?.data) {
            data = json.data;
            break;
          }
        }
        if (cancelled) return;
        if (!data) {
          setError('Ride not found');
          setRide(null);
        } else {
          setRide(data);
          setError('');
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load ride');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const pickup =
    ride?.pickup_address || ride?.from || ride?.pickup_label || ride?.pickup || '';
  const dropoff =
    ride?.dropoff_address ||
    ride?.to ||
    ride?.destination_label ||
    ride?.destination ||
    '';
  const distance = Number(ride?.distance_km ?? ride?.distanceKm ?? 0);
  const duration = Number(ride?.duration_minutes ?? ride?.durationMinutes ?? 0);
  const fare = Number(
    ride?.actual_fare ?? ride?.estimated_fare ?? ride?.totalPaid ?? ride?.total_paid ?? 0
  );
  const currency = ride?.currency || ride?.currency_code || 'NGN';
  const status = ride?.status || ride?.statusLabel || '';

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-motion-blue hover:opacity-80 font-semibold"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-2xl font-bold mb-2">Ride details</h2>
        {status ? (
          <p className="text-sm text-text-secondary mb-6 capitalize">{String(status).replace(/_/g, ' ')}</p>
        ) : (
          <div className="mb-6" />
        )}

        {loading ? <p className="text-text-secondary">Loading…</p> : null}
        {error ? <p className="text-error">{error}</p> : null}

        {!loading && !error && ride ? (
          <>
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-surface-elevated rounded-lg">
                <p className="text-sm text-text-secondary mb-1">Pickup</p>
                <div className="flex items-center gap-2">
                  <MapPin className="text-motion-blue shrink-0" size={20} />
                  <p className="font-semibold">{pickup || '—'}</p>
                </div>
              </div>
              <div className="p-4 bg-surface-elevated rounded-lg">
                <p className="text-sm text-text-secondary mb-1">Dropoff</p>
                <div className="flex items-center gap-2">
                  <MapPin className="text-motion-blue shrink-0" size={20} />
                  <p className="font-semibold">{dropoff || '—'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-elevated p-4 mb-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-text-secondary">Distance</p>
                  <p className="text-xl font-bold">{distance ? `${distance} km` : '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Duration</p>
                  <p className="text-xl font-bold">{duration ? `${duration} min` : '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Fare</p>
                  <p className="text-xl font-bold text-success">
                    {fare ? formatCurrency(fare, currency) : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6 space-y-3">
              <Link
                to="/help"
                className="block w-full text-center bg-motion-blue text-pure-white py-3 rounded-lg font-semibold hover:opacity-90"
              >
                Help
              </Link>
              {id ? (
                <>
                  <Link
                    to={`/ride/${id}/rate`}
                    className="block w-full text-center border border-border py-3 rounded-lg font-semibold hover:bg-surface-elevated"
                  >
                    Rate ride
                  </Link>
                  <Link
                    to={`/ride/${id}/receipt`}
                    className="block w-full text-center border border-border py-3 rounded-lg font-semibold hover:bg-surface-elevated"
                  >
                    View receipt
                  </Link>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default RideDetailPage;
