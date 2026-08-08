import React from 'react';
import { mediaUrl } from '../lib/media';

/** Device chrome for marketing phone mockups. */
export function PhoneFrame({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full max-w-[260px] sm:max-w-[280px] ${className}`}>
      <div
        className="absolute -inset-8 rounded-full opacity-50 blur-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(0,85,255,0.45), rgba(106,0,255,0.2), transparent 70%)',
        }}
      />
      <div className="relative rounded-[2.4rem] border border-white/15 bg-black/80 p-2.5 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
        <div className="rounded-[2rem] bg-[#0b0b0f] overflow-hidden border border-white/10">
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-20 h-1.5 rounded-full bg-white/20" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Built-in ride booking UI shown when no CMS screenshot is set. */
function DefaultRideScreen() {
  return (
    <div className="text-white font-[Poppins,Montserrat,sans-serif]" data-force-dark>
      <div className="flex justify-between text-[10px] px-5 pt-1 text-white/50">
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <p className="text-center font-bold mt-1 mb-2 text-sm tracking-tight">Movr</p>
      <div className="flex justify-center gap-5 text-[11px] border-b border-white/10 pb-2 px-2">
        <span className="text-white border-b-2 border-[#0055FF] pb-2 font-medium">Ride</span>
        <span className="text-white/45">Shop</span>
        <span className="text-white/45">Deliver</span>
      </div>
      <div className="relative m-3 h-36 rounded-xl overflow-hidden bg-[#15151a]">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
        <div
          className="absolute left-[18%] top-[55%] right-[28%] h-0.5 rounded-full opacity-80"
          style={{
            background: 'linear-gradient(90deg, #0055FF, #6A00FF)',
            transform: 'rotate(-18deg)',
            transformOrigin: 'left center',
          }}
        />
        <div className="absolute left-[18%] top-[52%] w-2.5 h-2.5 rounded-full bg-[#0055FF] shadow-[0_0_12px_rgba(0,85,255,0.8)]" />
        <div className="absolute right-[28%] bottom-[28%] w-2.5 h-2.5 rounded-full bg-white" />
        <div className="absolute left-3 bottom-3 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-medium">
          4 min away
        </div>
      </div>
      <div className="px-3 space-y-2 pb-4">
        <div className="rounded-xl bg-white/8 border border-white/10 px-3 py-2.5 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-movr-gradient shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">Kwame · Toyota Corolla</p>
            <p className="text-[10px] text-white/50">Arriving · GT-4821-21</p>
          </div>
          <span className="ml-auto text-[10px] font-semibold text-[#0055FF]">Live</span>
        </div>
        <div className="rounded-xl bg-white/8 border border-white/10 h-8 flex items-center px-3 text-[11px] text-white/55">
          Airport Terminal 3
        </div>
        <div className="rounded-full h-9 bg-movr-gradient flex items-center justify-center text-xs font-semibold">
          Ride booked
        </div>
      </div>
    </div>
  );
}

/**
 * Marketing phone — CMS screenshot fills the screen when set;
 * otherwise shows the default ride-booked mock.
 */
export default function PhoneMock({
  screenUrl,
  className = '',
}: {
  /** Admin-uploaded app screenshot (replaces the default ride UI). */
  screenUrl?: string | null;
  className?: string;
}) {
  const src = mediaUrl(String(screenUrl || '').trim());

  return (
    <PhoneFrame className={className}>
      {src ? (
        <img
          src={src}
          alt="Movr app"
          className="w-full aspect-[9/16] object-cover object-top bg-black"
        />
      ) : (
        <DefaultRideScreen />
      )}
    </PhoneFrame>
  );
}
