# Project Brain

A private workspace where every client project has one permanent chat, and the app turns that
conversation into structured, linked project knowledge: tasks, requirements, decisions, sensitive
info, files and an always-current project memory. Nothing is ever deleted.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

On first launch a demo workspace is created (Nova Café + Orbit Fitness). The last three Nova Café
messages are full of shorthand on purpose (`ty! new pwd for stg is xyz123. pls send the mobile build by fri, my mail is …`),
so you'll see suggestions appear straight away.

## Gemini

Settings → Gemini: paste a key from <https://aistudio.google.com/apikey>. The default model is
`gemini-3.5-flash-lite`; use **Load models** to pick the exact ID your key has access to, and
**Test connection** to check it. With a key, Gemini:

- reads every new message against the whole project record and proposes create / update / status / note operations
- understands shorthand (`pass, pwd, info, doc, txt, mail, stg, tmrw, eow, lgtm, nvm, w/, b4 …` — see `src/lib/shorthand.js`)
- writes the project memory (Memory → Refresh)
- powers the **Project assistant** (✨ Assistant in the project header, or the Memory tab): ask questions,
  give commands ("create tasks for all the risks", "split the About page into subtasks", "set due dates for open tasks"),
  or have it draft a client update, a reply or a call agenda. Changes come back as proposals you accept, edit or
  ignore — the assistant never changes the record on its own. Drafts can be copied or sent straight into the chat.

Without a key (or if the API call fails) the built-in rules in `src/lib/extract.js` do the same job locally.

## How the record works

Each project is one growing JSON object (`src/lib/model.js`):

| Part | What it holds |
| --- | --- |
| `messages` | raw conversation, append-only |
| `items` | tasks, requirements, decisions, sensitive info, questions, risks, files — each with `history`, `notes`, and (requirements) `versions` |
| `suggestions` | everything the brain proposed, kept as `pending` / `accepted` / `ignored` |
| `summaries` | every project memory ever generated |
| `asks` | questions asked to the brain and the answers |
| `log` | append-only event log of everything that happened |

There is no delete operation. Records are closed by status (`done`, `replaced`, `superseded`, …) and the
full trail stays in `history`. See it in **Timeline → Raw JSON**, or export it from the project menu.

## Privacy & security

- Data lives in this browser (IndexedDB). Export/import merges by ID and never overwrites history.
- Settings → Security encrypts the whole workspace with AES-256-GCM (PBKDF2 key from your passphrase).
- Sensitive values are masked everywhere (chat, cards, search, drawer) and revealed for 10 s on click.
- The client portal (invite link + PIN) shows only the chat and what you allow — never suggestions, the vault, notes or the log.

**Limit of this version:** there is no server, so invite links only work in the same browser profile
(open one in a new tab to try it). Adding a backend (e.g. Supabase/Firebase) for storage + auth is the
next step to make client access work from anywhere.

## Code map

```
src/
  store.jsx            state, IndexedDB persistence, encryption, multi-tab merge
  seed.js              demo workspace
  lib/model.js         the append-only record + suggestion validation + merge
  lib/extract.js       built-in rules (shorthand-aware)
  lib/gemini.js        Gemini prompts and API calls
  lib/brain.js         chooses Gemini vs rules; memory + ask
  lib/shorthand.js     shorthand dictionary
  components/          Home, ProjectShell, Chat, Suggestions, Items, ItemDrawer, Memory, Timeline, Search, Settings, Invite, Join
```
