import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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

/**
 * Voice booking — same confirm card as dashboard (route + fares + Book CTA → active ride).
 */
const VoiceBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [listening, setListening] = useState(false);

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
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Parse failed');
    setResult(json.data);
    setSelected(json.data?.options?.[0]?.code || null);
  };

  const startListen = async () => {
    setListening(true);
    try {
      const SR =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) throw new Error('no-stt');
      const heard: string = await new Promise((resolve, reject) => {
        const rec = new SR();
        rec.lang = 'en-GH';
        let finalText = '';
        rec.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
          }
        };
        rec.onerror = reject;
        rec.onend = () => resolve(finalText);
        rec.start();
      });
      const text = heard.trim() || "I'm going from Osu to the airport";
      setTranscript(text);
      await parse(text);
    } catch {
      const sample = "I'm going from Osu to the airport";
      setTranscript(sample);
      toast('Using demo utterance — enable mic for live STT');
      await parse(sample);
    } finally {
      setListening(false);
    }
  };

  const selectedOpt =
    result?.options?.find((o: any) => o.code === selected) || result?.options?.[0];

  const confirm = async () => {
    if (!result?.pickup || !result?.destination) return;
    setBooking(true);
    try {
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
          rideType: selected,
          vehicleTypeCode: selected,
          spoken: 'yes',
          countryCode: 'GH',
          sourceChannel: 'voice',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Booking failed');
      const rideId = json.data?.rideId || json.data?.id;
      toast.success(json.data?.confirmationMessage || 'Ride booked');
      if (rideId) navigate(json.data?.trackPath || `/ride/active/${rideId}`);
      else navigate('/dashboard');
    } catch (e: any) {
      toast.error(e.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="min-h-[70vh] max-w-lg mx-auto w-full px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Voice ride</h1>
      <p className="text-sm opacity-60 mt-1">Same booking card as the main ride screen.</p>

      <button
        type="button"
        onClick={startListen}
        className="mt-8 mx-auto flex h-24 w-24 items-center justify-center rounded-full text-white text-3xl"
        style={{ background: 'linear-gradient(135deg,#4f46e5,#0ea5e9)' }}
      >
        {listening ? '…' : '🎤'}
      </button>
      <p className="text-center text-sm opacity-60 mt-3">
        {listening ? 'Listening…' : 'Tap mic to speak'}
      </p>
      <p className="text-center italic mt-2 opacity-80">
        {transcript ? `“${transcript}”` : '“I\'m going from Osu to the airport”'}
      </p>

      {result?.options ? (
        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold tracking-wider opacity-50">PICKUP → DESTINATION</p>
          <p className="text-lg font-bold mt-1">
            {result.pickup?.address || 'Current'} → {result.destination?.address}
          </p>
          <div className="mt-4 space-y-2">
            {result.options.map((item: any) => {
              const active = selected === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setSelected(item.code)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-3 text-left border ${
                    active ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-black/[0.03]'
                  }`}
                >
                  <span>
                    <span className="font-semibold block">{item.name}</span>
                    <span className="text-xs opacity-60">
                      {item.etaMinutes != null ? `${item.etaMinutes} min` : 'Nearby'}
                    </span>
                  </span>
                  <span className="font-bold">
                    {formatCurrency(item.price, result.currency || 'GHS')}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={booking}
            onClick={confirm}
            className="mt-4 w-full rounded-full py-3.5 font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }}
          >
            Book {selectedOpt?.name || 'ride'} ·{' '}
            {formatCurrency(selectedOpt?.price || 0, result.currency || 'GHS')}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default VoiceBookingPage;
