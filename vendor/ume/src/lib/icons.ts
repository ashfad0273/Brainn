/* Remix Icon is the app's one icon set, and this is the one place that names
   icons. Screens import `Icons.*` (what the icon means) rather than a Remix
   component (what it looks like), so swapping a glyph is a one-line change and
   the same idea never gets two pictures.

   - Line variants by default. The six nav items are the exception: they
     use the solid glyphs drawn for the sidebar (src/components/app/nav-icons.tsx).
   - Sizes: 16px inline (`size-4`), 18px in buttons and nav (`size-4.5`),
     20px in icon chips (`size-5`). Remix icons are filled paths, so there is
     no stroke width to tune.
   - An app maps its own names (categories, kinds) onto these keys, so the
     same idea keeps the same picture across apps. */

import {
  RiArchiveLine,
  type RemixiconComponentType,
  RiAddLine,
  RiAlertLine,
  RiArrowDownLine,
  RiArrowDownSFill,
  RiArrowDownSLine,
  RiArrowLeftDownLine,
  RiArrowLeftLine,
  RiArrowLeftRightLine,
  RiArrowLeftSLine,
  RiArrowRightDownLine,
  RiArrowRightLine,
  RiArrowRightSFill,
  RiArrowRightUpLine,
  RiArrowUpLine,
  RiArrowUpSLine,
  RiBankCardLine,
  RiBankLine,
  RiBriefcase4Line,
  RiBuilding2Line,
  RiCalendarLine,
  RiCalendarScheduleLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiCircleLine,
  RiCloseCircleLine,
  RiCloseLine,
  RiComputerLine,
  RiDatabase2Line,
  RiDeleteBin6Line,
  RiDownloadLine,
  RiEqualizerLine,
  RiExchangeDollarLine,
  RiErrorWarningLine,
  RiExpandUpDownLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiFocus3Line,
  RiHistoryLine,
  RiIndeterminateCircleLine,
  RiForbidLine,
  RiInbox2Line,
  RiInformationLine,
  RiKey2Line,
  RiLineChartLine,
  RiLoader4Line,
  RiLockLine,
  RiLogoutBoxRLine,
  RiMailLine,
  RiMenuLine,
  RiMoneyDollarCircleLine,
  RiMoonLine,
  RiMore2Line,
  RiMoreLine,
  RiPencilLine,
  RiPieChartLine,
  RiPriceTag3Line,
  RiPrinterLine,
  RiQuestionLine,
  RiReceiptLine,
  RiRepeatLine,
  RiResetLeftLine,
  RiSafe2Line,
  RiScales3Line,
  RiSearchLine,
  RiSendPlaneLine,
  RiSmartphoneLine,
  RiSparklingLine,
  RiStackLine,
  RiStickyNoteLine,
  RiSubtractLine,
  RiSunLine,
  RiTimeLine,
  RiUploadLine,
  RiUserAddLine,
  RiUserLine,
  RiUserUnfollowLine,
  RiWallet3Line,
} from "@remixicon/react"
import { applyOverrides } from "./icon-overrides"
import { AccountsIcon, OverviewIcon, PeopleIcon, SettingsIcon, SubscriptionsIcon, TransactionsIcon } from "./nav-icons"
import { AddCircleIcon, CalendarIcon, ChevronRightIcon, ClockIcon, FilterIcon, SortIcon } from "./figma-icons"

export type Icon = RemixiconComponentType

/* The originals, before any Icon Studio override (see icon-overrides.tsx). */
export const BaseIcons = {
  /* Pages: the designer's Squidx set (nav-icons.tsx), the same picture as
     the sidebar, used for chips, fields and empty states too. */
  overview: OverviewIcon as Icon,
  accounts: AccountsIcon as Icon,
  transactions: TransactionsIcon as Icon,
  people: PeopleIcon as Icon,
  subscriptions: SubscriptionsIcon as Icon,
  settings: SettingsIcon as Icon,

  /* Money. */
  income: RiArrowLeftDownLine,
  expense: RiArrowRightUpLine,
  transfer: RiArrowLeftRightLine,
  cash: RiWallet3Line,
  balance: RiBankLine,
  profit: RiLineChartLine,
  net: RiScales3Line,
  fixedCosts: RiStackLine,
  savings: RiSafe2Line,
  target: RiFocus3Line,
  trendUp: RiArrowRightUpLine,
  trendDown: RiArrowRightDownLine,
  up: RiArrowUpLine,
  down: RiArrowDownLine,
  breakdown: RiPieChartLine,
  receipt: RiReceiptLine,
  card: RiBankCardLine,
  recurring: RiRepeatLine,

  /* Field icons (leading slot of Input / Select / Combobox). */
  amount: RiMoneyDollarCircleLine,
  date: RiCalendarLine,
  schedule: RiCalendarScheduleLine,
  category: RiPriceTag3Line,
  client: RiBuilding2Line,
  person: RiUserLine,
  account: RiBankLine,
  notes: RiStickyNoteLine,
  search: RiSearchLine,
  email: RiMailLine,
  password: RiLockLine,
  time: RiTimeLine,
  role: RiBriefcase4Line,
  rate: RiExchangeDollarLine,

  /* Actions. */
  add: RiAddLine,
  remove: RiSubtractLine,
  edit: RiPencilLine,
  delete: RiDeleteBin6Line,
  close: RiCloseLine,
  check: RiCheckLine,
  more: RiMoreLine,
  moreVertical: RiMore2Line,
  filter: FilterIcon,
  adjust: RiEqualizerLine,
  sort: SortIcon,
  download: RiDownloadLine,
  upload: RiUploadLine,
  print: RiPrinterLine,
  send: RiSendPlaneLine,
  copy: RiFileCopyLine,
  external: RiExternalLinkLine,
  reset: RiResetLeftLine,
  /* Transactions are archived, never deleted (Remix for now; replace it in the Icon Studio). */
  archive: RiArchiveLine,
  history: RiHistoryLine,
  signOut: RiLogoutBoxRLine,
  menu: RiMenuLine,
  userAdd: RiUserAddLine,
  userRemove: RiUserUnfollowLine,

  /* Overview (Figma 67:1205): solid glyphs for the filter pill, the Add a
     transaction button and the card meta lines. */
  dateSolid: CalendarIcon,
  addSolid: AddCircleIcon,
  timeSolid: ClockIcon,

  /* Navigation chevrons. */
  chevronDown: RiArrowDownSLine,
  chevronUp: RiArrowUpSLine,
  chevronLeft: RiArrowLeftSLine,
  chevronRight: ChevronRightIcon,
  chevronsUpDown: RiExpandUpDownLine,
  /* Solid triangles for sections that open and close (Transactions months): right when closed, down when open. */
  caretRight: RiArrowRightSFill,
  caretDown: RiArrowDownSFill,
  arrowLeft: RiArrowLeftLine,
  arrowRight: RiArrowRightLine,

  /* Status. */
  info: RiInformationLine,
  help: RiQuestionLine,
  warning: RiAlertLine,
  alert: RiErrorWarningLine,
  error: RiCloseCircleLine,
  success: RiCheckboxCircleLine,
  neutral: RiCircleLine,
  minusCircle: RiIndeterminateCircleLine,
  blocked: RiForbidLine,
  loading: RiLoader4Line,
  empty: RiInbox2Line,
  sparkle: RiSparklingLine,

  /* Security and devices. */
  key: RiKey2Line,
  show: RiEyeLine,
  hide: RiEyeOffLine,
  backup: RiDatabase2Line,
  light: RiSunLine,
  dark: RiMoonLine,
  system: RiComputerLine,
  phone: RiSmartphoneLine,
} as const satisfies Record<string, Icon>

/* What screens use: the originals with the designer's Icon Studio swaps on top. */
export const Icons = applyOverrides(BaseIcons)

export type IconName = keyof typeof BaseIcons

export { nameHue, initials, type Hue } from "./hue"
