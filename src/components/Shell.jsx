import { AppShell } from '@ume/ui/components/shell/AppShell';
import { ErrorBoundary } from '@ume/ui/components/session/ErrorBoundary';
import { useTheme } from '@ume/ui/hooks/use-theme';
import { Brain, Building2, Database, Files, Hash, Layers, Lock, Moon, Settings, ShieldCheck, Sparkles, Sun, User, Users } from '@/lib/icons';
import { useStore } from '../store';
import { useAuth } from './Auth';
import { hasServer } from '../lib/api';

/* Brainn inside Ume's app shell: the sidebar on desktop, the phone menu in each
   page's PageTopbar below lg. Routes are hash paths (#/, #/files,
   #/settings/:tab); the shell reads them as plain paths. Ume holds no data, so
   the nav, the account menu and the logo are built here from the store. */

export const hashPath = () => location.hash.replace(/^#/, '') || '/';

/** The Settings tabs a person can open: [key, label, icon]. Members only have their account. */
export function settingsTabs(member, auth) {
  if (member) return [['profile', 'Your account', User]];
  return [
    ['org', 'Organization', Building2], ...(hasServer() ? [['people', 'People', Users]] : []), ['templates', 'Templates', Hash],
    ['ai', 'AI', Sparkles], ['profile', auth ? 'Your account' : 'Profile', User], ['security', 'Security', ShieldCheck], ['data', 'Data', Database],
  ];
}

function Logo({ org }) {
  if (org.logo) return <img src={org.logo} alt="" className="size-8 shrink-0 rounded-full object-cover" />;
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full text-primary-foreground" style={{ background: org.color || 'var(--primary)' }}>
      <Brain className="size-4" />
    </span>
  );
}

/* The light / dark switch at the foot of the sidebar and the phone menu. */
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const I = theme === 'dark' ? Sun : Moon;
  return (
    <button type="button" onClick={toggle} className="flex items-center gap-2 text-text-secondary hover:text-foreground">
      <I className="size-4 text-icon-muted" />{theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

/** Home, Files and Settings. `onNewProject` puts the phone's + on the page. */
export default function BrainShell({ children, onNewProject }) {
  const { state, encrypted, lock, mode } = useStore();
  const auth = useAuth();
  const member = mode === 'member';
  const org = state.settings.org || {};
  const path = hashPath();

  const nav = [
    { path: '/', label: 'Projects', icon: Layers },
    { path: '/files', label: 'Files', icon: Files },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <AppShell
      nav={nav}
      currentPath={path}
      hrefFor={p => `#${p}`}
      logo={<Logo org={org} />}
      user={{ name: auth?.user?.name || auth?.user?.email || state.settings.ownerName || 'You', workspace: org.name || state.settings.workspaceName }}
      accountActions={encrypted ? [{ label: 'Lock workspace', icon: Lock, onSelect: lock, inPhoneMenu: true }] : []}
      onSignOut={auth?.signOut}
      themeSwitch={false}
      credit={<ThemeToggle />}
      phoneCredit={<ThemeToggle />}
      addAction={onNewProject && !member ? { label: 'New project', onSelect: onNewProject } : null}
      pageKey={'/' + (path.split('/')[1] || '')}
    >
      {/* One boundary per page, keyed by the path, so a broken page doesn't poison the others. */}
      <ErrorBoundary key={path}>{children}</ErrorBoundary>
    </AppShell>
  );
}
