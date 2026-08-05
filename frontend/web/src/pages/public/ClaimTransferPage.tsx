import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

/** Public claim-link landing — create account to claim a transfer. */
export default function ClaimTransferPage() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const claimCode = code || params.get('code') || '';
  const [preview, setPreview] = useState<{
    senderName: string;
    amount: number;
    currency: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!claimCode) {
      setError('Invalid claim link');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API}/wallet/transfer/claim-preview/${encodeURIComponent(claimCode)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.status === 404 || !j?.data) {
          setPreview(null);
          setError('Transfer not found');
          return;
        }
        setPreview({
          senderName: j.data.senderName || 'Someone',
          amount: Number(j.data.amount ?? 0),
          currency: j.data.currency || 'GHS',
        });
      })
      .catch(() => {
        setPreview(null);
        setError('Unable to load transfer');
      })
      .finally(() => setLoading(false));
  }, [claimCode]);

  const fmt = () => {
    if (!preview) return '';
    return formatCurrency(Number(preview.amount), preview.currency);
  };

  const claim = () => {
    if (!claimCode) return;
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (token) {
      fetch(`${API}/wallet/transfer/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ claimCode }),
      })
        .then(() => navigate('/wallet'))
        .catch(() => navigate(`/register?claim=${encodeURIComponent(claimCode)}`));
      return;
    }
    navigate(`/register?claim=${encodeURIComponent(claimCode)}`);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 font-[Poppins,Montserrat,sans-serif]">
      <p className="text-2xl font-bold mb-10">Movr</p>
      {loading ? (
        <p className="text-[#A0A0A0]">Loading transfer…</p>
      ) : error || !preview ? (
        <>
          <p className="text-xl font-semibold mb-2">{error || 'Transfer not found'}</p>
          <p className="text-[#A0A0A0] text-center max-w-xs">
            This claim link is invalid or has expired.
          </p>
        </>
      ) : (
        <>
          <div className="w-20 h-20 rounded-full bg-[#1A3A2A] border-2 border-[#3FCF7A] flex items-center justify-center text-3xl mb-8">
            ✈
          </div>
          <p className="text-[#A0A0A0] mb-2">{preview.senderName} sent you</p>
          <p className="text-5xl font-bold mb-4 tracking-tight">{fmt()}</p>
          <p className="text-[#A0A0A0] text-center max-w-xs mb-10 leading-relaxed">
            Create a free Movr account to claim this transfer. Takes less than a minute.
          </p>
          <button
            type="button"
            onClick={claim}
            className="w-full max-w-sm rounded-full py-4 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
          >
            Claim with your phone number
          </button>
        </>
      )}
    </div>
  );
}
