# Install Ume in an app

Ume is the Squidx design system. Every Squidx app uses it, so they all look,
move and read the same. This guide adds it to a new app and connects the app
to Ume's automatic updates, so a change in Ume reaches the app by itself.
Squidx Ledger (`withsaber/Squidx-Ledger`) is the working example of every
step.

**How it works:** the app keeps a read-only copy of Ume's `packages/ui` in
`vendor/ume` and imports it as `@ume/ui/*`. When `packages/ui` changes on
Ume's `main`, Ume's `notify-apps` workflow starts the app's `ume-sync`
workflow. That copies the new Ume in, builds the app (and runs its smoke test,
if it has one), and pushes to the app's `main` only if they pass.

## Before you start

- The app is React 19 + Vite 8 + Tailwind 4 + TypeScript, on Node 22, in a
  repo under `withsaber` on GitHub.
- `gh` is installed and logged in (`gh auth status`).
- Ume is checked out at `~/Documents/ume`. If not:
  `gh repo clone withsaber/ume ~/Documents/ume`.

In the steps below, `UME` means `~/Documents/ume`.

## 1. Copy the two files

From the app's root:

```bash
mkdir -p scripts .github/workflows
cp ~/Documents/ume/templates/app/scripts/ume.mjs scripts/ume.mjs
cp ~/Documents/ume/templates/app/.github/workflows/ume-sync.yml .github/workflows/ume-sync.yml
```

`scripts/ume.mjs sync` copies Ume in and `scripts/ume.mjs check` fails if
anyone edited the copy by hand. `ume-sync.yml` is the robot.

## 2. Add Ume's packages

The app needs every package in `UME/packages/ui/package.json`
`dependencies`; `scripts/ume.mjs check` fails if one is missing. Today that is:

```bash
npm install @base-ui/react @fontsource-variable/ibm-plex-sans @fontsource/ibm-plex-mono @remixicon/react class-variance-authority clsx motion recharts tailwind-merge react react-dom
npm install -D tailwindcss @tailwindcss/vite @vitejs/plugin-react vite typescript @types/react @types/react-dom @types/node
```

## 3. Copy Ume in

```bash
node scripts/ume.mjs sync
```

Then, in `package.json`, add the sync script and put the check in front of
the build:

```json
"scripts": {
  "ume:sync": "node scripts/ume.mjs sync",
  "check": "node scripts/ume.mjs check",
  "build": "tsc -b && vite build && npm run check"
}
```

Commit `vendor/ume` like any other code, and never edit it.

## 4. Wire it into the build

`vite.config.ts`:

```ts
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { iconStudio } from "./vendor/ume/vite/icon-studio.ts"

export default defineConfig({
  plugins: [react(), tailwindcss(), iconStudio()],
  resolve: {
    alias: [
      { find: /^@ume\/ui\/(.*)$/, replacement: path.resolve(__dirname, "./vendor/ume/src") + "/$1" },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
})
```

The app's tsconfig (the one that includes `src`, e.g. `tsconfig.app.json`):

```json
"compilerOptions": {
  "paths": {
    "@/*": ["./src/*"],
    "@ume/ui/*": ["./vendor/ume/src/*"]
  }
},
"include": ["src", "vendor/ume/src/types"]
```

If the root `tsconfig.json` also lists `paths`, add the same `@ume/ui/*`
line there. The tsconfig that checks `vite.config.ts` (e.g.
`tsconfig.node.json`) includes `"vendor/ume/vite"` too.

`src/index.css` holds only this. Ume brings the tokens, themes, type and
utilities:

```css
@import "../vendor/ume/src/styles/ume.css";
@source "./";
```

## 5. Start the app the Ume way

Copy the theme script, so the right theme is set before the first paint:

```bash
cp ~/Documents/ume/apps/docs/public/theme-init.js public/theme-init.js
```

`index.html`, inside `<head>`:

```html
<meta name="theme-color" content="#f7f7f7" />
<script src="/theme-init.js"></script>
```

`src/main.tsx`:

```tsx
import { MotionProvider } from "@ume/ui/components/patterns/MotionProvider"
import { ToastProvider } from "@ume/ui/components/ui/toast"
import { installScrollingFlag } from "@ume/ui/lib/scrolling"
import "./index.css"

installScrollingFlag()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MotionProvider>
  </StrictMode>,
)
```

## 6. Build with it

Import parts by path, never copy them into the app:

```tsx
import { Button } from "@ume/ui/components/ui/button"
import { DataTable } from "@ume/ui/components/patterns/DataTable"
import { SidePanel, DetailGrid } from "@ume/ui/components/patterns/SidePanel"
import { Icons } from "@ume/ui/lib/icons"
import { cn } from "@ume/ui/lib/utils"
```

`UME/apps/docs` shows every part in use (`pnpm dev` in Ume). Read the rules
before designing anything: `vendor/ume/docs/standard.md`, `conventions.md`
and `copy-guide.md`. If something any app could use is missing, add it to
Ume, not to the app. Only what reads the app's own data belongs in the app.

## 7. Turn on automatic updates

1. In Ume, add the app's repo to `APPS` in
   `.github/workflows/notify-apps.yml`. Repos are separated by spaces:
   `APPS: withsaber/Squidx-Ledger withsaber/new-app`. Commit and push.
2. Give the app the access token as the secret `UME_TOKEN`:

   ```bash
   gh secret set UME_TOKEN --repo withsaber/<app>
   ```

   It is the same token Ledger uses and Ume holds as `APPS_TOKEN`. If it was
   made for "Only select repositories", first add the new repo to it in
   GitHub → Settings → Developer settings → Fine-grained tokens. One made for
   "All repositories" covers new apps already.
3. If the app has a `ci.yml`, give it a `workflow_dispatch:` trigger, so the
   sync can start CI after it ships.

## 8. Check it

```bash
npm run build
gh workflow run ume-sync.yml --repo withsaber/<app>
```

The build passes with the Ume check. The sync run says "Ume is already up to
date". Next time Ume's `packages/ui` changes, the app gets an "Update Ume to
…" commit by itself.

## Keeping it working

- Never edit `vendor/ume`. Change Ume, push, and the sync brings it in. To
  pull by hand: `npm run ume:sync` (or `-- --ref <commit>`).
- New icons are made in Icon Studio on Ume (`pnpm studio` there) and arrive
  with the sync.
- When the token expires, the syncs stop and their runs fail. Make a new one
  with the same access and update `UME_TOKEN` in every app and `APPS_TOKEN`
  in Ume.
