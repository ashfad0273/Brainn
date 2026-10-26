// Built-in rules: used when no Gemini key is set, or as a fallback when the API fails.
// Values (passwords, emails, URLs, amounts) are read from the original text; intent
// (task / requirement / decision / change / done) from the shorthand-expanded text.

import { expand } from './shorthand';
import { parseDue } from './dates';
import { keywords, overlap, cap } from './util';
import { isActive } from './meta';
import { categorizeLink, linkTitle } from './files';

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const CRED_RE = /\b(pass(?:word|wd|code|phrase)?|pwd|pw|pswd|psw|pword|p\/w|pin|otp|token|api[\s_-]?key|secret(?:\s+key)?|access\s+key|login|username|user\s*name|usr|uname|u\/n|user\s*id)\b((?:\s+(?:for|of|to|on|at)\s+(?:the\s+)?[\w.-]+)?)\s*(?:\bis\b|=|:|->|→)\s*["'`]?([^\s"'`,;]+)/gi;
const PHONE_RE = /(?<![\w/.-])\+?\d[\d\s().-]{7,}\d(?![\w/-])/g;
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
const MONEY_RE = /(?:[$€£৳₹]\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|million|thousand)?\b|\b(?:usd|eur|gbp|bdt|tk|inr|rs\.?)\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m)?\b|\b\d[\d,]*(?:\.\d+)?\s?(?:k|m)?\s?(?:usd|eur|gbp|dollars|euros|pounds|bdt|taka|rupees)\b)/gi;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g;
const BAD_VALUE = /^(the|a|an|in|on|attached|below|above|same|here|there|this|that|sent|changed|updated|expired|wrong|correct|it|not|still|missing)$/i;

const CUE = {
  done: /\b(done|finished|completed?|sent (?:it|you|over|the)|fixed|deployed|shipped|uploaded|delivered|pushed|published|(?:is|are) (?:up|live|ready)|ready for review|wrapped up|took care of)\b/,
  cancel: /\b(never mind|cancel(?:led)?|scrap (?:it|that)|forget (?:about )?(?:it|that)|no longer need(?:ed)?|do not need|don'?t need|drop (?:it|that))\b/,
  change: /\b(actually|instead|rather than|change (?:it|that|the|to)|changed|switch(?:ed)? to|on second thought|again|no longer|revert|move(?:d)? (?:the )?(?:deadline|date))\b/,
  ask: /\b(?:can|could|would|will) you\b|\b(please|need you to|make sure|don'?t forget|do not forget|remember to)\b/,
  decision: /\b(let'?s go with|go with|we'?ll go with|going with|approved?|agreed?|decided|decision|finali[sz]ed?|confirmed?|looks good to me|sounds good|deal|signed off|go ahead|good to go)\b/,
  task: /\b(send|add|fix|update|check|review|create|build|design|prepare|remove|replace|upload|share|deliver|finish|call|schedule|set up|deadline|due|as soon as possible|by (?:today|tomorrow|end of|mon|tue|wed|thu|fri|sat|sun)\w*)\b/,
  self: /\b(i'?ll|i will|i'?m going to|let me|we'?ll|on it)\b/,
  req: /\b(should|must|needs? to (?:be|have)|has to|have to|want(?:s|ed)?|would like|prefer|keep|make it|required|requirement|always|never|no more than|at least|only|important that|needs)\b/,
  high: /\b(urgent|as soon as possible|critical|important|immediately|high priority|top priority)\b/,
  out: /\b(out of scope|not needed|not included|later phase|phase 2|not in (?:v1|the first version)|won'?t need|skip(?:ping)?)\b/,
  risk: /\b(risk|worried|concern(?:ed)?|problem|issue|blocker|blocked|delay(?:ed)?|running late|tight deadline|over budget)\b/,
};
const GENERIC = new Set(['look', 'good', 'great', 'fine', 'approved', 'approve', 'agreed', 'agree', 'sound', 'perfect', 'love', 'nice', 'confirmed', 'confirm', 'deal', 'awesome', 'amazing', 'cool', 'yes', 'ok']);

const FILLER = /^(?:(?:ok(?:ay)?|okk?|kk?|hey|hi|hello|so|and|but|also|plus|then|btw|by the way|fyi|ty|thx|thanks|thank you|actually|oh|hmm|well|one more thing|on second thought|nvm)\b[\s,!:.-]*)+/i;
const ASK = /^(?:(?:can|could|would|will)\s+(?:you|u|ya)\s+(?:please\s+|pls\s+|plz\s+|also\s+|just\s+)*|(?:please|pls|plz|kindly)\s+|i\s+(?:need|want)\s+(?:you|u)\s+to\s+|(?:make sure|don'?t forget|remember)\s+(?:to\s+)?|we\s+need\s+(?:to\s+)?)/i;
const PREFIX = /^(?:info(?:rmation)?(?:\s*(?:doc(?:ument)?s?|txt))?|doc(?:ument)?|txt|note|fyi|req(?:uirement)?|spec)\s*[:\-–]\s*/i;
const TRAIL = /[\s,]+(?:pls|plz|please|thx|thanks|ty|asap)\s*$/i;

export function cleanTitle(s, max = 90) {
  let t = (s || '').trim();
  for (let i = 0; i < 3; i++) t = t.replace(PREFIX, '').replace(FILLER, '').replace(ASK, '').replace(TRAIL, '');
  t = t.replace(/\s+/g, ' ').replace(/[\s.!?,;:]+$/, '').trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return cap(t);
}

const SPLIT = /\s*,\s*(?=(?:and|also|plus|pls|plz|please|can|could|would|my|our|new|then|but|btw|send|add|check|fix|make|remove|update|change)\b)|\s+and also\s+|\s*;\s*/i;
export const splitClauses = t => t.split(/(?<=[.!?])\s+|\n+/).flatMap(s => s.split(SPLIT)).map(s => s && s.trim()).filter(s => s && s.length > 1);

const luhn = d => { let s = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; };
const trimVal = v => v.replace(/[.,;:!?)\]]+$/, '');
function credLabel(k) {
  k = k.toLowerCase();
  if (k === 'pin') return 'PIN';
  if (k === 'otp') return 'one-time code';
  if (/token/.test(k)) return 'token';
  if (/api/.test(k)) return 'API key';
  if (/secret|access/.test(k)) return 'secret key';
  if (/login|user|usr|uname|u\/n/.test(k)) return 'username';
  return 'password';
}
const CRED_WORD = /^(pass(?:word|wd|code)?|pwd|pw|pswd|pin|otp|token|login|username|usr|uname|user)$/i;
const CONTEXT_SKIP = /^(new|the|my|our|your|a|an|updated|current|old|latest|and|or|is|hey|hi|hello|pls|please|here'?s|heres|btw|also|ty|thx|thanks|ok|so|i|we|use|its|it's)$/i;

/** Find credentials, contact details, money and IDs in one clause. */
function sensitives(c, ctx, from, active) {
  const out = [], used = new Set();
  const who = from === 'owner' ? ctx.ownerName : ctx.clientName;
  const poss = /\b(my|mine|me)\b/i.test(c) ? `${who}'s ` : /\bour\b/i.test(c) ? `${who}'s team ` : '';
  const add = (category, title, value, reason) => {
    used.add(value);
    const prev = active.find(i => i.type === 'sensitive' && i.category === category && i.title.toLowerCase() === title.toLowerCase() && i.value !== value);
    out.push({ op: 'create', type: 'sensitive', category, title, value, replaces: prev?.id || null, reason: prev ? `Replaces the earlier “${prev.title}”` : reason });
  };

  let lastCtx = '', prevEnd = -1;
  for (const x of c.matchAll(CRED_RE)) {
    const v = trimVal(x[3]);
    if (v.length < 2 || BAD_VALUE.test(v)) continue;
    let context = (x[2] || '').replace(/^\s*(?:for|of|to|on|at)\s+(?:the\s+)?/i, '').trim();
    if (!context) {
      // words since the previous credential: "cms login is x / pass: y" → none → both belong to the CMS;
      // "wifi pw: a, ftp user is b and pwd = c" → "ftp"
      const words = c.slice(Math.max(0, prevEnd), x.index).trim().split(/\s+/).map(w => w.replace(/[^\w.'-]/g, ''))
        .filter(w => /^[a-z][\w.-]*$/i.test(w) && !CONTEXT_SKIP.test(w) && !used.has(w) && !CRED_WORD.test(w));
      context = (prevEnd < 0 ? words.pop() : words[0]) || lastCtx;
    }
    prevEnd = x.index + x[0].length;
    context = expand(context).replace(/[^\w .-]/g, '').trim();
    lastCtx = context;
    const label = credLabel(x[1]);
    const ctxLabel = /^[a-z]{2,3}$/i.test(context) ? context.toUpperCase() : cap(context);
    add('credential', context ? `${ctxLabel} ${label}` : cap(label), v, 'Credential shared in chat');
  }
  for (const e of c.match(EMAIL_RE) || []) {
    const v = trimVal(e);
    if (used.has(v)) continue;
    add('contact', poss ? `${poss}email` : 'Email address', v, 'Email address shared');
  }
  for (const n of c.match(CARD_RE) || []) {
    const d = n.replace(/\D/g, '');
    if (d.length >= 13 && luhn(d)) add('financial', 'Card number', n.trim(), 'Card number shared');
  }
  for (const n of c.match(IBAN_RE) || []) add('financial', 'Bank account (IBAN)', n.trim(), 'Bank details shared');
  for (const n of c.match(PHONE_RE) || []) {
    const d = n.replace(/\D/g, '');
    if (d.length < 9 || d.length > 15 || [...used].some(u => u.replace(/\D/g, '') === d) || /^\d{4}-\d{2}-\d{2}$/.test(n.trim())) continue;
    add('contact', poss ? `${poss}phone number` : 'Phone number', n.trim(), 'Phone number shared');
  }
  const e = expand(c).toLowerCase();
  for (const mny of c.match(MONEY_RE) || []) {
    const v = mny.trim();
    if (used.has(v)) continue;
    const k = e.match(/\b(budget|price|pricing|cost|quote|invoice|fee|rate|payment|deposit|advance|retainer|salary|total)\b/);
    let title = k ? cap(k[1]) : 'Amount';
    if (k && /\b(cap|capped|max|maximum|limit|no more than|up to)\b/.test(e)) title += ' cap';
    add('financial', title, v, 'Money amount mentioned');
  }
  return out;
}

/** Every password / PIN / token / username value written as "pwd is x", "pass: y", "token = z". */
export function credentialValues(text) {
  const out = [];
  for (const x of (text || '').matchAll(CRED_RE)) {
    const v = trimVal(x[3]);
    if (v.length >= 2 && !BAD_VALUE.test(v)) out.push(v);
  }
  return out;
}
export const isCardNumber = s => { const d = s.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && luhn(d); };

function best(list, text, min = 0.5) {
  let top = null, score = 0;
  for (const it of list) {
    const o = overlap(text, it.title + ' ' + (it.detail || ''));
    const need = Math.min(2, keywords(it.title).length);
    if (o.inter >= need && o.score >= min && o.score > score) { top = it; score = o.score; }
  }
  return top;
}

/** Run the rules over one message → raw operations (same shape Gemini returns). */
export function extractLocal(p, m, ctx) {
  const text = (m.text || '').trim();
  if (!text) return [];
  const ops = [];
  const push = o => ops.push({ msg: m.id, ...o });
  const active = p.items.filter(isActive);
  const tasks = active.filter(i => i.type === 'task');
  const reqs = active.filter(i => i.type === 'requirement');
  const fromOwner = m.from === 'owner';
  const other = fromOwner ? 'client' : 'owner';

  for (const url of text.match(URL_RE) || []) {
    const u = trimVal(url);
    push({ op: 'create', type: 'file', title: linkTitle(u), value: u, category: categorizeLink(u), reason: 'Link shared in chat' });
  }

  for (const c of splitClauses(text)) {
    const sens = sensitives(c, ctx, m.from, active);
    sens.forEach(push);
    if (sens.length) continue;

    const e = expand(c.replace(URL_RE, ' ').replace(EMAIL_RE, ' ')).toLowerCase().replace(/\s+/g, ' ').trim();
    const kws = keywords(e);
    if (kws.length < 2 && !CUE.decision.test(e)) continue;
    const priority = CUE.high.test(e) ? 'high' : 'normal';

    if (CUE.done.test(e)) {
      const t = best(tasks, e);
      if (t) { push({ op: 'status', type: 'task', targetId: t.id, status: 'done', title: t.title, reason: `“${c}”` }); continue; }
      if (fromOwner) continue;
    }
    if (CUE.cancel.test(e)) {
      const t = best([...tasks, ...reqs], e);
      if (t) { push({ op: 'status', type: t.type, targetId: t.id, status: t.type === 'task' ? 'cancelled' : 'dropped', title: t.title, reason: `“${c}”` }); continue; }
    }
    if (CUE.change.test(e)) {
      const r = best(reqs, e, 0.34);
      if (r) {
        const title = cleanTitle(c.split(/,\s*/)[0]);
        push({ op: 'update', type: 'requirement', targetId: r.id, title, detail: c.trim(), reason: `Changed in conversation — was “${r.title}”` });
        tasks.filter(t => overlap(e, t.title).inter >= Math.min(2, keywords(t.title).length) && overlap(e, t.title).score >= 0.34)
          .forEach(t => push({ op: 'note', type: 'task', targetId: t.id, title: `Requirement changed: ${title}`, reason: 'Related requirement changed — check this task' }));
        continue;
      }
    }
    const isTask = CUE.ask.test(e) || CUE.task.test(e) || CUE.self.test(e);
    if (CUE.decision.test(e) && !CUE.ask.test(e)) {
      let title = cleanTitle(c);
      if (kws.filter(w => !GENERIC.has(w)).length < 2) {
        const prev = [...p.messages].reverse().find(x => x.ts < m.ts && x.from !== m.from && x.text?.trim());
        title = prev ? `Approved: ${cleanTitle(prev.text, 70)}` : title;
      }
      push({ op: 'create', type: 'decision', title, detail: c.trim(), reason: 'Agreement in conversation' });
      continue;
    }
    if (isTask) {
      const self = CUE.self.test(e) && !/\b(can|could|would|will) you\b/.test(e);
      push({ op: 'create', type: 'task', title: cleanTitle(c), due: parseDue(e), priority, assignee: self ? m.from : other, reason: 'Request in conversation' });
      continue;
    }
    if (CUE.req.test(e) || PREFIX.test(c)) {
      push({ op: 'create', type: 'requirement', title: cleanTitle(c), scope: CUE.out.test(e) ? 'out' : 'in', reason: 'Preference or constraint stated' });
      continue;
    }
    if (/\?\s*$/.test(c)) { push({ op: 'create', type: 'question', title: cleanTitle(c, 120) + '?', reason: 'Question asked in chat' }); continue; }
    if (CUE.risk.test(e)) push({ op: 'create', type: 'risk', title: cleanTitle(c), priority, reason: 'Possible risk mentioned' });
  }
  return ops;
}
