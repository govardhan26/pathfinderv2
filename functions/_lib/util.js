// Shared helpers for the Pages Functions. Files here are not routes.

export function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

// Trim, drop control characters, cap length.
export function clean(s, max) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// Constant-time string compare, so passcode checks do not leak timing.
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// Best-effort in-memory limiter. It resets when the worker restarts and is not
// shared between locations, so also add a Cloudflare rate limiting rule for /api/*.
const buckets = new Map();
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    buckets.set(key, { start: now, n: 1 });
    if (buckets.size > 5000) { for (const [k, v] of buckets) { if (now - v.start > windowMs) buckets.delete(k); } }
    return true;
  }
  b.n++;
  return b.n <= limit;
}

export async function readJson(request, maxBytes = 20000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('too_large');
  return JSON.parse(text || '{}');
}

// Browsers send an Origin header on every cross-site and POST request. It must match this site
// (or ALLOWED_ORIGIN if you set one). Requests without Origin (curl, server to server) pass.
export function originAllowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const allowed = env.ALLOWED_ORIGIN || new URL(request.url).origin;
  return origin === allowed;
}

// State-changing endpoints only accept JSON, which a plain HTML form cannot send.
export function isJson(request) {
  return (request.headers.get('Content-Type') || '').toLowerCase().includes('application/json');
}
