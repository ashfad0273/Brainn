// Project Brain AI proxy — a Cloudflare Worker in front of Workers AI.
//
// POST /v1/generate  { prompt, system?, model?, schema?, temperature?, maxTokens? }
//   → { model, output, jsonMode }   (output is an object in JSON mode, otherwise text)
//
// Guards: secret bearer token, allow-listed browser origins, request size cap,
// allow-listed models. Nothing is stored or logged by this Worker.

const enc = new TextEncoder();
const list = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);

function reply(body, status, cors) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

/** Compare via SHA-256 digests so the check takes the same time whatever the input length. */
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  return crypto.subtle.timingSafeEqual(x, y);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const okOrigin = list(env.ALLOWED_ORIGINS).includes(origin);
    const cors = okOrigin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    } : {};

    if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (!okOrigin) return reply({ error: 'origin not allowed' }, 403, cors);
    if (req.method !== 'POST') return reply({ error: 'use POST' }, 405, cors);
    if (new URL(req.url).pathname !== '/v1/generate') return reply({ error: 'not found' }, 404, cors);

    if (!env.APP_TOKEN) return reply({ error: 'APP_TOKEN secret is not set on the Worker' }, 500, cors);
    if (!(await sameSecret(req.headers.get('Authorization') || '', `Bearer ${env.APP_TOKEN}`))) return reply({ error: 'unauthorized' }, 401, cors);

    const max = Number(env.MAX_BODY_BYTES) || 200000;
    if (Number(req.headers.get('Content-Length') || 0) > max) return reply({ error: `request larger than ${max} bytes` }, 413, cors);
    const raw = await req.text();
    if (enc.encode(raw).length > max) return reply({ error: `request larger than ${max} bytes` }, 413, cors);

    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'body must be JSON' }, 400, cors); }
    const { prompt, system, model, schema } = body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) return reply({ error: 'prompt is required' }, 400, cors);

    const allowed = list(env.ALLOWED_MODELS);
    const useModel = model && allowed.includes(model) ? model : env.DEFAULT_MODEL;
    const temperature = Math.min(1, Math.max(0, Number(body.temperature ?? 0.2)));
    const max_tokens = Math.min(4096, Math.max(64, Number(body.maxTokens) || 2048));
    const messages = [...(typeof system === 'string' && system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }];
    const base = { messages, temperature, max_tokens };

    try {
      if (schema && typeof schema === 'object') {
        try {
          const r = await env.AI.run(useModel, { ...base, response_format: { type: 'json_schema', json_schema: schema } });
          return reply({ model: useModel, output: r.response, jsonMode: true }, 200, cors);
        } catch {
          // JSON mode can fail on long or unusual prompts — fall back to plain text; the app parses and retries.
        }
      }
      const r = await env.AI.run(useModel, base);
      return reply({ model: useModel, output: r.response, jsonMode: false }, 200, cors);
    } catch (e) {
      return reply({ error: `Workers AI: ${e?.message || e}` }, 502, cors);
    }
  },
};
