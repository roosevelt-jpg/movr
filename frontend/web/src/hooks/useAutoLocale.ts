import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useLocaleStore } from '../store/locale.store';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

/**
 * Auto-detect visitor country → currency + language.
 * Order: logged-in user country → manual footer choice → GPS → /public/detect.
 */
export function useAutoLocale() {
  const user = useAuthStore((s) => s.user);
  const applyDetect = useLocaleStore((s) => s.applyDetect);
  const setCountry = useLocaleStore((s) => s.setCountry);
  const manual = useLocaleStore((s) => s.manual);
  const detected = useLocaleStore((s) => s.detected);

  useEffect(() => {
    if (user?.country) {
      setCountry(user.country, { manual: false });
      return;
    }
    if (manual || detected) return;

    let cancelled = false;

    const run = async (lat?: number, lng?: number) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const qs = new URLSearchParams();
      if (lat != null && lng != null) {
        qs.set('lat', String(lat));
        qs.set('lng', String(lng));
      }
      if (tz) qs.set('timezone', tz);
      const res = await fetch(`${API}/public/detect?${qs.toString()}`);
      const j = await res.json();
      if (cancelled || !j?.data?.countryCode) return;
      applyDetect(j.data);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          run(pos.coords.latitude, pos.coords.longitude).catch(() => run());
        },
        () => {
          run().catch(() => undefined);
        },
        { maximumAge: 300_000, timeout: 6_000 }
      );
    } else {
      run().catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [user?.country, manual, detected, applyDetect, setCountry]);
}
