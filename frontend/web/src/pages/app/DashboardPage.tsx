import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Home, Briefcase, Clock, Car, Heart, Package, KeyRound } from 'lucide-react';
import { ridesApi, walletApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { useLocaleStore } from '../../store/locale.store';

const MODULES = [
  { id: 'Ride', icon: Car },
  { id: 'Shop', icon: Heart },
  { id: 'Deliver', icon: Package },
  { id: 'Rentals', icon: KeyRound },
] as const;

const SHORTCUTS = [
  { id: 'Home', icon: Home },
  { id: 'Work', icon: Briefcase },
  { id: 'Recent', icon: Clock },
] as const;

/** Customer ride booking shell — matches web dashboard mockup. */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const countryCode = useLocaleStore((s) => s.country) || user?.country || 'GH';
  const [activeModule, setActiveModule] = useState<(typeof MODULES)[number]['id']>('Ride');
  const [pickupAddress, setPickupAddress] = useState('12 Oxford St');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupLocation, setPickupLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [dropoffLocation, setDropoffLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [promise, setPromise] = useState<any>(null);
  const [fareMode, setFareMode] = useState<'now' | 'share'>('now');
  const [payWithCredit, setPayWithCredit] = useState(false);
  const [mobilityCredit, setMobilityCredit] = useState(0);
  const [catalogHint, setCatalogHint] = useState('');

  useEffect(() => {
    const API =
      (import.meta as any).env?.VITE_API_URL ||
      process.env.REACT_APP_API_URL ||
      'http://localhost:3000/api/v1';
    const token =
      localStorage.getItem('movr_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken');
    fetch(`${API}/trust/promise`)
      .then((r) => r.json())
      .then((j) => setPromise(j?.data || null))
      .catch(() => undefined);
    fetch(`${API}/rails/catalog?countryCode=${encodeURIComponent(countryCode)}`)
      .then((r) => r.json())
      .then((j) => {
        const rails = (j?.data?.rails || []).slice(0, 4).join(' · ');
        if (rails) setCatalogHint(rails);
      })
      .catch(() => undefined);
    fetch(`${API}/rails/credit`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => setMobilityCredit(Number(j?.data?.mobilityCredit || 0)))
      .catch(() => undefined);
  }, [countryCode]);

  const { data: addressesData } = useQuery('saved-addresses', () => walletApi.getAddresses());

  const savedAddresses: Array<{ label: string; address: string; lat?: number; lng?: number }> =
    addressesData?.data?.data || [];

  const applySaved = (label: string) => {
    const row = savedAddresses.find((a) => a.label.toLowerCase() === label.toLowerCase());
    if (row) {
      setDropoffAddress(row.address);
      if (row.lat != null && row.lng != null) {
        setDropoffLocation({ latitude: Number(row.lat), longitude: Number(row.lng) });
      }
      setActiveModule('Ride');
      toast.success(`Destination set to ${label}`);
      return;
    }
    toast(`No saved “${label}” address yet — add one from Profile`, { icon: '📍' });
    setActiveModule('Ride');
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPickupLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => setPickupLocation({ latitude: 5.6037, longitude: -0.187 })
      );
    } else {
      setPickupLocation({ latitude: 5.6037, longitude: -0.187 });
    }
  }, []);

  // Prefer live Home address as default pickup when available
  useEffect(() => {
    const home = savedAddresses.find((a) => a.label.toLowerCase() === 'home');
    if (home?.address) {
      setPickupAddress(home.address.replace(/,.*$/, '').trim() || home.address);
      if (home.lat != null && home.lng != null) {
        setPickupLocation({ latitude: Number(home.lat), longitude: Number(home.lng) });
      }
    }
  }, [savedAddresses]);

  const handleConfirmPickup = async () => {
    if (activeModule === 'Deliver') {
      navigate('/marketplace');
      return;
    }
    const pickup = pickupLocation || { latitude: 5.6037, longitude: -0.187 };
    const dropoff = dropoffLocation || { latitude: 5.605, longitude: -0.17 };
    if (!dropoffAddress.trim()) {
      toast.error('Enter a destination');
      return;
    }
    setIsRequesting(true);
    try {
      const API =
        (import.meta as any).env?.VITE_API_URL ||
        process.env.REACT_APP_API_URL ||
        'http://localhost:3000/api/v1';
      const token =
        localStorage.getItem('movr_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken');
      if (fareMode === 'share') {
        const res = await fetch(`${API}/rails/share/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            pickupLat: pickup.latitude,
            pickupLng: pickup.longitude,
            dropoffLat: dropoff.latitude,
            dropoffLng: dropoff.longitude,
            pickupAddress,
            dropoffAddress,
            countryCode,
            payWithMobilityCredit: payWithCredit,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Share pool failed');
        const rideId = json.data?.booking?.rideId || json.data?.booking?.id;
        const waiting = json.data?.waitingForRiders;
        const split = json.data?.fareSplit?.perRider;
        toast.success(
          waiting
            ? 'Joined share pool — waiting for more riders for one vehicle'
            : split
              ? `Shared vehicle matched · ${split} each`
              : 'Shared vehicle matched'
        );
        navigate(rideId ? `/ride/active/${rideId}` : '/history');
        return;
      }
      const res = await fetch(`${API}/rails/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pickupLat: pickup.latitude,
          pickupLng: pickup.longitude,
          dropoffLat: dropoff.latitude,
          dropoffLng: dropoff.longitude,
          pickupAddress,
          dropoffAddress,
          vehicleTypeCode: 'economy',
          fareMode: 'now',
          payWithMobilityCredit: payWithCredit,
          sourceChannel: 'app',
          countryCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Booking failed');
      toast.success(payWithCredit ? 'Ride booked with ride credit' : 'Ride requested! Finding a driver...');
      navigate(`/ride/active/${json.data?.rideId || json.data?.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to request ride');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <header className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:justify-between sm:px-6">
        <div className="shrink-0 text-lg font-bold tracking-tight sm:text-xl">Movr</div>
        <div className="order-3 flex w-full gap-2 overflow-x-auto sm:order-none sm:w-auto">
          {SHORTCUTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id === 'Home' || s.id === 'Work') applySaved(s.id);
                else navigate('/history');
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#1A1A1A] px-3 py-2 text-xs text-zinc-300 hover:text-white sm:px-4 sm:text-sm"
            >
              <s.icon size={14} /> {s.id}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2A2A2A]"
          title={user?.firstName || 'Profile'}
        />
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-72px)] px-4 pb-4 gap-4">
        <aside className="w-full lg:w-[300px] shrink-0 space-y-6">
          <nav className="space-y-1">
            {MODULES.map((m) => {
              const active = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActiveModule(m.id);
                    if (m.id === 'Shop') navigate('/marketplace');
                    if (m.id === 'Deliver') navigate('/explore');
                    if (m.id === 'Rentals') navigate('/rentals');
                  }}
                  className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold ${
                    active
                      ? 'bg-gradient-to-r from-[#6345ED] to-[#3B5CFF] text-white'
                      : 'text-white hover:bg-[#111]'
                  }`}
                >
                  <m.icon size={18} /> {m.id}
                </button>
              );
            })}
          </nav>

          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-3 rounded-2xl bg-[#1A1A1A] px-4 py-3.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0" />
              <input
                className="bg-transparent flex-1 text-sm outline-none text-white"
                value={`Pickup: ${pickupAddress}`}
                onChange={(e) => {
                  const raw = e.target.value.replace(/^Pickup:\s*/i, '');
                  setPickupAddress(raw);
                  setPickupLocation({ latitude: 5.6037, longitude: -0.187 });
                }}
                placeholder="Pickup: 12 Oxford St"
              />
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-[#1A1A1A] px-4 py-3.5">
              <span className="w-2.5 h-2.5 rounded-full border border-white shrink-0" />
              <input
                className="bg-transparent flex-1 text-sm outline-none placeholder:text-zinc-500 text-white"
                value={dropoffAddress}
                onChange={(e) => {
                  setDropoffAddress(e.target.value);
                  setDropoffLocation({ latitude: 5.6096, longitude: -0.1889 });
                }}
                placeholder="Enter destination"
              />
            </div>

            <div className="flex gap-2">
              {(
                [
                  { id: 'now' as const, label: 'Now' },
                  { id: 'share' as const, label: 'Share pool' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFareMode(m.id)}
                  className={`flex-1 rounded-full py-2 text-xs font-semibold ${
                    fareMode === m.id
                      ? 'bg-gradient-to-r from-[#6345ED] to-[#3B5CFF]'
                      : 'bg-[#1A1A1A] text-zinc-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-400 px-1 cursor-pointer">
              <input
                type="checkbox"
                checked={payWithCredit}
                onChange={(e) => setPayWithCredit(e.target.checked)}
              />
              Pay with ride credit ({mobilityCredit.toLocaleString()})
              {fareMode === 'share' ? ' · charged when pool dispatches' : ''}
            </label>
            {catalogHint ? (
              <p className="text-[10px] text-zinc-600 px-1">Rails: {catalogHint}</p>
            ) : null}

            <button
              type="button"
              onClick={handleConfirmPickup}
              disabled={isRequesting}
              className="w-full rounded-full py-3.5 font-semibold text-white bg-gradient-to-r from-[#6345ED] to-[#3B5CFF] disabled:opacity-50"
            >
              {isRequesting
                ? 'Requesting...'
                : fareMode === 'share'
                  ? 'Join share pool'
                  : 'Confirm pickup'}
            </button>
            {promise ? (
              <p className="text-[11px] text-zinc-500 leading-relaxed px-1">
                {promise.matchSlaText} · {promise.noShowText} · {promise.keep100Note}
              </p>
            ) : null}
          </div>
        </aside>

        <main className="flex-1 min-h-[480px] rounded-3xl overflow-hidden bg-[#141414] relative flex items-center justify-center">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #2A2A2A 0, #2A2A2A 1px, transparent 0, transparent 50%)',
              backgroundSize: '28px 28px',
            }}
          />
          <div className="relative w-16 h-16 rounded-full bg-[#3B5CFF]/30 flex items-center justify-center shadow-[0_0_40px_rgba(59,92,255,0.55)]">
            <div className="w-5 h-5 rounded-full border-2 border-[#3B5CFF] bg-[#3B5CFF]/80" />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
