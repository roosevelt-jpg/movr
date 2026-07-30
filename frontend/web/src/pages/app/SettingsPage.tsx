import React from 'react';
import { Bell, Lock, Eye, Smartphone, HelpCircle, LogOut } from 'lucide-react';

const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-600 to-gray-500 rounded-xl p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-gray-100">Manage your preferences and account settings</p>
      </div>

      <div className="card">
        <div className="divide-y divide-gray-200">
          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Bell className="text-gray-600" size={24} />
              <span className="font-semibold text-gray-900">Notifications</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Lock className="text-gray-600" size={24} />
              <span className="font-semibold text-gray-900">Privacy & Security</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Eye className="text-gray-600" size={24} />
              <span className="font-semibold text-gray-900">Appearance</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Smartphone className="text-gray-600" size={24} />
              <span className="font-semibold text-gray-900">App Settings</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <HelpCircle className="text-gray-600" size={24} />
              <span className="font-semibold text-gray-900">Help & Support</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors">
            <div className="flex items-center gap-3">
              <LogOut className="text-red-600" size={24} />
              <span className="font-semibold text-red-600">Logout</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>
        </div>
      </div>

      <div className="text-center text-sm text-gray-600">
        <p>MOVR v1.0.0</p>
        <p>© 2024 MOVR. All rights reserved.</p>
      </div>
    </div>
  );
};

export default SettingsPage;
