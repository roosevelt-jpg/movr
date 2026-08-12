import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Clock, MapPin } from 'lucide-react';
import { formatCurrency, formatCountryLabel } from '../lib/currency';
import { useAuthStore } from '../store/auth.store';
import { useLocaleStore } from '../store/locale.store';
import { bookingCopy } from '../lib/bookingCopy';
import { AFRICA_LOCALES } from '../lib/africaLocales';
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
    cityLabel?: string;
    countryCode?: string;
    ctaLabel?: string;
    sideTitle?: string;
    sideCtaLabel?: string;
    sideCtaHref?: string;
    defaultLat?: number;
    defaultLng?: number;
  };
};

/**
 * Uber-style homepage booking — auto country → local currency + language.
 * Quote/book via Africa rails with detected countryCode.
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

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup((prev) =>
          prev
            ? prev
            : {
                name: t.pickupPlaceholder,
                formattedAddress: t.pickupPlaceholder,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                countryCode,
              }
        );
      },
      () => undefined,
      { maximumAge: 60_000, timeout: 8_000 }
    );
  }, [countryCode, t.pickupPlaceholder]);

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
      className="relative bg-[#f6f6f6] text-black border-y border-black/5"
      data-force-light
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16 md:px-6 grid md:grid-cols-2 gap-10 items-start">
        <div>
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

          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] mb-6">
            {payload.headline || t.headline}
          </h2>
          <p className="text-black/60 mb-6 max-w-md">{payload.subhead || t.subhead}</p>

          <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.03]">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f4f5] border border-black/10 px-4 py-2.5 text-sm mb-4 shadow-sm">
              <Clock size={16} className="text-black/70" />
              <select
                className="bg-transparent outline-none font-medium text-black"
                value={when}
                onChange={(e) => setWhen(e.target.value as 'now' | 'share')}
              >
                <option value="now">{t.pickupNow}</option>
                <option value="share">{t.share}</option>
              </select>
            </div>

            <div className="relative space-y-3 mb-5">
              <div
                className="absolute left-[27px] top-11 bottom-11 w-0.5 bg-black/15"
                aria-hidden
              />
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
              <PlacesAutocompleteField
                placeholder={t.dropoffPlaceholder}
                countryBias={countryCode}
                icon="dropoff"
                valueLabel={dropoff?.formattedAddress || dropoff?.name}
                onPick={setDropoff}
                onClear={() => setDropoff(null)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={quoting}
                onClick={seePrices}
                className="rounded-full bg-black text-white px-7 py-3.5 text-sm font-semibold hover:bg-black/90 disabled:opacity-60 shadow-sm"
              >
                {quoting ? t.gettingPrices : payload.ctaLabel || t.seePrices}
              </button>
              {!isAuthenticated ? (
                <Link to="/login" className="text-sm text-black/65 underline underline-offset-2 hover:text-black">
                  {t.loginRecent}
                </Link>
              ) : (
                <Link to="/dashboard" className="text-sm text-black/65 underline underline-offset-2 hover:text-black">
                  {t.openDashboard}
                </Link>
              )}
            </div>
          </div>

          {options.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-white border border-black/10 p-4 space-y-2 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
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
                      active ? 'border-black bg-black/[0.03]' : 'border-transparent hover:bg-black/[0.02]'
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
                    ? `${t.loginToBook} · ${formatCurrency(selectedOpt?.price || 0, quoteCurrency || currency)}`
                    : `${t.request} ${selectedOpt?.name || ''} · ${formatCurrency(
                        selectedOpt?.price || 0,
                        quoteCurrency || currency
                      )}`}
              </button>
            </div>
          ) : null}
        </div>

        <div className="relative min-h-[320px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#134e4a] to-[#042f2e] text-white p-8 flex flex-col justify-end">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 70% 30%, rgba(99,69,237,0.5), transparent 50%), radial-gradient(circle at 20% 80%, rgba(14,165,233,0.35), transparent 45%)',
            }}
          />
          <div className="relative">
            <p className="text-2xl font-bold mb-2">{payload.sideTitle || t.sideTitle}</p>
            <p className="text-white/70 text-sm mb-4 max-w-sm">{t.sideBody}</p>
            <Link
              to={payload.sideCtaHref || '/register'}
              className="inline-flex rounded-full bg-white text-black px-5 py-2.5 text-sm font-semibold"
            >
              {payload.sideCtaLabel || t.sideCta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
