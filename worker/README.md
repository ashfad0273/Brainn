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

Create the sync tables (safe to re-run; it only adds what's missing):

```bash
npx wrangler d1 execute project-brain-db --remote --file=schema.sql
```

```bash
npx wrangler deploy
```

Gemini: set the key in the app (Settings → AI). It's stored encrypted on the server, never shown again (only the
last 4 characters) and can be replaced or removed any time. Everyone you invite uses it through the server without
seeing it, with `AI_DAILY_LIMIT` requests a day each (wrangler.toml); you have no limit. A `GEMINI_API_KEY` Worker
secret still works as a fallback.

Invitations: Cloudflare emails the invitation link (Cloudflare Email Service) once it's set up. That needs:

1. A domain added to Cloudflare, onboarded for sending: `npx wrangler email sending enable yourdomain.com`
2. The Workers Paid plan (on Free, Cloudflare only emails addresses you've verified yourself)
3. In `wrangler.toml`: uncomment the `[[send_email]]` binding named `EMAIL` and set `EMAIL_FROM`, then deploy

Until then the app shows each invitation link for you to copy and send; the invite flow is the same either way.

The app finds the Worker through `VITE_WORKER_URL` (see `.env.example`), set in `.env.local` or in the Pages
build settings before `npm run build`.

## Accounts

The first time the app opens against this Worker it asks for the **setup code** — your `APP_TOKEN` — and creates
the owner account (email + password). After that, everyone signs in with email + password. You invite people from
Settings → People (or a project's Members) with a label (client, designer, developer, …); they get a link, set a
password, and see only the projects you add them to, limited to what you switch on in each one — including
whether they may review AI suggestions. Old PIN links no longer work; re-invite those people by email from the
project's Members (their past messages stay attributed to them).

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
