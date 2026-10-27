// Time zones and working hours: "it's 11:40 PM for Sara", and when both sides are at work.

import { browserTz } from './api';

const DAY = 1440;
export const toMin = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const fmtMin = m => {
  m = ((m % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const validTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return !!tz; } catch { return false; } };
export const allZones = () => { try { return Intl.supportedValuesOf('timeZone'); } catch { return [browserTz()].filter(Boolean); } };
/** 'America/New_York' → 'New York' */
export const tzCity = tz => (tz ? tz.split('/').pop().replace(/_/g, ' ') : '');

/** Minutes past midnight and the weekday in a time zone. */
export function zoneNow(tz, t = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: validTz(tz) ? tz : undefined, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(t));
  const get = k => parts.find(p => p.type === k)?.value;
  const min = Number(get('hour')) * 60 + Number(get('minute'));
  return { min, day: get('weekday'), label: fmtMin(min) };
}

/** Offset from UTC in minutes. */
export function tzOffset(tz, t = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: validTz(tz) ? tz : undefined, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(t / 60000) * 60000) / 60000);
}

const isWeekend = day => day === 'Sat' || day === 'Sun';

/** { min, day, label, working, weekend } for someone with these hours. */
export function personNow(z) {
  const now = zoneNow(z.tz);
  const s = toMin(z.start), e = toMin(z.end);
  const inHours = s <= e ? now.min >= s && now.min < e : now.min >= s || now.min < e;
  return { ...now, weekend: isWeekend(now.day), working: inHours && !isWeekend(now.day) };
}

/**
 * When their working hours fall inside mine, in my local minutes: [[start, end], …].
 * zones: { tz, start: 'HH:MM', end: 'HH:MM' }
 */
export function overlapWindows(mine, theirs) {
  const shift = tzOffset(mine.tz) - tzOffset(theirs.tz); // add to their clock to get mine
  const span = (s, e) => (s <= e ? [[s, e]] : [[s, DAY], [0, e]]);
  const a = span(toMin(mine.start), toMin(mine.end));
  const bs = toMin(theirs.start) + shift, be = toMin(theirs.end) + shift;
  const norm = m => ((m % DAY) + DAY) % DAY;
  const b = span(norm(bs), norm(be));
  const out = [];
  for (const [s1, e1] of a) for (const [s2, e2] of b) { const s = Math.max(s1, s2), e = Math.min(e1, e2); if (e > s) out.push([s, e]); }
  return out.sort((x, y) => x[0] - y[0]);
}
export const fmtWindows = w => w.map(([s, e]) => `${fmtMin(s)}–${fmtMin(e)}`).join(', ');
