// POST /api/support { needs[], note, year, comfort, goal }  (signed in)
// Stores a support request for the mentor console. The student's email or mobile is attached
// only when they asked for Mentorship or a One-on-one session, which the form tells them.
import { json, clean, clientIp, rateLimit, readJson, originAllowed, isJson } from '../_lib/util.js';
import { getSession } from '../_lib/auth.js';
import { SUPPORT, YEARS, COMFORTS } from '../_lib/state.js';

const YEAR = 365 * 24 * 3600;

export async function onRequestPost({ request, env }) {
  if (!env.PF_KV) return json({ error: 'not_configured' }, 503);
  if (!originAllowed(request, env)) return json({ error: 'forbidden' }, 403);
  if (!isJson(request)) return json({ error: 'bad_request' }, 415);
  const s = await getSession(request, env);
  if (!s) return json({ error: 'unauthenticated' }, 401);
  if (!rateLimit('sup:' + s.uid, 6, 60 * 60 * 1000) || !rateLimit('supip:' + clientIp(request), 30, 60 * 60 * 1000)) return json({ error: 'slow_down' }, 429);

  let body;
  try { body = await readJson(request, 4000); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const needs = Array.isArray(body.needs) ? [...new Set(body.needs.filter((v) => SUPPORT.includes(v)))] : [];
  if (!needs.length) return json({ error: 'no_needs' }, 400);

  const id = String(9999999999999 - Date.now()).padStart(13, '0') + '-' + Math.random().toString(36).slice(2, 8);
  const wantsContact = needs.includes('mentor') || needs.includes('oneone');
  const record = {
    id, nick: s.user.nick, needs,
    note: clean(body.note, 400),
    year: YEARS.includes(body.year) ? body.year : '',
    comfort: COMFORTS.includes(body.comfort) ? body.comfort : '',
    goal: typeof body.goal === 'string' && /^[a-z0-9]{1,12}$/.test(body.goal) ? body.goal : '',
    contact: wantsContact ? s.user.id : null,
    createdAt: Date.now(), handled: false
  };

  // One open request per student: a new one replaces an earlier request nobody has handled yet.
  const prev = await env.PF_KV.get('p:' + s.uid);
  if (prev) {
    const old = await env.PF_KV.get('r:' + prev, 'json');
    if (old && !old.handled) await env.PF_KV.delete('r:' + prev);
  }
  await env.PF_KV.put('r:' + id, JSON.stringify(record), { expirationTtl: YEAR });
  await env.PF_KV.put('p:' + s.uid, id, { expirationTtl: YEAR });
  return json({ id }, 201);
}
