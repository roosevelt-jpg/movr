/**
 * Load-test helper for matching (Phase 21).
 * Run: npx ts-node backend/scripts/load-test-matching.ts
 * Or: autocannon -c 20 -d 10 http://localhost:3000/api/v1/rides/estimate
 */
import http from 'http';

const HOST = process.env.LOAD_TEST_HOST || 'localhost';
const PORT = Number(process.env.APP_PORT || 3000);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || 20);
const TOTAL = Number(process.env.LOAD_TOTAL || 200);

const payload = JSON.stringify({
  pickupLat: 5.6037,
  pickupLng: -0.187,
  dropoffLat: 5.6052,
  dropoffLng: -0.1668,
  countryCode: 'GH',
});

function once(): Promise<number> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: '/api/v1/rides/estimate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.on('data', () => undefined);
        res.on('end', () => resolve(Date.now() - start));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const times: number[] = [];
  let i = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < TOTAL) {
      i += 1;
      times.push(await once());
    }
  });
  await Promise.all(workers);
  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log(
    JSON.stringify(
      { total: times.length, avgMs: Math.round(avg), p95Ms: p95, targetMs: '2000-3000 matching' },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
