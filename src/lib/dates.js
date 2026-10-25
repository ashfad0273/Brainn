import { toISO } from './util';

const DAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAY_RE = /\b(by|on|before|until|till|due|next|this|for|from)?\s*(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };

function rollYear(d, base) {
  if (d < base) d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Turn "by fri", "tmrw", "eow", "in 3 days", "25 oct", "10/28" into YYYY-MM-DD (or ''). */
export function parseDue(text, base = new Date()) {
  const s = (text || '').toLowerCase();
  const b = new Date(base); b.setHours(12, 0, 0, 0);
  const plus = n => { const d = new Date(b); d.setDate(d.getDate() + n); return toISO(d); };
  let m;
  if ((m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/\bday after (tomorrow|tmrw)\b/.test(s)) return plus(2);
  if (/\b(tomorrow|tmrw|tmr|tomo|2moro|2mrw)\b/.test(s)) return plus(1);
  if (/\b(today|tonight|tdy|2day|eod|end of (the )?day)\b/.test(s)) return plus(0);
  if ((m = s.match(/\bin\s+(\d+|an?|one|two|three|four|five|six|seven|ten)\s+(day|week)s?\b/))) {
    const n = NUM[m[1]] ?? +m[1];
    return plus(m[2] === 'week' ? n * 7 : n);
  }
  if (/\b(eow|end of (the )?week)\b/.test(s)) return plus((5 - b.getDay() + 7) % 7);
  if (/\bnext week\b/.test(s)) return plus(((1 - b.getDay() + 7) % 7) || 7);
  if (/\b(eom|end of (the )?month)\b/.test(s)) return toISO(new Date(b.getFullYear(), b.getMonth() + 1, 0));
  if ((m = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}\\b`)))) {
    return toISO(rollYear(new Date(b.getFullYear(), MONTHS.indexOf(m[2].slice(0, 3)), +m[1], 12), b));
  }
  if ((m = s.match(new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
    return toISO(rollYear(new Date(b.getFullYear(), MONTHS.indexOf(m[1].slice(0, 3)), +m[2], 12), b));
  }
  if ((m = s.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
    const us = (navigator.language || 'en-US') === 'en-US';
    const [day, mon] = us ? [+m[2], +m[1]] : [+m[1], +m[2]];
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : b.getFullYear();
      const d = new Date(y, mon - 1, day, 12);
      return toISO(m[3] ? d : rollYear(d, b));
    }
  }
  if ((m = s.match(DAY_RE))) {
    const short = m[2].length <= 3;
    // "sat"/"sun" alone are too ambiguous without a preposition
    if (!(short && /^(sat|sun)$/.test(m[2]) && !m[1])) {
      const target = DAYS[m[2].slice(0, 3)];
      let diff = (target - b.getDay() + 7) % 7 || 7;
      if (m[1] === 'next' && diff < 3) diff += 7;
      return plus(diff);
    }
  }
  return '';
}
