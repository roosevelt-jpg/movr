import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { Bell, Lock, HelpCircle, LogOut, ChevronRight } from 'lucide-react';

/** Settings — dark list aligned with profile support section. */
const SettingsPage: React.FC = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const items = [
    { icon: Bell, label: 'Notifications', to: '/settings/notifications' },
    { icon: Lock, label: 'Privacy & security', to: '/privacy' },
    { icon: HelpCircle, label: 'Help centre', to: '/help' },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif] p-6 md:p-8 max-w-xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <div className="rounded-2xl bg-[#121212] border border-[#2A2A2A] divide-y divide-[#2A2A2A]">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.to)}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <item.icon size={20} />
            <span className="flex-1 font-medium">{item.label}</span>
            <ChevronRight size={18} className="text-[#888]" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full flex items-center gap-3 p-4 text-[#E57373]"
        >
          <LogOut size={20} />
          <span className="font-semibold">Sign out</span>
        </button>
      </div>
      <p className="text-center text-sm text-[#666] mt-8">Movr v1.0.0</p>
    </div>
  );
};

export default SettingsPage;
