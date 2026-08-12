import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('movr_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

type Msg =
  | { id: string; from: 'user' | 'bot'; kind: 'text'; text: string }
  | { id: string; from: 'bot'; kind: 'options'; options: any[]; currency: string };

/**
 * WhatsApp-style channel booking — confirm navigates to the same active-ride UX.
 */
const ChannelBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [awaitingPick, setAwaitingPick] = useState(false);
  const seq = useRef(1);
  const booted = useRef(false);

  const push = (m: Omit<Msg, 'id'>) => {
    const id = String(seq.current++);
    setMessages((prev) => [...prev, { ...m, id } as Msg]);
  };

  const parse = async (text: string) => {
    const res = await fetch(`${API}/voice/parse-intent`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        text,
        currentLat: 5.6037,
        currentLng: -0.187,
        countryCode: 'GH',
      }),
    });
    const json = await res.json().catch(() => ({}));
    const data = json.data;
    setResult(data);
    const from = data?.pickup?.address || 'Osu';
    const to = data?.destination?.address || 'Kotoka Airport';
    push({ from: 'bot', kind: 'text', text: `I heard: ${from} → ${to}` });
    const options = data?.options?.length
      ? data.options
      : [
          { code: 'economy', name: 'Economy', price: 45, etaMinutes: 4 },
          { code: 'comfort', name: 'Comfort', price: 62, etaMinutes: 3 },
        ];
    push({
      from: 'bot',
      kind: 'options',
      options: options.slice(0, 3),
      currency: data?.currency || 'GHS',
    });
    push({ from: 'bot', kind: 'text', text: 'Reply 1 / 2 / 3 to book — same rails as the ride screen.' });
    setAwaitingPick(true);
  };

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    parse("I'm going from Osu to the airport").catch(() => undefined);
  }, []);

  const confirm = async (index: number) => {
    const options = result?.options?.length
      ? result.options
      : [
          { code: 'economy', name: 'Economy', price: 45 },
          { code: 'comfort', name: 'Comfort', price: 62 },
        ];
    const opt = options[index] || options[0];
    setAwaitingPick(false);
    push({ from: 'user', kind: 'text', text: String(index + 1) });

    try {
      if (!result?.pickup || !result?.destination) throw new Error('No route');
      const res = await fetch(`${API}/voice/confirm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pickupLat: result.pickup.lat,
          pickupLng: result.pickup.lng,
          dropoffLat: result.destination.lat,
          dropoffLng: result.destination.lng,
          pickupAddress: result.pickup.address,
          dropoffAddress: result.destination.address,
          rideType: opt.code,
          vehicleTypeCode: opt.code,
          spoken: String(index + 1),
          sourceChannel: 'whatsapp',
          countryCode: 'GH',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Booking failed');
      push({
        from: 'bot',
        kind: 'text',
        text: json.data?.confirmationMessage || 'Booked — opening live ride…',
      });
      const rideId = json.data?.rideId || json.data?.id;
      if (rideId) {
        setTimeout(() => navigate(json.data?.trackPath || `/ride/active/${rideId}`), 600);
      }
    } catch (e: any) {
      push({ from: 'bot', kind: 'text', text: e.message || 'Booking failed' });
    }
  };

  const sendText = async () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    push({ from: 'user', kind: 'text', text: t });
    if (awaitingPick && /^[123]$/.test(t)) {
      await confirm(Number(t) - 1);
      return;
    }
    await parse(t);
  };

  return (
    <div className="min-h-[70vh] max-w-lg mx-auto w-full flex flex-col px-4 py-4">
      <div className="mb-3">
        <h1 className="text-xl font-bold">WhatsApp booking</h1>
        <p className="text-sm opacity-60">Confirm opens the same active-ride screen as Dashboard.</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl bg-[#0b141a] p-4 min-h-[360px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
              m.from === 'user'
                ? 'ml-auto bg-[#005c4b] text-white'
                : 'bg-[#202c33] text-white/95'
            }`}
          >
            {m.kind === 'options' ? (
              <div className="space-y-1">
                {m.options.map((o: any, i: number) => (
                  <button
                    key={o.code || i}
                    type="button"
                    className="block w-full text-left hover:underline"
                    onClick={() => confirm(i)}
                  >
                    {i + 1}. {o.name} · {formatCurrency(o.price, m.currency)}
                    {o.etaMinutes != null ? ` · ${o.etaMinutes} min` : ''}
                  </button>
                ))}
              </div>
            ) : (
              m.text
            )}
          </div>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
      >
        <input
          className="flex-1 rounded-full border border-black/15 px-4 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a destination or 1/2/3"
        />
        <button type="submit" className="rounded-full bg-emerald-700 text-white px-4 font-semibold">
          Send
        </button>
      </form>
    </div>
  );
};

export default ChannelBookingPage;
