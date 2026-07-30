import React, { useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { Camera, Mail, Phone, MapPin, User } from 'lucide-react';

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">Profile</h1>
        <p className="text-indigo-100">Manage your account information</p>
      </div>

      {/* Profile Picture */}
      <div className="card p-8 text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl text-white font-bold">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <button className="flex items-center justify-center gap-2 mx-auto mb-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          <Camera size={20} />
          Change Photo
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{user?.firstName} {user?.lastName}</h2>
        <p className="text-gray-600 capitalize">{user?.userType}</p>
      </div>

      {/* Profile Information */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            {isEditing ? 'Save' : 'Edit'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Mail className="text-gray-400" size={20} />
              <input
                type="email"
                value={user?.email || ''}
                readOnly={!isEditing}
                className={`flex-1 bg-transparent font-medium ${isEditing ? '' : 'cursor-default'}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Phone className="text-gray-400" size={20} />
              <input
                type="tel"
                value={user?.phone || ''}
                readOnly={!isEditing}
                className="flex-1 bg-transparent font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <MapPin className="text-gray-400" size={20} />
              <input
                type="text"
                value={user?.city || ''}
                readOnly={!isEditing}
                className="flex-1 bg-transparent font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-400 text-xl">🌍</span>
              <input
                type="text"
                value={user?.country || ''}
                readOnly={!isEditing}
                className="flex-1 bg-transparent font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Account Security */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Security</h3>
        <button className="w-full p-4 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-colors font-medium">
          Change Password
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
