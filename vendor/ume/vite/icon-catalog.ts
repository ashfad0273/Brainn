/* design/icon-catalog.json: every icon Ume names (the Icons.* keys in
   src/lib/icons.ts, in that order) with its original glyph and the files that
   use it. The Icon Studio app (github.com/withsaber/icon-studio) reads it to
   show each original next to the override it writes to design/icon-overrides/.

   Written by the dev server once it is listening (scripts/vite-icon-studio.ts)
   and by `npm run icons:catalog` (scripts/icon-catalog.ts). The file is only
   rewritten when its content changed. */

import { promises as fs } from "node:fs"
import path from "node:path"
import type { ViteDevServer } from "vite"

export const CATALOG = "design/icon-catalog.json"

const GROUPS = [
  { id: "squidx", title: "Squidx set" },
  { id: "remix", title: "Remix set", caption: "Still the stock Remix glyph. Paste to make it yours." },
]

/* The page icons are also used as <Name>Icon components from nav-icons.tsx. */
const NAV = ["Overview", "Accounts", "Transactions", "People", "Subscriptions", "Settings"]

/* Where each key is used: Icons.<key>, and the nav <Name>Icon components.
   Paths are relative to src/, sorted. */
async function usage(root: string): Promise<Record<string, string[]>> {
  const src = path.join(root, "src")
  const out: Record<string, Set<string>> = {}
  const add = (key: string, file: string) => (out[key] ??= new Set()).add(file)
  async function walk(d: string) {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name !== "icons") await walk(p)
      } else if (/\.(tsx?|jsx?)$/.test(e.name) && !p.endsWith(path.join("lib", "icons.ts"))) {
        const rel = path.relative(src, p).split(path.sep).join("/")
        const text = await fs.readFile(p, "utf8")
        for (const m of text.matchAll(/\bIcons\.(\w+)/g)) add(m[1], rel)
        for (const n of NAV) if (new RegExp(`\\b${n}Icon\\b`).test(text) && !rel.endsWith("nav-icons.tsx")) add(n.toLowerCase(), rel)
      }
    }
  }
  await walk(src)
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]))
}

/* The root <svg> tag loses its size and a11y attributes; the studio sets its own. */
const STRIP = /\s(?:width|height|aria-hidden|focusable|data-icon-override)="[^"]*"/g
const clean = (svg: string) => svg.replace(/^<svg\b[^>]*>/, (tag) => tag.replace(STRIP, ""))

/* Builds the catalog through `server` (any Vite server with the icon studio
   plugin) for the package at `root`
   and writes it when it changed. Returns true when the file was written.
   Server-side loads get no overrides (see ./icon-studio.ts), so BaseIcons
   render as the originals. */
export async function writeIconCatalog(server: ViteDevServer, root: string): Promise<boolean> {
  const { BaseIcons } = (await server.ssrLoadModule(path.join(root, "src/lib/icons.ts"))) as { BaseIcons: Record<string, unknown> }
  /* From Node, not ssrLoadModule: Vite leaves node_modules to Node on the
     server, so these are the same copies icons.ts got, and the Remix lookup
     by identity works. */
  const [{ createElement }, { renderToStaticMarkup }, Remix] = await Promise.all([
    import("react"),
    import("react-dom/server"),
    import("@remixicon/react"),
  ])
  /* Remix components carry no name, so look them up by identity. */
  const remixNames = new Map<unknown, string>(Object.entries(Remix).map(([n, c]) => [c, n]))
  const used = await usage(root)

  const icons: Record<string, { group: string; from: string; original: string; usage: string[] }> = {}
  for (const [key, Comp] of Object.entries(BaseIcons)) {
    const remix = remixNames.get(Comp)
    const name = remix
      ? `Remix ${remix.replace(/^Ri/, "")}`
      : `Squidx ${((Comp as { displayName?: string }).displayName ?? "Icon").replace(/Icon$/, "")}`
    icons[key] = {
      group: remix ? "remix" : "squidx",
      from: name,
      original: clean(renderToStaticMarkup(createElement(Comp as never, { size: 24 }))),
      usage: used[key] ?? [],
    }
  }

  const text = JSON.stringify({ groups: GROUPS, replacedGroup: "squidx", icons }, null, 2) + "\n"
  const file = path.join(root, CATALOG)
  const before = await fs.readFile(file, "utf8").catch(() => null)
  if (before === text) return false
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, text)
  return true
}
