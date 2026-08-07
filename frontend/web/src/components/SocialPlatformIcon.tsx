import React from 'react';

export type SocialLink = {
  key?: string;
  platform?: string;
  label?: string;
  href?: string;
  iconUrl?: string;
};

/** Known platforms admins can pick — any other value uses custom icon or letter fallback. */
export const SOCIAL_PLATFORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'threads', label: 'Threads' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'discord', label: 'Discord' },
  { value: 'github', label: 'GitHub' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'mail', label: 'Email' },
  { value: 'other', label: 'Other / custom' },
];

function hostOf(href?: string): string {
  if (!href) return '';
  try {
    const u = new URL(href.startsWith('http') ? href : `https://${href}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Infer platform from CMS key or URL host so any link still gets a sensible icon. */
export function resolveSocialPlatform(link: SocialLink): string {
  const raw = String(link.platform || link.key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (raw && raw !== 'other' && raw !== 'share' && raw !== 'community') {
    if (raw === 'twitter' || raw === 'x.com') return 'x';
    if (raw === 'fb') return 'facebook';
    if (raw === 'ig') return 'instagram';
    if (raw === 'yt') return 'youtube';
    if (raw === 'email' || raw === 'mailto') return 'mail';
    return raw;
  }

  const host = hostOf(link.href);
  if (!host) {
    if ((link.href || '').startsWith('mailto:')) return 'mail';
    return 'other';
  }
  if (host.includes('facebook') || host === 'fb.com' || host === 'fb.me') return 'facebook';
  if (host.includes('instagram')) return 'instagram';
  if (host === 'x.com' || host.includes('twitter')) return 'x';
  if (host.includes('linkedin')) return 'linkedin';
  if (host.includes('youtube') || host === 'youtu.be') return 'youtube';
  if (host.includes('tiktok')) return 'tiktok';
  if (host.includes('whatsapp') || host === 'wa.me') return 'whatsapp';
  if (host.includes('telegram') || host === 't.me') return 'telegram';
  if (host.includes('threads')) return 'threads';
  if (host.includes('snapchat')) return 'snapchat';
  if (host.includes('pinterest')) return 'pinterest';
  if (host.includes('reddit')) return 'reddit';
  if (host.includes('discord')) return 'discord';
  if (host.includes('github')) return 'github';
  if (host.includes('twitch')) return 'twitch';
  if (host.includes('spotify')) return 'spotify';
  return 'other';
}

function Glyph({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Compact brand glyphs — works without lucide brand packs. */
const PATHS: Record<string, string> = {
  facebook:
    'M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14C17.174 2.097 15.943 2 14.643 2 11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z',
  instagram:
    'M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm10 2H7a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3zm-5 3.5A4.5 4.5 0 1112 16.5 4.5 4.5 0 0112 7.5zm0 2A2.5 2.5 0 1014.5 12 2.5 2.5 0 0012 9.5zM17.5 6.75a1 1 0 11-1 1 1 1 0 011-1z',
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  linkedin:
    'M6.94 5a2 2 0 11-4-.002 2 2 0 014 .002zM7 8.48H3V21h4V8.48zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91l.04-1.68z',
  youtube:
    'M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.5 31.5 0 000 12a31.5 31.5 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.5 31.5 0 0024 12a31.5 31.5 0 00-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z',
  tiktok:
    'M16.6 5.82A4.93 4.93 0 0119.5 5V8a8 8 0 01-4-.94v7.42a5.5 5.5 0 11-5.5-5.5c.35 0 .69.04 1.02.11v2.8a2.7 2.7 0 00-.98-.18 2.7 2.7 0 102.7 2.7V2h2.86c.1 1.35.67 2.62 1.6 3.82z',
  whatsapp:
    'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.12c-.24.68-1.4 1.25-1.93 1.33-.5.08-1.13.11-1.82-.11-.42-.14-.96-.31-1.66-.61-2.92-1.26-4.82-4.2-4.97-4.4-.14-.19-1.18-1.57-1.18-3 0-1.42.74-2.12 1-2.41.26-.29.57-.36.76-.36h.55c.18 0 .41-.07.64.49.24.58.82 2 .89 2.14.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.12.57.16.28.73 1.2 1.57 1.95 1.08.96 1.99 1.26 2.27 1.4.28.14.45.12.61-.07.17-.19.7-.82.89-1.1.19-.28.37-.23.63-.14.26.1 1.66.78 1.95.93.28.14.47.21.54.33.07.12.07.7-.17 1.38z',
  telegram:
    'M9.78 15.55l-.37 5.22c.53 0 .76-.23 1.04-.5l2.5-2.4 5.18 3.8c.95.53 1.63.25 1.89-.88l3.42-16.07h.01c.3-1.41-.51-1.96-1.44-1.62L1.74 9.64C.37 10.17.39 10.95 1.5 11.3l5.1 1.59L18.3 6.2c.62-.41 1.18-.19.72.22L9.78 15.55z',
  threads:
    'M16.5 9.3c-.3-1.9-1.6-3.3-4.1-3.3-3 0-5 2.2-5 5.8 0 3.2 1.6 5.4 4.5 5.4 1.5 0 2.8-.4 3.8-1.1v-2.1c-.8.6-1.8 1-3 1-1.8 0-2.9-1.2-2.9-3.2 0-2.1 1.1-3.4 2.9-3.4.9 0 1.6.3 2 .9.2.3.4.7.5 1.1h2.4c-.1-1.2-.5-2.3-1.1-3.1zm-2.1 4.2c-.2 1.4-1.1 2.3-2.4 2.3-1.2 0-2-.9-2-2.4 0-1.4.8-2.3 2-2.3.9 0 1.7.5 2 1.4.2.5.4 1.1.4 1zM12.2 2C6.7 2 2.5 6.2 2.5 11.7S6.7 21.4 12.2 21.4 21.9 17.2 21.9 11.7 17.7 2 12.2 2z',
  snapchat:
    'M12.17 2c-2.8 0-5.2 1.9-5.5 4.8-.1.8-.1 3.4-.1 3.4s-.9.3-1.4.6c-.7.4-1.1 1-.7 1.6.4.7 1.5.7 2.1.9.2.1.3.2.3.4 0 .5-.9 1.8-2.4 2.4-.5.2-.6.5-.5.8.2.6 1.1.5 1.8.4.5-.1 1 .1 1.3.5.5.7 1.3 2.1 3.1 2.1s2.6-1.4 3.1-2.1c.3-.4.8-.6 1.3-.5.7.1 1.6.2 1.8-.4.1-.3 0-.6-.5-.8-1.5-.6-2.4-1.9-2.4-2.4 0-.2.1-.3.3-.4.6-.2 1.7-.2 2.1-.9.4-.6 0-1.2-.7-1.6-.5-.3-1.4-.6-1.4-.6s0-2.6-.1-3.4C17.37 3.9 15 2 12.17 2z',
  pinterest:
    'M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.3 9.3-.1-.8-.2-2 0-2.9.2-.8 1.3-5.5 1.3-5.5s-.3-.7-.3-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.7 1.5 1.6 0 1-.6 2.4-.9 3.8-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.6-4.4-3.1 0-5 2.3-5 4.8 0 .9.4 1.9.8 2.4.1.1.1.2.1.3l-.3 1.2c0 .2-.1.2-.3.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2-.5-2.4-1.2l-.7 2.5c-.2.9-.9 2-1.3 2.7A10 10 0 0012 22c5.5 0 10-4.5 10-10S17.5 2 12 2z',
  reddit:
    'M14.2 15.5a1.6 1.6 0 01-2.2 0 .5.5 0 00-.7.7 2.6 2.6 0 003.6 0 .5.5 0 00-.7-.7zM9.1 13.3a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2zm5.8 0a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2zM22 12.1a2.4 2.4 0 00-4.1-1.6 11 11 0 00-5.9-1.9l1-4.7 3.2.7a1.7 1.7 0 103.3-.7 1.7 1.7 0 00-3.2.6L12.3 3a.6.6 0 00-.7-.4l-4.5 1a.6.6 0 00-.4.7l1.1 5.1A11 11 0 002.1 14 2.4 2.4 0 004.5 18c.3 2.8 3.7 4.9 7.5 4.9s7.2-2.1 7.5-4.9A2.4 2.4 0 0022 12.1z',
  discord:
    'M19.3 5.2A17.4 17.4 0 0015.1 4l-.2.4a16.2 16.2 0 014.1 2.1 15.4 15.4 0 00-13.9 0A16.2 16.2 0 019.1 4.4L8.9 4A17.4 17.4 0 004.7 5.2C1.3 10.3.4 15.3.7 20.2A17.6 17.6 0 005.7 22l.9-1.4a11.3 11.3 0 01-1.7-.8l.4-.3a12.8 12.8 0 0014.4 0l.4.3a11.3 11.3 0 01-1.7.8l.9 1.4a17.6 17.6 0 005-1.8c.4-5.6-.6-10.6-4-15.1zM8.7 16.7a1.9 1.9 0 01-1.9-2 1.9 1.9 0 011.9-2 1.9 1.9 0 011.9 2 1.9 1.9 0 01-1.9 2zm6.6 0a1.9 1.9 0 01-1.9-2 1.9 1.9 0 011.9-2 1.9 1.9 0 011.9 2 1.9 1.9 0 01-1.9 2z',
  github:
    'M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0112 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .26.18.58.69.48A10.03 10.03 0 0022 12.26C22 6.58 17.52 2 12 2z',
  twitch:
    'M4 2L2 5.5V20h5.5v2H10l2.5-2H16l5-5.5V2H4zm15.5 11L17 16H12.5L10 18.5V16H6.5V4h13v9zM14 7.5h2V12h-2V7.5zm-5 0h2V12H9V7.5z',
  spotify:
    'M12 2a10 10 0 100 20 10 10 0 000-20zm4.6 14.4a.62.62 0 01-.86.21c-2.35-1.44-5.31-1.76-8.8-.96a.63.63 0 01-.28-1.22c3.8-.87 7.07-.5 9.72 1.12a.62.62 0 01.22.85zm1.2-2.7a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 01-.46-1.49c3.64-1.1 8.16-.57 11.24 1.32a.78.78 0 01.26 1.08zm.1-2.8C14.7 8.9 9.35 8.7 6.3 9.65a.94.94 0 11-.55-1.8c3.5-1.07 9.32-.86 13 1.33a.94.94 0 01-.95 1.62z',
  mail: 'M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
};

/**
 * Renders a social platform mark for footer buttons.
 * Supports known networks, URL auto-detect, custom iconUrl, and letter fallback for any platform.
 */
export function SocialPlatformIcon({
  link,
  size = 16,
}: {
  link: SocialLink;
  size?: number;
}) {
  if (link.iconUrl) {
    return (
      <img
        src={link.iconUrl}
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  const platform = resolveSocialPlatform(link);
  const path = PATHS[platform];
  if (path) return <Glyph d={path} size={size} />;

  const letter = String(link.label || platform || '?')
    .replace(/^https?:\/\//, '')
    .charAt(0)
    .toUpperCase();

  return (
    <span
      style={{
        fontSize: Math.max(10, size - 2),
        fontWeight: 700,
        lineHeight: 1,
        display: 'inline-flex',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

export function socialAriaLabel(link: SocialLink): string {
  if (link.label) return link.label;
  const p = resolveSocialPlatform(link);
  const known = SOCIAL_PLATFORM_OPTIONS.find((o) => o.value === p);
  return known?.label || 'Social link';
}
