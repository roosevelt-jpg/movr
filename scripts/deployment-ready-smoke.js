#!/usr/bin/env node
/**
 * Deployment readiness smoke checks (no auth for public; optional token for rails).
 * Usage: API_URL=http://localhost:3000/api/v1 node scripts/deployment-ready-smoke.js
 */
const API = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.SMOKE_TOKEN || '';

async function get(path, auth = false) {
  const headers = { Accept: 'application/json' };
  if (auth && TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* */
  }
  return { ok: res.ok, status: res.status, json, path };
}

function pass(name, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  console.log(`Smoke → ${API}`);
  let failed = 0;

  let health = { ok: false, status: 0, path: '/health' };
  try {
    health = await get('/health');
  } catch {
    /* */
  }
  const healthRoot = await fetch(API.replace(/\/api\/v1\/?$/, '') + '/health')
    .then((r) => ({ ok: r.ok, status: r.status }))
    .catch(() => ({ ok: false, status: 0 }));
  if (!pass('API reachable', health.ok || healthRoot.ok, `status=${health.status || healthRoot.status}`)) {
    failed += 1;
    console.log('\nStart the API (or set API_URL) then re-run. Remaining checks skipped.');
    process.exit(1);
  }

  const catalog = await get('/rails/catalog?countryCode=GH').catch(() => ({
    ok: false,
    status: 0,
  }));
  if (!pass('Rails catalog', catalog.ok, `status=${catalog.status}`)) failed += 1;

  const corridors = await get('/rails/remittance/corridors').catch(() => ({
    ok: false,
    status: 0,
  }));
  pass(
    'Remittance corridors (optional)',
    corridors.ok || corridors.status === 401 || corridors.status === 404,
    `status=${corridors.status}`
  );

  if (TOKEN) {
    const credit = await get('/rails/credit', true).catch(() => ({ ok: false, status: 0 }));
    if (!pass('Mobility credit (auth)', credit.ok, `status=${credit.status}`)) failed += 1;
  } else {
    console.log('SKIP  Mobility credit (set SMOKE_TOKEN for auth checks)');
  }

  const prodHint =
    process.env.EXPECT_PRODUCTION === 'true' || /mymovr\.io/i.test(API);
  if (prodHint) {
    pass(
      'Production API host',
      /api\.mymovr\.io/i.test(API) || process.env.ALLOW_NON_CANONICAL === 'true',
      API
    );
    console.log(
      'NOTE  Ensure PAYSTACK_SECRET_KEY / FLUTTERWAVE_SECRET_KEY are live and ALLOW_DEMO_TOPUPS is false'
    );
  }

  console.log(failed ? `\n${failed} required check(s) failed` : '\nReady for deploy smoke (public rails OK)');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
