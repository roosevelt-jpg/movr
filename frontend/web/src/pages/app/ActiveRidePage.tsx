import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle, Share2, MapPin } from 'lucide-react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { ridesApi } from '../../services/api';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_token') || ''}`,
  'Content-Type': 'application/json',
});

/** Active ride — ETA/SOS map, masked call/chat, share trip. */
const ActiveRidePage: React.FC = () => {
  const { id } = useParams();
  const { formatMoney } = useLocalCurrency();
  const [ride, setRide] = useState<any>(null);
  const [proxy, setProxy] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBody, setChatBody] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [sosMsg, setSosMsg] = useState('');
  const [emergencyTel, setEmergencyTel] = useState('tel:191');
  const [noticeAcked, setNoticeAcked] = useState(false);
  const [noticeBusy, setNoticeBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    setNoticeAcked(false);
    ridesApi
      .getRideDetails(id)
      .then((res) => setRide(res.data?.data || res.data))
      .catch(() => undefined);

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
  }, [id]);

  const triggerSos = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/sos/trigger`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ rideId: id, triggeredBy: 'rider' }),
      });
      const json = await res.json();
      if (json?.data?.quickDial) setEmergencyTel(json.data.quickDial);
      setSosMsg('SOS active — ops notified');
      toast.success('SOS triggered');
    } catch {
      toast.error('SOS failed');
    }
  };

  const shareTrip = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/rides/${id}/share-link`, { headers: headers() });
      const json = await res.json();
      const url = json?.data?.url;
      if (url) {
        await navigator.clipboard?.writeText(url);
        toast.success('Share link copied');
        window.open(url, '_blank');
      }
    } catch {
      toast.error('Could not create share link');
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
      await fetch(`${API}/rides/${id}/recording/notice`, {
        method: 'POST',
        headers: headers(),
      });
      setNoticeAcked(true);
    } catch {
      toast.error('Could not log recording notice');
    } finally {
      setNoticeBusy(false);
    }
  };

  const name =
    ride?.driver_name || ride?.driverName || 'Driver';
  const plate = ride?.vehicle_plate || ride?.plate || '—';
  const fare = Number(ride?.estimated_fare || ride?.actual_fare || 45);

  return (
    <div className="min-h-[70vh] rounded-2xl bg-jet-black text-pure-white overflow-hidden border border-border relative">
      {!noticeAcked ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-jet-black/80 p-6">
          <div className="max-w-md rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-warning">Safety recording</p>
            <p className="text-lg font-bold leading-snug">
              This trip is recorded for safety. Recording is stored securely and only reviewed if
              there&apos;s a dispute or safety report.
            </p>
            <p className="text-sm text-text-secondary">
              Footage is recorded on the driver device and uploaded later — not live-streamed.
            </p>
            <button
              type="button"
              disabled={noticeBusy}
              onClick={acknowledgeRecording}
              className="w-full rounded-xl bg-motion-blue py-3 font-semibold"
            >
              {noticeBusy ? 'Saving…' : 'I understand — continue'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative h-64 md:h-80 bg-surface-elevated">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute top-4 left-4 rounded-full bg-jet-black/80 px-3 py-1.5 text-sm font-semibold">
          ETA {ride?.eta_minutes ?? 6} min
        </div>
        <button
          type="button"
          onClick={triggerSos}
          className="absolute top-4 right-4 rounded-full bg-error text-black font-bold px-4 py-1.5 text-sm"
        >
          SOS
        </button>
        <a
          href={emergencyTel}
          className="absolute top-14 right-4 rounded-full bg-jet-black/80 border border-border px-3 py-1 text-xs font-semibold"
        >
          Call Police
        </a>
        <div className="absolute left-[28%] top-[32%] w-3 h-3 rounded-full bg-white" />
        <div className="absolute right-[30%] bottom-[28%] w-4 h-4 rounded-full border-2 border-motion-blue" />
      </div>

      <div className="p-5 md:p-6 space-y-4">
        {sosMsg ? <p className="text-error text-sm font-semibold text-center">{sosMsg}</p> : null}

        <div className="rounded-2xl bg-surface-elevated border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-full bg-surface border border-border" />
              <div>
                <p className="font-bold text-lg">{name}</p>
                <p className="text-sm text-text-secondary">{plate}</p>
                <p className="text-sm text-text-secondary">★ {Number(ride?.rating || 4.9).toFixed(1)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`tel:${proxy || ''}`}
                className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center"
                title="Masked call"
              >
                <Phone size={18} />
              </a>
              <button
                type="button"
                onClick={() => setChatOpen((v) => !v)}
                className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center"
              >
                <MessageCircle size={18} />
              </button>
            </div>
          </div>

          <p className="text-xs text-text-secondary mt-3">
            Calls and messages are number-masked for this ride
          </p>

          {chatOpen ? (
            <div className="mt-3 space-y-2">
              {messages.map((m, i) => (
                <p key={i} className="text-sm text-text-secondary">
                  {m}
                </p>
              ))}
              <div className="flex gap-2">
                <input
                  value={chatBody}
                  onChange={(e) => setChatBody(e.target.value)}
                  placeholder="Message driver…"
                  className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  className="rounded-lg bg-motion-blue px-3 py-2 text-sm font-semibold"
                >
                  Send
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={shareTrip}
              className="rounded-xl bg-surface border border-border py-3 font-semibold flex items-center justify-center gap-2"
            >
              <Share2 size={16} /> Share trip
            </button>
            <button
              type="button"
              className="rounded-xl bg-surface border border-border py-3 font-semibold flex items-center justify-center gap-2"
            >
              <MapPin size={16} /> Route
            </button>
          </div>
        </div>

        <p className="text-center text-text-secondary text-sm pb-2">
          {ride?.status || 'In progress'} · {formatMoney(fare)} fare
        </p>
      </div>
    </div>
  );
};

export default ActiveRidePage;
