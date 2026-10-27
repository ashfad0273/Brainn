import * as React from "react"
import type { RemixiconComponentType } from "@remixicon/react"
import { meta as initialMeta, svgs as initialSvgs } from "virtual:icon-overrides"

/* Icons the designer swapped in with the Icon Studio, its own app
   (github.com/withsaber/icon-studio, `npm run studio`). Each override is
   design/icon-overrides/<key>.svg, keyed by the Icons.* name (overview,
   accounts, … are also the six nav icons). They arrive through
   `virtual:icon-overrides` (scripts/vite-icon-studio.ts). The studio cleans
   each SVG before saving it: fills become currentColor, and clip paths and
   scripts are removed.

   Live in dev: when the studio writes a file, the dev server pushes
   `icon-studio:update` and every icon re-renders in place, with no page
   reload. In the build the set is fixed.

   Fit, per icon in manifest.json:
   - inset (default): the Figma grid. The pasted artwork, usually 12px, gets a
     1/6 margin on every side, so in a 16px box the glyph is 12px.
   - full: the glyph fills the whole box. */

export type OverrideMeta = { inset: boolean; replacedAt: string }
type Snapshot = { svgs: Record<string, string>; meta: Record<string, OverrideMeta> }

let snapshot: Snapshot = { svgs: initialSvgs, meta: initialMeta as Record<string, OverrideMeta> }
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const getSnapshot = () => snapshot

if (import.meta.hot) {
  import.meta.hot.on("icon-studio:update", (data: Snapshot) => {
    snapshot = data
    listeners.forEach((fn) => fn())
  })
}

export function useOverrides(): Snapshot {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function parse(svg: string) {
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "0 0 12 12"
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
  return { vb: vb.split(/[\s,]+/).map(Number), inner }
}

export function svgInner(svg: string) {
  return parse(svg).inner
}

export function viewBoxFor(svg: string, inset: boolean) {
  const [x, y, w, h] = parse(svg).vb
  if (!inset) return `${x} ${y} ${w} ${h}`
  const px = w / 6
  const py = h / 6
  return `${x - px} ${y - py} ${w + 2 * px} ${h + 2 * py}`
}

type IconProps = React.ComponentProps<RemixiconComponentType>

/* One `{ __html }` object per SVG, reused on every render. React 19 rewrites
   innerHTML whenever it gets a new object, even with the same markup, and
   each rewrite is a DOM mutation: inside a toast, whose content is watched by
   a MutationObserver that re-renders it, that froze the tab (every toast
   after a save). */
const htmlCache = new Map<string, { __html: string }>()
function innerHtml(svg: string) {
  let html = htmlCache.get(svg)
  if (!html) {
    html = { __html: svgInner(svg) }
    htmlCache.set(svg, html)
  }
  return html
}

function OverrideSvg({ name, svg, inset, size, color = "currentColor", ...props }: IconProps & { name: string; svg: string; inset: boolean }) {
  return (
    <svg
      viewBox={viewBoxFor(svg, inset)}
      width={size ?? 16}
      height={size ?? 16}
      fill={color}
      aria-hidden
      focusable="false"
      data-icon-override={name}
      {...props}
      /* Local, studio-cleaned SVG from the repo, never user input. */
      dangerouslySetInnerHTML={innerHtml(svg)}
    />
  )
}

/* One icon: the override when there is one, else the original. In dev it
   follows the live set; in the build it is resolved once. */
function overridable(key: string, Original: RemixiconComponentType): RemixiconComponentType {
  if (import.meta.hot) {
    const Live: RemixiconComponentType = (props) => {
      const { svgs, meta } = useOverrides()
      const svg = svgs[key]
      return svg ? <OverrideSvg name={key} svg={svg} inset={meta[key]?.inset !== false} {...props} /> : <Original {...props} />
    }
    Live.displayName = (Original as { displayName?: string }).displayName
    return Live
  }
  const svg = snapshot.svgs[key]
  if (!svg) return Original
  const inset = snapshot.meta[key]?.inset !== false
  const Fixed: RemixiconComponentType = (props) => <OverrideSvg name={key} svg={svg} inset={inset} {...props} />
  return Fixed
}

/* The registry with every studio override applied; the key set is unchanged. */
export function applyOverrides<T extends Record<string, RemixiconComponentType>>(icons: T): T {
  const out: Record<string, RemixiconComponentType> = {}
  for (const [key, Icon] of Object.entries(icons)) out[key] = overridable(key, Icon)
  return out as T
}

/* One nav icon, keyed by page name (the same key as Icons.<page>). */
export function navOverride<P extends React.SVGProps<SVGSVGElement>>(
  key: string,
  original: (props: P) => React.ReactElement,
): (props: P) => React.ReactElement {
  return overridable(key, original as unknown as RemixiconComponentType) as unknown as (props: P) => React.ReactElement
}
