import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ridesApi } from '../../services/api';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { formatCurrency } from '../../lib/currency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_token') || localStorage.getItem('token') || ''}`,
  'Content-Type': 'application/json',
});

/** Driver matched — ETA map, Call/Message/SOS, wallet fare, Cancel. */
const ActiveRidePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency: locCurrency } = useLocalCurrency();
  const [ride, setRide] = useState<any>(null);
  const [proxy, setProxy] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBody, setChatBody] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [sosMsg, setSosMsg] = useState('');
  const [shareMsg, setShareMsg] = useState('');
  const [noticeAcked, setNoticeAcked] = useState(false);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!id) return;
    ridesApi
      .getRideDetails(id)
      .then((res) => {
        setRide(res.data?.data || res.data);
        setError('');
      })
      .catch(() => setError('Could not load active ride'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    setNoticeAcked(false);
    load();
    const t = setInterval(load, 8000);
    fetch(`${API}/rides/${id}/masked-session`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.customerProxyNumber) setProxy(j.data.customerProxyNumber);
      })
      .catch(() => undefined);
    return () => clearInterval(t);
  }, [id]);

  const triggerSos = async () => {
    if (!id) return;
    try {
      await fetch(`${API}/sos/trigger`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ rideId: id, triggeredBy: 'rider' }),
      });
      setSosMsg('SOS active — ops notified');
      toast.success('SOS triggered');
    } catch {
      toast.error('SOS failed');
    }
  };

  const shareTrip = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/trust/share-trip`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ rideId: id }),
      });
      const j = await res.json();
      const url =
        j?.data?.publicUrl ||
        (j?.data?.shareUrl
          ? `${window.location.origin}${j.data.shareUrl}`
          : null);
      if (!res.ok || !url) throw new Error(j.message || 'Share failed');
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      setShareMsg(url);
      toast.success('Share link copied');
    } catch (e: any) {
      toast.error(e.message || 'Could not share trip');
    }
  };

  const reportNoShow = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/rides/${id}/cancel`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ reason: 'driver_no_show' }),
      });
      const j = await res.json();
      if (j?.reliability?.amount) {
        toast.success(`No-show credit: ${j.reliability.amount}`);
      } else {
        toast.success('Ride cancelled');
      }
      navigate('/dashboard');
    } catch {
      toast.error('Could not cancel');
    }
  };

  const cancelRide = async () => {
    if (!id) return;
    try {
      await fetch(`${API}/rides/${id}/cancel`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ reason: 'rider_cancel' }),
      });
      toast.success('Ride cancelled');
      navigate('/dashboard');
    } catch {
      toast.error('Could not cancel');
    }
  };

  const sendChat = async () => {
    if (!id || !chatBody.trim()) return;
    const body = chatBody.trim();
    setMessages((m) => [...m, `You: ${body}`]);
    setChatBody('');
    await fetch(`${API}/rides/${id}/chat`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ body }),
    }).catch(() => undefined);
  };

  const acknowledgeRecording = async () => {
    if (!id) return;
    setNoticeBusy(true);
    try {
      await fetch(`${API}/rides/${id}/recording/notice`, { method: 'POST', headers: headers() });
      setNoticeAcked(true);
    } catch {
      toast.error('Could not log recording notice');
    } finally {
      setNoticeBusy(false);
    }
  };

  const driver = ride?.driver;
  const eta = Number(ride?.eta_minutes ?? ride?.etaMinutes ?? 0);
  const fare = Number(ride?.estimated_fare ?? ride?.fare ?? 0);
  const currency = ride?.currency || locCurrency || 'NGN';
  const plate = String(driver?.vehicle?.plate || '').replace(/-/g, ' ');
  const model = driver?.vehicle?.model || '';
  const color = driver?.vehicle?.color || '';
  const rating = Number(driver?.rating ?? 0).toFixed(1);
  const trips = Number(driver?.tripCount ?? 0);
  const banner = ride?.etaLabel || (ride ? `Driver is ${eta} min away` : '');
  const payment = ride?.paymentMethod || '';
  const name = driver?.name || ride?.driver_name || '';

  return (
    <div className="min-h-[70vh] rounded-2xl bg-black text-white overflow-hidden border border-zinc-800 relative max-w-xl mx-auto" data-force-dark>
      {loading ? <p className="p-5 text-zinc-400">Loading ride…</p> : null}
      {error ? <p className="p-5 text-red-400">{error}</p> : null}
      {!noticeAcked ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6">
          <div className="max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Safety recording</p>
            <p className="text-lg font-bold">This trip is recorded for safety.</p>
            <button
              type="button"
              disabled={noticeBusy}
              onClick={acknowledgeRecording}
              className="w-full rounded-xl bg-purple-600 py-3 font-semibold"
            >
              {noticeBusy ? 'Saving…' : 'I understand — continue'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative h-52 bg-[#0c0c12]">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(#2a2a35 1px, transparent 1px), linear-gradient(90deg, #2a2a35 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm font-semibold">
          • {banner}
        </div>
        <div className="absolute left-[32%] top-[42%] w-12 h-12 rounded-full bg-purple-500/30" />
        <span className="absolute left-[36%] top-[46%] text-xl">🚗</span>
        <span className="absolute right-[24%] bottom-[26%] text-xl">📍</span>
      </div>

      <div className="p-5 space-y-4">
        <div className="text-center">
          <p className="text-zinc-400">{ride?.matchedHeadline || ''}</p>
          <p className="text-xl font-bold mt-1">
            Arriving in <span className="text-purple-400">{eta} min</span>
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-900 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl">👨</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold">{name}</p>
            <p className="text-sm text-zinc-400">
              {model} · {color}
            </p>
            <p className="text-xs text-amber-400 mt-1">
              ★★★★★ {rating} · {trips} trips
            </p>
          </div>
          <div className="border border-zinc-600 rounded-md px-2 py-1 text-[11px] font-extrabold tracking-wide">
            {plate}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <a
            href={`tel:${proxy || driver?.phone || ''}`}
            className="rounded-xl bg-zinc-900 py-3 flex flex-col items-center gap-1"
          >
            <Phone size={18} />
            <span className="text-xs font-semibold">Call</span>
          </a>
          <button
            type="button"
            onClick={() => {
              if (id) navigate(`/ride/${id}/chat`);
              else setChatOpen((v) => !v);
            }}
            className="rounded-xl bg-zinc-900 py-3 flex flex-col items-center gap-1"
          >
            <MessageCircle size={18} />
            <span className="text-xs font-semibold">Message</span>
          </button>
          <button
            type="button"
            onClick={shareTrip}
            className="rounded-xl bg-zinc-900 py-3 flex flex-col items-center gap-1"
          >
            <span className="text-sm">🔗</span>
            <span className="text-xs font-semibold">Share</span>
          </button>
          <button
            type="button"
            onClick={triggerSos}
            className="rounded-xl bg-red-900/80 py-3 flex flex-col items-center gap-1"
          >
            <span className="font-black text-sm">SOS</span>
            <span className="text-xs font-semibold text-red-200">SOS</span>
          </button>
        </div>

        {sosMsg ? <p className="text-red-400 text-sm text-center font-semibold">{sosMsg}</p> : null}
        {shareMsg ? (
          <p className="text-emerald-400 text-xs text-center break-all">Shared: {shareMsg}</p>
        ) : null}

        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Paying with</span>
          <span className="font-bold">💳 {payment}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Fare estimate</span>
          <span className="font-extrabold">{formatCurrency(fare, currency)}</span>
        </div>

        {chatOpen ? (
          <div className="space-y-2 rounded-xl bg-zinc-900 p-3">
            {messages.map((m, i) => (
              <p key={i} className="text-sm text-zinc-400">
                {m}
              </p>
            ))}
            <div className="flex gap-2">
              <input
                value={chatBody}
                onChange={(e) => setChatBody(e.target.value)}
                placeholder="Message driver…"
                className="flex-1 rounded-lg bg-black border border-zinc-700 px-3 py-2 text-sm"
              />
              <button type="button" onClick={sendChat} className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold">
                Send
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={cancelRide}
          className="w-full rounded-2xl bg-zinc-900 py-3.5 font-bold"
        >
          Cancel Ride
        </button>
        <button
          type="button"
          onClick={reportNoShow}
          className="w-full rounded-2xl border border-amber-700/60 text-amber-300 py-3 font-semibold text-sm"
        >
          Driver no-show — get credit
        </button>
      </div>
    </div>
  );
};

export default ActiveRidePage;
