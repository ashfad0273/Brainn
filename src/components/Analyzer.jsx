import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { analyze } from '../lib/brain';

/** Runs in the owner's tab: reads every new message (batched per project) and proposes records. */
export default function Analyzer() {
  const { state, stateRef, mutate, toast } = useStore();
  const busy = useRef(new Set());
  const timers = useRef({});

  useEffect(() => {
    if (!state?.settings.autoAnalyze) return;
    for (const p of state.projects) {
      if (p.archived || !p.messages.some(m => !m.analyzed && !busy.current.has(m.id))) continue;
      clearTimeout(timers.current[p.id]);
      timers.current[p.id] = setTimeout(async () => {
        const cur = stateRef.current.projects.find(x => x.id === p.id);
        const ids = cur.messages.filter(m => !m.analyzed && !busy.current.has(m.id)).map(m => m.id);
        if (!ids.length) return;
        ids.forEach(i => busy.current.add(i));
        try {
          const { count, engine } = await analyze({ state: stateRef.current, project: cur, ids, mutate, toast });
          if (count) toast(`✨ ${count} new suggestion${count > 1 ? 's' : ''} in ${cur.name} (${engine === 'gemini' ? 'Gemini' : 'built-in rules'})`);
        } catch (e) {
          console.error(e);
        } finally {
          ids.forEach(i => busy.current.delete(i));
        }
      }, 900);
    }
  }, [state, stateRef, mutate, toast]);

  return null;
}
