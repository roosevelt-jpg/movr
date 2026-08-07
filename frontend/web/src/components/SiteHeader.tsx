import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useCmsPage } from '../services/cms';
import MovrWordmark from './MovrWordmark';
import ThemeModeIcon from './ThemeModeIcon';
import { useAuthStore } from '../store/auth.store';
import { useTheme } from '../theme/ThemeProvider';

const FALLBACK_NAV = {
  brand: 'Movr',
  links: [
    { label: 'Ride', href: '/#ride' },
    { label: 'Shop', href: '/#shop' },
    { label: 'Deliver', href: '/#deliver' },
    { label: 'AI', href: '/ai' },
    { label: 'Drivers', href: '/drivers' },
    { label: 'Merchants', href: '/merchants' },
    { label: 'About', href: '/about' },
  ],
  secondaryCta: { label: 'Log in', href: '/login' },
  cta: { label: 'Get started', href: '/register' },
};

function go(navigate: ReturnType<typeof useNavigate>, href?: string) {
  if (!href) return;
  if (href.startsWith('http')) {
    window.open(href, '_blank', 'noreferrer');
    return;
  }
  if (href.startsWith('/#') || href.startsWith('#')) {
    window.location.href = href.startsWith('#') ? `/${href}` : href;
    return;
  }
  navigate(href);
}

/** Global site header — theme-aware with sun/moon toggle. */
export default function SiteHeader() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { mode } = useTheme();
  const light = mode === 'light';
  const { section } = useCmsPage('global');
  const payload = section('nav')?.payload || FALLBACK_NAV;
  const [open, setOpen] = useState(false);

  const secondary = isAuthenticated
    ? null
    : payload.secondaryCta || { label: 'Log in', href: '/login' };
  const cta = isAuthenticated
    ? { label: 'Dashboard', href: '/dashboard' }
    : payload.cta || { label: 'Get started', href: '/register' };

  const linkCls = light
    ? 'text-sm text-black/65 hover:text-black transition-colors'
    : 'text-sm text-white/70 hover:text-white transition-colors';

  const NavLinks = ({
    className,
    onNavigate,
  }: {
    className?: string;
    onNavigate?: () => void;
  }) => (
    <nav className={className}>
      {(payload.links || []).map((l: any) =>
        l.href?.startsWith('/#') || l.href?.startsWith('#') ? (
          <a key={l.label} href={l.href} className={`${linkCls} text-left`} onClick={onNavigate}>
            {l.label}
          </a>
        ) : (
          <button
            key={l.label}
            type="button"
            onClick={() => {
              go(navigate, l.href);
              onNavigate?.();
            }}
            className={`${linkCls} text-left`}
          >
            {l.label}
          </button>
        )
      )}
    </nav>
  );

  return (
    <header
      className={
        light
          ? 'sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-black/8 text-black'
          : 'sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/8 text-white'
      }
      {...(light ? { 'data-force-light': true } : { 'data-force-dark': true })}
    >
      <div className="mkt-shell py-3.5 sm:py-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 shrink-0"
          aria-label={payload.brand || 'MOVR'}
        >
          <MovrWordmark height={26} />
          <span className="sr-only">{payload.brand || 'MOVR'}</span>
        </button>

        <NavLinks className="hidden lg:flex items-center gap-8" />

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeModeIcon lightChrome={light} />
          {secondary ? (
            <button
              type="button"
              onClick={() => go(navigate, secondary.href)}
              className={
                light
                  ? 'hidden sm:inline-flex text-sm font-medium text-black/70 hover:text-black px-3 py-2'
                  : 'hidden sm:inline-flex text-sm font-medium text-white/75 hover:text-white px-3 py-2'
              }
            >
              {secondary.label}
            </button>
          ) : null}
          {cta ? (
            <button
              type="button"
              onClick={() => go(navigate, cta.href)}
              className="rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold bg-movr-gradient text-white"
            >
              {cta.label}
            </button>
          ) : null}
          <button
            type="button"
            className={
              light
                ? 'lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/12'
                : 'lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15'
            }
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          className={
            light
              ? 'lg:hidden border-t border-black/8 bg-white px-5 py-5'
              : 'lg:hidden border-t border-white/8 bg-black px-5 py-5'
          }
        >
          <NavLinks className="flex flex-col gap-4" onNavigate={() => setOpen(false)} />
          <div className="mt-5 flex items-center justify-between">
            <span className={`text-sm ${light ? 'text-black/55' : 'text-white/55'}`}>Appearance</span>
            <ThemeModeIcon lightChrome={light} />
          </div>
          {!isAuthenticated ? (
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                className={
                  light
                    ? 'rounded-full border border-black/15 py-2.5 text-sm font-medium'
                    : 'rounded-full border border-white/20 py-2.5 text-sm font-medium'
                }
                onClick={() => {
                  navigate('/login');
                  setOpen(false);
                }}
              >
                Log in
              </button>
              <button
                type="button"
                className="rounded-full py-2.5 text-sm font-semibold bg-movr-gradient text-white"
                onClick={() => {
                  navigate('/register');
                  setOpen(false);
                }}
              >
                Get started
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
