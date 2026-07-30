import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Star, DollarSign, MessageCircle, ArrowLeft } from 'lucide-react';

const RideDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Ride Details</h2>
        
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Pickup</p>
            <div className="flex items-center gap-2">
              <MapPin className="text-blue-600" size={20} />
              <p className="font-semibold text-gray-900">Lekki Phase 1</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Dropoff</p>
            <div className="flex items-center gap-2">
              <MapPin className="text-blue-600" size={20} />
              <p className="font-semibold text-gray-900">Victoria Island</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Distance</p>
              <p className="text-xl font-bold text-gray-900">12.5 km</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Duration</p>
              <p className="text-xl font-bold text-gray-900">28 min</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fare</p>
              <p className="text-xl font-bold text-green-600">₦2,500</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 space-y-3">
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Help
          </button>
          <button className="w-full border border-gray-300 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
            Rate Ride
          </button>
        </div>
      </div>
    </div>
  );
};

export default RideDetailPage;
