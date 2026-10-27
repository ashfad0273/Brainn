import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { analyze } from '../lib/brain';
import { engineName } from '../lib/gemini';
import { myMember } from '../lib/model';

/**
 * Only one open tab reads new messages: the one holding the "analyzer" lock. Otherwise two owner
 * tabs would analyse the same message at the same time and propose everything twice.
 */
function useLeader() {
  const [leader, setLeader] = useState(!navigator.locks);
  useEffect(() => {
    if (!navigator.locks) return;
    let release;
    const held = new Promise(r => { release = r; });
    navigator.locks.request('project-brain-analyzer', () => { setLeader(true); return held; }).catch(() => {});
    return () => { release(); setLeader(false); };
  }, []);
  return leader;
}

/**
 * Runs in the owner's tab — and for people allowed to review suggestions, in theirs (for those projects):
 * reads every new message (batched per project) and proposes records.
 */
export default function Analyzer() {
  const { state, stateRef, mutate, toast, mode, user } = useStore();
  const busy = useRef(new Set());
  const timers = useRef({});
  const leader = useLeader();

  useEffect(() => {
    if (!leader || !state?.settings.autoAnalyze) return;
    for (const p of state.projects) {
      if (mode === 'member' && !myMember(p, user)?.perms?.suggestions) continue;
      if (p.archived || !p.messages.some(m => !m.analyzed && !m.deleted && !busy.current.has(m.id))) continue;
      clearTimeout(timers.current[p.id]);
      timers.current[p.id] = setTimeout(async () => {
        const cur = stateRef.current.projects.find(x => x.id === p.id);
        const ids = cur.messages.filter(m => !m.analyzed && !m.deleted && !busy.current.has(m.id)).map(m => m.id);
        if (!ids.length) return;
        ids.forEach(i => busy.current.add(i));
        try {
          const latest = () => stateRef.current.projects.find(x => x.id === p.id);
          const { count, engine } = await analyze({ state: stateRef.current, project: cur, ids, mutate, toast, latest });
          if (count) toast(`✨ ${count} new suggestion${count > 1 ? 's' : ''} in ${cur.name} (${engineName(engine)})`);
        } catch (e) {
          console.error(e);
        } finally {
          ids.forEach(i => busy.current.delete(i));
        }
      }, 900);
    }
  }, [state, stateRef, mutate, toast, leader, mode, user]);

  return null;
}
