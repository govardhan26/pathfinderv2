// Mentor console API, protected by the MENTOR_PASSCODE secret.
//   POST /api/mentor { passcode, action, ... }
//   action: list | answer | handle | delete | reset
import { json, clean, clientIp, rateLimit, safeEqual, readJson, originAllowed, isJson } from '../_lib/util.js';
import { normalizeIdentifier, uidFor, randomB64, hashPassword } from '../_lib/auth.js';

const YEAR = 365 * 24 * 3600;
const ID_RE = /^\d{13}-[a-z0-9]{1,8}$/;

export async function onRequestPost({ request, env }) {
  if (!env.PF_KV || !env.MENTOR_PASSCODE) return json({ error: 'not_configured' }, 503);
  if (!originAllowed(request, env)) return json({ error: 'forbidden' }, 403);
  if (!isJson(request)) return json({ error: 'bad_request' }, 415);

  let body;
  try { body = await readJson(request, 6000); } catch (e) { return json({ error: 'bad_request' }, 400); }

  const ip = clientIp(request);
  if (!safeEqual(clean(body.passcode, 200), env.MENTOR_PASSCODE)) {
    // Only failed attempts count toward the limit.
    if (!rateLimit('mfail:' + ip, 10, 15 * 60 * 1000)) return json({ error: 'slow_down' }, 429);
    return json({ error: 'wrong_passcode' }, 401);
  }

  const action = clean(body.action, 10);
  const id = clean(body.id, 40);
  const get = (k) => env.PF_KV.get(k, 'json');

  if (action === 'list') {
    const [pend, done, reqs] = await Promise.all([
      env.PF_KV.list({ prefix: 'q:', limit: 100 }),
      env.PF_KV.list({ prefix: 'a:', limit: 20 }),
      env.PF_KV.list({ prefix: 'r:', limit: 100 })
    ]);
    const [pending, answered, requests] = await Promise.all([
      Promise.all(pend.keys.map((k) => get(k.name))),
      Promise.all(done.keys.map((k) => get(k.name))),
      Promise.all(reqs.keys.map((k) => get(k.name)))
    ]);
    return json({ pending: pending.filter(Boolean), answered: answered.filter(Boolean), requests: requests.filter(Boolean) });
  }

  if (action === 'reset') {
    const norm = normalizeIdentifier(body.identifier);
    const pw = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!norm) return json({ error: 'bad_id' }, 400);
    if (pw.length < 8 || pw.length > 200) return json({ error: 'bad_password' }, 400);
    const uid = await uidFor(norm);
    const user = await get('u:' + uid);
    if (!user) return json({ error: 'not_found' }, 404);
    user.salt = randomB64(16);
    user.hash = await hashPassword(pw, user.salt);
    user.sv = (user.sv || 1) + 1;                // signs the student out everywhere
    await env.PF_KV.put('u:' + uid, JSON.stringify(user));
    return json({ ok: true });
  }

  if (!ID_RE.test(id)) return json({ error: 'bad_id' }, 400);

  if (action === 'answer') {
    const answer = clean(body.answer, 1500);
    if (answer.length < 2) return json({ error: 'too_short' }, 400);
    const rec = (await get('q:' + id)) || (await get('a:' + id));
    if (!rec) return json({ error: 'not_found' }, 404);
    rec.answer = answer;
    rec.mentor = clean(body.mentor, 40);
    rec.answeredAt = Date.now();
    await env.PF_KV.put('a:' + id, JSON.stringify(rec), { expirationTtl: YEAR });
    await env.PF_KV.delete('q:' + id);
    return json({ ok: true });
  }

  if (action === 'handle') {
    const rec = await get('r:' + id);
    if (!rec) return json({ error: 'not_found' }, 404);
    rec.handled = true; rec.handledBy = clean(body.mentor, 40); rec.handledAt = Date.now();
    await env.PF_KV.put('r:' + id, JSON.stringify(rec), { expirationTtl: YEAR });
    return json({ ok: true });
  }

  if (action === 'delete') {
    const kind = clean(body.kind, 1);
    const prefixes = kind === 'r' ? ['r:'] : kind === 'a' ? ['a:'] : ['q:', 'a:'];
    for (const p of prefixes) await env.PF_KV.delete(p + id);
    return json({ ok: true });
  }

  return json({ error: 'bad_action' }, 400);
}
