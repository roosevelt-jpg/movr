import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Share2, Mail, Users } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { getStoredCountry, setStoredCountry } from '../hooks/useLocalCurrency';
import { COUNTRY_NAME, currencyForCountry } from '../lib/currency';
import { useCmsPage } from '../services/cms';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

type CountryRow = { code: string; name: string; currencyCode: string };

/** Footer copy from CMS `global` → footer section. */
export default function SiteFooter() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { section } = useCmsPage('global');
  const footer = section('footer')?.payload || {};
  const [countries, setCountries] = React.useState<CountryRow[]>([]);
  const [country, setCountry] = React.useState(user?.country || getStoredCountry());

  React.useEffect(() => {
    fetch(`${API}/public/countries`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data) && j.data.length) {
          setCountries(
            j.data.map((c: any) => ({
              code: c.code,
              name: c.name,
              currencyCode: c.currencyCode,
            }))
          );
        }
      })
      .catch(() => {
        setCountries(
          Object.entries(COUNTRY_NAME).map(([code, name]) => ({
            code,
            name,
            currencyCode: currencyForCountry(code),
          }))
        );
      });
  }, []);

  React.useEffect(() => {
    if (user?.country) setCountry(user.country.toUpperCase());
  }, [user?.country]);

  const Col = ({
    title,
    links,
  }: {
    title: string;
    links: { label: string; href: string }[];
  }) => (
    <div>
      <p className="text-xs tracking-wider text-[#8E8E93] mb-4">{title}</p>
      <ul className="space-y-3 text-sm text-[#C8C8C8]">
        {(links || []).map((l) => (
          <li key={l.label}>
            {(l.href || '').includes('#') ? (
              <a href={l.href} className="hover:text-white">
                {l.label}
              </a>
            ) : (
              <Link to={l.href || '/'} className="hover:text-white">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="bg-black text-white border-t border-[#2A2A2A] font-[Poppins,Montserrat,sans-serif]">
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2 md:col-span-1">
          <p className="text-xl font-bold mb-3">{footer.brand || 'Movr'}</p>
          <p className="text-sm text-[#A0A0A0] leading-relaxed mb-4">
            {footer.tagline || ''}
          </p>
          <div className="flex gap-2">
            {[Share2, Mail, Users].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-9 h-9 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#A0A0A0] hover:text-white"
                aria-label="Social"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {(footer.columns || []).map((col: any) => (
          <Col key={col.title} title={col.title} links={col.links || []} />
        ))}

        <div>
          <p className="text-xs tracking-wider text-[#8E8E93] mb-4">GET THE APP</p>
          <div className="space-y-3">
            {(footer.appButtons || []).map((b: any) => (
              <button
                key={b.label}
                type="button"
                onClick={() => navigate(b.href || '/download')}
                className="w-full rounded-xl border border-[#3A3A3A] bg-[#121212] px-4 py-3 text-sm font-semibold text-left"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#2A2A2A]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm text-[#8E8E93]">
          <p>{footer.copyright || ''}</p>
          <div className="flex flex-wrap items-center gap-5">
            <label className="inline-flex items-center gap-2">
              <span aria-hidden>🌐</span>
              <select
                className="bg-transparent border border-[#2A2A2A] rounded-lg px-2 py-1 text-[#C8C8C8]"
                value={country}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setCountry(next);
                  setStoredCountry(next);
                }}
                aria-label="Country"
              >
                {(countries.length
                  ? countries
                  : Object.entries(COUNTRY_NAME).map(([code, name]) => ({
                      code,
                      name,
                      currencyCode: currencyForCountry(code),
                    }))
                ).map((c) => (
                  <option key={c.code} value={c.code} className="bg-black text-white">
                    {c.name} · {c.currencyCode || currencyForCountry(c.code)}
                  </option>
                ))}
              </select>
            </label>
            {(footer.legalLinks || []).map((l: any) => (
              <Link key={l.label} to={l.href || '/'} className="hover:text-white">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
