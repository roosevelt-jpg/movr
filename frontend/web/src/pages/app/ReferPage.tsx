import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Refer & Earn (mockup). */
export default function ReferPage() {
  const [code, setCode] = useState('KWAME50');
  const [shareLink, setShareLink] = useState('https://movr.io/r/KWAME50');
  const [headline, setHeadline] = useState('Give ₦500, Get 50 pts');
  const [body, setBody] = useState(
    'Share your code. When a friend completes their first ride, you both win.'
  );
  const [invited, setInvited] = useState(8);
  const [joined, setJoined] = useState(5);
  const [pts, setPts] = useState(250);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = authHeaders();
    Promise.all([
      fetch(`${API}/referrals/my-code`, { headers: h }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/referrals/progress`, { headers: h }).then((r) => r.json()).catch(() => null),
    ]).then(([c, p]) => {
      if (c?.data?.code) setCode(c.data.code);
      if (c?.data?.shareLink) setShareLink(c.data.shareLink);
      if (p?.data) {
        setInvited(Number(p.data.invitedCount ?? 8));
        setJoined(Number(p.data.joinedCount ?? 5));
        setPts(Number(p.data.ptsEarned ?? p.data.totalRewards ?? 250));
        if (p.data.promo?.headline) setHeadline(p.data.promo.headline);
        if (p.data.promo?.body) setBody(p.data.promo.body);
      }
    });
  }, []);

  const copy = async (text: string) => {
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const msg = `Join MOVR with my code ${code} and get ₦500 off. ${shareLink}`;

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex items-center gap-3 mb-4">
        <Link to="/profile" className="text-xl">
          ←
        </Link>
        <h1 className="text-xl font-extrabold">Refer & Earn</h1>
      </div>

      <div className="flex justify-center my-6">
        <div className="w-28 h-28 rounded-full bg-violet-900 flex items-center justify-center text-5xl">
          🎁
        </div>
      </div>

      <h2 className="text-2xl font-extrabold text-center">{headline}</h2>
      <p className="text-zinc-400 text-center mt-2 mb-6 text-sm">{body}</p>

      <button
        type="button"
        onClick={() => copy(code)}
        className="w-full rounded-2xl border-2 border-dashed border-purple-500 bg-zinc-900 p-4 text-center mb-5"
      >
        <p className="text-[11px] tracking-wider text-zinc-500 font-bold">YOUR REFERRAL CODE</p>
        <p className="text-3xl font-extrabold my-2">{code}</p>
        <p className="text-xs text-zinc-400">{copied ? 'Copied!' : 'Tap to copy'}</p>
      </button>

      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {[
          {
            label: 'WhatsApp',
            icon: '💬',
            href: `https://wa.me/?text=${encodeURIComponent(msg)}`,
          },
          { label: 'SMS', icon: '✉️', href: `sms:?body=${encodeURIComponent(msg)}` },
          { label: 'Instagram', icon: '📷', onClick: () => copy(msg) },
          { label: 'Copy Link', icon: '🔗', onClick: () => copy(shareLink) },
        ].map((b) =>
          b.href ? (
            <a
              key={b.label}
              href={b.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-zinc-900 py-4 text-center"
            >
              <p className="text-xl mb-1">{b.icon}</p>
              <p className="font-semibold text-sm">{b.label}</p>
            </a>
          ) : (
            <button
              key={b.label}
              type="button"
              onClick={b.onClick}
              className="rounded-xl bg-zinc-900 py-4"
            >
              <p className="text-xl mb-1">{b.icon}</p>
              <p className="font-semibold text-sm">{b.label}</p>
            </button>
          )
        )}
      </div>

      <div className="rounded-2xl bg-zinc-900 p-4">
        <p className="text-[11px] tracking-wider text-zinc-500 font-bold mb-3">
          YOUR REFERRAL STATS
        </p>
        <div className="grid grid-cols-3 text-center">
          <div>
            <p className="text-2xl font-extrabold">{invited}</p>
            <p className="text-xs text-zinc-500 mt-1">Invited</p>
          </div>
          <div className="border-x border-zinc-800">
            <p className="text-2xl font-extrabold">{joined}</p>
            <p className="text-xs text-zinc-500 mt-1">Joined</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-purple-400">{pts}</p>
            <p className="text-xs text-zinc-500 mt-1">Pts earned</p>
          </div>
        </div>
      </div>
    </div>
  );
}
