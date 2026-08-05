/** Optional Sentry — runtime specifier avoids Vite import-analysis hard fail. */
export function initWebSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || import.meta.env.REACT_APP_SENTRY_DSN;
  if (!dsn) return;

  const specifier = ['@sentry', 'react'].join('/');
  import(/* @vite-ignore */ specifier)
    .then((mod: any) => {
      const Sentry = mod?.default ?? mod;
      Sentry?.init?.({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
      });
    })
    .catch(() => undefined);
}
