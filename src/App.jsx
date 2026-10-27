import { useEffect, useState } from 'react';
import { Brain } from '@/lib/icons';
import { useStore } from './store';
import Home from './components/Home';
import ProjectPage from './components/ProjectShell';
import FileManager from './components/FileManager';
import Unlock from './components/Unlock';
import Analyzer from './components/Analyzer';

function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

const Splash = ({ text }) => (
  <div className="h-full grid place-items-center text-center p-6">
    <div><Brain size={34} className="mx-auto text-icon-muted animate-pulse" /><p className="mx-auto mt-3 max-w-[40ch] text-balance text-sm text-muted-foreground">{text}</p></div>
  </div>
);

export default function App() {
  const { phase, state } = useStore();
  const h = useHash();
  // #/  ·  #/files  ·  #/p/:id/:tab[/m|i/:ref]  ·  #/join/:token (retired PIN links)
  const join = h.match(/^#\/join\/([\w-]+)/);
  const files = h.startsWith('#/files');
  const pm = h.match(/^#\/p\/([\w-]+)(?:\/(\w+))?(?:\/(m|i)\/([\w-]+))?/);

  let body;
  if (phase === 'loading') body = <Splash text="Opening your workspace…" />;
  else if (phase === 'error') body = <Splash text="The saved workspace could not be read. Nothing was changed — try reloading the page." />;
  else if (phase === 'locked') body = <Unlock />;
  else if (join) body = <Splash text="PIN invite links were replaced by email invitations. Ask the project owner to invite you by email." />;
  else {
    const p = pm && state.projects.find(x => x.id === pm[1]);
    body = (
      <>
        {p ? <ProjectPage key={p.id} p={p} tab={pm[2] || 'chat'} deep={pm[3] ? { kind: pm[3], ref: pm[4] } : null} /> : files ? <FileManager /> : <Home />}
        <Analyzer />
      </>
    );
  }
  return body;
}
