import React from 'react';

/** Shared background image/video for CMS marketing sections. */
export function CmsMediaBackdrop({
  imageUrl,
  videoUrl,
  className = '',
}: {
  imageUrl?: string;
  videoUrl?: string;
  className?: string;
}) {
  const video = videoUrl || (imageUrl && /\.(mp4|webm|mov)(\?|$)/i.test(imageUrl) ? imageUrl : '');
  const image = video ? '' : imageUrl;
  if (!video && !image) return null;

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      {video ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          src={video}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black" />
    </div>
  );
}
