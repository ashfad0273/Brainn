# Project Brain — Comprehensive Technical Knowledge Base

> **Single Source of Truth for Architecture, Implementation, Data Flow, and System Design**  
> *Project Brain* is a local-first, zero-knowledge, append-only client project memory and workspace. It ingests conversational client communication (chat messages, shorthand notes, audio voice notes, and file attachments) and autonomously transforms that stream into structured, versioned, relational project records: tasks, requirements, decisions, credentials/sensitive vault entries, files, and living project summaries.

---

## Table of Contents

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [High-Level Architecture & Tech Stack](#2-high-level-architecture--tech-stack)
3. [Append-Only Data Model & Conflict-Free Replication (CRDT-like)](#3-append-only-data-model--conflict-free-replication-crdt-like)
4. [Security, Cryptography & Privacy Subsystem](#4-security-cryptography--privacy-subsystem)
5. [Intelligence & Analysis Engine (AI & Rule Heuristics)](#5-intelligence--analysis-engine-ai--rule-heuristics)
6. [In-Browser Document & OCR Processing Pipeline](#6-in-browser-document--ocr-processing-pipeline)
7. [Cloudflare Worker AI Proxy (`worker/`)](#7-cloudflare-worker-ai-proxy-worker)
8. [Multi-Member Collaboration & Client Portal](#8-multi-member-collaboration--client-portal)
9. [State Management, Storage & Multi-Tab Synchronization](#9-state-management-storage--multi-tab-synchronization)
10. [Frontend Component Hierarchy & View Layout](#10-frontend-component-hierarchy--view-layout)
11. [Complete File-by-File Code Map](#11-complete-file-by-file-code-map)
12. [Developer Operations, Build & Deployment Guide](#12-developer-operations-build--deployment-guide)

---

## 1. Executive Summary & Core Philosophy

### 1.1 The Core Problem
Freelancers and agencies frequently manage client communications across unstructured channels (Slack, WhatsApp, email, voice memos). Critical specifications, credentials, deadlines, and approvals get lost across chat history. Traditional project management software (Jira, Linear, Asana) requires manual triage and constant administrative upkeep.

### 1.2 The Project Brain Solution
Project Brain provides a private client engagement hub centered around a **permanent, single chat stream**. An autonomous background intelligence layer monitors messages, analyzes client intent, interprets messy colloquial shorthand, and extracts structured data objects. 

### 1.3 Guiding Architectural Principles
1. **Local-First & Zero-Knowledge**: All data resides in the user's browser (IndexedDB). Secrets are never sent to external AI providers in plaintext; they are sanitized and substituted with placeholder tokens via client-side redaction before leaving the browser. Optional AES-256-GCM encryption secures the entire local database.
2. **Append-Only / Never-Deleted**: Records are never destroyed. Closing a task, requirement, or decision transitions it through immutable status states (`done`, `dropped`, `superseded`). Even records created by mistake receive a tombstone (`deleted: true`) while preserving full history in the raw JSON event log.
3. **Human-in-the-Loop Governance**: The AI (whether Gemini, Cloudflare AI, or local regex heuristics) **never directly mutates records**. It proposes actions as `suggestions`. The workspace owner explicitly accepts, edits, or ignores them.
4. **Deterministic Bidirectional Linking**: Every structured item links back to its exact origin in the conversation (down to the message ID and character-level text span `sourceSpan`). Clicking an item jumps directly to and highlights the original chat quote.
5. **Zero Infrastructure Requirement**: Works out-of-the-box in modern browsers with pure client-side libraries (PDF parsing, Word extraction, Tesseract OCR, regex shorthand expanders).

---

## 2. High-Level Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER WORKSPACE                               │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         React 18 SPA (Vite)                         │   │
│   │   Home / Shell / Chat / Items / Drawer / Memory / Search / Invite   │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      Store Provider (`store.jsx`)                   │   │
│   │  - Reactive State & Mutators     - BroadcastChannel ('project-brain')│  │
│   │  - Auto-Save Debounce (250ms)    - Leader Election (Analyzer lock)  │   │
│   └───────────────┬──────────────────────────────────┬──────────────────┘   │
│                   │                                  │                      │
│        Encrypted  │ Storage               Binary     │ Blobs                │
│                   ▼                                  ▼                      │
│   ┌──────────────────────────────┐   ┌──────────────────────────────────┐   │
│   │   IndexedDB (`kv` store)     │   │   IndexedDB (`blob:*` records)   │   │
│   │   PBKDF2 + AES-GCM (JSON)    │   │   Raw / AES-GCM Encrypted Files  │   │
│   └──────────────────────────────┘   └──────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    In-Browser Document Engine                       │   │
│   │   pdfjs-dist (PDFs) · mammoth (Word) · tesseract.js (WASM OCR)      │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │ Extracted & Redacted text            │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                    HTTPS Requests     ▼ (Client-Side Redacted)
         ┌─────────────────────────────┴─────────────────────────────┐
         │                                                           │
         ▼                                                           ▼
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│      Google Gemini API           │        │   Cloudflare Workers AI Proxy    │
│  (Direct from browser via key)   │        │     (`worker/src/index.js`)      │
│  gemini-3.5-flash-lite / models  │        │   Llama 3.3 70B / Llama 3.1 8B   │
└──────────────────────────────────┘        └──────────────────────────────────┘
```

### 2.1 Technology Stack Details
- **Frontend Core**: React 18 (`react`, `react-dom`), Vite 5, Tailwind CSS 3, PostCSS, Autoprefixer.
- **Icons**: `lucide-react`.
- **Database/Storage**: Native `IndexedDB` wrapped via custom asynchronous promises (`src/lib/kv.js`).
- **Binary Blob Handling**: IndexedDB object URLs with memory lifecycle management (`src/lib/blobs.js`).
- **Cryptographic Primitives**: Web Cryptography API (`crypto.subtle`) — PBKDF2 (310,000 iterations), AES-256-GCM.
- **Document & Media Parsers**:
  - `pdfjs-dist` (v4.10): In-browser PDF parsing, text layout coordinate analysis, canvas rendering for scanned pages.
  - `mammoth` (v1.8): DOCX to HTML conversion and image extraction.
  - `tesseract.js` (v5.1): WebAssembly/Worker-based client-side OCR for images and scanned documents.
- **Audio/Voice Processing**: Browser `MediaRecorder` API + HTML5 Audio + Web Speech API (`webkitSpeechRecognition`).
- **AI Worker Proxy**: Cloudflare Workers environment (`wrangler`), Workers AI binding (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).

---

## 3. Append-Only Data Model & Conflict-Free Replication (CRDT-like)

The entire application state is represented as a single, normalized hierarchical JSON structure (`src/lib/model.js`).

### 3.1 Workspace State Hierarchy
```typescript
interface State {
  version: number;
  settings: Settings;
  spaces: Space[];
  projects: Project[];
}

interface Settings {
  ownerName: string;
  workspaceName: string;
  provider: 'rules' | 'cloudflare' | 'gemini' | '';
  apiKey: string;           // Gemini API Key
  model: string;            // Default: 'gemini-3.5-flash-lite'
  useGemini: boolean;       // Legacy backward compatibility flag
  workerUrl: string;        // Cloudflare Worker URL
  workerToken: string;      // Cloudflare Worker Bearer Auth Token
  cfModel: string;          // Selected Cloudflare model
  autoAnalyze: boolean;     // Automatically read incoming messages
  settingsAt: number;       // Timestamp of settings update
}

interface Space {
  id: string;               // Prefix 'sp_'
  name: string;
  createdAt: number;
  updatedAt: number;
}
```

### 3.2 Project Record Schema
Every project maintains independent chronological streams:

```typescript
interface Project {
  id: string;               // Prefix 'p' + random alphanumeric + timestamp base36
  name: string;
  client: string;           // Display client name
  description: string;
  color: string;            // Hex color code (e.g. '#0ea5e9')
  spaceId: string | null;   // Foreign key to Space
  cover: ImageRef | null;   // Stored image blob reference
  avatar: ImageRef | null;
  archived: boolean;
  createdAt: number;
  metaAt: number;           // Monotonic timestamp of metadata modification
  members: Member[];        // Collaborators and client portal invites
  messages: Message[];      // Immutable chat messages
  items: Item[];            // Structured entities (tasks, requirements, etc.)
  suggestions: Suggestion[];// Proposals generated by AI/rules
  summaries: Summary[];     // Living memory generation checkpoints
  asks: AskEntry[];         // Q&A history with the project assistant
  log: EventLogEntry[];     // Append-only audit trail
}
```

#### Message Object
```typescript
interface Message {
  id: string;               // Prefix 'm'
  from: 'owner' | 'client';
  memberId?: string;        // ID of invited collaborator if not owner
  text: string;
  ts: number;
  attachments: AttachmentRef[];
  voice?: { duration: number };
  analyzed: boolean;        // Whether the brain has evaluated this message
}
```

#### Item Object (Tasks, Requirements, Decisions, etc.)
```typescript
interface Item {
  id: string;               // e.g., 'ta_xyz', 're_xyz', 'de_xyz', 'se_xyz', 'fi_xyz'
  type: 'task' | 'requirement' | 'decision' | 'sensitive' | 'question' | 'risk' | 'file';
  title: string;
  detail: string;
  value: string;            // For 'sensitive' (secret) or 'file' (link URL)
  category: string;         // e.g., 'credential' | 'financial' | 'Brand assets'
  status: string;           // Validated per TYPES[type].statuses
  priority: 'low' | 'normal' | 'high';
  due: string;              // ISO format: 'YYYY-MM-DD'
  assignee: string;         // 'owner', 'client', or memberId
  scope: 'in' | 'out';      // For requirements
  kind: string;             // For files: 'link' | 'upload' | 'voice'
  file: { name: string; size: number; mime: string; attachmentId: string } | null;
  sourceMsg: string | null; // Originating Message ID
  sourceSpan?: { start: number; end: number }; // Character offsets in Message text
  sourceQuote?: string;     // Exact quote from parsed file
  sourceAttachment?: string;// Originating Attachment ID
  createdAt: number;
  createdBy: string;        // Actor ID
  updatedAt: number;
  via: 'manual' | 'upload' | 'gemini' | 'cloudflare' | 'rules' | 'assistant';
  replaces: string | null;  // Previous item ID if this replaces an older item
  supersededBy: string | null;
  deleted?: boolean;        // Tombstone flag
  deletedAt?: number;
  deletedBy?: string;
  history: ItemHistory[];   // Full audit log of every field/status edit
  notes: ItemNote[];        // Collaborative remarks
  versions: RequirementVersion[]; // Historical requirement diffs
  reading?: FileReading;    // AI extraction summary for attachments
}
```

### 3.3 The 7 Core Record Types & State Machines

| Type | Prefix | Default Initial | Active Statuses | Closed / Terminal Statuses | Replaced Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **task** | `ta_` | `open` | `open`, `in_progress`, `blocked` | `done`, `cancelled` | `cancelled` |
| **requirement** | `re_` | `active` | `active` (scope: `in`/`out`) | `delivered`, `dropped` | `dropped` |
| **decision** | `de_` | `active` | `active` | `reversed`, `superseded` | `superseded` |
| **sensitive** | `se_` | `active` | `active` | `replaced`, `revoked` | `replaced` |
| **question** | `qu_` | `open` | `open` | `answered`, `dropped` | `dropped` |
| **risk** | `ri_` | `open` | `open` | `mitigated`, `closed` | `closed` |
| **file** | `fi_` | `active` | `active` | `outdated` | `outdated` |

### 3.4 Tombstones vs. Status Changes
- **Status Change**: Expected lifecycle progression. Setting a task to `done` or requirement to `dropped` maintains visibility in filtered tabs, memory summaries, and item drawers.
- **Tombstones (`deleted: true`)**: Used exclusively when an item was created by mistake (e.g., misinterpretation or duplicate). It is masked from UI views (`liveItems(p)`), excluded from AI context windows, but retained in raw JSON exports and the log.

### 3.5 Deduplication and Normalization Logic
To prevent identical items from being proposed multiple times across repeated re-scans or tabs:
1. **Value Normalization (`valueKey`)**:
   - URLs: Scheme-agnostic, trailing slash removed, lowercase (`u:example.com/path`).
   - Emails: Case-folded (`e:john@acme.com`).
   - Phones: Non-digit stripped (`n:14155552671`).
   - Currency/Amounts: Symbols and spaces stripped (`m:2500usd`).
   - Secrets: Exact match (`v:SecretPass123`).
2. **Text Overlap Matching (`overlap`)**:
   - Computes keyword intersection score against existing items using stopword filtering and depluralization.
   - Rejects proposals if `overlap.score >= 0.7` with identical message origins or `>= 0.9` across messages.
3. **Deterministic Suggestion Hashing (`hashId`)**:
   - Suggestion IDs are generated via double-round 32-bit FNV-1a hash of their normalized payload: `s_` + `hashId(keyOf(s) + askId + msg + attachment)`.
   - Two parallel runs or tabs evaluating the same message generate identical IDs and automatically de-duplicate.

### 3.6 Multi-Tab CRDT Union Merge Algorithm
When changes occur across different browser tabs or incoming file imports, `mergeState` and `mergeProject` reconcile changes without data loss:
- **Project Meta**: Newest `metaAt` timestamp wins.
- **Members**: Unioned by ID, newer `updatedAt` wins.
- **Messages**: Unioned by ID; if one tab completed AI analysis (`analyzed: true`), the analyzed copy wins.
- **Items**: Unioned by ID via `tombstoneFirst`:
  $$\text{Winner} = \begin{cases} x & \text{if } x.deleted \land \neg y.deleted \\ y & \text{if } y.deleted \land \neg x.deleted \\ \text{newer}(x, y) & \text{otherwise} \end{cases}$$
  *(A deletion tombstone always beats an active record, preventing resurrected items across desynchronized tabs).*
- **Suggestions**: Unioned by ID via `decided`:
  An accepted/ignored decision beats a `pending` state; otherwise the newer timestamp wins.
- **Summaries, Asks, Log**: Append-only streams unioned by ID, sorted chronologically by timestamp (`ts`).

---

## 4. Security, Cryptography & Privacy Subsystem

Project Brain enforces privacy at three distinct boundaries: at-rest local storage, AI network egress, and UI presentation.

```
                              [ User Input / Chat Stream ]
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          Client-Side Privacy Engine          │
                     │             (`src/lib/redact.js`)            │
                     └──────────────────────┬───────────────────────┘
                                            │
                   ┌────────────────────────┴────────────────────────┐
                   │                                                 │
          Local Storage Path                                 AI Transmission Path
                   │                                                 │
                   ▼                                                 ▼
     ┌────────────────────────────┐                    ┌────────────────────────────┐
     │  PBKDF2-SHA256 (310k iter) │                    │ Extract & map secrets:     │
     │  AES-256-GCM Encryption    │                    │ "pwd123" → "[SECRET_1]"    │
     │  Key derived from password │                    │ Transmit ONLY placeholders │
     └─────────────┬──────────────┘                    └─────────────┬──────────────┘
                   │                                                 │
                   ▼                                                 ▼
     ┌────────────────────────────┐                    ┌────────────────────────────┐
     │  Stored in IndexedDB       │                    │ AI returns ops with tokens │
     │  (Encrypted Blobs + Meta)  │                    │ Restore tokens locally     │
     └────────────────────────────┘                    └────────────────────────────┘
```

### 4.1 Client-Side Data Redaction (`src/lib/redact.js`)
Before any prompt, conversation history, or document excerpt is transmitted to Google Gemini or Cloudflare Workers AI, it passes through `createRedactor(p)`:
- **Secret Detection Patterns**:
  - Google API Keys: `AIza[0-9A-Za-z_-]{30,}`
  - Generic Secrets/Stripe/OpenAI: `(?:sk|pk|rk)[-_]...`
  - GitHub Personal Access Tokens: `gh[pousr]_[A-Za-z0-9]{30,}`
  - Slack Tokens: `xox[abprs]-[A-Za-z0-9-]{10,}`
  - AWS Access Keys: `AKIA[0-9A-Z]{16}`
  - JWTs: `eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+`
  - Private Keys: `-----BEGIN [A-Z ]*PRIVATE KEY-----`
  - High-Entropy Hex Secrets: 32+ hex chars
  - Credit Cards: 13–19 digit strings validated against the **Luhn Algorithm** (`luhn`).
  - International Bank Accounts: IBAN regex patterns.
  - Bank Accounts: Routing numbers, sort codes, SWIFT, BIC patterns.
  - Chat Credential Patterns: Contextual statements (`pwd is ...`, `pass: ...`, `api key = ...`).
  - Existing Project Vault Values: Any secret value previously recorded or suggested.
- **Token Mapping**:
  Each unique secret is mapped to an ephemeral identifier: `[SECRET_1]`, `[SECRET_2]`.
- **Egress & Ingress Exchange**:
  1. Outbound prompt replaces all detected secrets with `[SECRET_n]`.
  2. The AI reasons over tokens: *"User shared staging password [SECRET_1]"*.
  3. AI returns operations specifying: `{ title: "Staging password", value: "[SECRET_1]" }`.
  4. Local client calls `R.restore()` to substitute the real secret back into `value` for vault insertion.
  5. The AI assistant's text explanations and draft emails are sanitized via `R.mask()` to replace tokens with `••••••`.

### 4.2 At-Rest Workspace Encryption (`src/lib/crypto.js`)
Users can optionally protect their entire workspace with a master passphrase:
- **Key Derivation**: PBKDF2 using SHA-256 with **310,000 iterations** (exceeding OWASP minimums). A cryptographically secure random 16-byte salt is generated via `crypto.getRandomValues`.
- **Cipher**: AES-256-GCM. Each encryption operation uses a fresh random 12-byte initialization vector (IV).
- **Blob File Encryption**: Attachment byte streams are encrypted independently via `encryptBytes` before persisting to IndexedDB (`src/lib/blobs.js`). When passphrase encryption is toggled or changed, `reencryptAll()` iterates through all `blob:*` keys, decrypts using the old key, and re-encrypts using the new key.
- **Lockout Mechanism**: When locked, the derived `CryptoKey` is cleared from memory references (`keyRef.current = null`, `setBlobKey(null)`), and the UI drops into `<Unlock />`.

### 4.3 UI Secret Masking
Sensitive entries in the chat timeline, search modal, timeline log, and item cards are masked (`••••••`). Clicking a masked element reveals the raw secret for exactly **10 seconds** via a local timer before auto-hiding.

---

## 5. Intelligence & Analysis Engine (AI & Rule Heuristics)

Project Brain features a tri-engine intelligence architecture coordinated by `src/lib/brain.js`:

```
                                [ Incoming Message / Event ]
                                             │
                                             ▼
                             ┌───────────────────────────────┐
                             │       `brain.js` Router       │
                             └───────────────┬───────────────┘
                                             │
                      ┌──────────────────────┼──────────────────────┐
                      │                      │                      │
             Engine = 'gemini'      Engine = 'cloudflare'    Engine = 'rules' / Fallback
                      ▼                      ▼                      ▼
             ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
             │ `gemini.js`     │    │ `gemini.js`     │    │ `extract.js`    │
             │ Google API      │    │ Cloudflare AI   │    │ Local Heuristic │
             │ JSON Schema     │    │ JSON Schema     │    │ Regex & Rules   │
             └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                      │                      │                      │
                      └──────────────────────┼──────────────────────┘
                                             │
                                             ▼
                             ┌───────────────────────────────┐
                             │ `prepareSuggestions()`        │
                             │ - Validation & Schema Filter  │
                             │ - Deduplication vs Known Index│
                             │ - Deterministic Hash ID       │
                             └───────────────┬───────────────┘
                                             │
                                             ▼
                             ┌───────────────────────────────┐
                             │  Pending Suggestion Queue     │
                             │  (Owner Review & Decision)    │
                             └───────────────────────────────┘
```

### 5.1 Chat Shorthand Dictionary (`src/lib/shorthand.js`)
Clients frequently communicate using abbreviations. The dictionary handles over 80 standard shorthand tokens across 6 categories:
- **Credentials**: `pwd`, `pass`, `usr`, `uname`, `creds`, `acc`, `otp`, `2fa`, `apikey`
- **Documents & Info**: `deets`, `specs`, `reqs`, `ss` (screenshot), `inv` (invoice), `est` (estimate)
- **Contact**: `eml`, `phn`, `mob`, `wa`, `mtg`
- **Tech / Environments**: `stg` (staging), `prod`, `dev`, `fe`, `be`, `ui`, `ux`, `mvp`
- **Reactions / Status**: `pls`, `thx`, `ty`, `k`, `lgtm`, `gtg`, `nvm`, `asap`
- **Temporal**: `tmrw`, `tdy`, `yday`, `eod`, `eow`, `eom`
- **Grammar**: `w/`, `w/o`, `b4`, `bc`, `u`, `ur`, `abt`

Usage:
1. `expand(text)`: Used by local rules to normalize text prior to regex matching.
2. `GLOSSARY`: Injected directly into Gemini and Cloudflare prompts to condition LLMs on colloquial freelancer-client shorthand.

### 5.2 Natural Language Date Parsing (`src/lib/dates.js`)
The `parseDue(text, baseDate)` function converts natural language temporal references into strict ISO `YYYY-MM-DD`:
- Relative days: `today`, `tdy`, `tonight`, `eod` $\rightarrow +0\text{ days}$
- `tomorrow`, `tmrw`, `2moro` $\rightarrow +1\text{ day}$
- `day after tomorrow` $\rightarrow +2\text{ days}$
- Offsets: `in 3 days`, `in two weeks`
- End of period: `eow` (upcoming Friday), `next week` (upcoming Monday), `eom` (last calendar day of month)
- Days of week: `by fri`, `until next tuesday`
- Absolute formats: `25 oct`, `October 12th`, `10/28/2026` (respects US vs international locale). Automatically increments year if the parsed date is in the past.

### 5.3 Local Rule-Based Heuristic Extractor (`src/lib/extract.js`)
Operates 100% offline without API keys:
1. Splits raw message text into semantic clauses via punctuation and coordinating conjunctions (`and`, `also`, `pls`, `then`, `but`).
2. Scans for URLs $\rightarrow$ Proposes `file` link items.
3. Scans for credentials and sensitive information via regex patterns (`sensitives()`). Automatically attributes ownership (*"my email"* $\rightarrow$ *Client's email*).
4. Matches conversational intent cues:
   - **Done Cue**: `done`, `finished`, `deployed`, `shipped` $\rightarrow$ Finds matching open task using keyword overlap $\rightarrow$ Proposes `status: done`.
   - **Cancel Cue**: `never mind`, `scrap that`, `no longer need` $\rightarrow$ Proposes `cancelled` or `dropped`.
   - **Change Cue**: `actually`, `instead`, `switch to` $\rightarrow$ Matches active requirement $\rightarrow$ Proposes `update` + notes related tasks.
   - **Decision Cue**: `let's go with`, `approved`, `lgtm`, `deal` $\rightarrow$ Proposes `decision`. If statement is purely evaluative (*"looks good"*), automatically pulls context from the preceding message.
   - **Task Cue**: `can you`, `please send`, `fix`, `build` $\rightarrow$ Proposes `task` with extracted due date and assignee.
   - **Requirement Cue**: `should`, `must`, `needs to have`, `make it` $\rightarrow$ Proposes `requirement` (detects out-of-scope markers: `out of scope`, `phase 2`, `v2`).
   - **Question / Risk Cues**: Trailing question marks or risk terminology (`worried`, `blocker`, `delay`).

### 5.4 LLM Integration (`src/lib/gemini.js`)
Configured to use structured JSON output mode:
- **Gemini**: Calls `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `responseMimeType: "application/json"`.
- **Cloudflare AI**: Calls `/v1/generate` on the worker with JSON Schema validation (`response_format: { type: 'json_schema' }`).
- **Resilience**: A double-parse wrapper (`generate()`) intercepts markdown code fences (````json ... ````), strips prose, extracts JSON boundaries, and retries once if invalid JSON is received.
- **Budgeting**: Adjusts context window size depending on provider token limits (Cloudflare Llama models receive a tighter token budget than Gemini Flash).

### 5.5 Living Project Memory (`summarize` / `localSummary`)
Generates comprehensive point-in-time project summaries across 7 categories:
1. `headline`: One-sentence executive status.
2. `overview`: 3–6 sentences summarizing scope, progress, recent changes, and priorities.
3. `keyFacts`: Non-negotiable preferences, constraints, budgets, and architecture choices.
4. `done`: Recently completed items.
5. `inProgress`: Active tasks.
6. `next`: Upcoming items sorted by due date.
7. `openQuestions`: Unanswered questions.
8. `risks`: Overdue deadlines, blockers, and stated concerns.
9. `recentChanges`: Modifications that occurred over the last 7 days.

Every memory point includes array of `refs` referencing specific item IDs and message IDs.

### 5.6 Project Assistant (`src/lib/assistant.js`)
An interactive agent embedded in the project header and Memory tab:
- **Capabilities**:
  1. Answering arbitrary questions about the project history.
  2. Proposing bulk record changes (e.g., *"Break down the About page into tasks"*, *"Create tasks for all open risks"*).
  3. Drafting client communications (progress reports, call agendas, replies to the last client message).
- **Proposals Governance**: Assistant changes are returned as `ops` in the response payload and queued into `p.suggestions` for owner approval. The assistant is strictly prohibited from mutating the state directly.
- **Direct Chat Dispatch**: Drafted messages feature a "Send in chat" action, allowing the owner to review, edit, and post the draft directly into the conversation.

---

## 6. In-Browser Document & OCR Processing Pipeline

Project Brain includes an entirely client-side document processing engine (`src/lib/docread.js` and `src/lib/files.js`).

```
[ Uploaded File Blob (PDF / DOCX / Image / Text) ]
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 `readFile()` Router (`docread.js`)          │
└───────┬─────────────────────┬─────────────────────┬─────────┘
        │                     │                     │
   Kind = 'pdf'          Kind = 'docx'         Kind = 'image'
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ pdfjs-dist    │     │ mammoth       │     │ tesseract.js  │
│ - Text lines  │     │ - HTML parse  │     │ - WASM worker │
│ - Line gaps   │     │ - Image dump  │     │ - OCR text    │
│ - Table cols  │     │ - OCR images  │     │ - Confidence  │
│ - Scanned OCR │     └───────┬───────┘     └───────┬───────┘
└───────┬───────┘             │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────────┐
        │ Universal Structured Document JSON:       │
        │ - Headings (level 1-3)                    │
        │ - Paragraphs (with bold/underline tags)   │
        │ - Lists (ordered / unordered)             │
        │ - Tables (rows and cells)                 │
        │ - Images (OCR text + canvas vision thumb) │
        └─────────────────────┬─────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────────┐
        │ `readAttachment()` in `brain.js`:         │
        │ Redact JSON → Send to Gemini / Cloudflare │
        │ → Ingest returned operations to Inbox     │
        └───────────────────────────────────────────┘
```

### 6.1 PDF Document Parsing
- Utilizes `pdfjs-dist` with Web Worker offloading (`pdf.worker.min.mjs`).
- Extracts text coordinates (`transform[4], transform[5]`) and font metrics.
- Computes the document's body font size across all pages. Lines larger than $1.25\times$ body size are converted into `heading` blocks.
- **Table Detection**: Analyzes horizontal offsets (`x`) across segments on identical vertical baselines (`y`). Wide gaps segment text into tabular column cells (`table` blocks).
- **Scanned Page Fallback**: Pages with fewer than 25 text characters are identified as scanned documents or flat graphics. The page canvas is rendered at $2\times$ resolution and passed to `tesseract.js` for optical character recognition.

### 6.2 Word Document Parsing (.docx)
- Loads `mammoth.browser.min.js`.
- Converts Word XML into semantic HTML with custom style mappings (preserving underlines, strong tags, and bulleted lists).
- Extracts embedded images as base64 representations and runs OCR on up to 10 images per document.

### 6.3 Universal Document Representation
All supported formats (PDF, DOCX, PNG, JPEG, WEBP, TXT, MD, CSV, TSV) are converted into a standardized block format:
```typescript
interface DocumentModel {
  kind: 'pdf' | 'docx' | 'image' | 'text';
  name: string;
  mime: string;
  pages?: number;
  warnings?: string[];
  blocks: (HeadingBlock | ParagraphBlock | ListBlock | TableBlock | ImageBlock)[];
}
```

### 6.4 Optical Gemini Vision Integration
When analyzing visual assets (design mockups, brand guidelines, infographics) with Gemini, the user can toggle "Also let Gemini see the image itself". The canvas produces an optimized JPEG ($1600\text{px}$ max dimension) that is transmitted as base64 `inline_data` alongside the redacted document JSON.

---

## 7. Cloudflare Worker AI Proxy (`worker/`)

A standalone edge service (`worker/src/index.js`) allowing Project Brain to run entirely on open-weight models (Llama 3.3 70B and Llama 3.1 8B) hosted on Cloudflare's global GPU network.

### 7.1 Security & Guardrails
1. **Bearer Token Authentication**: Enforces a pre-shared `APP_TOKEN` secret. Compared using `crypto.subtle.timingSafeEqual` over SHA-256 digests to eliminate timing attacks.
2. **CORS Origin Allowlist**: Matches browser `Origin` headers against `ALLOWED_ORIGINS` configured in `wrangler.toml`.
3. **Payload Size Caps**: Requests exceeding `MAX_BODY_BYTES` ($200\text{ KB}$) are rejected before execution.
4. **Model Allowlist**: Restricts execution to approved models:
   - `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (Default, high intelligence)
   - `@cf/meta/llama-3.1-8b-instruct-fast` (Fast, low cost)
5. **Zero-Log Guarantee**: The Worker does not record logs, maintain storage, or retain input payloads.

### 7.2 API Specification
- **Endpoint**: `POST /v1/generate`
- **Request Body**:
  ```json
  {
    "prompt": "User query...",
    "system": "System instructions...",
    "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "schema": { "type": "object", "properties": { ... } },
    "temperature": 0.2,
    "maxTokens": 2048
  }
  ```
- **Response**:
  ```json
  {
    "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "output": { ... },
    "jsonMode": true
  }
  ```

---

## 8. Multi-Member Collaboration & Client Portal

Project Brain supports inviting clients, designers, developers, and team members with scoped permissions (`src/components/Invite.jsx` and `src/components/Join.jsx`).

### 8.1 Roles and Identity
- Supported roles: `client`, `developer`, `designer`, `motion`, `video`, `brand`, or `other` (with custom designation).
- Each member receives:
  1. A unique URL token: `#/join/<token>`
  2. A cryptographically random **4-digit PIN** (`secureDigits(4)`).

### 8.2 Zero-Leak Scoped Data Projection (`memberCopy()`)
When an invite link is accessed, the application projects a restricted slice of the project record:
- **Completely Stripped**:
  - `p.suggestions` $\rightarrow$ Never exposed.
  - `p.asks` $\rightarrow$ Never exposed.
  - `p.log` $\rightarrow$ Never exposed.
  - `p.items.filter(type === 'sensitive')` $\rightarrow$ Vault is never accessible.
  - Internal item notes $\rightarrow$ All `notes` arrays are emptied.
  - Item edit histories $\rightarrow$ Filtered to hide status transitions and audit notes.
  - Other members' PINs/tokens $\rightarrow$ Sanitized from member lists.
- **Granular Feature Toggles (`perms`)**:
  - `tasks`: View and review tasks.
  - `requirements`: View active specifications and scope.
  - `decisions`: View logged agreements.
  - `files`: View and download shared assets and links.
  - `summary`: View the living memory overview.

---

## 9. State Management, Storage & Multi-Tab Synchronization

The frontend state management architecture is encapsulated in `src/store.jsx`:

### 9.1 Storage Architecture
IndexedDB database named `project-brain` (version 1) containing object store `kv`:
- Key `'workspace'`: Holds the root serialized application state JSON (or encrypted ciphertext envelope `{ v: 1, enc: true, salt, iv, ct }`).
- Keys `'blob:<attachmentId>'`: Holds raw binary file Blobs (or encrypted buffers `{ enc: true, mime, iv, ct }`).

### 9.2 Auto-Save Pipeline
Whenever React state mutates, a 250ms debounced effect checks if `JSON.stringify(state)` has diverged from `lastJson.current`. If changed, it writes to IndexedDB and broadcasts a message across `BroadcastChannel('project-brain')`.

### 9.3 Cross-Tab Synchronization
```
[ Tab A: Owner Workspace ]                                [ Tab B: Client Portal ]
          │                                                          │
   User sends message                                                │
   State mutates locally                                             │
   Saved to IndexedDB                                                │
          │                                                          │
          ├─────── BroadcastChannel('project-brain') ────────────────┤
          │        Message: { type: 'saved', from: 'tab_A' }         │
          │                                                          │
          │                                              Receives signal
          │                                              Loads fresh data from IDB
          │                                              Executes `mergeState()`
          │                                              React state updates seamlessly!
```

### 9.4 Multi-Tab Leader Election (`src/components/Analyzer.jsx`)
If a user keeps multiple workspace tabs open, all tabs would attempt to analyze incoming messages simultaneously.
Project Brain solves this using the **Web Locks API**:
```javascript
navigator.locks.request('project-brain-analyzer', () => {
  setLeader(true);
  return heldPromise; // Lock held indefinitely until tab closes
});
```
Only the elected leader tab schedules the debounced 900ms message evaluation timer and dispatches analysis jobs.

---

## 10. Frontend Component Hierarchy & View Layout

The application employs a responsive hash-based router (`src/App.jsx`):
- `#/` $\rightarrow$ Workspace Home (`<Home />`)
- `#/p/:id/:tab` $\rightarrow$ Project Shell (`<ProjectShell />`)
- `#/p/:id/:tab/m/:msgId` $\rightarrow$ Jump to message in chat
- `#/p/:id/:tab/i/:itemId` $\rightarrow$ Jump to item drawer
- `#/join/:token` $\rightarrow$ Client Portal Authentication (`<Join />`)

```
App.jsx
├── Splash (Loading / Error states)
├── Unlock.jsx (Passphrase challenge if encrypted)
├── Join.jsx (Client PIN challenge & portal)
└── Home.jsx (Projects list, spaces, stats)
    │
    └── ProjectShell.jsx (Main project container)
        ├── Header (Project title, status, member avatars, action menu)
        ├── Tab Navigation (Chat, Tasks, Requirements, Decisions, Vault, Files, Memory, Timeline)
        │
        ├── View: Chat.jsx
        │   ├── Search bar
        │   ├── Message list (MessageText with Linkified & Secret masking)
        │   ├── Voice Note playback & audio waveforms
        │   ├── Attachment download & ReadFileModal launcher
        │   ├── Message Composer (File drop, Voice recorder, Simulation switcher)
        │   └── Suggestions Sidebar (`ChatSidebar` / `SuggestionsInbox`)
        │
        ├── View: Items.jsx (TasksView, RequirementsView, DecisionsView, VaultView, FilesView)
        │   ├── Progress bars
        │   ├── Filter toolbars
        │   └── ItemRow / VersionCard / Attachment tiles
        │
        ├── View: Memory.jsx
        │   ├── Living Summary Card (Facts, Done, In Progress, Next, Questions, Risks)
        │   ├── Memory Historical Timeline
        │   └── Embedded Assistant.jsx
        │
        ├── View: Timeline.jsx
        │   ├── Chronological event list (`project.log`)
        │   └── Raw JSON inspector modal
        │
        ├── Drawers & Modals:
        │   ├── ItemDrawer.jsx (Detailed item inspection, status history, notes thread, delete)
        │   ├── Search.jsx (Universal search modal)
        │   ├── Settings.jsx (AI keys, worker tokens, security passphrase, JSON import/export)
        │   ├── Invite.jsx (Member link & PIN manager)
        │   ├── ReadFileModal.jsx (Document analysis workflow)
        │   └── Lightbox / Viewer.jsx (Pan/zoom image viewer)
        │
        └── Global: Toasts.jsx (Notification pill stack)
```

---

## 11. Complete File-by-File Code Map

```
/Users/seeamsquidx/Desktop/best works/Brainn/
├── package.json              Vite, React 18, Tailwind, mammoth, pdfjs-dist, tesseract.js
├── vite.config.js            React plugin configuration
├── tailwind.config.js        Tailwind setup with custom dark themes and keyframes
├── postcss.config.js         PostCSS autoprefixer configuration
├── index.html                HTML shell with root container
│
├── worker/
│   ├── wrangler.toml         Cloudflare Workers AI bindings, models, and CORS configuration
│   ├── README.md             Deployment and secret generation manual
│   └── src/
│       └── index.js          Cloudflare Worker AI reverse proxy implementation
│
└── src/
    ├── main.jsx              React DOM application entry point
    ├── App.jsx               Hash router, master layout switcher, unlock and join gates
    ├── store.jsx             Global workspace state provider, IndexedDB sync, encryption lifecycle
    ├── seed.js               First-launch demo workspace generator (Nova Café & Orbit Fitness)
    ├── index.css             Tailwind directives, CSS animations (pop, slide, wave, flash, hl-mark)
    │
    ├── lib/
    │   ├── model.js          Append-only state schemas, item operations, deduplication, CRDT union merges
    │   ├── meta.js           Enums, type configurations, colors, status definitions, role constants
    │   ├── util.js           Keyword overlap scoring, ISO date formatters, hashId (FNV-1a), DOM flash utilities
    │   ├── dates.js          Natural language date parser (e.g. "by fri", "eow", "tmrw" -> YYYY-MM-DD)
    │   ├── shorthand.js      Client chat abbreviation glossary (e.g. pwd, stg, req, lgtm) and expander
    │   ├── redact.js         Client-side secret identification, token substitution ([SECRET_n]), and restoration
    │   ├── crypto.js         Web Crypto API wrapper (PBKDF2-SHA256, AES-256-GCM) for state and binary data
    │   ├── kv.js             IndexedDB promise-based key-value storage engine
    │   ├── blobs.js          IndexedDB binary file attachment persistence, encryption, and object URLs
    │   ├── files.js          File and link categorization heuristics, link title extraction
    │   ├── docread.js        In-browser file parser (PDF text/tables/OCR, Word Mammoth, Tesseract WASM OCR)
    │   ├── gemini.js         Google Gemini & Cloudflare API client, JSON schemas, retry logic, prompt templates
    │   ├── brain.js          Intelligence orchestrator: routes between AI models and rules, manages memory
    │   └── assistant.js      Interactive project assistant: Q&A, draft generation, and record change proposals
    │
    └── components/
        ├── ui.jsx            Design system: Button, Modal, Drawer, Input, Toggle, Badge, Menu, Secret
        ├── Home.jsx          Dashboard: project list, spaces sidebar, storage indicators, project creation
        ├── ProjectShell.jsx  Project shell: navigation headers, tab switcher, drawer container
        ├── ProjectArt.jsx    Avatar and banner cover image component with gradient fallbacks
        ├── Chat.jsx          Chat timeline: voice playback, file previews, masked secrets, composer
        ├── Suggestions.jsx   AI suggestion cards, review inbox, one-click accept/edit/ignore
        ├── Items.jsx         Structured views for Tasks, Requirements, Decisions, Vault, and Files
        ├── ItemDrawer.jsx    Full inspection drawer: version diffs, status changer, notes, audit trail
        ├── Memory.jsx        Living project state summary view, timeline checkpoints, and assistant
        ├── Assistant.jsx     Conversational assistant widget, prompt chips, and message drafter
        ├── Analyzer.jsx      Headless background tab coordinator using Web Locks API for auto-analysis
        ├── Timeline.jsx      Raw project event log viewer and formatted JSON exporter
        ├── Search.jsx        Global and project-scoped search modal with real-time text highlight
        ├── Settings.jsx      AI provider configuration, Security encryption setup, and JSON data backup
        ├── Invite.jsx        Member invite manager: generates unique links, PINs, and role permissions
        ├── Join.jsx          External collaborator authentication portal with 4-digit PIN verification
        ├── Unlock.jsx        Master passphrase authentication challenge screen
        ├── ReadFile.jsx      Attachment analyzer modal: configures OCR and vision parameters
        ├── Viewer.jsx        High-resolution image lightbox with pan and zoom capabilities (5% - 1600%)
        └── Toasts.jsx        Floating notification pill stack
```

---

## 12. Developer Operations, Build & Deployment Guide

### 12.1 Local Development Environment
```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev
# Default address: http://localhost:5173
```

### 12.2 Production Build
```bash
# Build optimized static bundle
npm run build
# Assets emitted to dist/

# Preview production build locally
npm run preview
```

### 12.3 Cloudflare Deployment (Live Production)

The project is deployed on Cloudflare:
- **Frontend (Cloudflare Pages)**: `https://project-brain-557.pages.dev`
- **Backend API (Cloudflare Worker + D1)**: `https://project-brain-ai.ashfadhossain0.workers.dev`

To redeploy changes:
```bash
# 1. Build and redeploy the frontend:
npm run build
npx wrangler pages deploy dist --project-name=project-brain

# 2. Redeploy the backend worker:
cd worker
npx wrangler deploy
```

*Note: The Worker's `ALLOWED_ORIGINS` in `worker/wrangler.toml` includes both `http://localhost:5173` and `https://project-brain-557.pages.dev`.*

### 12.4 Configuring Intelligence in the App
1. Open the app in browser $\rightarrow$ **Settings** (gear icon) $\rightarrow$ **AI**.
2. **Option A: Google Gemini**
   - Select **Gemini**.
   - Input API key from [Google AI Studio](https://aistudio.google.com/apikey).
   - Click **Load models** and choose `gemini-3.5-flash-lite`.
   - Click **Test connection**.
3. **Option B: Cloudflare AI**
   - Select **Cloudflare AI**.
   - Enter deployed Worker URL and the `APP_TOKEN`.
   - Click **Test connection**.
4. **Option C: Built-in Rules**
   - Runs automatically if no keys are entered or if network calls encounter errors.

### 12.5 Workspace Backup & Portability
- **Exporting**: Settings $\rightarrow$ Data $\rightarrow$ **Export workspace**. Generates a clean JSON file of all projects, items, and conversation records (API keys and worker tokens are automatically stripped from exports).
- **Importing**: Settings $\rightarrow$ Data $\rightarrow$ **Import & merge**. Ingests previously exported records, performing non-destructive ID union merges so historical edits are never overwritten.
