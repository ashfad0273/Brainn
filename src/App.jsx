import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { useStore } from './store';
import Home from './components/Home';
import ProjectPage from './components/ProjectShell';
import Join from './components/Join';
import Unlock from './components/Unlock';
import Analyzer from './components/Analyzer';
import Toasts from './components/Toasts';

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
    <div><Brain size={34} className="mx-auto text-neutral-500 animate-pulse" /><p className="text-sm text-neutral-500 mt-3 max-w-sm">{text}</p></div>
  </div>
);

export default function App() {
  const { phase, state } = useStore();
  const h = useHash();
  // #/  ·  #/p/:id/:tab[/m|i/:ref]  ·  #/join/:token
  const join = h.match(/^#\/join\/([\w-]+)/);
  const pm = h.match(/^#\/p\/([\w-]+)(?:\/(\w+))?(?:\/(m|i)\/([\w-]+))?/);

  let body;
  if (phase === 'loading') body = <Splash text="Opening your workspace…" />;
  else if (phase === 'error') body = <Splash text="The saved workspace could not be read. Nothing was changed — try reloading the page." />;
  else if (phase === 'locked') body = <Unlock />;
  else if (join) body = <Join token={join[1]} />;
  else {
    const p = pm && state.projects.find(x => x.id === pm[1]);
    body = (
      <>
        {p ? <ProjectPage key={p.id} p={p} tab={pm[2] || 'chat'} deep={pm[3] ? { kind: pm[3], ref: pm[4] } : null} /> : <Home />}
        <Analyzer />
      </>
    );
  }
  return <>{body}<Toasts /></>;
}
