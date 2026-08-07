import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { VerifiedBadgeWeb } from '@movr/design-system/components/VerifiedBadgeWeb';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Merchant account settings — BUSINESS + NOTIFICATIONS (mockup wired). */
export default function MerchantSettingsPage() {
  const [business, setBusiness] = useState({
    email: 'owner@boutique22.com',
    reg: 'BN-2024-88213',
    payout: 'GCB Bank · ****3390',
  });
  const [alerts, setAlerts] = useState({ newOrders: true, dailySummary: true });
  const [attestation, setAttestation] = useState<{ status?: string; explorerUrl?: string } | null>(
    null
  );

  useEffect(() => {
    axios
      .get(`${API}/merchant/me`, { headers: headers() })
      .then(async (res) => {
        const m = res.data?.data;
        if (!m) return;
        setBusiness({
          email: m.business_email || m.email || 'owner@boutique22.com',
          reg: m.registration_number || m.business_registration_number || 'BN-2024-88213',
          payout:
            typeof m.payout_account === 'string'
              ? m.payout_account
              : 'GCB Bank · ****3390',
        });
        if (m.notifications) {
          setAlerts({
            newOrders: m.notifications.new_order_alerts !== false,
            dailySummary: m.notifications.daily_sales_summary !== false,
          });
        }
        const uid = m.user_id;
        if (!uid) return;
        try {
          const a = await axios.get(`${API}/kyc/attestation/${uid}`, { headers: headers() });
          const row = a.data?.data;
          if (!row) return;
          const chain = String(row.chain || 'polygon-amoy');
          const explorer = row.tx_hash
            ? chain.includes('amoy')
              ? `https://amoy.polygonscan.com/tx/${row.tx_hash}`
              : `https://polygonscan.com/tx/${row.tx_hash}`
            : undefined;
          setAttestation({ status: row.status || row.attestationStatus, explorerUrl: explorer });
        } catch {
          /* none yet */
        }
      })
      .catch(() => undefined);
  }, []);

  const persistAlert = async (next: { newOrders: boolean; dailySummary: boolean }) => {
    setAlerts(next);
    try {
      await axios.patch(
        `${API}/merchant/settings/notifications`,
        {
          new_order_alerts: next.newOrders,
          daily_sales_summary: next.dailySummary,
        },
        { headers: headers() }
      );
    } catch {
      toast.error('Could not save notification setting');
    }
  };

  const Row = ({
    label,
    value,
    onClick,
  }: {
    label: string;
    value: string;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex justify-between gap-4 py-4 border-b border-border text-left disabled:cursor-default"
    >
      <span className="text-pure-white">{label}</span>
      <span className="text-text-secondary text-right">{value}</span>
    </button>
  );

  return (
    <MerchantShell activePath="/merchant/settings">
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">Account settings</h1>
        <VerifiedBadgeWeb status={attestation?.status} explorerUrl={attestation?.explorerUrl} />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">BUSINESS</p>
      <div className="mb-10 max-w-xl">
        <Row label="Business email" value={business.email} />
        <Row label="Registration number" value={business.reg} />
        <Row label="Payout account" value={business.payout} />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">NOTIFICATIONS</p>
      <div className="mb-10 max-w-xl">
        <Row
          label="New order alerts"
          value={alerts.newOrders ? 'On' : 'Off'}
          onClick={() => persistAlert({ ...alerts, newOrders: !alerts.newOrders })}
        />
        <Row
          label="Daily sales summary"
          value={alerts.dailySummary ? 'On' : 'Off'}
          onClick={() => persistAlert({ ...alerts, dailySummary: !alerts.dailySummary })}
        />
      </div>

      <Link to="/merchant/store" className="text-sm text-motion-blue hover:underline">
        Edit store profile →
      </Link>
    </MerchantShell>
  );
}
