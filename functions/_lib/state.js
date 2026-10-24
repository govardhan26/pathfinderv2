// Clean up saved progress before it is stored. Never trust what a browser sends.
import { clean } from './util.js';

const SUPPORT = ['learn', 'career', 'mentor', 'oneone'];
export const YEARS = ['y1', 'y2', 'y3', 'y4', 'y_other'];
export const COMFORTS = ['c0', 'c1', 'c2'];
export { SUPPORT };
const SLUG = /^[a-z0-9]{1,12}$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function sanitizeState(st) {
  const o = isObj(st) ? st : {};
  const str = (v, n) => (typeof v === 'string' ? clean(v, n) : '');
  const out = {
    onboarded: o.onboarded === true,
    year: YEARS.includes(o.year) ? o.year : '',
    comfort: COMFORTS.includes(o.comfort) ? o.comfort : '',
    goal: typeof o.goal === 'string' && SLUG.test(o.goal) ? o.goal : '',
    support: Array.isArray(o.support) ? [...new Set(o.support.filter((v) => SUPPORT.includes(v)))] : [],
    supportNote: str(o.supportNote, 400),
    supportSent: o.supportSent === true,
    subjects: Array.isArray(o.subjects)
      ? [...new Set(o.subjects.filter((v) => typeof v === 'string' && SLUG.test(v)))].slice(0, 40) : [],
    done: {},
    logs: [],
    updatedAt: Math.max(0, Math.min(Number(o.updatedAt) || 0, Date.now() + 86400000))
  };
  if (isObj(o.done)) {
    for (const [role, steps] of Object.entries(o.done).slice(0, 20)) {
      if (!SLUG.test(role) || !isObj(steps)) continue;
      const m = {};
      for (const [i, ts] of Object.entries(steps).slice(0, 30)) {
        if (/^\d{1,2}$/.test(i) && Number.isFinite(Number(ts)) && Number(ts) > 0) m[i] = Number(ts);
      }
      if (Object.keys(m).length) out.done[role] = m;
    }
  }
  if (Array.isArray(o.logs)) {
    for (const l of o.logs.slice(0, 200)) {
      if (!isObj(l) || typeof l.role !== 'string' || !SLUG.test(l.role)) continue;
      const step = Number(l.step);
      if (!Number.isInteger(step) || step < 0 || step > 29) continue;
      out.logs.push({ role: l.role, step, note: str(l.note, 400), link: str(l.link, 300), ts: Number(l.ts) || 0 });
    }
  }
  return out;
}
