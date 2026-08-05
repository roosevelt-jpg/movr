/**
 * Phase 21 — Sentry for Expo / RN driver app.
 * Set EXPO_PUBLIC_SENTRY_DSN (or REACT_APP_SENTRY_DSN) to enable; no-op otherwise.
 */
export function initMobileSentry(appName: 'customer' | 'driver' = 'driver') {
  const dsn =
    (typeof process !== 'undefined' &&
      (process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.REACT_APP_SENTRY_DSN)) ||
    '';
  if (!dsn) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react-native');
    if (Sentry?.init) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
        enableAutoSessionTracking: true,
        initialScope: { tags: { app: appName } },
      });
    }
  } catch {
    const g = globalThis as any;
    if (!g.__MOVR_SENTRY_FALLBACK__) {
      g.__MOVR_SENTRY_FALLBACK__ = true;
      const prev = g.ErrorUtils?.getGlobalHandler?.();
      g.ErrorUtils?.setGlobalHandler?.((error: any, isFatal?: boolean) => {
        // eslint-disable-next-line no-console
        console.error(`[sentry:${appName}]`, { isFatal, message: String(error?.message || error) });
        prev?.(error, isFatal);
      });
    }
  }
}
