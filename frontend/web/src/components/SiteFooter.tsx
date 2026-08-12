import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { getStoredCountry, setStoredCountry } from '../hooks/useLocalCurrency';
import { useLocaleStore } from '../store/locale.store';
import { useCmsPage } from '../services/cms';
import { StoreBadgeButton } from './StoreBadges';
import { useTheme } from '../theme/ThemeProvider';
import { countryFlagEmoji } from '@movr/format';
import { AFRICA_LOCALES } from '../lib/africaLocales';
import { SocialPlatformIcon, socialAriaLabel, type SocialLink } from './SocialPlatformIcon';

function localeLabel(countryCode: string, displayLabel: string) {
  const flag = countryFlagEmoji(countryCode);
  if (!flag) return displayLabel;
  if (displayLabel.includes(flag)) return displayLabel;
  return `${flag} ${displayLabel}`;
}

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
  tagline: '',
  /** Empty until admin adds social links in CMS → global → footer */
  social: [] as SocialLink[],
  columns: [] as { title: string; links: { label: string; href: string }[] }[],
  appButtons: [] as { label: string; store: string; href: string }[],
  copyright: '© Movr',
  legalLinks: [] as { label: string; href: string }[],
};

/** Public site footer — CMS + live app links + locales (mockup). */
export default function SiteFooter() {
  const navigate = useNavigate();
  const { mode } = useTheme();
  const light = mode === 'light';
  const user = useAuthStore((s) => s.user);
  const { section } = useCmsPage('global');
  const cms = section('footer')?.payload || {};
  const socialLinks: SocialLink[] = (Array.isArray(cms.social) ? cms.social : [])
    .map((s: any) => ({
      key: s.key || s.platform,
      platform: s.platform || s.key,
      label: s.label,
      href: String(s.href || '').trim(),
      iconUrl: s.iconUrl || s.icon_url || undefined,
    }))
    .filter((s: SocialLink) => {
      if (!s.href) return false;
      // Drop legacy seed placeholders (share/community → internal pages)
      const key = String(s.platform || s.key || '').toLowerCase();
      if ((key === 'share' || key === 'community') && !/^https?:/i.test(s.href)) return false;
      return true;
    });

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
    social: socialLinks,
  };

  const [locales, setLocales] = React.useState<LocaleRow[]>([]);
  const localeCountry = useLocaleStore((s) => s.country);
  const country = (user?.country || localeCountry || getStoredCountry() || 'GH').toUpperCase();
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
    if (user?.country) {
      useLocaleStore.getState().setCountry(user.country, { manual: false });
    }
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

  const muted = light ? 'text-black/45' : 'text-white/45';
  const ink = light ? 'text-black' : 'text-white';
  const soft = light ? 'text-black/50' : 'text-white/50';
  const hover = light ? 'hover:text-black/70' : 'hover:text-white/80';
  const socialBtn = light
    ? 'w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center text-black/55 hover:text-black transition-colors'
    : 'w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-white/55 hover:text-white transition-colors';

  const Col = ({
    title,
    links,
  }: {
    title: string;
    links: { label: string; href: string }[];
  }) => (
    <div>
      <p className={`text-[11px] tracking-[0.12em] uppercase ${muted} mb-4`}>{title}</p>
      <ul className={`space-y-3 text-sm ${ink}`}>
        {(links || []).map((l) => (
          <li key={l.label}>
            {(l.href || '').includes('#') ? (
              <a href={l.href} className={`${hover} transition-colors`}>
                {l.label}
              </a>
            ) : (
              <Link to={l.href || '/'} className={`${hover} transition-colors`}>
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
    <footer
      className={
        light
          ? 'bg-white text-black border-t border-black/10 font-[Poppins,Montserrat,sans-serif]'
          : 'bg-black text-white border-t border-white/10 font-[Poppins,Montserrat,sans-serif]'
      }
      {...(light ? { 'data-force-light': true } : { 'data-force-dark': true })}
    >
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 lg:grid-cols-6 gap-10">
        <div className="col-span-2 lg:col-span-1">
          <p className="text-2xl font-bold mb-4 tracking-tight">{footer.brand || 'Movr'}</p>
          <p className={`text-sm ${soft} leading-relaxed mb-5 whitespace-pre-line`}>
            {taglineLines.join('\n')}
          </p>
          {socialLinks.length ? (
          <div className="flex flex-wrap gap-2">
            {socialLinks.map((s, i) => {
              const href = String(s.href || '').trim();
              const external = /^(https?:|mailto:|tel:)/i.test(href);
              const label = socialAriaLabel(s);
              if (external) {
                return (
                  <a
                    key={`${href}-${i}`}
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className={socialBtn}
                    aria-label={label}
                    title={label}
                  >
                    <SocialPlatformIcon link={s} size={16} />
                  </a>
                );
              }
              return (
                <Link key={`${href}-${i}`} to={href || '/'} className={socialBtn} aria-label={label} title={label}>
                  <SocialPlatformIcon link={s} size={16} />
                </Link>
              );
            })}
          </div>
          ) : null}
        </div>

        {(footer.columns || []).map((col: any) => (
          <Col key={col.title} title={col.title} links={col.links || []} />
        ))}

        <div className="col-span-2 lg:col-span-1">
          <p className={`text-[11px] tracking-[0.12em] uppercase ${muted} mb-4`}>GET THE APP</p>
          <div className="flex flex-row flex-wrap items-center gap-2.5">
            {(footer.appButtons || []).map((b: any) => (
              <StoreBadgeButton
                key={b.label}
                label={b.label}
                store={b.store}
                href={b.href}
                onClick={() => openApp(b)}
                variant="full"
                className="shrink-0 [&_svg]:h-10 [&_svg]:w-auto"
              />
            ))}
          </div>
        </div>
      </div>

      <div className={light ? 'border-t border-black/10' : 'border-t border-white/10'}>
        <div
          className={`max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm ${muted}`}
        >
          <p>{footer.copyright || FALLBACK_FOOTER.copyright}</p>
          <div className="flex flex-wrap items-center gap-5">
            <label className={`inline-flex items-center gap-2 ${muted}`}>
              <Globe size={14} aria-hidden />
              <select
                className={`bg-transparent border-0 outline-none cursor-pointer ${muted}`}
                value={country}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setStoredCountry(next);
                  useLocaleStore.getState().setCountry(next, { manual: true });
                }}
                aria-label="Region and language"
              >
                {(locales.length
                  ? locales
                  : AFRICA_LOCALES.map((c) => ({
                      country_code: c.country_code,
                      display_label: c.display_label,
                      is_default: c.is_default,
                    }))
                ).map((c) => (
                  <option
                    key={c.country_code}
                    value={c.country_code}
                    className={light ? 'bg-white text-black' : 'bg-black text-white'}
                  >
                    {localeLabel(c.country_code, c.display_label)}
                  </option>
                ))}
              </select>
            </label>
            {(footer.legalLinks || []).map((l: any) => (
              <Link
                key={l.label}
                to={l.href || '/'}
                className={light ? 'hover:text-black transition-colors' : 'hover:text-white transition-colors'}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
