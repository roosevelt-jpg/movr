// frontend/web/src/pages/app/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ridesApi, marketplaceApi, walletApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';

// Icons
import MarkerIcon from 'leaflet/dist/images/marker-icon.png';
import MarkerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: MarkerIcon,
  shadowUrl: MarkerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.setIcon(DefaultIcon);

const MODULES = ['Ride', 'Shop', 'Parcel', 'Rental'] as const;
const SHORTCUTS = ['Home', 'Work', 'Recent', 'Favorites'] as const;

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [activeModule, setActiveModule] = useState<(typeof MODULES)[number]>('Ride');
  const [pickupLocation, setPickupLocation] = useState<any>(null);
  const [dropoffLocation, setDropoffLocation] = useState<any>(null);
  const [rideType, setRideType] = useState<'standard' | 'express' | 'premium'>('standard');
  const [isRequesting, setIsRequesting] = useState(false);

  // Fetch wallet balance
  const { data: walletData } = useQuery('wallet', () => walletApi.getBalance());

  // Fetch recent rides
  const { data: ridesData } = useQuery('recent-rides', () =>
    ridesApi.getRideHistory(5, 0)
  );

  // Fetch featured stores
  const { data: storesData } = useQuery('featured-stores', () =>
    marketplaceApi.getStores({ limit: 4 })
  );

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setPickupLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      });
    }
  }, []);

  const handleRequestRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      toast.error('Please set pickup and dropoff locations');
      return;
    }

    setIsRequesting(true);
    try {
      const response = await ridesApi.requestRide({
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        dropoffLat: dropoffLocation.latitude,
        dropoffLng: dropoffLocation.longitude,
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
    <div className="min-h-screen bg-jet-black text-pure-white">
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-display font-semibold">Hi, {user?.firstName}</h1>
        <p className="text-text-secondary mt-1">Where to?</p>
      </div>

      <div className="px-4 pt-4 flex gap-2 overflow-x-auto">
        {SHORTCUTS.map((s) => (
          <button
            key={s}
            className="shrink-0 rounded-pill bg-surface-elevated px-4 py-2 text-sm text-text-primary border border-border"
            type="button"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 flex gap-6 border-b border-border">
        {MODULES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setActiveModule(m);
              if (m === 'Shop') navigate('/marketplace');
              if (m === 'Parcel' || m === 'Rental') toast('Coming soon');
            }}
            className={`pb-3 text-sm font-semibold ${
              activeModule === m ? 'text-pure-white' : 'text-text-secondary'
            }`}
          >
            {m}
            {activeModule === m ? (
              <span className="mt-2 block h-0.5 rounded-full bg-movr-gradient" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ride Request Section */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-lg border border-border p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">{activeModule}</h2>

              {/* Map */}
              <div className="mb-6 h-64 rounded-lg overflow-hidden border border-border bg-surface-elevated">
                {pickupLocation && (
                  <MapContainer
                    center={[pickupLocation.latitude, pickupLocation.longitude]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                    />
                    <Marker position={[pickupLocation.latitude, pickupLocation.longitude]}>
                      <Popup>Your Location</Popup>
                    </Marker>
                  </MapContainer>
                )}
              </div>

              {/* Input Fields */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    placeholder="Enter pickup location"
                    className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-md text-pure-white placeholder:text-text-secondary focus:ring-2 focus:ring-electric-violet focus:border-transparent"
                    onChange={(e) => {
                      // In real app, use geocoding
                      setPickupLocation({
                        latitude: 5.6037,
                        longitude: -0.187,
                        address: e.target.value,
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Dropoff Location
                  </label>
                  <input
                    type="text"
                    placeholder="Enter dropoff location"
                    className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-md text-pure-white placeholder:text-text-secondary focus:ring-2 focus:ring-electric-violet focus:border-transparent"
                    onChange={(e) => {
                      setDropoffLocation({
                        latitude: 5.6096,
                        longitude: -0.1889,
                        address: e.target.value,
                      });
                    }}
                  />
                </div>

                {/* Ride Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Ride Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['standard', 'express', 'premium'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setRideType(type)}
                        className={`p-3 rounded-md border transition ${
                          rideType === type
                            ? 'border-electric-violet bg-surface-elevated'
                            : 'border-border hover:border-text-secondary'
                        }`}
                      >
                        <div className="capitalize font-semibold text-pure-white">
                          {type}
                        </div>
                        <div className="text-sm text-text-secondary mt-1">
                          {type === 'standard' && 'GHS 5.00'}
                          {type === 'express' && 'GHS 7.50'}
                          {type === 'premium' && 'GHS 10.00'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Request Button */}
              <button
                onClick={handleRequestRide}
                disabled={isRequesting}
                className="w-full bg-movr-gradient text-pure-white py-3 rounded-pill font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                {isRequesting ? 'Requesting...' : 'Request Ride'}
              </button>
            </div>

            {/* Recent Rides */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Rides</h3>
              {ridesData?.data?.data?.rides?.length ? (
                <div className="space-y-3">
                  {ridesData.data.data.rides.slice(0, 3).map((ride: any) => (
                    <div
                      key={ride.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/ride/${ride.id}`)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {ride.pickupAddress}
                          </p>
                          <p className="text-sm text-gray-500">
                            → {ride.dropoffAddress}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-600">
                            GHS {ride.actualFare || ride.estimatedFare}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {ride.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-6">No recent rides</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Wallet */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Your Wallet</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Balance</p>
                  <p className="text-2xl font-bold text-purple-600">
                    GHS {walletData?.data?.data?.balance_fiat || '0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reward Points</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {walletData?.data?.data?.balance_points || '0'}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/wallet')}
                  className="w-full bg-purple-100 text-purple-600 py-2 rounded-lg font-semibold hover:bg-purple-200 transition"
                >
                  Add Funds
                </button>
              </div>
            </div>

            {/* Featured Stores */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Popular Stores</h3>
              <div className="space-y-3">
                {storesData?.data?.data?.slice(0, 3).map((store: any) => (
                  <button
                    key={store.id}
                    onClick={() => navigate(`/store/${store.id}`)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <p className="font-semibold text-gray-800">{store.name}</p>
                    <p className="text-sm text-gray-500">⭐ {store.rating}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => navigate('/marketplace')}
                className="w-full mt-4 text-purple-600 font-semibold hover:underline"
              >
                View All Stores →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
