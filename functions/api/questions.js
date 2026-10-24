// Anonymous questions for mentors. Needs a KV namespace bound as PF_KV.
//   GET  /api/questions  -> recent answered questions (public board)
//   POST /api/questions  { text, role } -> stores a new question, returns { id }
// Keys: "q:<id>" while waiting, "a:<id>" once answered. Ids sort newest first.
import { json, clean, clientIp, rateLimit, readJson, originAllowed } from '../_lib/util.js';

const YEAR = 365 * 24 * 3600;

export async function onRequestGet({ env }) {
  if (!env.PF_KV) return json({ items: [] }, 200, { 'Cache-Control': 'public, max-age=60' });
  const list = await env.PF_KV.list({ prefix: 'a:', limit: 30 });
  const rows = await Promise.all(list.keys.map((k) => env.PF_KV.get(k.name, 'json')));
  const items = rows.filter(Boolean).map((r) => ({
    id: r.id, text: r.text, answer: r.answer, mentor: r.mentor || '', answeredAt: r.answeredAt
  }));
  return json({ items }, 200, { 'Cache-Control': 'public, max-age=60' });
}

export async function onRequestPost({ request, env }) {
  if (!env.PF_KV) return json({ error: 'storage_not_configured' }, 503);
  if (!originAllowed(request, env)) return json({ error: 'forbidden' }, 403);
  if (!rateLimit('q:' + clientIp(request), 8, 60 * 60 * 1000)) return json({ error: 'slow_down' }, 429);

  let body;
  try { body = await readJson(request, 4000); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const text = clean(body.text, 600);
  if (text.length < 3) return json({ error: 'too_short' }, 400);

  const id = String(9999999999999 - Date.now()).padStart(13, '0') + '-' + Math.random().toString(36).slice(2, 8);
  const record = { id, text, role: clean(body.role, 12), createdAt: Date.now(), answer: null };
  await env.PF_KV.put('q:' + id, JSON.stringify(record), { expirationTtl: YEAR });
  return json({ id }, 201);
}
