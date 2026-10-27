# Ume design standard

> Ume's design standard. It was written for Squidx Ledger, the first app built on Ume, so its examples name Ledger's pages (Overview, Accounts, Transactions). Paths under `packages/ui/` are Ume's; any other `src/` path is in the app's own repo.

This standard describes the **Vibrant** system: IBM Plex, no gradients (the approved sidebar aside), a cool grey scale, beUI blue and teal, a family of ten vivid hues, white cards with a soft shadow, Remix icons and snappy motion. "Alive" comes from colour and composition, never from slower animation; the motion budget in [conventions.md](./conventions.md) is unchanged and `npm run check` enforces it. Every block in section 4 is shown live on `/design-system` (the Vibrant showcase at the top, then "App building blocks").

## 1. Tokens

All colours live in `packages/ui/src/styles/ume.css` (OKLCH or hex, light and dark). No raw hex anywhere else.

**Brand**

| Token | Use for |
| --- | --- |
| `primary` (`bg-primary`, `text-primary-foreground`) | beUI blue: the primary action, focus, selection, progress |
| `primary-soft` / `primary-ink` | Tinted primary: `Button variant="soft"`, default badges, the active nav pill |
| `accent` | beUI teal. Brand accent only, never a hover fill |
| `focus-ring-brand` | A solid 2px `--primary` focus ring for the key CTA (`Button variant="brand"`). There are no gradients (check-conventions `no-gradient`) outside the approved sidebar (see Sidebar below): brand chips are solid `--primary` |

**Hue family.** `violet`, `blue`, `sky`, `teal`, `green`, `lime`, `amber`, `orange`, `rose`, `pink`. Four steps each:

| Step | Utility | Use for |
| --- | --- | --- |
| solid | `text-{hue}`, `bg-{hue}` | Icons in chips, bars, dots, swatches |
| soft | `bg-{hue}-soft` | Tinted surfaces: chips, badges, key cards |
| ink | `text-{hue}-ink` | Text on the soft surface (≥4.5:1 in both themes, checked) |
| ring | `border-{hue}-ring` | A hairline on the soft surface |

Read them through `HUE_CLASSES[hue]` (`packages/ui/src/lib/hue.ts`) so Tailwind sees each class literally; `hueVar(hue, step)` gives the CSS colour for inline styles and chart props. `--chart-1…10` are the same hues (blue, orange, teal, violet, green, sky, pink, lime, amber, rose).

Fixed hues per figure (`FIGURE_HUE`): cash and balance blue, profit and income green, expenses rose, fixed costs amber, net violet. Categories take their hue from `categoryHue()`; people and clients from `nameHue(name)`.

**Money and status**

| Token | Use for |
| --- | --- |
| `text-pos` / `text-neg` | Money in / out as text on a card (≥4.5:1) |
| `bg-pos-soft` + `text-pos-ink`, `bg-neg-soft` + `text-neg-ink`, `bg-warn-soft` + `text-warn-ink` | Delta pills, status pills, money callouts |
| `success` / `warning` / `destructive` | Aliases kept for older screens. Apply status through `Badge variant` or `StatusBadge`. Error text uses `text-destructive-foreground` |

**Greys.** `--grey-25` … `--grey-950` (OKLCH, hue 281.3, slightly cool) in `:root`, also exposed as `bg-grey-*` / `text-grey-*` / `border-grey-*`. They are the raw material: every neutral token below is a step or a `color-mix()` of them, and app code uses the semantic tokens.

| Token | Light | Dark |
| --- | --- | --- |
| `background` | white 65% + grey-25 | grey-950 |
| `card`, `popover` | white | grey-900 |
| `muted`, `secondary` | white 40% + grey-25 | grey-900 50% + grey-800 |
| `border` | grey-100 at 45% | grey-800 |
| `border-strong`, `input` | grey-200 | grey-700 |
| `foreground` | neutral-11 (#1c1c1c, the designer's text colour) | grey-25 |
| `muted-foreground`, `chart-axis`, placeholder | grey-500 (≥4.6:1 on card, page and muted) | grey-300 (grey-400 falls under 4.5:1 on the card) |
| `chart-grid` | grey-100 at 40% | grey-800 at 70% |

**Neutral greys.** `--neutral-11`, `-22`, `-32`, `-42`, `-52`, `-62`, `-72`, `-82`, `-92`: pure neutrals from the Figma sidebar, each `hsl(0 0% L%)` named by its lightness, plus `--green-success` (#01b468). Theme-independent primitives, like the grey scale; they have no utilities of their own (`bg-(--neutral-11)` when a primitive is genuinely needed, as in `SquidxLogo`).

**Text, icon and sidebar tokens.** The Figma code-syntax names, registered as Tailwind colours. Steps are neutral-* unless named.

| Token | Utility | Light | Dark | Use for |
| --- | --- | --- | --- | --- |
| `--text-secondary` | `text-text-secondary` | 52 | 62 | Unselected nav, the workspace name, the credit line (3.46:1 on the light sidebar: held at 3:1 by decision) |
| `--text-tertiary` | `text-text-tertiary` | 62 | 52 | Quieter meta |
| `--text-disabled` | `text-text-disabled` | 72 | 32 | Disabled text |
| `--icon-default` | `text-icon-default` | 11 | 92 | The selected nav icon and bar |
| `--icon-secondary` | `text-icon-secondary` | 52 | 72 | Icon hover |
| `--icon-muted` | `text-icon-muted` | 62 | 52 | Unselected nav icons, the empty sync dot |
| `--icon-disabled` | `text-icon-disabled` | 82 | 32 | Disabled icons |
| `--icon-primary` / `--icon-on-primary` | `text-icon-primary` / `text-icon-on-primary` | `--primary` / white | same | Brand icons / icons on a primary fill |
| `--icon-success` / `--icon-warning` / `--icon-danger` | `text-icon-*`, `bg-icon-*` | green-success / `--amber` / `--rose` | the same tokens (their lighter dark steps) | Status icons and dots (the Last sync pill) |
| `--sidebar` | `bg-sidebar` | `--background` | `--muted` | The desktop sidebar surface |
| `--sidebar-active` | `bg-sidebar-active` | 92 | grey-800 | The selected row's surface |
| `--sidebar-border` | `border-sidebar-border` | 92 | grey-800 | The sidebar's right edge |

**Sidebar.** `Sidebar.tsx`, built to the approved Figma frame (node 30:1537): 220px (`w-55`), sticky, `h-dvh`, `bg-sidebar` with an inset `--sidebar-border` right edge. The header (`SquidxLogo`, display name, workspace) is the account menu trigger: profile, password, theme and sign out. Six 42px nav rows with the solid glyphs from `nav-icons.tsx`; the selected row sits on a `--sidebar-active` surface that fades to the right, with a 1px bar on the left. At the foot, the Last sync pill (`SyncPill.tsx`: green under 1 day, amber from 1 to 3 days, rose after 3, from the newest entry created or edited) and the credit row. The selected-row fade and the logo star are the only gradients in the app: those two files are check-conventions' `GRADIENT_ALLOWLIST`.

**Surfaces**

| Token | Use for |
| --- | --- |
| `bg-background` | Page and shell (near-white / grey-950) |
| `bg-card` + `border-border` + `shadow-card` | In-flow cards, through `panel*` (white / grey-900) |
| `panelTint(hue)` | A key card tinted in one hue. One or two per screen |
| `bg-muted` | Hover fills and tracks. Never a whole panel |
| `bg-field` / `bg-field-hover` | Quiet controls (§4): `--track` at 55% / 85%, a shade darker than the page and than a white card, in both themes. The fill of a quiet field, picker, secondary button, segmented track, `CountBadge` and small tags; `bg-field-hover` is hover inside a white surface |
| `glass` | Every floating surface |
| `border-border` / `divide-border` | Every hairline. The token already carries its alpha |
| `text-foreground` / `text-muted-foreground` | Titles, labels and values / meta only (dates, help lines, table headers) |

**Banned in app code:**
- `text-destructive` on money
- `lucide-react` (use `Icons.*` from `packages/ui/src/lib/icons.ts`)
- Grey-on-grey panels (`bg-muted` cards); use a white `panel` or `panelTint(hue)`
- Muted card titles and labels; titles are `text-foreground`
- `border-border/60` and `divide-border/40|60`
- Opacity on text
- Arbitrary alphas (`bg-foreground/[0.06]`, `bg-destructive/[0.03]`)
- Badge colours set through `className`
- `duration-150` or `duration-[Nms]`. Use `duration-fast` or `duration-base`
- `rounded-[Npx]`
- `!` modifiers

**Light and dark in Figma.** The Figma file (WviZLRJiNXNINqs00CkOuU) mirrors these tokens as variables: "Primitives" is the palette with one mode, and "Color" holds every semantic token with a Light and a Dark mode, its code syntax set to the CSS variable. Each screen is one frame bound to "Color" variables; set the frame's Color mode to Dark to see it dark. Never draw a separate dark copy, and never use a raw colour where a variable exists. The card shadow is one effect style, "Shadow/Card", whose colours and blur come from mode-aware `shadow/card/*` variables, so it follows the mode too.

## 2. Type scale

IBM Plex everywhere, self-hosted: Plex Sans Variable (`@fontsource-variable/ibm-plex-sans`, wght axis) for `font-sans` and `font-heading`, Plex Mono (`@fontsource/ibm-plex-mono`, 500 and 400) for `font-mono` and the Label Mono style. Every number is tabular: `html` sets `tabular-nums` (§6). Labels are foreground; muted is for meta only. Figma is the source of truth for the text styles below.

**Scale.** Body is 15px and 13px is the floor; `text-2xs` no longer exists. Each token carries its Figma letter spacing (`--text-*--letter-spacing`), so headings and figures need no `tracking-*` class.

| Token | Figma style | px / line-height | Tracking | Use |
| --- | --- | --- | --- | --- |
| `text-label-mono` | Label Mono | 13 / 18 | +1% | Plex Mono 500, uppercase, for small labels only: bottom-tab labels, stat card deltas and footers, list row meta, card heading subtitles, table headers, menu group labels, short captions |
| `text-xs` | Label | 13 / 18 | 0 | Plex Sans for user data and prose: names, emails, notes, helper and error text, toasts, the sync pill (the floor). With `font-medium`: segmented options, counts (`CountBadge`), badges and tags, avatar initials |
| `text-sm` | Body | 15 / 22 | -1% | Body, inputs, buttons, table cells, nav (the default; `body` is set to it) |
| `text-base` | Body | 15 / 22 | -1% | Same as `text-sm`; prefer `text-sm` |
| `text-lg` | Title | 17 / 24 | -1.25% | Card titles (`eyebrow`, `Section`), emphasised text |
| `text-xl` | Heading | 20 / 28 | -1.5% | Section headings |
| `text-2xl` | Page title | 24 / 30 | -2.5% | Page titles |
| `text-3xl` / `text-figure` | Figure 30 | 30 / 36 | -2.5% | Large figures |
| `text-4xl` | Figure 36 | 36 / 40 | -2.5% | Key figures |
| `text-hero` | Figure 44 | 44 / 48 | -2.5% | The hero figure |

**Label Mono vs Label.** In Figma, `Label/*` is Plex Sans 13/18 (`text-xs` in code) and `Label Mono/*` is the uppercase mono style (`text-label-mono`). `text-label-mono` sets the family, weight, size, tracking and case itself, so it never sits next to a `font-*` class. Never uppercase user data or prose — those keep `text-xs`.

**Less mono (Oct 2026).** Plex Mono is for small labels only. Segmented options, counts, badges, tags and avatar initials are Plex Sans Medium in normal case (`font-medium text-xs`; initials `text-sm`). `SegmentedControl` and `CountBadge` follow it; `Badge` and `InitialsAvatar` `sm`/`md` still draw Label Mono until they move over, so a Settings tag or avatar passes the Sans classes itself.

**Line length and balance.** How many words sit on a line is part of the type, not left to the browser.
- Centred copy (empty states, error pages, dialogs' lead lines): at most **40 characters** a line (`max-w-[40ch]`) and `text-balance`, so a two-line sentence splits into two near-equal lines instead of a long line over a short one. Centred titles take `text-balance` too.
- Left-aligned paragraphs (settings help, descriptions): 45–75 characters a line (`max-w-[60ch]` or the column), and `text-pretty`, which keeps a last word from sitting alone without reshaping the paragraph.
- Never `text-pretty` on centred copy: it only fixes the last line, so the first line runs long.
- Two lines are the most a centred line of help should need; if balancing still gives three, cut words before widening the measure.

**Weights.** Only Regular (`font-normal`, 400) and Medium (`font-medium`, 500); Semibold and Bold are gone, and `font-weight` in check-conventions enforces it.
- Medium: titles, card headings, buttons, the active nav item, figures and amounts, form labels, emphasised names in rows (Labels are Medium by definition).
- Regular: body, secondary text, tooltips, chart ticks.
- No more than one medium element per line of a row, apart from the amount.

| Role | Classes |
| --- | --- |
| Page title (AppShell only) | `font-heading font-medium text-xl sm:text-2xl leading-none` |
| Page subtitle (AppShell) | `text-xs text-muted-foreground` |
| Toolbar count line | `text-label-mono text-muted-foreground` |
| Section h2 / h3 | `font-heading font-medium text-xl` / `font-medium text-lg` |
| Card title + description | `font-medium text-lg text-foreground` (`eyebrow`) + `mt-1 text-xs text-muted-foreground` |
| Card label / sub-label | `eyebrow` / `eyebrowSub` (`text-label-mono`) from `surface.ts` |
| Big figure | `font-heading font-medium text-figure sm:text-4xl leading-none tabular-nums` |
| Lead sentence | `font-heading font-normal text-2xl leading-snug` |
| Body / meta | `text-sm` / `text-label-mono text-muted-foreground` |
| Table header / cell | `app/ledger/DataTable.tsx`: headers in `text-label-mono`, cells in `text-sm`; money in `AmountText` (`app/ledger/parts.tsx`) |
| Badge | `<Badge variant dot>` (`text-label-mono`); `size="sm"` is shorter, same 13px text |
| Button | `<Button>`, including `variant="link"` / `"ghost"`. Never a hand-styled `<button>` |

## 3. Spacing & layout

**Page and section layout**
- **Page frame:** owned by `AppShell`. That covers the main area (`px-4 py-6 lg:px-6`), the header (`px-4 py-3`) and the width (`max-w-[120rem]`).
- **Page stack:** `flex flex-col gap-6` (24px between sections), with the order toolbar → tiles → table → charts. No `mb-*` or `pt-*` spacers.
- **Density:** fewer, fuller cards. No card should feel empty: pair a figure with its chip, delta and sparkline rather than leaving white space. Align figures on a grid.
- **Card grids:** `gap-4`, tile grids included.

**Cards**
- **Card padding:**
  - `panel` (`p-5`, 20px) for content and stat cards.
  - `panelFlush` around a table or list.
  - `panelCompact` (`p-4`) only for nested tiles or cells.
- **Card internals:**
  - Header → body: `mb-4`.
  - Chip + label → figure: `mt-4`; figure → meta: `mt-2`.
  - Footer: `mt-4 border-t pt-4 text-xs text-muted-foreground`.
  - Flush strip header: `border-b px-4 py-3`.

**Forms and tables**
- **Forms:** body `gap-4`. Use `Field` (it supplies `gap-1.5`) and `FieldError`.
- **Settings rows:** `SettingsRow`, `py-4` with a hairline between rows. A compact control (switch, segmented control, picker, button) stays beside the label on phones too; a field is `w-full sm:w-44` (a short email field `sm:w-60`) and takes its own line on phones.
- **Tables:**
  - Toolbar: `flex flex-wrap items-center gap-2 border-b p-3`.
  - Cells: first `ps-4`, last `pe-4`.
  - Pagination: `border-t p-3`.
  - Phone rows: `ListRow` (`min-h-16 gap-3 px-4 py-3`), led by a 36px `IconChip` / `CategoryChip` / `InitialsAvatar`.
  - Switch at 768px of container width.

**Controls, radii and widths**
- **Controls:** buttons `h-7` / `h-8` / `h-9` (sm 28 / md 32 / lg 36px), icon buttons `size-9`; fields `h-11` (sm `h-8`, lg `h-12`) with a `leadingIcon`.
- **Radii:**
  - `2xl` (20px): cards and dialogs.
  - `xl` (12px): inputs, nav items, 36px chips.
  - `pop` (16px): menus, choice menus, select lists and the date popover; their rows are `pop-row` (9px, §6).
  - `full`: buttons, badges and pills.
  - `lg`: skeletons and calendar cells.
  - `sm` / `md`: swatches only.
- **Max widths:**
  - Prose: `max-w-prose`.
  - Lead sentence: `max-w-4xl`.
  - Settings: `max-w-5xl`.
  - Dialogs: `max-w-md`, or `max-w-sm` for small dialogs.
  - Auth: `max-w-sm`.
  - Print summary: `max-w-3xl`.

## 4. Component structure

All paths are under `src/components/`. Import from the path shown; screens never hand-roll what one of these already does.

**Page and section layout**

| Block | Path | When to use / props |
| --- | --- | --- |
| Page title | `app/AppShell.tsx` (`PageHeading`) | The only h1. Pages never repeat it |
| Surfaces | `app/surface.ts` | `panel`, `panelCompact`, `panelFlush`, `panelTint(hue)`, `eyebrow`, `eyebrowSub` |
| `IconChip` | `app/IconChip.tsx` | The coloured square. `icon` (an `Icons.*` component or element), `hue` (a hue, `"brand"` or `"neutral"`), `size` (`sm` 28px, `md` 36px, `lg` 48px) |
| `InitialsAvatar` | `app/IconChip.tsx` | People and clients. `name`, `hue` (defaults to `nameHue(name)`), `size`, `shape` (`circle` for people, `square` for companies) |
| `CategoryChip`, `useCategoryHue` | `app/CategoryDot.tsx` | A category's icon in its hue (agrees with `CategoryDot` and the charts). `category`, `size` |
| `PageToolbar` | `app/PageToolbar.tsx` | Top row of a list page. `count` (a loading line until `ready`), `actions`, `note`, `noteId` |
| `Section`, `SectionFooter` | `app/Section.tsx` | A titled `panel`. `title`, `description`, `action` (ghost buttons), `icon` + `hue` (28px chip), `as` (`h2`/`h3`), `id`. `SectionFooter` is the `mt-4 border-t pt-4` strip |
| `SettingsSection`, `SettingsRow`, `SettingsRows` | `app/SettingsRow.tsx` | A section: `title` (Title, 17px), `count`, a one-line `description`, `action`. One setting: `label`, `htmlFor` or `labelId`, `help` (+ `helpId`), `leading` (an icon tile), the control as children. Wrap rows in `SettingsRows` |
| `CardHeading` | `app/CardHeading.tsx` | Chart and content card header. `label`, `sub`, `tip` or `term`, `icon` + `hue`, `action`, `id` |
| `AuthLayout`, `BrandMark` | `app/AuthLayout.tsx` | Signed-out pages. `title`, `description`, `footer`, form as children. `BrandMark size="sm" \| "lg"` everywhere the monogram appears |
| Empty | `app/EmptyState.tsx` | 48px chip (or a Hairline `illustration`), then `title` (Title, 17px), `description` (Body, balanced, ≤ 40ch), one `action`; 24 / 8 / 24px between them. `icon` (defaults to `Icons.empty`), `hue` (defaults to `"brand"`) |
| Loading | `app/LoadingRows.tsx` | `LoadingRows`, `LoadingPanels`, gated on `ready` |

**Data tables**

| Block | Path | When to use / props |
| --- | --- | --- |
| `TableToolbar`, `TableSearch` | `app/TableToolbar.tsx` | Strip above a table. `search`, `filters`, `count` (pluralised, `undefined` while loading), `noun`, `nounPlural`, `end`. `TableSearch`: `label`, `placeholder`, `value`, `onChange` |
| `TablePagination` | `app/TablePagination.tsx` | `page` (1-based), `pageSize`, `total`, `onPageChange`, `compact` (no page numbers on phones). Renders nothing for one page |
| `ListRow` | `app/ListRow.tsx` | Row inside `<ul className="divide-y divide-border">`. The body is a real `<button>`. `leading` (a `CategoryChip` / `InitialsAvatar`) or `icon` + `hue`, `tone`, `title`, `meta`, `trailing` (amount in `text-pos`/`text-neg`), `label` (accessible name), `onClick`, `actions`, `expanded`, children (the expanded strip) |
| Table parts | `app/table-parts.tsx` | `SortableHead`, `RowActionsMenu({label, actions})`, `EntrySheet`, `ScheduledTag` |

**Shared primitives**

| Block | Path | When to use / props |
| --- | --- | --- |
| `ConfirmDialog` | `app/ConfirmDialog.tsx` | Every "are you sure?". `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `cancelLabel`, `onConfirm`, `pending`, `tone` (`destructive` default, or `default`) |
| `StatusBadge` | `app/StatusBadge.tsx` | Soft pill + ink + dot. `status`, optional `children` (label override), `icon`, `dot` (default on), `size`. One map: active / paid / success → success; paused / cancelled / inactive / past → secondary; overdue / failed / failure → error; pending / scheduled → warning; anything else → outline |
| `DetailList` | `app/DetailList.tsx` | Label/value pairs in a sheet. `items: {label, value, hidden?}[]`; empty values show "—" |
| Form dialog | `app/ResponsiveDialog.tsx` + `dialogs/form-parts.tsx` | `title`, `description`, `dirty`, `onSubmit`, `submitLabel`, `pending`, `footerStart`, `size`. Use `useFormValues` and `FieldError` with it |
| `Badge` | `ui/badge.tsx` | `variant` (`default`, `success`, `warning`, `error`, `info`, `secondary`, `outline`), `dot`, `hue` (any hue), `size` |
| `Button` | `ui/button.tsx` | `variant`: `default` (solid blue), `brand` (solid primary focus ring, one per screen), `soft`, `secondary`/`outline` (card + hairline), `quiet` (field grey, see below), `ghost`, `destructive` (rose), `destructive-soft` (soft red fill, red text and icon), `destructive-outline`, `link`. `size`: `default` 40px, `sm`, `lg`, `icon` 36px, `icon-sm`, `icon-lg` |
| Fields | `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx`, `ui/combobox.tsx`, `ui/autocomplete.tsx` | 44px, card background, primary focus ring. `leadingIcon={Icons.amount}` on `Input`, `Textarea`, `SelectTrigger`, `SelectButton`, `ComboboxInput`, `AutocompleteInput`. `variant="quiet"` on `Input`, `SelectTrigger` and `SelectButton` for Settings (below) |
| `Switch` | `ui/switch.tsx` | 36×20, no border in either state: `bg-track` off, `bg-primary` on, a white 16px thumb with a small shadow. Spring and squish, off under reduced motion |
| `SegmentedControl` | `ui/segmented-control.tsx` | A radio group: 32px `bg-field` track, 28px options (`min-w-14`) in Plex Sans 13 Medium, the picked one `bg-card text-text-figure shadow-button` with no border. Fills its container with equal columns; `fit` hugs the labels (a settings row) |
| `CountBadge`, `RowIconButton` | `app/ledger/parts.tsx` | The count beside a heading: a Plex Sans pill on `bg-field`, no border or shadow. A row's 28px icon button: muted, white with a hairline on hover; `destructive` is the red-ink icon with `hover:bg-neg-soft` and no fill at rest |

**Quiet controls (Settings, Oct 2026).** Controls on the grey page carry no outline at rest, so nothing looks selected until it is touched.
- **At rest:** `bg-field`, 32px (`h-8`), `rounded-md`, values in Plex Sans Medium 15. `Input variant="quiet"` (`addonStart` / `addonEnd` for "৳" and "%"), `SelectTrigger` / `SelectButton variant="quiet"` (hugs its value, a muted chevron-down, opens the choice menu), `Button variant="quiet"`.
- **Hover on the grey page turns white:** `bg-card` + `shadow-[0_0_0_1px_var(--border-subtle),var(--button-shadow)]`, and the same while a picker's menu is open. Inside a white surface (side panel, menu, toast) hover stays grey (`bg-field-hover` or `bg-input-filled`).
- **Field focus:** `bg-card`, an inset 1px `--border-strong` line and a 3px halo of `--ring` at 16%. Invalid: an inset 1px `--destructive` line.
- **Destructive:** an icon-only one is the red-ink icon, no fill at rest, `hover:bg-neg-soft` (`RowIconButton destructive`); a text one is `Button variant="destructive-soft"`.
- **Words:** a section has a Title heading and one short description line. Help under a row is one line. When unsure, write less.
| Toast | `lib/toast.ts` | `notify.success`, `.error`, `.errorRetry`, `.undo`. Pass errors through `describeError()` |

**Icons and hues** (`src/lib`)

| Helper | Path | Output |
| --- | --- | --- |
| `Icons.*` | `lib/icons.ts` | Semantic Remix icons: pages (`overview`, `accounts`, `transactions`, `people`, `subscriptions`, `settings`), money (`income`, `expense`, `transfer`, `cash`, `balance`, `profit`, `net`, `fixedCosts`, …), fields (`amount`, `date`, `category`, `client`, `person`, `account`, `notes`, `search`, `email`, `password`), actions, chevrons and status. 16px inline, 18px in buttons and nav, 20px in chips |
| `NavIcons.*` | `lib/icons.ts` | `{ line, fill }` per page: line at rest, fill when active |
| `categoryIcon(name)` | the app (Ledger: `src/lib/category-icon.ts`) | Salaries team, Rent home, Subscriptions repeat, Equipment computer, Marketing megaphone, Client Payment hand-coin, Retainer calendar-check, Template Sales shopping bag, Misc shapes, Transfer arrows; anything else a price tag |
| `categoryHue(table, name)` | the app (Ledger: `src/lib/categoryColor.ts`) | The category's hue (null for Transfer). In components use `useCategoryHue()` or `CategoryChip` |
| `nameHue(name)`, `initials(name)` | `lib/hue.ts` | A stable hue per name (never rose); "PL" for "Psycle London" |
| `HUE_CLASSES`, `hueVar`, `FIGURE_HUE` | `lib/hue.ts` | Literal classes per hue step; `var(--teal-soft)`; the fixed hue per key figure |

**Formatting helpers** (`src/lib`)

| Helper | Path | Output |
| --- | --- | --- |
| `taka(n)`, `takaShort(n)` | `lib/money.ts` | "৳1,20,000"; "৳1.2L" on axes and pills |
| `takaSigned(n)` | `lib/money.ts` | "+৳1,200", "−৳1,200" (U+2212), no sign for zero. `MINUS` and `signFor(n)` are exported too |
| `fmtDate` | `lib/format.ts` | "Oct 2, 2026" |
| `fmtDateTime` | `lib/format.ts` | "Oct 2, 2026, 3:00 AM", never seconds |
| `fmtMonth(date, "short" \| "long")` | `lib/format.ts` | "Oct" / "October 2026". Takes a `Date`, "YYYY-MM" or "YYYY-MM-DD" |
| `count(n, one, other)` | `lib/format.ts` | Whole templated strings: "3 entries" |
| `plural(n, one, other?)` | `lib/format.ts` | "1 result", "1,200 results" |

`cn()` in `lib/utils.ts` knows the custom type sizes (`text-figure`, `text-hero`), so `cn("text-figure", "text-pos")` keeps both.

## 5. UX & copy voice

**Rules**
- Sentence case and verb-first buttons, as already set out in `copy-guide.md`.
- **Toast titles:** a past-tense fact with no period ("Account added"). An optional description is a full sentence.
- **Errors:** "Couldn't {verb} {thing}", plus what to do next. Never show raw backend text, file names, storage keys, table or field names.
- **Empty states:** say what's missing and offer one action. For a search, suggest what to try instead of "will appear here".
- **One word per concept:**
  - "Sign out", not "Log out".
  - "Clear filters", not "Reset filters".
  - "Recurring" or "Repeats": choose one.
  - "Spent", not "Spend".
- **Numbers:**
  - Money goes through `taka()`, with `takaShort()` on axes. An app that stores another currency converts to taka first (Ledger: `money.fmt` in its `src/lib/currency.ts`).
  - Signs use `+` / `−` (U+2212) from `takaSigned()`.
  - A record saved in another currency shows its original under the taka figure ("$1,200 USD"), only when it differs.
  - Use `count()` or `plural()` for every counted noun.
  - Percentages are rounded.
  - Use `—` for empty cells and "/month" muted after monthly amounts.
- **Dates:**
  - Use `fmtDate` ("Oct 2, 2026").
  - Date-times have no seconds (`fmtDateTime`). Month labels use `fmtMonth`.
  - Use relative time for "last used".
  - Never hard-code `"en-US"`.
  - Calendars start on Monday.

| # | Before (real string) | After |
| --- | --- | --- |
| 1 | `Log out` | `Sign out` |
| 2 | `{n} results` | `count(n, "{n} result", "{n} results")` |
| 3 | `Accounts whose name, owner or currency match your search will appear here.` | `Try a different name, owner or currency.` |
| 4 | `Assign a person to expenses that never captured one · 12 pending` | `Choose who each salary was paid to · 12 left` |
| 5 | `Income history is kept and shows as a legacy row.` / badge `Legacy` | `Their past income stays in your records.` / `Past client` |
| 6 | `The monthly email function isn't deployed yet` + `Follow … in RUNBOOK.md` | `Monthly email isn't set up yet` + `Ask whoever manages this workspace to finish setup.` |
| 7 | `last run success at Oct 2, 2026, 3:00:12 AM` | `Last backup finished Oct 2 at 3:00 AM` |
| 8 | `sb-…-auth-token · localStorage · Your sign-in token.` | `Sign-in · Keeps you signed in on this browser until you sign out.` |
| 9 | `Invalid email or password.` | `That email and password don't match. Try again or reset your password.` |
| 10 | `Couldn't remove that passkey.` | `Couldn't remove passkey` + `Check your connection and try again.` |
| 11 | `income +$1200 · Rent · changed: monthly_salary` | `Income +$1,200 · Rent` / `Changed salary` |
| 12 | `Couldn't record audit event` | `Couldn't add this to the activity log` |

## 6. Craft rules

The eleven published rules from [Craft](https://craft.gustavofior.com),
built into Ume so no app has to remember them (Oct 2026). Each is held by a
check in `pnpm check` where a script can see it; [conventions.md](./conventions.md)
lists the checks.

**Tabular numbers.** Digits keep one width so changing values hold still and
columns line up. Plex Sans only ships tabular digits; `html` still sets
`font-variant-numeric: tabular-nums`, so the fallback font (while Plex loads)
and any later face behave the same. Numeric table columns align to the end
edge: `LedgerColumn` takes `numeric`, and `LedgerHead` / `LedgerCell` take
it too. Money, counts, hours and rates are numeric.

**Optical alignment.** The side of a button that holds an icon takes 2px
less padding than the text side (sm 10 / 8, md 12 / 10, lg 16 / 14), because
the icon's own air adds to it; `Button` does this by itself. A quote's
opening mark hangs outside the text edge (`blockquote`, in `ume.css`). A
nudge for one icon's shape (a play triangle) is made once, in its Icon
Studio override, never with a transform at the call site.

**Font smoothing.** `antialiased` on `html`: macOS otherwise draws every
weight heavier, most of all light text on dark. Ume uses only 400 and 500, so
nothing is thin enough to break on a 1x screen.

**Noise.** Grain comes from `ChartNoise` and nowhere else. It is a live SVG
filter, which is fine on chart-sized surfaces; grain over a large or moving
surface is a tiled image (an SVG data URI) instead.

**Image outlines.** Every `img` and `video`, and `InitialsAvatar`, carries a
1px line drawn over its outermost pixels (`outline` with `-1px` offset, the
`image-outline` utility): black at 10% in light, white at 10% in dark
(`--image-outline`). It gives a pale photo or a pale avatar a shape without
taking space. `IconChip` doesn't take it: it is an icon on a tint.

**Nested border radius.** A surface inside another takes the outer radius
minus the inset between their edges, the border included: outer = inner +
inset. Menus, choice menus and select lists are 16px (`rounded-pop`) with
1px border and 6px padding, so their rows are 9px (`rounded-pop-row`). The
toast is 20px with 1px + 12px, so its icon chip is 7px
(`rounded-toast-chip`). Dialog, sheet and drawer footers already follow the
card (`radius-2xl − 1px`), and a pill in a pill is concentric by shape. Each
inner radius is a token written as `calc(outer − inset)` in `ume.css`. The
rule is for an inner surface that follows the corner: the date popover's day
cells are a grid, so they are tuned by eye.

**HTML background.** `html` is painted with `bg-background`, the same token
as the app, so an overscroll never shows the browser's white and the canvas
follows the theme. The platform bounce stays (no `overscroll-behavior` on
the page); `ScrollArea` already stops inner scroll chaining. `useTheme` keeps
`theme-color` in sync from the token; the hard-coded first-paint colours
equal `--background` in each theme (light `#f7f7f7`, dark `#070709`).

**Scroll fades.** A scroll container fades the edge that has more content
past it, and only that edge: at the top there is no fade above the first
row. `ScrollArea` does it by default (`scrollFade`, the `scroll-area-fade`
utility), sized from Base UI's `--scroll-area-overflow-*`, so each fade
grows from 0 to 40px as you leave its edge, in every browser; the mask sits
on the viewport, so the scrollbar doesn't fade. A plain overflow row of
chips or tabs takes `scroll-fade-x` (or `-y`), driven by a scroll timeline,
with its scrollbar hidden; where scroll timelines aren't supported nothing
fades. These masks are the one exception to no gradients: a mask paints no
colour, so its stops are only transparent and black, and it lives in
`ume.css` only.

**Button press.** A control presses to 0.97 (`PRESS_SCALE`) on
`SPRING_PRESS`, which settles in `fast` (about 120ms); a large surface (a
row, a card) to 0.99 (`PRESS_SCALE_SURFACE`). A disabled control doesn't
press. One source per element: a Motion button presses through `whileTap`,
anything else through the `active:scale` class, never both (the two
multiplied to 0.92 before Oct 2026).

**Interruptibility.** Anything a person can toggle animates toward a
destination (a CSS transition, Base UI's starting and ending styles, a
Motion spring), so it turns around mid-flight. Keyframes are only for loops,
one-shots nothing can interrupt, and scroll-driven effects. Nothing drops
input while it moves.

**Hover restraint.** Hover and keyboard highlights switch on instantly: no
colour fade, no sliding highlight between menu rows, and nothing grows.
Press, open and close keep their motion. Tooltips (`ui/tooltip.tsx`) wait
`TOOLTIP_DELAY_MS` (500ms) before the first one, then open their neighbours
at once and close instantly; wrap a toolbar or the app in one
`TooltipProvider` so they share it. A tooltip is never the only name of a
control.
