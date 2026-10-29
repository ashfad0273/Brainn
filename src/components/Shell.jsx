import { useState } from 'react';
import { ErrorBoundary } from '@ume/ui/components/session/ErrorBoundary';
import { Building2, Database, Hash, Search, ShieldCheck, Sparkles, User, Users } from '@/lib/icons';
import { useStore } from '../store';
import { Rail, BottomNav, GlobalSearch, ThemeButton, Mark, PAGES, hashPath, isOn, iconButton, tabPill } from './Rail';
import { hasServer } from '../lib/api';
import { cx } from '../lib/util';

/* Brainn's frame: the rail on a desktop, a title row and the bottom bar on a
   phone (see Rail.jsx), with the page in a centred column. Built here first,
   from Ume's tokens. Routes are hash paths: #/ (Dashboard), #/projects,
   #/files, #/calendar, #/settings/:tab. */

export { hashPath };

/** The Settings tabs a person can open: [key, label, icon]. Members only have their account. */
export function settingsTabs(member, auth) {
  if (member) return [['profile', 'Your account', User]];
  return [
    ['org', 'Organization', Building2], ...(hasServer() ? [['people', 'People', Users]] : []), ['templates', 'Templates', Hash],
    ['ai', 'AI', Sparkles], ['profile', auth ? 'Your account' : 'Profile', User], ['security', 'Security', ShieldCheck], ['data', 'Data', Database],
  ];
}

/* Phones: the mark, the page's name, search and the theme. */
function PhoneBar() {
  const { state } = useStore();
  const [search, setSearch] = useState(false);
  const path = hashPath();
  const page = PAGES.find(([href]) => isOn(href, path));
  return (
    <header className="flex items-center gap-3 px-4 pt-4 pb-3 lg:hidden">
      <a href="#/" aria-label="Dashboard" className="rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mark org={state.settings.org || {}} /></a>
      <h1 className="min-w-0 flex-1 truncate font-medium text-lg">{page?.[1] || 'Brainn'}</h1>
      {/* -me-2.5: the last icon's edge lines up with the page's edge below, not its 40px hit area. */}
      <div className="-me-2.5 flex items-center">
        {/* The Projects page has its own "Find a project" field, so no second search there. */}
        {!isOn('/projects', path) && <button type="button" onClick={() => setSearch(true)} aria-label="Search everything" title="Search everything" className={iconButton(false)}><Search aria-hidden /></button>}
        <ThemeButton />
      </div>
      {search && <GlobalSearch onClose={() => setSearch(false)} />}
    </header>
  );
}

/** Every page but a project: the rail (or the phone's bars), then the page in the centred column. */
export default function BrainShell({ children, wide }) {
  const path = hashPath();
  return (
    <div className="min-h-dvh bg-background text-foreground lg:flex">
      <Rail />
      <div className="min-w-0 flex-1">
        <PhoneBar />
        <main className={cx('mx-auto w-full px-4 pb-28 sm:px-6 lg:pt-8 lg:pb-12', wide ? 'max-w-6xl' : 'max-w-4xl')}>
          {/* One boundary per page, keyed by the path, so a broken page doesn't poison the others. */}
          <ErrorBoundary key={path}><div className="anim-fade">{children}</div></ErrorBoundary>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

/** A page in one card beside the rail, like an open project: its title, its tabs, then the page
    in a narrow column. `tabs` are [key, label, icon]; on a phone the title moves to the phone bar. */
const column = 'mx-auto w-full max-w-2xl px-4 sm:px-6';

export function CardShell({ title, subtitle, tabs, tab, onTab, children }) {
  const path = hashPath();
  return (
    <div className="flex h-dvh bg-background text-foreground">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:my-2 lg:me-2 lg:rounded-[20px] lg:border lg:border-border lg:bg-card lg:shadow-card">
        <PhoneBar />
        {/* The title, the tabs and the page share one column, so they line up. */}
        <header className="max-lg:hidden">
          <div className={cx(column, 'pt-8 pb-4')}>
            <h1 className="font-medium text-xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
          </div>
        </header>
        {tabs?.length > 1 && (
          <div className="border-b border-border">
            <nav aria-label={title} className={cx(column, 'flex gap-1 overflow-x-auto pb-3 [scrollbar-width:none] sm:-translate-x-3 [&::-webkit-scrollbar]:hidden')}>
              {tabs.map(([k, label, I]) => (
                <button key={k} type="button" onClick={() => onTab(k)} aria-current={tab === k ? 'page' : undefined} className={tabPill(tab === k)}><I aria-hidden />{label}</button>
              ))}
            </nav>
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto thin-scrollbar autohide-scrollbar">
          <div className={cx(column, 'pt-6 pb-28 lg:pt-8 lg:pb-12')}>
            <ErrorBoundary key={path}><div className="anim-fade">{children}</div></ErrorBoundary>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

/** A page's own row at the top of the page: its title (optional), its buttons, and a second row such as filters. */
export function PageHead({ title, subtitle, actions, children }) {
  return (
    <div className="mb-5 flex flex-col gap-3">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title && <div className="min-w-0"><h1 className="font-medium text-xl">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}</div>}
          {actions && <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** The card from the layout: a title row with an icon or action, a hairline (unless `quiet`), then the body. */
export function Panel({ title, icon: I, action, href, quiet, className, bodyClassName, children }) {
  return (
    <section className={cx('flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card', className)}>
      <header className={cx('flex items-center gap-3 px-5', quiet ? 'pt-4 pb-1' : 'border-b border-border py-4')}>
        <h2 className="min-w-0 flex-1 truncate font-medium">{href ? <a href={href} className="outline-none hover:underline focus-visible:underline">{title}</a> : title}</h2>
        {action}
        {I && <I aria-hidden className="size-5 shrink-0 text-icon-muted" />}
      </header>
      <div className={cx('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}
