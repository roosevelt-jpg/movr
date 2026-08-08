import React from 'react';
import { MediaField } from './CmsMediaField';

/** Stock Movr brand photos (also in frontend/web/public/brand). */
export const BRAND_BG_PRESETS: Array<{ id: string; label: string; url: string }> = [
  { id: 'sedan', label: 'Ride sedan', url: '/brand/ride-sedan.png' },
  { id: 'courier', label: 'Courier moto', url: '/brand/courier-moto.png' },
  { id: 'shop', label: 'Shop partner', url: '/brand/shop-partner.png' },
  { id: 'wordmark', label: 'Movr wordmark', url: '/brand/movr-wordmark.png' },
];

type BgPatch = {
  backgroundImage?: string;
  backgroundVideo?: string;
  backgroundOpacity?: number;
  overlayOpacity?: number;
};

/**
 * Hero / banner background editor — upload, presets, and fade/visibility sliders.
 */
export function HeroBackgroundField({
  label = 'Page background / banner',
  backgroundImage,
  backgroundVideo,
  backgroundOpacity = 65,
  overlayOpacity = 55,
  disabled,
  onChange,
}: {
  label?: string;
  backgroundImage?: string;
  backgroundVideo?: string;
  backgroundOpacity?: number;
  overlayOpacity?: number;
  disabled?: boolean;
  onChange: (next: BgPatch) => void;
}) {
  const current = backgroundVideo || backgroundImage || '';
  const imgPct = Number.isFinite(Number(backgroundOpacity)) ? Number(backgroundOpacity) : 65;
  const overlayPct = Number.isFinite(Number(overlayOpacity)) ? Number(overlayOpacity) : 55;

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        Full-bleed hero on the public page. White headline text sits on a dark fade — raise fade if text is hard to
        read, raise image visibility to show more of the photo.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {BRAND_BG_PRESETS.map((preset) => {
          const active = current === preset.url;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              title={preset.label}
              onClick={() =>
                onChange({
                  backgroundImage: preset.url,
                  backgroundVideo: '',
                  backgroundOpacity: imgPct,
                  overlayOpacity: overlayPct,
                })
              }
              style={{
                width: 72,
                height: 48,
                padding: 0,
                borderRadius: 8,
                overflow: 'hidden',
                border: active ? '2px solid var(--motion-blue, #0055FF)' : '1px solid var(--border)',
                cursor: disabled ? 'default' : 'pointer',
                background: 'var(--surface)',
              }}
            >
              <img
                src={preset.url}
                alt={preset.label}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          );
        })}
      </div>

      <MediaField
        label="Upload or replace background"
        value={current}
        disabled={disabled}
        purpose="hero"
        hint="Image or short looping video — auto-resized to /assets. Remove media to clear the photo (gradient only)."
        onChange={(url) => {
          if (!url) {
            onChange({
              backgroundImage: '',
              backgroundVideo: '',
              backgroundOpacity: imgPct,
              overlayOpacity: overlayPct,
            });
            return;
          }
          if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/')) {
            onChange({
              backgroundVideo: url,
              backgroundImage: '',
              backgroundOpacity: imgPct,
              overlayOpacity: overlayPct,
            });
          } else {
            onChange({
              backgroundImage: url,
              backgroundVideo: '',
              backgroundOpacity: imgPct,
              overlayOpacity: overlayPct,
            });
          }
        }}
      />

      <label style={{ display: 'block', marginTop: 8 }}>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Or paste image/video URL
        </span>
        <input
          value={current}
          disabled={disabled}
          placeholder="https://… or /uploads/… or /brand/…"
          onChange={(e) => {
            const url = e.target.value.trim();
            if (!url) {
              onChange({
                backgroundImage: '',
                backgroundVideo: '',
                backgroundOpacity: imgPct,
                overlayOpacity: overlayPct,
              });
              return;
            }
            if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/')) {
              onChange({
                backgroundVideo: url,
                backgroundImage: '',
                backgroundOpacity: imgPct,
                overlayOpacity: overlayPct,
              });
            } else {
              onChange({
                backgroundImage: url,
                backgroundVideo: '',
                backgroundOpacity: imgPct,
                overlayOpacity: overlayPct,
              });
            }
          }}
          style={inputStyle}
        />
      </label>

      <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <label>
          <span style={labelRow}>
            Image visibility <strong>{imgPct}%</strong>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            disabled={disabled || !current}
            value={imgPct}
            onChange={(e) =>
              onChange({
                backgroundImage: backgroundImage || '',
                backgroundVideo: backgroundVideo || '',
                backgroundOpacity: Number(e.target.value),
                overlayOpacity: overlayPct,
              })
            }
            style={{ width: '100%' }}
          />
          <span style={hint}>Higher = photo shows through more clearly</span>
        </label>
        <label>
          <span style={labelRow}>
            Dark fade / text contrast <strong>{overlayPct}%</strong>
          </span>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            disabled={disabled}
            value={overlayPct}
            onChange={(e) =>
              onChange({
                backgroundImage: backgroundImage || '',
                backgroundVideo: backgroundVideo || '',
                backgroundOpacity: imgPct,
                overlayOpacity: Number(e.target.value),
              })
            }
            style={{ width: '100%' }}
          />
          <span style={hint}>Higher = darker overlay so white headlines stay readable</span>
        </label>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated, #1a1a1a)',
  color: 'var(--text-primary, #fff)',
  padding: '10px 12px',
  fontSize: 13,
};

const labelRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

const hint: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text-secondary)',
  marginTop: 4,
};
