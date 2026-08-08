import React from 'react';
import { mediaUrl } from '../lib/media';

export type MediaVariants = { sm?: string; md?: string; lg?: string };

function isVideoUrl(url?: string | null) {
  if (!url) return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/');
}

const ASPECT: Record<string, string> = {
  '21/9': 'aspect-[21/9]',
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  auto: '',
};

/**
 * Responsive image or video for CMS / storefront banners.
 * Always object-cover inside a relative aspect box; resolves /assets via mediaUrl.
 */
export default function ResponsiveMedia({
  src,
  alt = '',
  variants,
  aspect = '16/9',
  className = '',
  mediaClassName = 'absolute inset-0 h-full w-full object-cover',
  priority = false,
  fit = 'cover',
}: {
  src?: string | null;
  alt?: string;
  variants?: MediaVariants | null;
  aspect?: '21/9' | '16/9' | '4/3' | '1/1' | 'auto';
  className?: string;
  mediaClassName?: string;
  /** Skip lazy-load for heroes */
  priority?: boolean;
  fit?: 'cover' | 'contain';
}) {
  const url = mediaUrl(src);
  if (!url) return null;

  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';
  const mediaCls = mediaClassName.replace('object-cover', fitClass);
  const aspectCls = ASPECT[aspect] || '';
  const video = isVideoUrl(src);

  const srcSet = variants
    ? [variants.sm && `${mediaUrl(variants.sm)} 640w`, variants.md && `${mediaUrl(variants.md)} 1280w`, (variants.lg || url) && `${mediaUrl(variants.lg || url)} 1920w`]
        .filter(Boolean)
        .join(', ')
    : undefined;

  return (
    <div className={`relative w-full overflow-hidden ${aspectCls} ${className}`.trim()}>
      {video ? (
        <video
          className={mediaCls}
          src={url}
          autoPlay
          muted
          loop
          playsInline
          controls={false}
        />
      ) : (
        <img
          className={mediaCls}
          src={url}
          srcSet={srcSet}
          sizes={srcSet ? '(max-width: 640px) 100vw, (max-width: 1280px) 100vw, 1920px' : undefined}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
    </div>
  );
}

export function isMediaVideo(url?: string | null) {
  return isVideoUrl(url);
}
