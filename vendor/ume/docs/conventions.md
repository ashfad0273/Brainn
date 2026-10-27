# Enforced conventions

> Ume's conventions, enforced by `pnpm check` (`scripts/check-conventions.mjs`, `scripts/check-css.mjs`). Written for Squidx Ledger, the first app on Ume; page names are Ledger's examples.

`npm run check` runs two guards. Both are wired into `npm run build` and into
CI, so neither can be skipped by forgetting.

The rules a script can't check (tokens, type scale, spacing, the shared app
components and the copy voice) live in [standard.md](./standard.md). Build
screens from the blocks it lists.

## Why they exist

Six rounds of interface review produced fixes that nothing then held in place.
Two failure modes recurred:

**Silently-invalid CSS.** Compiles, ships, does nothing. Happened twice:

| source | emitted | effect |
| --- | --- | --- |
| `bg-[--chart-2]` | `background-color: --chart-2` | every budget bar rendered with no fill |
| `inset-shadow-[var(--card-hi)]` | `box-shadow: inset inset 0 1px 0 …` | card highlight silently absent |

Browsers discard invalid declarations without complaint and TypeScript has no
opinion about CSS, so both passed review and shipped.

**Sweep-induced inconsistency.** A phase set the bottom tab bar's press scale to
`0.96` and left `Button` at `0.98`, recreating the exact inconsistency it had set
out to remove.

## scripts/check-css.mjs

Scans `dist/assets/*.css` after the build:

- a standard property whose whole value is a bare `--name` (missing `var()`)
- duplicated keywords, both literal and **after one level of var substitution** —
  the `inset inset` case never appears in the stylesheet text, only in the
  computed value
- `var(--x)` where `--x` is declared nowhere and has no fallback
- empty declarations

Custom properties that Base UI or our own code sets inline at runtime are
allow-listed by prefix in the script.

## scripts/check-conventions.mjs

Scans `src/`. Each rule is a review finding made permanent:

| rule | invariant |
| --- | --- |
| `press-scale` | a control presses to `0.97` (`PRESS_SCALE`), a large surface (row, card) to `0.99` (`PRESS_SCALE_SURFACE`). Reads `active:` / `data-pressed:` scale classes, Motion `whileTap` and the `pressScale` prop, default parameters included. `Button` drops its class scale when Motion presses it, so the two never multiply |
| `transition-all` | transitions name their properties |
| `arbitrary-text-size` | no `text-[Npx]` — use the `--text-*` scale |
| `no-text-2xs` | `text-2xs` is gone; `text-xs` (13px) is the smallest step |
| `min-font-size` | nothing under 13px: inline `fontSize` (styles and Recharts/SVG props), `font-size` attributes, CSS `font-size`, `[font-size:…]` classes and the `--text-*` tokens themselves. A size computed at runtime clamps itself (`Math.max(MIN_FONT_PX, …)`) |
| `font-weight` | two weights: `font-normal` (400) and `font-medium` (500). Bans `font-thin/extralight/light/semibold/bold/extrabold/black`, `font-[N]`, any other `fontWeight` and any other CSS `font-weight`, across all of `src/` |
| `no-gradient` | no gradients: CSS `*-gradient()`, SVG `<linearGradient>`/`<radialGradient>`, old `bg-gradient-*` utilities and Tailwind v4 `bg-linear/radial/conic-*` and `mask-*-from/to` utilities, across all of `src/`. The one exception is `GRADIENT_ALLOWLIST`: `Sidebar.tsx` (the selected-row fade) and `SquidxLogo.tsx` (the logo star), approved by the designer; an entry without a gradient fails as stale. One stated exception, for scroll fades: a `mask-image` declaration in `ume.css` whose stops are all `transparent` or `black` (a mask paints no colour). A colour stop, or a mask anywhere else, still fails |
| `label-mono-name` | the old `text-label` name is gone; the mono uppercase style is `text-label-mono` (Figma "Label Mono") and the Plex Sans Label is `text-xs` |
| `arbitrary-tracking` | no `tracking-[Nem]` — use `tracking-wide` |
| `palette-literal` | no Tailwind palette classes; use semantic tokens |
| `raw-hex` | no hex outside `index.css` |
| `tailwind-v3-bare-var` | no `bg-[--x]`; v4 needs `(--x)` or a theme key |
| `non-woff2-font` | fonts ship as woff2 |
| `table-density-on-nav-breakpoint` | tables branch on container width, not nav chrome |
| `icon-button-unnamed` | every `size="icon"` Button has an accessible name |
| `contrast-floor` | the token pairs stay at or above their WCAG floor in both themes: every `--{hue}-ink` on `--{hue}-soft`, `--pos/neg/warn-ink` on their soft, `--primary-ink` on `--primary-soft`, money and label colours on the card and page, labels on their fills, and every text token on the neutral surfaces (foreground and muted-foreground on page, card, popover and muted; inks on page and card), and the sidebar (foreground and `--icon-default` on `--sidebar` and `--sidebar-active`; `--text-secondary` on `--sidebar` at 3:1 by decision). Values may be hex, `hsl()`, `oklch()` or `color-mix(in oklch, …)` and may point at another token with `var()` |
| `lucide-import` | no `lucide-react` in the migrated folders (`ui/`, `motion/`, `charts/`, `lib/`, the shared app primitives, the design-system page); icons come from `Icons.*` in `packages/ui/src/lib/icons.ts`. Widen it to all of `src/` once every screen has moved |
| `raw-recharts` | no `recharts` imports outside `packages/ui/src/components/charts/` |
| `faint-muted-text` | no opacity on `text-muted-foreground`; it is already at the 4.5:1 floor |
| `page-width-wrapper` | pages don't centre themselves in their own `max-w-*xl` column; `AppShell` owns the width |

Comments are stripped before scanning, so a class name quoted as prose in a
docstring is documentation rather than usage.

### The Craft rules

The eleven rules from [Craft](https://craft.gustavofior.com), decided in
[standard.md](./standard.md) §6, each held by a check where a script can see
it:

| rule | invariant |
| --- | --- |
| `tabular-default` | `html` in `ume.css` sets `font-variant-numeric: tabular-nums` |
| `numeric-column` | a `DataTable` column whose key names a quantity (amount, cost, balance, total, price, rate, count, hours, salary, paid, due, spent, income, expense, fee, tax, budget, profit, value) sets `numeric: true`, so it right-aligns |
| `icon-side-padding` | every text size in `buttonVariants` gives the side holding an icon less padding than the text side |
| `font-smoothing` | `html` applies `antialiased`; `subpixel-antialiased` and `-webkit-font-smoothing: auto` need an `allow-` marker |
| `one-grain` | `feTurbulence` appears only in `charts/ChartNoise.tsx` |
| `image-outline` | `:where(img, video)` keeps the 1px inset `--image-outline`, defined in both themes; no `<img>` takes a `border` class |
| `nested-radius` | every nested pair in `NESTED` holds outer = inner + padding + border, read from the radius tokens and the spacing scale; a listed class that leaves its file fails until the pair is updated. A new popup with rows, or a chip in a card's corner, adds a line |
| `html-background` | `html` applies `bg-background` |
| `theme-color-sync` | the hard-coded theme-color hexes (`theme-init.js`, the docs `index.html`, the snippet in `install.md`, `useTheme`'s fallback) equal `--background` resolved in each theme |
| `keyframes-allowlist` | every `@keyframes` is listed in `KEYFRAMES` as a loop, a one-shot or scroll-driven; anything a person can toggle uses a transition or Motion |
| `input-lock` | no `isAnimating`-style guard drops input while something moves |
| `hover-instant` | no class string, and no `cn()` call across its strings, pairs a `hover:`, `group-hover:` or `peer-hover:` colour change with a transition that animates colour; no `whileHover` |
| `disabled-opacity` | a disabled control is `opacity-64` everywhere (`disabled:`, `data-disabled:`, `has-[…disabled]:` or `disabled && "opacity-…"`) |
| `drawn-icon` | no `<path d=…>` in `components/ui` or `components/patterns`: icons come from `Icons.*`, new ones from Icon Studio |
| `short-units` | `/month` and `/year`, never `/mo` or `/yr`, in the code and in these guides (text in backticks is skipped) |
| `tooltip-delay` | no literal `delay={…}` / `closeDelay={…}`: hover waits come from `TOOLTIP_DELAY_MS` through `TooltipProvider` |

### Opting out

Put `allow-<rule>` in a comment on the offending line or the line above, with a
reason:

```ts
// allow-raw-hex: last-resort fallback if the token hasn't resolved yet
m.setAttribute("content", bg || (t === "dark" ? "#0d0d11" : "#f6f5f2"))
```

## Motion budget

Motion should feel immediate. Before the revamp, dialogs took 430ms, drawers
500ms, chart wipes a full second, and money tickers 0.9s plus a delay per digit.
Pages also waited for the old page's exit before the new one could start. One
scale now covers every animation. It lives in `packages/ui/src/lib/ease.ts` (`DURATION`,
`EASE_OUT`, `EASE_DRAWER`, `SPRING`, `STAGGER`), and `packages/ui/src/styles/ume.css` mirrors it
as `--duration-*` and `--ease-*`:

| token | value | used for |
| --- | --- | --- |
| instant | 0 | reduced motion, chart tooltips, live value updates |
| fast | 120ms | colour, press, and every exit. Hover is instant (no transition) |
| base | 180ms | menus, popovers, tooltips, page enter (opacity only, no exit), toasts, badge swaps |
| slow | 280ms | dialogs (scale 0.96, no blur), sheets, drawers |
| chart | 400ms max | chart reveals, with no begin delay |
| ticker | 350ms | number tickers, 15ms between digits, first reveal only |
| stagger | 20ms | list entrances, 100ms total cap |

- **Easing.** Everything uses one ease-out, `cubic-bezier(0.16, 1, 0.3, 1)`.
  `--ease-out` replaces Tailwind's default, so the plain `ease-out` utility is
  this curve. Sheets and drawers use `ease-drawer`
  (`cubic-bezier(0.32, 0.72, 0, 1)`), and nothing else does. Don't use
  `ease-in-out` on UI.
- **Springs.** There is one spring: `SPRING`, which is
  `{ type: "spring", visualDuration: 0.2, bounce: 0 }`. It drives sliding pills,
  switch thumbs, morphs and content swaps. `SPRING_PRESS` (`visualDuration`
  `fast`, about 120ms, no bounce) is
  only for tap scale.
- **Tailwind utilities.** `duration-fast`, `duration-base`, `duration-slow`,
  `duration-chart` and `duration-ticker` come from the theme. A bare
  `transition-colors` with no duration defaults to `fast` on the app curve.
- **Popups and dialogs.**
  - Menus, popovers, select lists and tooltips open in 150ms and close in
    100ms.
  - Dialogs open in 200ms and close in 150ms, at scale 0.96.
  - Sheets and drawers open in 280ms and close in 200ms. A swiped drawer
    scales that close by the swipe's strength.
- **Number tickers** roll once, the first time they're shown. After that, a new
  value snaps into place: a period or account change updates every figure at
  once, and rolling them all would read as lag.
- **Reduced motion.**
  - Gate every animation on `useAppReducedMotion()`, never Motion's raw
    `useReducedMotion()`, because the raw hook misses the Settings toggle.
  - Gate Recharts `isAnimationActive` on it as well.
  - The CSS reduce rule also zeroes `transition-delay` and `animation-delay`.

`scripts/check-conventions.mjs` enforces the budget with two rules:

| rule | invariant |
| --- | --- |
| `slow-duration` | no literal duration or delay over 280ms (`slow`) in UI code, or over 400ms in chart files (`components/charts/`, and the app's chart components). It reads Tailwind `duration-*` and `delay-*` (including `[Nms]` and `[calc(…)]`), Motion `duration:`, `delay:` and `delayChildren:`, Recharts `animationDuration` (a literal or a same-file constant), and CSS times in transitions and animations, including `transition-delay`, `animation-delay` and their camelCase style keys. A non-zero Recharts `animationBegin` also fails. |
| `animate-presence-wait` | no `<AnimatePresence mode="wait">` around routed content (`<Outlet>`, `useOutlet`, `<Routes>` or a pathname key) |

A delay counts against the budget the same way a duration does: waiting 600ms
before a 180ms fade feels just as slow. The ceiling is the `slow` token itself
(280ms), with no margin above it.

Two kinds of animation are exempt:

- Loops, such as spinners, the skeleton shimmer and pulses, are skipped
  automatically (`repeat`, `Infinity` or `infinite` in the same transition).
  A loop the script can't see (the radial chart's loading skeleton, which an
  interval re-tweens) carries an `allow-slow-duration` marker that says so.
- A few slow literals are deliberate and carry an `allow-slow-duration`
  marker with the reason: the 450ms error shake on text fields, and the
  scrollbar's 300ms linger before it fades.

A value taken from a token (`DURATION.slow`, `duration-slow`) is not a literal,
so it passes.

`TOOLTIP_DELAY_MS` (500ms) is the one wait over `slow`, by design: it is a
pause before a tooltip, not a motion, and it is paid once per toolbar.

The script keeps a short `BASELINE` of violations that another change is
already removing, with a note on who removes each one. Once a listed file is
fixed or deleted, its entry fails the check as stale. Delete the entry: the
list can only get shorter.

## Components (beUI)

The look and motion come from [beUI](https://beui.dev)'s free registry
(`@beui` in `components.json`). The beUI pieces still in use live in
`packages/ui/src/components/motion/` (number ticker, animated number and badge,
stateful button, loader, text shimmer, the 404 glitch), with
helpers in `packages/ui/src/lib/ease.ts`, `packages/ui/src/lib/motion.ts` and `packages/ui/src/hooks/`. The
paid `@beui-pro` registry is not used.

Code nothing imports is deleted rather than kept "in case". The revamp
removed about 14k lines of unused beUI components and ui wrappers (sidebar,
command, context menu, toggle, toolbar and others); re-add one from its
registry when a screen actually needs it. To check for dead files, walk the
import graph from `src/main.tsx`, resolving the `@/` alias and counting
`/design-system` as reachable.

Screens import design-system parts only from `packages/ui/src/components/ui/*`, never
from `packages/ui/src/components/motion/*`. Those files keep Base UI underneath wherever it provides focus management,
keyboard support, ARIA or form values, and layer beUI's surfaces and Motion
springs on top. Restyle a component there and every screen follows.

- Add a beUI component with `npx shadcn@latest add @beui/<name>`, then map any
  palette colours, pixel text sizes and letter-spacing to tokens so
  `npm run check` passes.
- Every press scale is 0.97 (`PRESS_SCALE`), or 0.99 on a large surface, even where beUI's default differs.
- `MotionProvider` wraps the app in a `MotionConfig`, so the Settings
  reduced-motion toggle calms every Motion animation. Gate CSS animations on
  `useAppReducedMotion()`.
- The look is **Vibrant** (see [standard.md](./standard.md) §1–3); its tokens
  live in `packages/ui/src/styles/ume.css`:
  - A cool grey scale (`--grey-25…950`, hue 281.3) under every neutral
    token (plus the pure `--neutral-11…92` steps behind the text, icon and
    sidebar tokens), beUI blue, beUI teal as `--accent`, no gradients outside
    the approved sidebar, and a
    family of ten vivid hues (violet,
    blue, sky, teal, green, lime, amber, orange, rose, pink), each with
    solid, `-soft`, `-ink` and `-ring` steps.
  - Type is IBM Plex (self-hosted): Plex Sans in two weights, Regular and
    Medium, and Plex Mono Medium for the uppercase Label Mono style
    (`text-label-mono`); the Figma Label style is Plex Sans 13 (`text-xs`).
    Body is 15px; 13px is the floor. Code uses Plex Mono.
  - Cards are white (light) or grey-900 (dark) on a near-white / grey-950 page, with a
    hairline `border-border`, a soft `shadow-card` and `rounded-2xl` (20px),
    with no hover lift. Build them from `panel` in `surface.ts`.
  - Colour comes from chips, not from grey panels: an `IconChip` in a hue
    leads stat cards, list rows, section headings and empty states.
  - Icons are Remix only, named in `packages/ui/src/lib/icons.ts` (`Icons.*`,
    `NavIcons` line/fill pairs, `categoryIcon()`). Line by default, Fill for
    active.
  - Floating UI (popovers, menus, dropdown lists, tooltips, dialogs, sheets,
    drawers and toasts) uses the `glass` utility instead of its own background,
    border and shadow.
  - Control heights: buttons sm `h-7`, md `h-8`, lg `h-9`; icon buttons
    36px (`size-9`); fields (inputs, selects, comboboxes) 44px (`h-11`), sm
    `h-8`, lg `h-12`. No `sm:` height overrides. Fields are `rounded-xl`
    (12px) on `bg-card` and take a `leadingIcon`; buttons are pills
    (`rounded-full`).
  - Labels are sentence case. The only all-caps text is calendar weekday
    letters; data values like "monthly" get `capitalize`.
- Page width belongs to `AppShell`: one `max-w-[120rem]` container shared by
  the header, page and footer. Pages use the full width and add grid columns
  at `2xl:` instead of centring themselves. On screens 2400px and wider the
  root font size grows (112.5%, then 137.5% from 3200px), so the whole UI
  scales up on 4K monitors. Check large screens with
  `npm run shots -- --sizes wide,uhd`.
- `/design-system` shows the `ui/*` parts against the live tokens. It is
  admin-only (`RequireAuth` + `RequireAdmin` in `App.tsx`) and sits outside
  the app shell. A part that the page imports counts as in use.
- `/illustrations` shows every Hairline figure live on a wall of tiles
  (Figma 252:3870). It exists only on the public demo: the demo's build sets
  `VITE_DEMO=1` and `App.tsx` adds the route only then, so the real app
  answers it with the 404. It needs no sign-in (no data) and sits outside the
  app shell; the wall's layout is `.showcase-wall` in `index.css`. A new
  figure gets a tile there. To see it locally: `VITE_DEMO=1 npm run dev`.
- Overview figures (cash on hand, fixed costs, runway, the summary
  sentence) come from `src/lib/overview.ts`, shared by the dashboard and
  `/summary`.

## Accessibility floors

Checked in review and by the screenshot harness rather than by a script, so
hold them by hand:

- **Tap targets are at least 24px** (WCAG 2.5.8), and controls use the shared
  heights above (32px and up). When the visual must stay smaller, keep it and
  pad the hit area with an invisible pseudo-element instead of growing the
  layout: `relative after:absolute after:-inset-1 after:rounded-full` turns a
  16px icon into a 24px target.
- **Text is at least 13px.** `text-xs` is 13px and is the smallest step in
  the scale. `arbitrary-text-size` blocks `text-[Npx]` and `min-font-size`
  blocks every literal size under 13px, chart ticks and SVG text included.
  Interactive text (buttons, links) is 15px (`text-sm`); segmented options,
  counts and badges are 13px Plex Sans Medium (`font-medium text-xs`), never
  the mono Label Mono style, which is for small labels only.
- **Every control has a name.** Icon-only buttons carry `aria-label`
  (`icon-button-unnamed` checks `size="icon"` Buttons); a visible label is tied
  to its control with `htmlFor` or `aria-labelledby`, segmented controls are
  radio groups, and tabs have tab panels.
- **Reduced motion** reads `useAppReducedMotion()` from `packages/ui/src/lib/motion.ts`,
  never Motion's own `useReducedMotion()`, so the Settings toggle and the OS
  setting both apply. Gate CSS transitions and Recharts `isAnimationActive`
  on it too.
- **Contrast** of every ink-on-soft pair and the label and money pairs is
  asserted by `contrast-floor`. Icons in a chip use the hue's solid, which
  is decorative; text on a soft surface always uses the `-ink` step.

## Screenshots

`npm run shots` builds, then renders every scene in light and dark at
desktop, tablet and mobile with fixture data and a fake admin session
(`scripts/shots.mjs`, fixtures in `scripts/shots/fixtures.mjs`). Nothing
leaves the machine: Supabase is stubbed and every other host is blocked. It
exits non-zero on a scene that fails to render or throws a JS error.

- Add a scene to `SCENES` for any new screen or dialog. Wait on text the user
  would miss if it vanished (a heading, a fixture name), and list
  alternatives so a copy edit doesn't break the run.
- A new table the app reads goes in `tableRows()` and in the fixtures;
  unknown tables answer with an empty list.
- Fixture dates stay in the past apart from two deliberate future-dated
  entries, which exercise the Scheduled state.

## Charts

Every chart is built from Ume's chart parts in
`packages/ui/src/components/charts/`: `TrendChart` for a figure over time,
and `ChartFrame` with the Recharts glue in `recharts-chart.tsx` for anything
else. A new chart type is added there, in Ume, so every app gets it; an app
never imports `recharts` itself (`raw-recharts` fails the build).

Every chart takes its colours, tooltip and accessible wrapper from
`packages/ui/src/components/charts/chart.tsx`, so the charts cannot drift apart:

- `ChartFrame` wraps the chart with an accessible name and a sentence
  summary of the data;
- `tokenColors(...)` builds a `ChartConfig` colour from theme tokens only, and
  `seriesTokens` holds income, expense and net, so they read the same everywhere;
- `--chart-1` to `--chart-10` are the hue family, in order: blue, orange,
  teal, violet, green, sky, pink, lime, amber, rose;
- `seriesColor(i)` cycles `--chart-1` to `--chart-7` for categorical series.
  Key those series by index (`s0`, `s1`, …) because config keys become CSS
  custom property names;
- `--chart-8` to `--chart-10` widen the category colour palette
  (`src/lib/categoryColor.ts`). Use them for category colours only, never
  for chart series. A category's chip hue comes from `categoryHue()` /
  `useCategoryHue()`, so chip, dot and chart agree;
- spread `tooltipProps` on every `.Tooltip` and `legendProps` on every
  `.Legend`, and format money with `taka()` (`lib/money.ts`) in tooltips and
  `takaShort()` on axes.
- style (Vibrant): a solid hairline grid in `--chart-grid`, axis labels in
  `--chart-axis` and sentence case, 2px series strokes, areas
  `variant="solid"` (a flat, low-opacity fill) with `strokeVariant="solid"`,
  bars with the default 6px radius, and tooltips on the popover surface with
  round hue dots. Series and legends stay non-clickable because the chart sits inside
  `role="img"`.

## What these do not cover

Both are static. Neither can catch valid CSS that produces the wrong result — a
card that renders but looks wrong at 200% zoom, or a layout that breaks at a
width nobody tested. The screenshot harness covers the tested widths; the rest
still needs a browser and a real session.
