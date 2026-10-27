# Copy guide

> The copy voice for every app on Ume. Examples are from Squidx Ledger.

Squidx Ledger is used by **administrative staff**, not developers or accountants.
Copy should read like a calm colleague explaining something — short, plain, no jargon.

## Voice
- **Neutral and admin-friendly.** Not chatty, not corporate.
- **Plain words for non-accountants.** Say what a figure means, not its textbook name:
  "Cash on hand", "Profit this period", "Monthly fixed costs", "What you earned minus what
  you spend". A finance term that has to stay (margin, runway, recurring) gets a
  one-sentence definition beside it.
- Identity line is **"Private workspace"** everywhere (sign-in, footer). Never "founders".
- **Sentence case** for every label, heading, button and tab: "Add a transaction", "Profile &
  security", "Categories & targets". No all-caps except calendar weekday letters.

## Words we use
| Say | Not |
| --- | --- |
| **account** — a bank account, card or cash box that holds money | wallet |
| **Profile** — your own name, password, passkeys and devices | Account (for the user) |
| **entry** — one line of income, expense or transfer | transaction record, row |
| **transfer** — money moved between two accounts | income + expense pair |
| **Scheduled** — an entry dated after today; not in balances yet | pending, future |
| **This month**, **Last month**, **3 months**, **This year**, **All time** | MTD, YTD, 1m |
| **Print summary** | Share summary, export |

## Rules
1. **One line of helper text, max.** If a hint needs a second sentence, cut it.
2. **No implementation nouns** in anything a user sees. Banned words:
   `migration`, `Supabase`, `service role`, `schema` / `schema_version`, `RLS`,
   `GitHub Action`, `Op`, `actor`, `append-only`, `spoof`, `RPC`, `uuid`.
   Say the user-facing meaning instead:
   - "run migration 0008 in Supabase" → "this workspace still needs setup"
   - "Actor is set server-side and can't be spoofed" → "Recorded automatically — can't be edited"
   - column `Op` → `Action`; `Actor` → `Who`; `Schema` → `Version`
3. **Cut reassurance footnotes** that only describe internal mechanics. If it must stay,
   state the user benefit: "Backups run automatically overnight — nothing to set up."
   Settings save on their own, so don't toast "Saved" after every change.
4. **Verb-first buttons.** "Add a transaction", "Sign in", "Set targets in Settings".
5. **Empty states = one action.** Tell them the single next step, nothing more.
   "Add your first entry — your charts and totals fill in from here."
   When the period is empty but older entries exist, say so and offer "Show all time".
6. **Errors say what happened and what to do.** "You don't have permission to delete this
   entry", "A client with this name already exists" — never a silent no-op, never a raw
   error code.
7. **A disabled control says why, on screen** — not only in a hover `title`, which touch
   screens never show.

## Table headers
Prefer plain words a non-engineer scans instantly: `Who`, `Action`, `Version`,
`Started`, `Duration` — not internal column names.
