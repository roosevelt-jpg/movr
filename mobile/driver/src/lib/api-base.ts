export function apiBase() {
  return (
    (globalThis as any).__MOVR_API_URL__ ||
    process.env.EXPO_PUBLIC_API_URL ||
    'http://localhost:3000/api/v1'
  );
}

export function authIdBody(identifier: string, extra: Record<string, string> = {}) {
  const value = String(identifier || '').trim();
  if (value.includes('@')) return { email: value.toLowerCase(), ...extra };
  return { phone: value.replace(/[\s\-()]/g, ''), ...extra };
}

export function identifierLooksValid(identifier: string) {
  const value = String(identifier || '').trim();
  if (!value) return false;
  if (value.includes('@')) return value.includes('.');
  return value.replace(/\D/g, '').length >= 7;
}
