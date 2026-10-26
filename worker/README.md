# Project Brain AI Worker

A small Cloudflare Worker that lets Project Brain use **Workers AI** instead of Gemini. The app sends
already-redacted text (passwords, keys and account numbers are replaced with `[SECRET_n]` before
leaving the browser); the Worker checks the request and calls the model. It stores and logs nothing.

Guards: a secret bearer token, an allow-list of browser origins, a request size cap and an
allow-list of models (see `wrangler.toml`).

## Deploy (run these yourself, from this `worker/` folder)

```bash
npx wrangler login
```

```bash
npx wrangler secret put APP_TOKEN
```

Paste a long random string when asked (for example from a password manager). You'll enter the same
token in the app.

```bash
npx wrangler deploy
```

Wrangler prints the Worker URL, e.g. `https://project-brain-ai.<your-subdomain>.workers.dev`.

## Connect the app

Settings → **AI** → choose **Cloudflare AI**, paste the Worker URL and the token, then **Test connection**.

## Change what's allowed

- Hosting the app somewhere other than `http://localhost:5173`? Add that origin to `ALLOWED_ORIGINS` in
  `wrangler.toml` and run `npx wrangler deploy` again.
- Models: `DEFAULT_MODEL` and `ALLOWED_MODELS`. The default, Llama 3.3 70B (fp8 fast), supports JSON mode.
- Logs while testing:

```bash
npx wrangler tail
```

## Cost

Workers AI has a daily free allocation; beyond it usage is billed per "neuron". Check the Workers AI
pricing page in your Cloudflare dashboard.

## What the token protects

The token sits in your browser's storage (encrypted if you turned on workspace encryption). It stops
other websites and strangers from using your Worker; it does not protect against someone who already
has access to your browser profile. Rotate it any time with `npx wrangler secret put APP_TOKEN`.
