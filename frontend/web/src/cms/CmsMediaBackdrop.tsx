import React from 'react';
import { mediaUrl } from '../lib/media';

/** Shared background image/video for CMS marketing sections. */
export function CmsMediaBackdrop({
  imageUrl,
  videoUrl,
  className = '',
  /** photo = stronger brand imagery; soft = lighter wash */
  intensity = 'photo',
  /** 0–100: how visible the photo/video is */
  imageOpacity,
  /** 0–100: how strong the dark fade/scrim is (higher = easier white text) */
  overlayOpacity,
}: {
  imageUrl?: string;
  videoUrl?: string;
  className?: string;
  intensity?: 'photo' | 'soft';
  imageOpacity?: number;
  overlayOpacity?: number;
}) {
  const rawVideo =
    videoUrl || (imageUrl && /\.(mp4|webm|mov)(\?|$)/i.test(imageUrl) ? imageUrl : '');
  const video = rawVideo ? mediaUrl(rawVideo) : '';
  const image = video ? '' : imageUrl ? mediaUrl(imageUrl) : '';
  if (!video && !image) return null;

  const photo = intensity === 'photo';
  const imgPct = clampPct(imageOpacity, photo ? 65 : 40);
  const overlayPct = clampPct(overlayOpacity, photo ? 55 : 70);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      {video ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: imgPct / 100 }}
          src={video}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${image})`, opacity: imgPct / 100 }}
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black"
        style={{ opacity: overlayPct / 100 }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-[#6A00FF] via-[#0055FF] to-[#3F7048]" />
    </div>
  );
}

function clampPct(value: number | undefined, fallback: number): number {
  if (value == null || Number.isNaN(Number(value))) return fallback;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}
