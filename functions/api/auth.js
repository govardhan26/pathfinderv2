// GET  /api/auth                                  -> who am I (checks the session cookie), plus saved progress
// POST /api/auth { action: "register", name, identifier, password }
// POST /api/auth { action: "login", identifier, password }
// POST /api/auth { action: "logout" }
import { json, clean, clientIp, rateLimit, readJson, originAllowed, isJson } from '../_lib/util.js';
import {
  normalizeIdentifier, uidFor, cleanName, randomB64, hashPassword, createSession, getSession,
  sessionCookie, clearCookie
} from '../_lib/auth.js';

const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA==';     // used to spend the same time when an account does not exist
const WINDOW = 15 * 60 * 1000;

export async function onRequestGet({ request, env }) {
  if (!env.PF_KV) return json({ error: 'not_configured' }, 503);
  const s = await getSession(request, env);
  if (!s) return json({ error: 'unauthenticated' }, 401);
  const state = await env.PF_KV.get('d:' + s.uid, 'json');
  return json({ user: { id: s.uid, nick: s.user.nick }, state: state || null });
}

async function respondWithSession(env, user, status) {
  const token = await createSession(env, user);
  const state = await env.PF_KV.get('d:' + user.uid, 'json');
  return json({ user: { id: user.uid, nick: user.nick }, state: state || null }, status, { 'Set-Cookie': sessionCookie(token) });
}

export async function onRequestPost({ request, env }) {
  if (!env.PF_KV) return json({ error: 'not_configured' }, 503);
  if (!originAllowed(request, env)) return json({ error: 'forbidden' }, 403);
  if (!isJson(request)) return json({ error: 'bad_request' }, 415);

  let body;
  try { body = await readJson(request, 2000); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const action = clean(body.action, 10);
  const ip = clientIp(request);

  if (action === 'logout') {
    const s = await getSession(request, env);
    if (s) await env.PF_KV.delete('t:' + s.tokenHash);
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
  }

  if (action !== 'register' && action !== 'login') return json({ error: 'bad_action' }, 400);

  const norm = normalizeIdentifier(body.identifier);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!norm) return json({ error: 'bad_id' }, 400);

  if (action === 'register') {
    if (!rateLimit('reg:' + ip, 10, 60 * 60 * 1000)) return json({ error: 'slow_down' }, 429);
    const nick = cleanName(body.name);
    if (nick.length < 2) return json({ error: 'bad_name' }, 400);
    if (password.length < 8 || password.length > 200) return json({ error: 'bad_password' }, 400);
    const uid = await uidFor(norm);
    if (await env.PF_KV.get('u:' + uid)) return json({ error: 'exists' }, 409);
    const salt = randomB64(16);
    const user = { uid, id: norm, nick, salt, hash: await hashPassword(password, salt), sv: 1, createdAt: Date.now() };
    await env.PF_KV.put('u:' + uid, JSON.stringify(user));
    return respondWithSession(env, user, 201);
  }

  // login
  const uid = await uidFor(norm);
  if (!rateLimit('li:' + ip, 40, WINDOW) || !rateLimit('lu:' + uid, 10, WINDOW)) return json({ error: 'slow_down' }, 429);
  const user = await env.PF_KV.get('u:' + uid, 'json');
  const computed = await hashPassword(password.slice(0, 200), user ? user.salt : DUMMY_SALT);
  if (!user || computed !== user.hash) return json({ error: 'bad_credentials' }, 401);
  return respondWithSession(env, user, 200);
}
