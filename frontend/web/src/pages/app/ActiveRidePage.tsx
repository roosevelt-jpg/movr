import React from 'react';
import { MapPin, Phone, Star, MessageCircle, X } from 'lucide-react';

const ActiveRidePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="h-64 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
          <div className="text-center">
            <p className="text-lg opacity-75">Map Loading...</p>
            <p className="text-2xl font-bold">🗺️</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Ride</h2>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 font-semibold">✓ Driver Assigned</p>
          <p className="text-sm text-yellow-700">Ahmed Hassan • 4.9★ (245 rides)</p>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
            A
          </div>
          <div className="flex-1 ml-4">
            <p className="font-bold text-gray-900">Ahmed Hassan</p>
            <p className="text-sm text-gray-600">Silver Driver</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-blue-100 text-blue-600 p-2 rounded-full hover:bg-blue-200 transition-colors">
              <Phone size={20} />
            </button>
            <button className="bg-blue-100 text-blue-600 p-2 rounded-full hover:bg-blue-200 transition-colors">
              <MessageCircle size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <MapPin className="text-blue-600 flex-shrink-0" size={20} />
            <div>
              <p className="text-xs text-gray-600">Pickup In</p>
              <p className="font-semibold text-gray-900">3 minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <MapPin className="text-blue-600 flex-shrink-0" size={20} />
            <div>
              <p className="text-xs text-gray-600">Arriving In</p>
              <p className="font-semibold text-gray-900">28 minutes</p>
            </div>
          </div>
        </div>

        <button className="w-full border border-red-300 text-red-600 py-3 rounded-lg font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
          <X size={20} />
          Cancel Ride
        </button>
      </div>
    </div>
  );
};

export default ActiveRidePage;
