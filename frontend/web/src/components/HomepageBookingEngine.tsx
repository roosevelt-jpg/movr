import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LocateFixed, MapPin } from 'lucide-react';
import { formatCurrency, formatCountryLabel } from '../lib/currency';
import { useAuthStore } from '../store/auth.store';
import { useLocaleStore } from '../store/locale.store';
import { bookingCopy } from '../lib/bookingCopy';
import { AFRICA_LOCALES } from '../lib/africaLocales';
import { mediaUrl } from '../lib/media';
import PlacesAutocompleteField, { PickedPlace } from './PlacesAutocompleteField';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

type FareOpt = {
  code: string;
  name: string;
  price: number;
  riderFare?: number;
  etaMinutes?: number;
  isRecommended?: boolean;
};

type Props = {
  payload?: {
    headline?: string;
    subhead?: string;
    formTitle?: string;
    cityLabel?: string;
    countryCode?: string;
    ctaLabel?: string;
    mapImageUrl?: string;
    mapImageAlt?: string;
    sideTitle?: string;
    sideCtaLabel?: string;
    sideCtaHref?: string;
    defaultLat?: number;
    defaultLng?: number;
  };
};

/**
 * Uber-style “Compare your travel options” — Trip details + map.
 * Quote/book via Africa rails with detected countryCode. CMS-editable copy + map image.
 */
export default function HomepageBookingEngine({ payload = {} }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const country = useLocaleStore((s) => s.country);
  const currency = useLocaleStore((s) => s.currency);
  const language = useLocaleStore((s) => s.language);
  const city = useLocaleStore((s) => s.city);
  const detected = useLocaleStore((s) => s.detected);
  const setCountry = useLocaleStore((s) => s.setCountry);
  const t = useMemo(() => bookingCopy(language), [language]);

  const countryCode = (country || payload.countryCode || 'GH').toUpperCase();
  const defaultLat = Number(payload.defaultLat ?? 5.6037);
  const defaultLng = Number(payload.defaultLng ?? -0.187);
  const mapSrc = mediaUrl(payload.mapImageUrl || '/brand/compare-map.svg');

  const [pickup, setPickup] = useState<PickedPlace | null>(null);
  const [dropoff, setDropoff] = useState<PickedPlace | null>(null);
  const [when, setWhen] = useState<'now' | 'share'>('now');
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  const [options, setOptions] = useState<FareOpt[]>([]);
  const [quoteCurrency, setQuoteCurrency] = useState(currency);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setQuoteCurrency(currency);
  }, [currency]);

  const applyGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup({
          name: t.useLocation,
          formattedAddress: t.useLocation,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          countryCode,
        });
      },
      () => toast.error(t.quoteFailed),
      { maximumAge: 60_000, timeout: 8_000 }
    );
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup((prev) =>
          prev
            ? prev
            : {
                name: t.useLocation,
                formattedAddress: t.useLocation,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                countryCode,
              }
        );
      },
      () => undefined,
      { maximumAge: 60_000, timeout: 8_000 }
    );
  }, [countryCode, t.useLocation]);

  const authHeaders = () => {
    const token =
      localStorage.getItem('movr_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const changeCity = () => {
    const list = AFRICA_LOCALES.map((r) => r.country_code).join(', ');
    const next = window.prompt(`${t.changeCity} (${list})`, countryCode);
    if (!next?.trim()) return;
    const code = next.trim().toUpperCase().slice(0, 2);
    if (!/^[A-Z]{2}$/.test(code)) return;
    setCountry(code, { manual: true });
    setOptions([]);
    setSelected(null);
  };

  const seePrices = async () => {
    const p = pickup || {
      name: city || formatCountryLabel(countryCode),
      lat: defaultLat,
      lng: defaultLng,
      formattedAddress: city,
    };
    if (!dropoff?.lat) {
      toast.error(t.needDropoff);
      return;
    }
    setQuoting(true);
    setOptions([]);
    try {
      const res = await fetch(`${API}/rails/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLat: p.lat,
          pickupLng: p.lng,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          countryCode,
          fareMode: when,
          vehicleCode: when === 'share' ? 'shared' : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || t.quoteFailed);
      const opts = (j.data?.options || []).map((o: any) => ({
        code: o.code,
        name: o.name || o.code,
        price: Number(o.riderFare ?? o.price ?? 0),
        riderFare: Number(o.riderFare ?? o.price ?? 0),
        etaMinutes: o.etaMinutes,
        isRecommended: Boolean(o.isRecommended),
      }));
      if (!opts.length) throw new Error(t.noVehicles);
      setOptions(opts);
      setSelected(opts[0]?.code || null);
      setQuoteCurrency(j.data?.currency || currency || 'GHS');
    } catch (e: any) {
      toast.error(e.message || t.quoteFailed);
    } finally {
      setQuoting(false);
    }
  };

  const confirmBook = async () => {
    const p = pickup || {
      name: city,
      lat: defaultLat,
      lng: defaultLng,
      formattedAddress: city,
    };
    if (!dropoff?.lat || !selected) {
      toast.error(t.pickVehicle);
      return;
    }
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'movr_pending_ride',
        JSON.stringify({
          pickup,
          dropoff,
          vehicleTypeCode: selected,
          fareMode: when,
          countryCode,
        })
      );
      toast(t.loginToBook);
      navigate('/login', { state: { from: '/dashboard' } });
      return;
    }

    setBooking(true);
    try {
      if (when === 'share' || selected === 'shared') {
        const res = await fetch(`${API}/rails/share/join`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            pickupLat: p.lat,
            pickupLng: p.lng,
            dropoffLat: dropoff.lat,
            dropoffLng: dropoff.lng,
            pickupAddress: p.formattedAddress || p.name,
            dropoffAddress: dropoff.formattedAddress || dropoff.name,
            countryCode,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.message || t.quoteFailed);
        const rideId = j.data?.booking?.rideId || j.data?.booking?.id;
        toast.success(j.data?.waitingForRiders ? t.shareWaiting : t.shareJoined);
        navigate(rideId ? `/ride/active/${rideId}` : '/dashboard');
        return;
      }

      const res = await fetch(`${API}/rails/book`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pickupLat: p.lat,
          pickupLng: p.lng,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          pickupAddress: p.formattedAddress || p.name,
          dropoffAddress: dropoff.formattedAddress || dropoff.name,
          vehicleTypeCode: selected,
          fareMode: 'now',
          countryCode,
          sourceChannel: 'web',
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || t.quoteFailed);
      toast.success(t.booked);
      navigate(`/ride/active/${j.data?.rideId || j.data?.id}`);
    } catch (e: any) {
      toast.error(e.message || t.quoteFailed);
    } finally {
      setBooking(false);
    }
  };

  const selectedOpt = options.find((o) => o.code === selected) || options[0];
  const cityLabel =
    payload.cityLabel ||
    `${city || formatCountryLabel(countryCode)}, ${countryCode}`;

  return (
    <section
      id="book"
      className="relative bg-[#f3f3f3] text-black border-y border-black/5"
      data-force-light
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16 md:px-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-black/60 mb-4">
          <MapPin size={16} />
          <span className="font-medium text-black">{cityLabel}</span>
          <button
            type="button"
            className="underline underline-offset-2 hover:text-black"
            onClick={changeCity}
          >
            {t.changeCity}
          </button>
          <span className="text-xs rounded-full bg-black/5 px-2 py-0.5 text-black/70">
            {t.chargedIn} {quoteCurrency || currency}
            {!detected ? ` · ${t.detecting}` : ''}
          </span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.08] max-w-3xl">
          {payload.headline || t.headline}
        </h2>
        <p className="mt-4 text-black/60 max-w-2xl text-base md:text-lg leading-relaxed">
          {payload.subhead || t.subhead}
        </p>

        <div className="mt-10 grid lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          <div className="rounded-2xl bg-white border border-black/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-5 sm:p-6 flex flex-col">
            <h3 className="text-xl font-bold mb-4">{payload.formTitle || t.tripDetails}</h3>

            <div className="inline-flex self-start rounded-full bg-[#ececec] p-1 mb-5">
              {(
                [
                  { id: 'now' as const, label: t.pickupNow },
                  { id: 'share' as const, label: t.share },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setWhen(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    when === tab.id ? 'bg-black text-white' : 'text-black/70 hover:text-black'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative space-y-3 flex-1">
              <div
                className="absolute left-[27px] top-11 bottom-11 w-0.5 bg-black/15"
                aria-hidden
              />
              <div className="relative">
                <PlacesAutocompleteField
                  placeholder={t.pickupPlaceholder}
                  countryBias={countryCode}
                  icon="pickup"
                  valueLabel={pickup?.formattedAddress || pickup?.name}
                  onPick={(place) => {
                    setPickup(place);
                    if (place.countryCode) setCountry(place.countryCode, { manual: true });
                  }}
                  onClear={() => setPickup(null)}
                />
                <button
                  type="button"
                  onClick={applyGps}
                  className="absolute right-10 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-lg text-black/50 hover:text-black hover:bg-black/5"
                  title={t.useLocation}
                  aria-label={t.useLocation}
                >
                  <LocateFixed size={18} />
                </button>
              </div>
              <PlacesAutocompleteField
                placeholder={t.dropoffPlaceholder}
                countryBias={countryCode}
                icon="dropoff"
                valueLabel={dropoff?.formattedAddress || dropoff?.name}
                onPick={setDropoff}
                onClear={() => setDropoff(null)}
              />
            </div>

            <button
              type="button"
              disabled={quoting}
              onClick={seePrices}
              className="mt-6 w-full rounded-xl bg-black text-white py-3.5 text-sm font-semibold hover:bg-black/90 disabled:opacity-60"
            >
              {quoting ? t.gettingPrices : payload.ctaLabel || t.seePrices}
            </button>

            <div className="mt-3">
              {!isAuthenticated ? (
                <Link
                  to="/login"
                  className="text-sm text-black/65 underline underline-offset-2 hover:text-black"
                >
                  {t.loginRecent}
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="text-sm text-black/65 underline underline-offset-2 hover:text-black"
                >
                  {t.openDashboard}
                </Link>
              )}
            </div>
          </div>

          <div className="relative min-h-[300px] lg:min-h-full rounded-2xl overflow-hidden bg-[#e8eef2] border border-black/5">
            <img
              src={mapSrc}
              alt={payload.mapImageAlt || 'Map preview'}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {(payload.sideTitle || payload.sideCtaLabel) && (
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/70 to-transparent text-white">
                {payload.sideTitle ? (
                  <p className="font-bold text-lg">{payload.sideTitle}</p>
                ) : null}
                {payload.sideCtaLabel ? (
                  <Link
                    to={payload.sideCtaHref || '/register'}
                    className="inline-flex mt-2 rounded-full bg-white text-black px-4 py-2 text-sm font-semibold"
                  >
                    {payload.sideCtaLabel}
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {options.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-white border border-black/10 p-4 sm:p-5 space-y-2 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-semibold tracking-wide text-black/50 uppercase">
              {t.chooseRide}
            </p>
            {options.map((o) => {
              const active = selected === o.code;
              return (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => setSelected(o.code)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-3 text-left border ${
                    active
                      ? 'border-black bg-black/[0.03]'
                      : 'border-transparent hover:bg-black/[0.02]'
                  }`}
                >
                  <span>
                    <span className="font-semibold block">{o.name}</span>
                    <span className="text-xs text-black/50">
                      {o.etaMinutes != null ? `${o.etaMinutes} min` : t.nearby}
                      {o.isRecommended ? ` · ${t.bestValue}` : ''}
                    </span>
                  </span>
                  <span className="font-bold">
                    {formatCurrency(o.price, quoteCurrency || currency)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              disabled={booking || !selectedOpt}
              onClick={confirmBook}
              className="mt-2 w-full rounded-full bg-gradient-to-r from-[#6345ED] to-[#3B5CFF] text-white py-3.5 font-semibold disabled:opacity-60"
            >
              {booking
                ? t.confirming
                : !isAuthenticated
                  ? `${t.loginToBook} · ${formatCurrency(
                      selectedOpt?.price || 0,
                      quoteCurrency || currency
                    )}`
                  : `${t.request} ${selectedOpt?.name || ''} · ${formatCurrency(
                      selectedOpt?.price || 0,
                      quoteCurrency || currency
                    )}`}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
