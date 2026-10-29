import { useState } from 'react';
import { ErrorBoundary } from '@ume/ui/components/session/ErrorBoundary';
import { Building2, Database, Hash, Search, ShieldCheck, Sparkles, User, Users } from '@/lib/icons';
import { useStore } from '../store';
import { Rail, BottomNav, GlobalSearch, ThemeButton, Mark, PAGES, hashPath, isOn, iconButton } from './Rail';
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
      <button type="button" onClick={() => setSearch(true)} aria-label="Search everything" title="Search everything" className={iconButton(false)}><Search aria-hidden /></button>
      <ThemeButton />
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

/** The card from the layout: a title row with an icon or action, a hairline, then the body. */
export function Panel({ title, icon: I, action, href, className, bodyClassName, children }) {
  return (
    <section className={cx('flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card', className)}>
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <h2 className="min-w-0 flex-1 truncate font-medium">{href ? <a href={href} className="outline-none hover:underline focus-visible:underline">{title}</a> : title}</h2>
        {action}
        {I && <I aria-hidden className="size-5 shrink-0 text-icon-muted" />}
      </header>
      <div className={cx('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}
