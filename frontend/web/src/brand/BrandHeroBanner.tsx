import React from 'react';
import { CmsMediaBackdrop } from '../cms/CmsMediaBackdrop';
import { BRAND } from './assets';

/**
 * Full-bleed brand photo banner for marketing pages (drivers, merchants, about, download).
 * Keeps brand + one headline + one line + CTAs — photo is the visual plane.
 * Always white text for contrast on dark brand photography.
 */
export function BrandHeroBanner({
  imageUrl = BRAND.rideSedan,
  eyebrow,
  headline,
  subhead,
  children,
  className = '',
  imageOpacity = 65,
  overlayOpacity = 55,
}: {
  imageUrl?: string;
  eyebrow?: string;
  headline: string;
  subhead?: string;
  children?: React.ReactNode;
  className?: string;
  imageOpacity?: number;
  overlayOpacity?: number;
}) {
  return (
    <section
      className={`mkt-hero mkt-hero-media relative min-h-[52vh] sm:min-h-[58vh] flex flex-col justify-end ${className}`}
    >
      <CmsMediaBackdrop
        imageUrl={imageUrl}
        intensity="photo"
        imageOpacity={imageOpacity}
        overlayOpacity={overlayOpacity}
      />
      <div className="mkt-shell relative pt-24 sm:pt-28 pb-14 sm:pb-16">
        {eyebrow ? <p className="mkt-eyebrow">{eyebrow}</p> : null}
        <h1 className="mkt-display mt-4 max-w-3xl whitespace-pre-line text-white">{headline}</h1>
        {subhead ? (
          <p className="mt-5 text-lg sm:text-xl text-white/75 max-w-2xl leading-relaxed">{subhead}</p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
