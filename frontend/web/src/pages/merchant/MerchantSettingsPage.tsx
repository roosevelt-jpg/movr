import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import MerchantShell from '../../layouts/MerchantShell';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Merchant account settings — business + notifications. */
export default function MerchantSettingsPage() {
  const [business, setBusiness] = useState({
    email: 'owner@boutique22.com',
    reg: 'BN-2024-88213',
    payout: 'GCB Bank · ****3390',
  });
  const [alerts, setAlerts] = useState({ newOrders: true, dailySummary: true });

  useEffect(() => {
    axios
      .get(`${API}/merchant/me`, { headers: headers() })
      .then((res) => {
        const m = res.data?.data;
        if (!m) return;
        setBusiness((b) => ({
          email: m.email || m.business_email || b.email,
          reg: m.registration_number || m.reg_number || b.reg,
          payout: m.payout_account || b.payout,
        }));
      })
      .catch(() => undefined);
  }, []);

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 py-4 border-b border-border">
      <span className="text-pure-white">{label}</span>
      <span className="text-text-secondary text-right">{value}</span>
    </div>
  );

  return (
    <MerchantShell activePath="/merchant/settings">
      <h1 className="text-3xl font-bold mb-8">Account settings</h1>

      <p className="text-xs tracking-wider text-text-secondary mb-2">BUSINESS</p>
      <div className="mb-10 max-w-xl">
        <Row label="Business email" value={business.email} />
        <Row label="Registration number" value={business.reg} />
        <Row label="Payout account" value={business.payout} />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">NOTIFICATIONS</p>
      <div className="mb-10 max-w-xl">
        <button
          type="button"
          className="w-full flex justify-between gap-4 py-4 border-b border-border text-left"
          onClick={() => setAlerts((a) => ({ ...a, newOrders: !a.newOrders }))}
        >
          <span>New order alerts</span>
          <span className="text-text-secondary">{alerts.newOrders ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          className="w-full flex justify-between gap-4 py-4 border-b border-border text-left"
          onClick={() => setAlerts((a) => ({ ...a, dailySummary: !a.dailySummary }))}
        >
          <span>Daily sales summary</span>
          <span className="text-text-secondary">{alerts.dailySummary ? 'On' : 'Off'}</span>
        </button>
      </div>

      <Link to="/merchant/store" className="text-sm text-motion-blue hover:underline">
        Edit store profile →
      </Link>
    </MerchantShell>
  );
}
