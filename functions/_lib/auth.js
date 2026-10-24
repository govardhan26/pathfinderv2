// Accounts: password hashing, sessions and cookies. Needs the PF_KV binding.
//   u:<uid>   user record   { uid, id, nick, salt, hash, sv, createdAt }
//   t:<hash>  session       { uid, sv, exp }   (key is the SHA-256 of the cookie token)
//   d:<uid>   saved progress
// uid is a hash of the email or mobile, so raw contact details never appear in key names.
import { clean } from './util.js';

const enc = new TextEncoder();
const ITER = 100000;                 // the most Cloudflare Workers allow for PBKDF2
export const SESSION_DAYS = 30;
const COOKIE = 'pf_sid';

function b64(buf) {
  const a = new Uint8Array(buf); let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
export function randomB64(n) { return b64(crypto.getRandomValues(new Uint8Array(n))); }
function hex(buf) { return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
export function randomHex(n) { return hex(crypto.getRandomValues(new Uint8Array(n))); }
export async function sha256Hex(str) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(str))); }

export async function hashPassword(password, saltB64) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: ITER }, key, 256);
  return b64(bits);
}

// "Asha@Example.com" -> "e:asha@example.com";  "+91 98765 43210" -> "m:9876543210";  anything else -> null
export function normalizeIdentifier(raw) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (s.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(s)) return 'e:' + s;
  let d = s.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? 'm:' + d : null;
}
export async function uidFor(norm) { return (await sha256Hex('pf-uid:' + norm)).slice(0, 20); }

export function cleanName(v) { return clean(v, 20).replace(/[<>]/g, ''); }

export function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
function tokenFrom(request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([0-9a-f]{64})(?:;|$)'));
  return m ? m[1] : null;
}

export async function createSession(env, user) {
  const token = randomHex(32);
  const rec = { uid: user.uid, sv: user.sv, exp: Date.now() + SESSION_DAYS * 86400000 };
  await env.PF_KV.put('t:' + (await sha256Hex(token)), JSON.stringify(rec), { expirationTtl: SESSION_DAYS * 86400 });
  return token;
}

// Returns { uid, user, tokenHash } for a valid session cookie, otherwise null.
export async function getSession(request, env) {
  const token = tokenFrom(request);
  if (!token || !env.PF_KV) return null;
  const tokenHash = await sha256Hex(token);
  const rec = await env.PF_KV.get('t:' + tokenHash, 'json');
  if (!rec || rec.exp < Date.now()) return null;
  const user = await env.PF_KV.get('u:' + rec.uid, 'json');
  if (!user || user.sv !== rec.sv) return null;      // sv changes when a password is reset
  return { uid: rec.uid, user, tokenHash };
}
