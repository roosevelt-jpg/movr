import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Share2, Mail, Users, Globe } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { getStoredCountry, setStoredCountry } from '../hooks/useLocalCurrency';
import { useCmsPage } from '../services/cms';
import { StoreBadgeButton } from './StoreBadges';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

type LocaleRow = {
  country_code: string;
  display_label: string;
  is_default?: boolean;
};

const FALLBACK_FOOTER = {
  brand: 'Movr',
  tagline: 'Move. Shop. Deliver.\nGlobal mobility, commerce, and logistics in one platform.',
  social: [
    { key: 'share', href: '/download' },
    { key: 'mail', href: '/contact' },
    { key: 'community', href: '/about' },
  ],
  columns: [
    {
      title: 'SERVICES',
      links: [
        { label: 'Ride', href: '/#ride' },
        { label: 'Shop', href: '/#shop' },
        { label: 'Deliver', href: '/#deliver' },
        { label: 'Rentals', href: '/#rentals' },
      ],
    },
    {
      title: 'COMPANY',
      links: [
        { label: 'About Movr', href: '/about' },
        { label: 'For drivers', href: '/drivers' },
        { label: 'For merchants', href: '/merchants' },
        { label: 'Careers', href: '/about' },
      ],
    },
    {
      title: 'SUPPORT',
      links: [
        { label: 'Help centre', href: '/help' },
        { label: 'Contact us', href: '/contact' },
        { label: 'Safety', href: '/help' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Privacy Policy', href: '/privacy' },
      ],
    },
  ],
  appButtons: [
    { label: 'App Store', store: 'ios', href: '/download' },
    { label: 'Google Play', store: 'android', href: '/download' },
  ],
  copyright: '© 2026 Movr Global Technologies. All rights reserved.',
  legalLinks: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Cookies', href: '/privacy' },
  ],
};

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  share: Share2,
  mail: Mail,
  community: Users,
};

/** Public site footer — CMS + live app links + locales (mockup). */
export default function SiteFooter() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { section } = useCmsPage('global');
  const cms = section('footer')?.payload || {};
  const footer = {
    ...FALLBACK_FOOTER,
    ...cms,
    columns: Array.isArray(cms.columns) && cms.columns.length ? cms.columns : FALLBACK_FOOTER.columns,
    appButtons:
      Array.isArray(cms.appButtons) && cms.appButtons.length
        ? cms.appButtons
        : FALLBACK_FOOTER.appButtons,
    legalLinks:
      Array.isArray(cms.legalLinks) && cms.legalLinks.length
        ? cms.legalLinks
        : FALLBACK_FOOTER.legalLinks,
    social:
      Array.isArray(cms.social) && cms.social.length ? cms.social : FALLBACK_FOOTER.social,
  };

  const [locales, setLocales] = React.useState<LocaleRow[]>([]);
  const [country, setCountry] = React.useState(user?.country || getStoredCountry() || 'GH');
  const [appLinks, setAppLinks] = React.useState<{ ios_url: string; android_url: string }>({
    ios_url: 'https://apps.apple.com/app/movr',
    android_url: 'https://play.google.com/store/apps/details?id=io.movr.app',
  });

  React.useEffect(() => {
    fetch(`${API}/public/locales`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data) && j.data.length) setLocales(j.data);
      })
      .catch(() => undefined);

    fetch(`${API}/public/app-links`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.ios_url || j?.data?.android_url) {
          setAppLinks({
            ios_url: j.data.ios_url || appLinks.ios_url,
            android_url: j.data.android_url || appLinks.android_url,
          });
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (user?.country) setCountry(user.country.toUpperCase());
  }, [user?.country]);

  const openApp = (btn: { store?: string; href?: string; label?: string }) => {
    const store = String(btn.store || btn.label || '').toLowerCase();
    if (store.includes('ios') || store.includes('app store')) {
      window.open(appLinks.ios_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (store.includes('android') || store.includes('google') || store.includes('play')) {
      window.open(appLinks.android_url, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(btn.href || '/download');
  };

  const Col = ({
    title,
    links,
  }: {
    title: string;
    links: { label: string; href: string }[];
  }) => (
    <div>
      <p className="text-[11px] tracking-[0.12em] uppercase text-white/45 mb-4">{title}</p>
      <ul className="space-y-3 text-sm text-white">
        {(links || []).map((l) => (
          <li key={l.label}>
            {(l.href || '').includes('#') ? (
              <a href={l.href} className="hover:text-white/80 transition-colors">
                {l.label}
              </a>
            ) : (
              <Link to={l.href || '/'} className="hover:text-white/80 transition-colors">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  const taglineLines = String(footer.tagline || FALLBACK_FOOTER.tagline).split('\n');

  return (
    <footer className="bg-black text-white border-t border-white/10 font-[Poppins,Montserrat,sans-serif]">
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2 md:col-span-1">
          <p className="text-2xl font-bold mb-4 tracking-tight">{footer.brand || 'Movr'}</p>
          <p className="text-sm text-white/50 leading-relaxed mb-5 whitespace-pre-line">
            {taglineLines.join('\n')}
          </p>
          <div className="flex gap-2">
            {(footer.social || []).map((s: any, i: number) => {
              const Icon = SOCIAL_ICONS[s.key] || Share2;
              const href = s.href || '#';
              const className =
                'w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-white/55 hover:text-white transition-colors';
              if (href.startsWith('http') || href.includes('#')) {
                return (
                  <a key={i} href={href} className={className} aria-label={s.label || s.key}>
                    <Icon size={16} />
                  </a>
                );
              }
              return (
                <Link key={i} to={href} className={className} aria-label={s.label || s.key}>
                  <Icon size={16} />
                </Link>
              );
            })}
          </div>
        </div>

        {(footer.columns || []).map((col: any) => (
          <Col key={col.title} title={col.title} links={col.links || []} />
        ))}

        <div>
          <p className="text-[11px] tracking-[0.12em] uppercase text-white/45 mb-4">GET THE APP</p>
          <div className="space-y-3">
            {(footer.appButtons || []).map((b: any) => (
              <StoreBadgeButton
                key={b.label}
                label={b.label}
                store={b.store}
                href={b.href}
                onClick={() => openApp(b)}
                variant="full"
                className="w-full [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-h-12"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm text-white/45">
          <p>{footer.copyright || FALLBACK_FOOTER.copyright}</p>
          <div className="flex flex-wrap items-center gap-5">
            <label className="inline-flex items-center gap-2 text-white/45">
              <Globe size={14} aria-hidden />
              <select
                className="bg-transparent border-0 outline-none text-white/45 cursor-pointer"
                value={country}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setCountry(next);
                  setStoredCountry(next);
                }}
                aria-label="Region and language"
              >
                {(locales.length
                  ? locales
                  : [{ country_code: 'GH', display_label: 'Ghana - English', is_default: true }]
                ).map((c) => (
                  <option key={c.country_code} value={c.country_code} className="bg-black text-white">
                    {c.display_label}
                  </option>
                ))}
              </select>
            </label>
            {(footer.legalLinks || []).map((l: any) => (
              <Link key={l.label} to={l.href || '/'} className="hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
