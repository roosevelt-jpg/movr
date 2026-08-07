import React, { useEffect, useState } from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { StoreBadgeButton } from '../../components/StoreBadges';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const DEFAULT_LINKS = {
  ios_url: 'https://apps.apple.com/app/movr',
  android_url: 'https://play.google.com/store/apps/details?id=io.movr.app',
};

/** Download page — prefers CMS `download` slug; falls back to badges + app-links API. */
export default function DownloadAppPage() {
  const { page, loading } = useCmsPage('download');
  const [links, setLinks] = useState(DEFAULT_LINKS);

  useEffect(() => {
    fetch(`${API}/public/app-links`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data?.ios_url || body?.data?.android_url) {
          setLinks({
            ios_url: body.data.ios_url || DEFAULT_LINKS.ios_url,
            android_url: body.data.android_url || DEFAULT_LINKS.android_url,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (page?.sections?.length) {
    return (
      <div className="bg-surface text-text-primary">
        <CmsSections sections={page.sections} pageSlug="download" />
      </div>
    );
  }

  return (
    <div className="bg-surface text-text-primary flex flex-col flex-1 mkt-hero">
      <main className="mkt-shell flex-1 flex flex-col items-center justify-center py-20 sm:py-28 text-center">
        <p className="mkt-eyebrow">Get the app</p>
        <h1 className="mkt-display mt-5 max-w-3xl">Take Movr with you.</h1>
        <p className="mt-5 text-lg text-white/55 max-w-xl">
          Book rides, shop local stores, send parcels, and manage your wallet — on iOS and Android.
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <StoreBadgeButton store="ios" href={links.ios_url} label="App Store" />
          <StoreBadgeButton store="android" href={links.android_url} label="Google Play" />
        </div>
      </main>
    </div>
  );
}
