// POST /api/sync { state } saves the signed-in student's progress.
import { json, rateLimit, readJson, originAllowed, isJson } from '../_lib/util.js';
import { getSession } from '../_lib/auth.js';
import { sanitizeState } from '../_lib/state.js';

export async function onRequestPost({ request, env }) {
  if (!env.PF_KV) return json({ error: 'not_configured' }, 503);
  if (!originAllowed(request, env)) return json({ error: 'forbidden' }, 403);
  if (!isJson(request)) return json({ error: 'bad_request' }, 415);
  const s = await getSession(request, env);
  if (!s) return json({ error: 'unauthenticated' }, 401);
  if (!rateLimit('sync:' + s.uid, 120, 60 * 60 * 1000)) return json({ error: 'slow_down' }, 429);

  let body;
  try { body = await readJson(request, 80000); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const out = JSON.stringify(sanitizeState(body.state));
  if (out.length > 60000) return json({ error: 'too_large' }, 413);
  await env.PF_KV.put('d:' + s.uid, out);
  return json({ ok: true });
}
