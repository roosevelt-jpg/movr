import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const COPY = {
  ride: {
    icon: '🚗',
    title: 'Ride',
    kicker: 'Fair fares · driver keeps 100%',
    body: 'Compare travel options, share a vehicle, or book a verified chauffeur. Start here, then enter pickup and drop-off.',
    points: [
      'See fares and ETAs before you confirm',
      'Share pool when you want to save',
      'Okada, cars, and verified fleet',
    ],
    cta: 'Start a ride',
    href: '/book',
    secondary: { label: 'Verified cars', href: '/verified' },
  },
  shop: {
    icon: '🛍️',
    title: 'Shop',
    kicker: 'Neighbourhood stores, delivered',
    body: 'Browse local merchants, add to cart, and pay with the same Movr wallet you use for rides.',
    points: [
      'Food, grocery, pharmacy, and more',
      'Track the order to your door',
      'One account for rides and shopping',
    ],
    cta: 'Browse shops',
    href: '/marketplace',
    secondary: { label: 'My orders', href: '/history' },
  },
  parcel: {
    icon: '📦',
    title: 'Parcel',
    kicker: 'Same-day across town',
    body: 'Send a document, bag, or crate. Next you will set pickup, drop-off, and package type.',
    points: [
      'Choose package type and speed',
      'Live tracking after pickup',
      'Pay in-app with wallet or mobile money',
    ],
    cta: 'Send a parcel',
    href: '/parcel/send',
    secondary: { label: 'Back home', href: '/dashboard' },
  },
  rentals: {
    icon: '🔑',
    title: 'Rentals',
    kicker: 'Self-drive or chauffeur',
    body: 'Need a car for the day or a week? Pick dates and how you want to drive, then choose a vehicle.',
    points: [
      'Self-drive or with a chauffeur',
      'Hourly and daily options',
      'List your own car when you are ready',
    ],
    cta: 'Find a car',
    href: '/rentals',
    secondary: { label: 'List your car', href: '/rentals/list' },
  },
} as const;

/** In-app landing for Ride / Shop / Parcel / Rentals. */
export default function ServiceStartPage({
  service,
}: {
  service: keyof typeof COPY;
}) {
  const navigate = useNavigate();
  const copy = COPY[service];

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="text-purple-400 font-semibold mb-8"
      >
        ← Home
      </button>
      <div className="text-5xl mb-4">{copy.icon}</div>
      <h1 className="text-3xl font-extrabold">{copy.title}</h1>
      <p className="text-purple-400 font-semibold mt-2">{copy.kicker}</p>
      <p className="text-zinc-400 mt-4 leading-relaxed">{copy.body}</p>
      <ul className="mt-8 space-y-3">
        {copy.points.map((p) => (
          <li key={p} className="flex gap-2 text-sm text-zinc-200">
            <span className="text-green-400 font-bold">✓</span> {p}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => navigate(copy.href)}
        className="mt-10 w-full rounded-full py-3.5 font-bold text-white bg-gradient-to-r from-purple-500 to-blue-500"
      >
        {copy.cta}
      </button>
      <Link to={copy.secondary.href} className="block text-center text-sm text-zinc-500 mt-4">
        {copy.secondary.label}
      </Link>
    </div>
  );
}
