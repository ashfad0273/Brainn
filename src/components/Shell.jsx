import { ErrorBoundary } from '@ume/ui/components/session/ErrorBoundary';
import { useTheme } from '@ume/ui/hooks/use-theme';
import { Building2, Calendar, Dashboard, Database, Files, Hash, Layers, Moon, Settings, ShieldCheck, Sparkles, Sun, User, Users } from '@/lib/icons';
import { useStore } from '../store';
import { hasServer } from '../lib/api';
import { cx } from '../lib/util';

/* Brainn's frame: a top bar (the mark, the pages in one pill, theme and Settings)
   over a centred column. Built here first, from Ume's tokens; it moves into Ume
   once it settles. Routes are hash paths: #/ (Dashboard), #/projects, #/files,
   #/calendar, #/settings/:tab. */

export const hashPath = () => location.hash.replace(/^#/, '') || '/';

/** The Settings tabs a person can open: [key, label, icon]. Members only have their account. */
export function settingsTabs(member, auth) {
  if (member) return [['profile', 'Your account', User]];
  return [
    ['org', 'Organization', Building2], ...(hasServer() ? [['people', 'People', Users]] : []), ['templates', 'Templates', Hash],
    ['ai', 'AI', Sparkles], ['profile', auth ? 'Your account' : 'Profile', User], ['security', 'Security', ShieldCheck], ['data', 'Data', Database],
  ];
}

const PAGES = [
  ['/', 'Dashboard', Dashboard],
  ['/projects', 'Projects', Layers],
  ['/files', 'Files', Files],
  ['/calendar', 'Calendar', Calendar],
];
const isOn = (page, path) => (page === '/' ? path === '/' : path === page || path.startsWith(page + '/'));

function Mark({ org }) {
  if (org.logo) return <img src={org.logo} alt="" className="size-10 shrink-0 rounded-xl object-cover" />;
  return <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground font-medium text-lg text-background">B</span>;
}

/* A round 40px icon button in the bar: muted at rest, the field grey on hover or while its page is open. */
const iconButton = on => cx('grid size-10 shrink-0 place-items-center rounded-full outline-none transition-[scale] duration-fast ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5',
  on ? 'bg-field text-foreground' : 'text-icon-muted hover:bg-field hover:text-foreground');

function TopBar() {
  const { state } = useStore();
  const { theme, toggle } = useTheme();
  const org = state.settings.org || {};
  const path = hashPath();
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5 sm:px-6">
      <a href="#/" aria-label={`${org.name || state.settings.workspaceName || 'Brainn'}: Dashboard`} className="justify-self-start rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Mark org={org} />
      </a>
      <nav aria-label="Pages" className="flex items-center gap-1">
        {PAGES.map(([href, label, I]) => {
          const on = isOn(href, path);
          // The open page is a pill with its name; the others are icons, named for screen readers and on hover.
          return on ? (
            <a key={href} href={`#${href}`} aria-current="page" className="flex h-10 items-center justify-center gap-2 rounded-full bg-field font-medium text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:w-10 sm:ps-3.5 sm:pe-4 [&_svg]:size-5">
              {/* phones: the icon alone, so the bar fits at 375px */}
              <I aria-hidden /><span className="max-sm:sr-only">{label}</span>
            </a>
          ) : (
            <a key={href} href={`#${href}`} aria-label={label} title={label} className={iconButton(false)}><I aria-hidden /></a>
          );
        })}
      </nav>
      <div className="flex items-center gap-1 justify-self-end">
        <button type="button" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} className={iconButton(false)}><ThemeIcon aria-hidden /></button>
        <a href="#/settings" aria-label="Settings" title="Settings" aria-current={isOn('/settings', path) ? 'page' : undefined} className={iconButton(isOn('/settings', path))}><Settings aria-hidden /></a>
      </div>
    </header>
  );
}

/** Every page but a project: the top bar, then the page in the centred column. */
export default function BrainShell({ children, wide }) {
  const path = hashPath();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopBar />
      <main className={cx('mx-auto w-full px-4 pb-12 sm:px-6', wide ? 'max-w-6xl' : 'max-w-4xl')}>
        {/* One boundary per page, keyed by the path, so a broken page doesn't poison the others. */}
        <ErrorBoundary key={path}><div className="anim-fade">{children}</div></ErrorBoundary>
      </main>
    </div>
  );
}

/** A page's own row under the top bar: its title (optional), its buttons, and a second row such as filters. */
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
