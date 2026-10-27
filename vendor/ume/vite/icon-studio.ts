/* Ume's side of the Icon Studio. Every app that uses Ume adds this plugin to
   its Vite config (`plugins: [react(), tailwindcss(), iconStudio()]`).

   The studio is its own app (github.com/withsaber/icon-studio; `pnpm studio`
   in ume opens it on packages/ui). It writes the designer's icons straight
   into packages/ui/design/icon-overrides/: <key>.svg per replaced icon, plus
   manifest.json for the fit. Ume only serves them and keeps the studio fed:

   - `virtual:icon-overrides` hands the overrides to packages/ui/src/lib/icon-overrides.tsx,
     in dev and in the build. Production gets them the normal way (commit,
     PR, merge).
   - In dev, a change in design/icon-overrides/ pushes an
     `icon-studio:update` event to every open page, which swaps the icon in
     place with no reload.
   - Once the dev server is listening it refreshes design/icon-catalog.json,
     the list of icons the studio shows (./icon-catalog.ts). */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"
import { CATALOG, writeIconCatalog } from "./icon-catalog.ts"

type Meta = { inset: boolean; replacedAt: string }

const VIRTUAL = "virtual:icon-overrides"
const RESOLVED = "\0" + VIRTUAL

/* The package root (packages/ui), wherever the app that uses it lives. */
const root = fileURLToPath(new URL("..", import.meta.url))

/* `catalog`: refresh design/icon-catalog.json when the dev server starts. Only
   Ume's own site does; an app's copy of Ume is read-only. */
export function iconStudio({ catalog = false }: { catalog?: boolean } = {}): Plugin {
  const dir = () => path.join(root, "design/icon-overrides")

  async function readManifest(): Promise<Record<string, Meta>> {
    try {
      return JSON.parse(await fs.readFile(path.join(dir(), "manifest.json"), "utf8")) as Record<string, Meta>
    } catch {
      return {}
    }
  }

  async function readSvgs(): Promise<Record<string, string>> {
    const out: Record<string, string> = {}
    try {
      for (const f of (await fs.readdir(dir())).sort()) {
        if (f.endsWith(".svg")) out[f.slice(0, -4)] = await fs.readFile(path.join(dir(), f), "utf8")
      }
    } catch {
      /* no overrides folder yet */
    }
    return out
  }

  return {
    name: "icon-studio",
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : undefined
    },
    async load(id, options) {
      if (id !== RESOLVED) return undefined
      /* The app never renders on the server; the only server-side load is the
         icon catalog, which wants the originals. */
      if (options?.ssr) return "export const svgs = {}\nexport const meta = {}\n"
      return `export const svgs = ${JSON.stringify(await readSvgs())}\nexport const meta = ${JSON.stringify(await readManifest())}\n`
    },
    configureServer(server) {
      const logger = server.config.logger

      /* Push the new set to open pages and drop the cached virtual module, so
         a later full reload reads fresh files. No HMR update, no reload. */
      const broadcast = async () => {
        const mod = server.moduleGraph.getModuleById(RESOLVED)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: "custom", event: "icon-studio:update", data: { svgs: await readSvgs(), meta: await readManifest() } })
      }

      /* The studio writes an SVG and the manifest one after the other; wait
         for the pair before pushing. */
      let timer: ReturnType<typeof setTimeout> | undefined
      const onFile = (file: string) => {
        if (!file.startsWith(dir() + path.sep)) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          broadcast().catch((e: unknown) => logger.warn(`Icon overrides: couldn't push the update (${String(e)})`, { timestamp: true }))
        }, 50)
      }
      server.watcher.add(dir())
      server.watcher.on("add", onFile).on("change", onFile).on("unlink", onFile)

      /* After startup, never in the way of it. No httpServer in middleware
         mode, which is how `pnpm icons:catalog` runs. */
      if (catalog) server.httpServer?.once("listening", () => {
        writeIconCatalog(server, root)
          .then((written) => written && logger.info(`Icon catalog: wrote ${CATALOG}`, { timestamp: true }))
          .catch((e: unknown) => logger.warn(`Icon catalog: couldn't write ${CATALOG} (${e instanceof Error ? e.message : String(e)})`, { timestamp: true }))
      })
    },
  }
}
