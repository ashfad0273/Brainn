// Redaction before anything is sent to an AI provider (Cloudflare or Gemini).
// Passwords, keys, tokens and account/card numbers become [SECRET_n] placeholders.
// The model can still say "a new staging password was shared" and return [SECRET_1] as the value;
// restore() swaps the real value back in locally, so it never left the browser.

import { secretValues } from './model';
import { credentialValues, isCardNumber } from './extract';

const KEY_PATTERNS = [
  /\bAIza[0-9A-Za-z_-]{30,}/g,                                   // Google API keys
  /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{16,}/g, // Stripe / OpenAI / Anthropic-style keys
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,                               // GitHub tokens
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,                             // Slack tokens
  /\bAKIA[0-9A-Z]{16}\b/g,                                       // AWS access key ids
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g,                    // JWTs
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?=[A-Fa-f0-9]*\d)(?=[A-Fa-f0-9]*[A-Fa-f])[A-Fa-f0-9]{32,}\b/g, // long hex secrets
];
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g;
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
const ACCOUNT_RE = /\b(?:acc(?:oun)?t|a\/c|routing|sort code|swift|bic)\.?\s*(?:no\.?|number|num|#|code)?\s*[:=]?\s*([A-Z0-9][A-Z0-9 -]{4,}[A-Z0-9])/gi;

const PLACEHOLDER = /\[SECRET_\d+\]/g;
export const MASK = '••••••';

/** Values in one piece of text that must not leave the browser. */
export function findSecrets(text) {
  if (!text) return [];
  const found = new Set(credentialValues(text));
  for (const re of KEY_PATTERNS) for (const m of text.match(re) || []) found.add(m);
  for (const m of text.match(IBAN_RE) || []) found.add(m);
  for (const m of text.match(CARD_RE) || []) if (isCardNumber(m)) found.add(m.trim());
  for (const m of text.matchAll(ACCOUNT_RE)) if (/\d{4,}/.test(m[1].replace(/\D/g, ''))) found.add(m[1].trim());
  return [...found].filter(v => v.length >= 3);
}

/** One redactor per request, so the same value always maps to the same placeholder. */
export function createRedactor(p) {
  const known = p ? secretValues(p) : [];
  const toToken = new Map(), toValue = new Map();
  const tokenFor = v => {
    if (!toToken.has(v)) { const t = `[SECRET_${toToken.size + 1}]`; toToken.set(v, t); toValue.set(t, v); }
    return toToken.get(v);
  };

  const text = s => {
    if (typeof s !== 'string' || !s) return s;
    const values = new Set([...known.filter(v => s.includes(v)), ...findSecrets(s)]);
    let out = s;
    [...values].sort((a, b) => b.length - a.length).forEach(v => { out = out.split(v).join(tokenFor(v)); });
    return out;
  };
  const walk = (x, f) => (typeof x === 'string' ? f(x)
    : Array.isArray(x) ? x.map(y => walk(y, f))
      : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, walk(v, f)])) : x);

  return {
    text,
    /** Put the real values back (only for structured ops that are stored in the vault). */
    restore: x => walk(x, s => s.replace(PLACEHOLDER, t => toValue.get(t) ?? t)),
    /** Replace placeholders with a mask (for prose the owner reads: answers, drafts, summaries). */
    mask: x => walk(x, s => s.replace(PLACEHOLDER, MASK)),
    get count() { return toToken.size; },
  };
}
