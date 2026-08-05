import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import MerchantShell from '../../layouts/MerchantShell';
import { VerifiedBadgeWeb } from '@movr/design-system/components/VerifiedBadge';
import { ThemeToggle } from '../../theme/ThemeProvider';
import OnOffButton from '../../components/OnOffButton';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Merchant account settings — business + notifications + KYC attestation badge. */
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
        setBusiness((b) => ({
          email: m.email || m.business_email || b.email,
          reg: m.registration_number || m.reg_number || b.reg,
          payout: m.payout_account || b.payout,
        }));
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

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 py-4 border-b border-border">
      <span className="text-text-primary">{label}</span>
      <span className="text-text-secondary text-right">{value}</span>
    </div>
  );

  return (
    <MerchantShell activePath="/merchant/settings">
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">Account settings</h1>
        <VerifiedBadgeWeb status={attestation?.status} explorerUrl={attestation?.explorerUrl} />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">APPEARANCE</p>
      <div className="mb-10 max-w-xl rounded-2xl border border-border bg-surface-elevated p-4">
        <ThemeToggle />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">BUSINESS</p>
      <div className="mb-10 max-w-xl">
        <Row label="Business email" value={business.email} />
        <Row label="Registration number" value={business.reg} />
        <Row label="Payout account" value={business.payout} />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">NOTIFICATIONS</p>
      <div className="mb-10 max-w-xl">
        <div className="flex justify-between items-center gap-4 py-4 border-b border-border">
          <span>New order alerts</span>
          <OnOffButton
            on={alerts.newOrders}
            onClick={() => setAlerts((a) => ({ ...a, newOrders: !a.newOrders }))}
          />
        </div>
        <div className="flex justify-between items-center gap-4 py-4 border-b border-border">
          <span>Daily summary</span>
          <OnOffButton
            on={alerts.dailySummary}
            onClick={() => setAlerts((a) => ({ ...a, dailySummary: !a.dailySummary }))}
          />
        </div>
      </div>

      <Link to="/merchant/store" className="text-sm text-motion-blue hover:underline">
        Edit store profile →
      </Link>
    </MerchantShell>
  );
}
