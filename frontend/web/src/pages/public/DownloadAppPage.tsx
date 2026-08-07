import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const DEFAULT_LINKS = {
  ios_url: 'https://apps.apple.com/app/movr',
  android_url: 'https://play.google.com/store/apps/details?id=io.movr.app',
};

/** Public download page — matches “Get the Movr app” mockup. */
export default function DownloadAppPage() {
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

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif] flex flex-col">
      <header className="px-6 pt-6 pb-5">
        <span className="text-xl font-bold tracking-tight">Movr</span>
      </header>
      <div className="h-px w-full bg-white/15" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Get the Movr app</h1>
        <p className="mt-4 text-white/55 text-base md:text-lg">Available on iOS and Android</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={links.ios_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 rounded-xl bg-[#2a2a2a] hover:bg-[#333] px-6 py-3.5 font-semibold text-white min-w-[150px] justify-center"
          >
            <Download size={18} strokeWidth={2.25} />
            App Store
          </a>
          <a
            href={links.android_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 rounded-xl bg-[#2a2a2a] hover:bg-[#333] px-6 py-3.5 font-semibold text-white min-w-[150px] justify-center"
          >
            <Download size={18} strokeWidth={2.25} />
            Google Play
          </a>
        </div>
      </main>
    </div>
  );
}
