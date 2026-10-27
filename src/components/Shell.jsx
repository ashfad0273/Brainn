import { AppShell } from '@ume/ui/components/shell/AppShell';
import { ErrorBoundary } from '@ume/ui/components/session/ErrorBoundary';
import { Brain, Files, FolderPlus, Layers, Lock, Settings, Sparkles } from '@/lib/icons';
import { useStore } from '../store';
import { useAuth } from './Auth';
import { aiOn, aiName } from '../lib/brain';
import { cx } from '../lib/util';

/* Brainn inside Ume's app shell: the sidebar on desktop, the phone menu in each
   page's PageTopbar below lg. Routes are hash paths (#/, #/s/:space, #/files);
   the shell reads them as plain paths. Ume holds no data, so the nav, the
   account menu and the logo are built here from the store. */

export const hashPath = () => location.hash.replace(/^#/, '') || '/';

// Projects is a parent whose children are All projects and each space.
const isActive = (path, current) => {
  if (path === '/projects') return current === '/' || current.startsWith('/s/');
  if (path === '/') return current === '/';
  return current === path || current.startsWith(path + '/');
};

function Logo({ org }) {
  if (org.logo) return <img src={org.logo} alt="" className="size-8 shrink-0 rounded-full object-cover" />;
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full text-primary-foreground" style={{ background: org.color || 'var(--primary)' }}>
      <Brain className="size-4" />
    </span>
  );
}

/** Home and Files: `onSettings(tab)` opens Settings, `onNewSpace` and `onNewProject` the page's own dialogs. */
export default function BrainShell({ children, onSettings, onNewSpace, onNewProject }) {
  const { state, encrypted, lock, mode } = useStore();
  const auth = useAuth();
  const member = mode === 'member';
  const org = state.settings.org || {};
  const path = hashPath();
  const gem = aiOn(state.settings);

  const nav = [
    {
      path: '/projects', label: 'Projects', icon: Layers,
      children: [{ path: '/', label: 'All projects' }, ...(member ? [] : state.spaces.map(s => ({ path: `/s/${s.id}`, label: s.name })))],
    },
    { path: '/files', label: 'Files', icon: Files },
  ];

  const accountActions = [
    { label: 'Settings', icon: Settings, onSelect: () => onSettings(member ? 'profile' : 'org'), inPhoneMenu: true },
    !member && { label: `AI · ${aiName(state.settings)}`, icon: Sparkles, onSelect: () => onSettings('ai'), inPhoneMenu: true },
    !member && onNewSpace && { label: 'New space', icon: FolderPlus, onSelect: onNewSpace, inPhoneMenu: true },
    encrypted && { label: 'Lock workspace', icon: Lock, onSelect: lock, inPhoneMenu: true },
  ].filter(Boolean);

  // The AI row the sidebar used to end with: the provider, and a dot when it's live.
  const credit = !member && (
    <button type="button" onClick={() => onSettings('ai')} className="flex items-center gap-2 text-text-secondary hover:text-foreground">
      <Sparkles className="size-4 text-icon-muted" />AI · {aiName(state.settings)}
      <span className={cx('size-2 rounded-full', gem ? 'bg-green' : 'bg-grey-400')} />
    </button>
  );

  return (
    <AppShell
      nav={nav}
      currentPath={path}
      isActive={isActive}
      hrefFor={p => `#${p}`}
      logo={<Logo org={org} />}
      user={{ name: auth?.user?.name || auth?.user?.email || state.settings.ownerName || 'You', workspace: org.name || state.settings.workspaceName }}
      accountActions={accountActions}
      onSignOut={auth?.signOut}
      themeSwitch
      credit={credit}
      addAction={onNewProject && !member ? { label: 'New project', onSelect: onNewProject } : null}
      pageKey={path.startsWith('/files') ? '/files' : '/'}
    >
      {/* One boundary per page, keyed by the path, so a broken page doesn't poison the others. */}
      <ErrorBoundary key={path}>{children}</ErrorBoundary>
    </AppShell>
  );
}
