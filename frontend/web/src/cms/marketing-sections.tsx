import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  Heart,
  Package,
  KeyRound,
  Store,
  Users,
  Building2,
  Sparkles,
  ShieldCheck,
  Wallet,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { StoreBadgeButton } from '../components/StoreBadges';
import PhoneMock from '../components/PhoneMock';
import { CmsMediaBackdrop } from './CmsMediaBackdrop';
import { BRAND, resolveCmsHeroMedia } from '../brand/assets';
import { mediaUrl } from '../lib/media';

const PRODUCT_BANNER_BY_TITLE: Record<string, string> = {
  ride: BRAND.rideSedan,
  shop: BRAND.shopPartner,
  deliver: BRAND.courierMoto,
  rentals: BRAND.rideSedan,
};

const TESTIMONIAL_AVATAR_BY_NAME: Record<string, string> = {
  ama: '/brand/testimonials/ama.jpg',
  enoch: '/brand/testimonials/enoch.jpg',
  'boutique 22': '/brand/testimonials/boutique22.jpg',
};

/** Prefer CMS upload; fall back to brand photo by product title when unset. */
function resolveProductBanner(item: any): string {
  if (Object.prototype.hasOwnProperty.call(item || {}, 'imageUrl')) {
    return mediaUrl(String(item.imageUrl || '').trim());
  }
  if (Object.prototype.hasOwnProperty.call(item || {}, 'bannerUrl')) {
    return mediaUrl(String(item.bannerUrl || '').trim());
  }
  const key = String(item?.title || '').toLowerCase().trim();
  return mediaUrl(PRODUCT_BANNER_BY_TITLE[key] || '');
}

/** Prefer CMS avatar; fall back to stock portrait by name when unset. */
function resolveTestimonialAvatar(item: any): string {
  if (Object.prototype.hasOwnProperty.call(item || {}, 'avatarUrl')) {
    return mediaUrl(String(item.avatarUrl || '').trim());
  }
  if (Object.prototype.hasOwnProperty.call(item || {}, 'imageUrl')) {
    return mediaUrl(String(item.imageUrl || '').trim());
  }
  const key = String(item?.name || '').toLowerCase().trim();
  return mediaUrl(TESTIMONIAL_AVATAR_BY_NAME[key] || '');
}

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  car: Car,
  heart: Heart,
  package: Package,
  key: KeyRound,
  store: Store,
  users: Users,
  building: Building2,
  sparkles: Sparkles,
  shield: ShieldCheck,
  wallet: Wallet,
  map: MapPin,
  check: CheckCircle2,
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

/** PerfectRide-style choice hero — eyebrow, large headline, two path cards. */
export function CmsChoiceHero({
  payload,
  pageSlug,
}: {
  payload: any;
  pageSlug?: string;
}) {
  const navigate = useNavigate();
  const media = resolveCmsHeroMedia(payload, pageSlug);
  const hasMedia = Boolean(media.imageUrl || media.videoUrl);

  return (
    <section
      className={`mkt-hero relative min-h-[56vh] sm:min-h-[62vh] ${hasMedia ? 'mkt-hero-media' : ''}`}
    >
      <CmsMediaBackdrop
        imageUrl={media.imageUrl}
        videoUrl={media.videoUrl}
        intensity="photo"
        imageOpacity={media.imageOpacity}
        overlayOpacity={media.overlayOpacity}
      />
      <div className="mkt-shell relative pt-16 sm:pt-24 pb-16 sm:pb-20">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h1 className="mkt-display mt-5 max-w-4xl whitespace-pre-line text-white">
          {payload.headline}
        </h1>
        {payload.subhead ? (
          <p className="mt-6 text-lg sm:text-xl text-white/75 max-w-2xl leading-relaxed">
            {payload.subhead}
          </p>
        ) : null}

        {payload.choices?.length ? (
          <div className="mt-12 grid sm:grid-cols-2 gap-4 max-w-3xl">
            {payload.choices.map((c: any) => (
              <button
                key={c.title}
                type="button"
                onClick={() => go(navigate, c.href)}
                className="mkt-choice text-left group overflow-hidden"
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt=""
                    className="w-full h-28 object-cover rounded-xl mb-4 opacity-90"
                  />
                ) : (
                  <span className="text-2xl mb-3 block" aria-hidden>
                    {c.emoji || '•'}
                  </span>
                )}
                <span className="block text-lg font-semibold text-white">
                  {c.title}
                </span>
                <span className="block mt-2 text-sm text-white/65 leading-relaxed">{c.body}</span>
                {c.cta ? (
                  <span className="inline-block mt-4 text-sm font-semibold text-motion-blue">
                    {c.cta} →
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {(payload.primaryCta || payload.secondaryCta) && !payload.choices?.length ? (
          <div className="mt-10 flex flex-wrap gap-3">
            {payload.primaryCta ? (
              <button
                type="button"
                onClick={() => go(navigate, payload.primaryCta.href)}
                className="mkt-btn-primary"
              >
                {payload.primaryCta.label}
              </button>
            ) : null}
            {payload.secondaryCta ? (
              <button
                type="button"
                onClick={() => go(navigate, payload.secondaryCta.href)}
                className="mkt-btn-ghost"
              >
                {payload.secondaryCta.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function CmsTrustStrip({ payload }: { payload: any }) {
  const items = payload.items || payload.logos || [];
  if (!items.length) return null;
  return (
    <section className="border-y border-white/8 py-10">
      <div className="mkt-shell">
        {payload.label ? (
          <p className="text-center text-xs tracking-[0.14em] uppercase mkt-soft mb-6">
            {payload.label}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {items.map((item: any) => (
            <span
              key={typeof item === 'string' ? item : item.label}
              className="text-sm sm:text-base font-medium mkt-soft"
            >
              {typeof item === 'string' ? item : item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CmsHowItWorks({ payload }: { payload: any }) {
  return (
    <section className="mkt-section" id={payload.anchor || 'how'}>
      <div className="mkt-shell">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h2 className="mkt-h2 mt-4 max-w-3xl">{payload.heading}</h2>
        <div className="mt-14 grid md:grid-cols-3 gap-10 md:gap-8">
          {(payload.steps || []).map((s: any, i: number) => (
            <div key={s.title || i} className="relative">
              <p className="text-sm font-semibold tracking-widest text-motion-blue mb-4">
                {s.number || String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="text-xl font-semibold mkt-ink">{s.title}</h3>
              <p className="mt-3 mkt-muted leading-relaxed">{s.body}</p>
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt=""
                  className="mt-5 w-full h-36 object-cover rounded-xl border border-white/10"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CmsProductGrid({ payload }: { payload: any }) {
  const navigate = useNavigate();
  return (
    <section className="mkt-section" id={payload.anchor || 'products'}>
      <div className="mkt-shell">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h2 className="mkt-h2 mt-4 max-w-3xl">{payload.heading}</h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(payload.items || []).map((c: any) => {
            const Icon = ICONS[c.iconKey] || Car;
            const banner = resolveProductBanner(c);
            return (
              <button
                key={c.title}
                type="button"
                onClick={() => go(navigate, c.href)}
                className="mkt-product text-left"
              >
                {banner ? (
                  <div className="-mx-6 -mt-6 mb-5 overflow-hidden rounded-t-2xl">
                    <img
                      src={banner}
                      alt=""
                      className="w-full h-28 sm:h-32 object-cover"
                    />
                  </div>
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 mb-5 overflow-hidden">
                    <Icon size={20} className="mkt-ink" />
                  </span>
                )}
                <p className="text-xs tracking-[0.12em] uppercase mkt-soft mb-2">
                  {c.eyebrow || c.category}
                </p>
                <h3 className="text-lg font-semibold mkt-ink">{c.title}</h3>
                <p className="mt-2 text-sm mkt-muted leading-relaxed">{c.body}</p>
                {c.cta ? (
                  <span className="inline-block mt-5 text-sm font-semibold text-motion-blue">
                    {c.cta} →
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CmsWhyGrid({ payload }: { payload: any }) {
  return (
    <section className="mkt-section" id={payload.anchor || 'why'}>
      <div className="mkt-shell">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h2 className="mkt-h2 mt-4 max-w-3xl">{payload.heading}</h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(payload.items || []).map((c: any) => {
            const Icon = ICONS[c.iconKey] || CheckCircle2;
            return (
              <div key={c.title} className="py-2">
                <Icon size={22} className="text-movr-green mb-4" />
                <h3 className="text-lg font-semibold mkt-ink">{c.title}</h3>
                <p className="mt-2 text-sm mkt-muted leading-relaxed">{c.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CmsTestimonials({ payload }: { payload: any }) {
  return (
    <section className="mkt-section" id={payload.anchor || 'stories'}>
      <div className="mkt-shell">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h2 className="mkt-h2 mt-4 max-w-3xl">{payload.heading}</h2>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {(payload.items || payload.quotes || []).map((q: any) => {
            const avatar = resolveTestimonialAvatar(q);
            const initial = String(q.name || '?').trim().charAt(0).toUpperCase() || '?';
            return (
              <blockquote key={q.name || q.quote} className="mkt-quote">
                <p className="mkt-ink leading-relaxed text-base">“{q.quote || q.body}”</p>
                <footer className="mt-6 flex items-center gap-3">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={q.name || ''}
                      className="h-11 w-11 rounded-full object-cover shrink-0 ring-1 ring-black/10"
                    />
                  ) : (
                    <span
                      className="h-11 w-11 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold bg-movr-gradient text-white"
                      aria-hidden
                    >
                      {initial}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold mkt-ink">{q.name}</p>
                    <p className="text-sm mkt-soft mt-0.5">{q.role}</p>
                  </div>
                </footer>
              </blockquote>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CmsFinalCta({ payload, pageSlug }: { payload: any; pageSlug?: string }) {
  const navigate = useNavigate();
  const media = resolveCmsHeroMedia(payload, pageSlug);
  const hasMedia = Boolean(media.imageUrl || media.videoUrl);
  const showPhone = payload.showPhoneMock !== false;
  return (
    <section className="mkt-section pb-24">
      <div className="mkt-shell">
        <div
          className={`mkt-final relative overflow-hidden ${hasMedia ? 'mkt-final-media' : ''}`}
        >
          <CmsMediaBackdrop
            imageUrl={media.imageUrl}
            videoUrl={media.videoUrl}
            className="rounded-[1.75rem]"
            intensity="soft"
            imageOpacity={media.imageOpacity}
            overlayOpacity={media.overlayOpacity}
          />
          <div
            className={`relative grid gap-10 items-center ${
              showPhone ? 'lg:grid-cols-[1.1fr_0.9fr]' : ''
            }`}
          >
            <div>
              <h2 className="mkt-h2 max-w-2xl">{payload.heading}</h2>
              {payload.body ? (
                <p className="mt-4 mkt-muted max-w-xl leading-relaxed">{payload.body}</p>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                {payload.primaryCta ? (
                  <button
                    type="button"
                    onClick={() => go(navigate, payload.primaryCta.href)}
                    className="mkt-btn-primary"
                  >
                    {payload.primaryCta.label}
                  </button>
                ) : null}
                {payload.secondaryCta ? (
                  <button
                    type="button"
                    onClick={() => go(navigate, payload.secondaryCta.href)}
                    className="mkt-btn-ghost"
                  >
                    {payload.secondaryCta.label}
                  </button>
                ) : null}
              </div>
              {payload.note ? <p className="mt-5 text-sm mkt-soft">{payload.note}</p> : null}
              {payload.storeButtons?.length ? (
                <div className="mt-8 flex flex-wrap gap-3">
                  {payload.storeButtons.map((b: any) => (
                    <StoreBadgeButton
                      key={b.label}
                      label={b.label}
                      store={b.store}
                      href={b.href}
                      onClick={() => go(navigate, b.href)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            {showPhone ? (
              <div className="flex justify-center lg:justify-end">
                <PhoneMock screenUrl={payload.phoneImageUrl || payload.phoneScreenUrl} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** PerfectRide-style Movr AI showcase — Talk. Don't tap. + chat mock. */
export function CmsAiShowcase({ payload }: { payload: any }) {
  const navigate = useNavigate();
  const demo = payload.demo || {};
  const quote = demo.quoteCard || null;

  return (
    <section id={payload.anchor || 'ai'} className="mkt-section scroll-mt-24">
      <div className="mkt-shell grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
          <h2 className="mkt-h2 mt-4 max-w-xl">{payload.heading || 'Talk. Don’t tap.'}</h2>
          {payload.body ? (
            <p className="mt-5 text-lg mkt-muted max-w-xl leading-relaxed">{payload.body}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            {payload.primaryCta ? (
              <button
                type="button"
                onClick={() => go(navigate, payload.primaryCta.href || '/ai')}
                className="mkt-btn-primary inline-flex items-center gap-2"
              >
                <Sparkles size={16} />
                {payload.primaryCta.label}
              </button>
            ) : null}
            {payload.secondaryCta ? (
              <button
                type="button"
                onClick={() => go(navigate, payload.secondaryCta.href)}
                className="mkt-btn-ghost"
              >
                {payload.secondaryCta.label}
              </button>
            ) : null}
          </div>
          {payload.note ? <p className="mt-5 text-sm mkt-soft">{payload.note}</p> : null}
        </div>

        <div className="mkt-ai-chat" aria-hidden={!demo.userMessage}>
          <div className="mkt-ai-chat-head">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-movr-gradient text-white shrink-0">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold mkt-ink text-sm truncate">
                  {demo.title || 'Movr AI'}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-success flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {demo.status || 'Online'}
                </p>
              </div>
            </div>
          </div>
          <div className="mkt-ai-chat-body space-y-3">
            {demo.userMessage ? (
              <div className="flex justify-end">
                <p className="mkt-ai-bubble-user">{demo.userMessage}</p>
              </div>
            ) : null}
            {demo.botMessage ? (
              <div className="flex justify-start">
                <p className="mkt-ai-bubble-bot">{demo.botMessage}</p>
              </div>
            ) : null}
            {quote ? (
              <div className="mkt-ai-quote-card">
                <div className="flex gap-3 items-start">
                  {quote.imageUrl ? (
                    <img
                      src={quote.imageUrl}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <span className="h-14 w-14 rounded-lg bg-surface-elevated border border-border flex items-center justify-center shrink-0">
                      <Car size={22} className="text-motion-blue" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold mkt-ink text-sm">{quote.title}</p>
                    {quote.badge ? (
                      <p className="text-[11px] uppercase tracking-wide text-motion-blue mt-0.5">
                        {quote.badge}
                      </p>
                    ) : null}
                    {quote.price ? (
                      <p className="text-lg font-bold mkt-ink mt-1">{quote.price}</p>
                    ) : null}
                  </div>
                </div>
                {quote.footer ? (
                  <p className="mt-3 text-xs text-success flex items-center gap-1.5 border-t border-border pt-2.5">
                    <ShieldCheck size={14} />
                    {quote.footer}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
