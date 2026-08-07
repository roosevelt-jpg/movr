import React, { useRef, useState } from 'react';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

type Msg = { id: string; from: 'user' | 'bot'; text: string; hint?: string };

/** Web Movr Bot booking chat. */
export default function MovrBotPage() {
  const { country, formatMoney } = useLocalCurrency();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      from: 'bot',
      text: 'Welcome! Share your location or type your pickup address.',
    },
  ]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState<'pickup' | 'dest' | 'quote' | 'done'>('pickup');
  const [pickup, setPickup] = useState('Osu');
  const seq = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  const push = (m: Omit<Msg, 'id'>) => {
    setMessages((prev) => [...prev, { ...m, id: String(seq.current++) }]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const quote = async (from: string, to: string) => {
    let economy = { price: 45, eta: 4 };
    let comfort = { price: 62, eta: 3 };
    try {
      const res = await fetch(`${API}/voice/parse-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `from ${from} to ${to}`,
          currentLat: 5.6037,
          currentLng: -0.187,
          countryCode: country,
        }),
      });
      const json = await res.json();
      const opts = json.data?.options || [];
      if (opts[0]) economy = { price: opts[0].price, eta: opts[0].etaMinutes ?? 4 };
      if (opts[1]) comfort = { price: opts[1].price, eta: opts[1].etaMinutes ?? 3 };
    } catch {
      /* live quote optional */
    }
    push({
      from: 'bot',
      text: `Economy ${formatMoney(economy.price)} · ${economy.eta} min | Comfort ${formatMoney(comfort.price)} · ${comfort.eta} min`,
      hint: 'Tap a button below to confirm',
    });
    setStep('quote');
  };

  const shareLocation = () => {
    push({ from: 'user', text: '📍 Location shared' });
    setPickup('Osu');
    push({ from: 'bot', text: 'Got it — pickup set to Osu. Where are you headed?' });
    setStep('dest');
  };

  const confirm = async (tier: 'economy' | 'comfort') => {
    push({ from: 'user', text: tier === 'economy' ? 'Economy' : 'Comfort' });
    push({ from: 'bot', text: '✅ Booked! Kwesi Boateng, GR 4471-22, arriving soon.' });
    setStep('done');
  };

  const send = async () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    push({ from: 'user', text: t });
    if (step === 'pickup') {
      setPickup(t);
      push({ from: 'bot', text: `Got it — pickup set to ${t}. Where are you headed?` });
      setStep('dest');
      return;
    }
    if (step === 'dest') {
      await quote(pickup, t);
      return;
    }
    if (step === 'quote') {
      await confirm(t.toLowerCase().includes('comfort') ? 'comfort' : 'economy');
    }
  };

  return (
    <div className="min-h-[70vh] bg-jet-black text-pure-white flex flex-col max-w-lg mx-auto font-[Poppins,Montserrat,sans-serif]" data-force-dark>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-10 h-10 rounded-full bg-electric-violet flex items-center justify-center font-bold">
          M
        </div>
        <div>
          <p className="font-semibold">Movr Bot</p>
          <p className="text-xs text-success">bot</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm ${
              m.from === 'user' ? 'ml-auto bg-motion-blue' : 'bg-surface-elevated'
            }`}
          >
            <p>{m.text}</p>
            {m.hint ? <p className="text-success text-xs mt-1">{m.hint}</p> : null}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {step === 'pickup' ? (
        <button
          type="button"
          onClick={shareLocation}
          className="mx-4 mb-2 rounded-full border border-border py-3 text-sm font-semibold"
        >
          📍 Share location
        </button>
      ) : null}

      {step === 'quote' ? (
        <div className="flex gap-2 px-4 mb-2">
          <button
            type="button"
            onClick={() => confirm('economy')}
            className="flex-1 rounded-full border border-motion-blue py-3 font-semibold"
          >
            Economy
          </button>
          <button
            type="button"
            onClick={() => confirm('comfort')}
            className="flex-1 rounded-full border border-motion-blue py-3 font-semibold"
          >
            Comfort
          </button>
        </div>
      ) : null}

      <div className="p-3 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message..."
          className="flex-1 rounded-full bg-surface-elevated px-5 py-3 outline-none placeholder:text-text-secondary"
        />
        <button
          type="button"
          onClick={send}
          className="rounded-full bg-motion-blue px-5 font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
}
