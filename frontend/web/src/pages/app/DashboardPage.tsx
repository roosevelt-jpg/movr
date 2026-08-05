import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Home, Briefcase, Clock, Car, Heart, Package, KeyRound } from 'lucide-react';
import { ridesApi, marketplaceApi, walletApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { formatCurrency } from '../../lib/currency';

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

/** Customer web dashboard — sidebar booking + map (mockup). */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
  const [rideType, setRideType] = useState<'standard' | 'express' | 'premium'>('standard');
  const [isRequesting, setIsRequesting] = useState(false);

  const { data: walletData } = useQuery('wallet', () => walletApi.getBalance());
  const { data: ridesData } = useQuery('recent-rides', () => ridesApi.getRideHistory(5, 0));
  const { data: storesData } = useQuery('featured-stores', () =>
    marketplaceApi.getStores({ limit: 4 })
  );

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setPickupLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      });
    } else {
      setPickupLocation({ latitude: 5.6037, longitude: -0.187 });
    }
  }, []);

  const handleRequestRide = async () => {
    const pickup = pickupLocation || { latitude: 5.6037, longitude: -0.187 };
    const dropoff = dropoffLocation || { latitude: 5.605, longitude: -0.17 };
    if (!dropoffAddress && !dropoffLocation) {
      toast.error('Enter a destination');
      return;
    }
    setIsRequesting(true);
    try {
      const response = await ridesApi.requestRide({
        pickupLat: pickup.latitude,
        pickupLng: pickup.longitude,
        dropoffLat: dropoff.latitude,
        dropoffLng: dropoff.longitude,
        rideType,
      });
      toast.success('Ride requested! Finding a driver...');
      navigate(`/ride/active/${response.data.data.rideId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to request ride');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-pure-white font-[Poppins,Montserrat,sans-serif]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="text-xl font-bold">Movr</div>
        <div className="flex gap-2">
          {SHORTCUTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-surface-elevated border border-border px-4 py-2 text-sm text-text-secondary"
            >
              <s.icon size={14} /> {s.id}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-full bg-border"
          title={user?.firstName || 'Profile'}
        />
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-73px)]">
        <aside className="w-full lg:w-80 shrink-0 border-r border-border p-4 space-y-4">
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
                  }}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
                    active
                      ? 'bg-movr-gradient text-pure-white'
                      : 'text-text-secondary hover:text-pure-white'
                  }`}
                >
                  <m.icon size={18} /> {m.id}
                </button>
              );
            })}
          </nav>

          {activeModule === 'Ride' || activeModule === 'Deliver' ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 rounded-xl bg-surface-elevated border border-border px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0" />
                <input
                  className="bg-transparent flex-1 text-sm outline-none"
                  value={pickupAddress}
                  onChange={(e) => {
                    setPickupAddress(e.target.value);
                    setPickupLocation({ latitude: 5.6037, longitude: -0.187 });
                  }}
                  placeholder="Pickup"
                />
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-elevated border border-border px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full border border-pure-white shrink-0" />
                <input
                  className="bg-transparent flex-1 text-sm outline-none placeholder:text-text-secondary"
                  value={dropoffAddress}
                  onChange={(e) => {
                    setDropoffAddress(e.target.value);
                    setDropoffLocation({ latitude: 5.6096, longitude: -0.1889 });
                  }}
                  placeholder="Enter destination"
                />
              </div>

              {activeModule === 'Ride' ? (
                <div className="grid grid-cols-3 gap-2">
                  {(['standard', 'express', 'premium'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRideType(type)}
                      className={`rounded-lg border p-2 text-xs capitalize ${
                        rideType === type
                          ? 'border-motion-blue bg-surface-elevated'
                          : 'border-border text-text-secondary'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleRequestRide}
                disabled={isRequesting}
                className="w-full rounded-xl py-3.5 font-semibold bg-movr-gradient disabled:opacity-50"
              >
                {isRequesting
                  ? 'Requesting...'
                  : activeModule === 'Deliver'
                    ? 'Find a courier'
                    : 'Confirm pickup'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-text-secondary pt-2">
              Open {activeModule} from the menu — marketplace and rentals stay available.
            </p>
          )}

          <div className="rounded-xl bg-surface-elevated border border-border p-4 mt-4">
            <p className="text-xs text-text-secondary">Wallet</p>
            <p className="text-xl font-bold mt-1">
              {formatCurrency(
                Number(walletData?.data?.data?.balance_fiat ?? walletData?.data?.data?.balance ?? 0),
                walletData?.data?.data?.currency
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="text-sm text-motion-blue mt-2"
            >
              Add funds
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-6 flex flex-col gap-4">
          <div className="flex-1 min-h-[420px] rounded-2xl overflow-hidden border border-border bg-surface relative flex items-center justify-center">
            <div
              className="absolute inset-0 opacity-35"
              style={{
                backgroundImage:
                  'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="relative w-14 h-14 rounded-full bg-motion-blue/25 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-motion-blue" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface-elevated border border-border p-4">
              <h3 className="font-semibold mb-3">Recent rides</h3>
              {ridesData?.data?.data?.rides?.length ? (
                <div className="space-y-2">
                  {ridesData.data.data.rides.slice(0, 3).map((ride: any) => (
                    <button
                      key={ride.id}
                      type="button"
                      onClick={() => navigate(`/ride/${ride.id}`)}
                      className="w-full text-left text-sm border-b border-border py-2"
                    >
                      <span className="text-pure-white">{ride.pickupAddress}</span>
                      <span className="text-text-secondary"> → {ride.dropoffAddress}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No recent rides</p>
              )}
            </div>
            <div className="rounded-2xl bg-surface-elevated border border-border p-4">
              <h3 className="font-semibold mb-3">Popular stores</h3>
              {storesData?.data?.data?.slice(0, 3).map((store: any) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => navigate(`/store/${store.id}`)}
                  className="block w-full text-left text-sm py-2 border-b border-border"
                >
                  {store.name}
                </button>
              )) || <p className="text-sm text-text-secondary">Browse marketplace</p>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
