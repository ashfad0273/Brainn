// Demo workspace shown on first launch. Built with the same append-only operations the app uses.

import { withClock } from './lib/util';
import { newProject, addMessage, addItem, setStatus, normalizeState, defaultSettings } from './lib/model';
import { categorizeFile } from './lib/files';

const at = (daysAgo, h, m) => { const x = new Date(); x.setDate(x.getDate() - daysAgo); x.setHours(h, m, 0, 0); return +x; };
const file = (name, size, mime) => ({ id: 'a_' + name.replace(/\W/g, ''), name, size, mime, kind: 'file', category: categorizeFile(name, mime), dataUrl: null });

export function buildSeed() {
  const spaces = [
    { id: 'sp_web', name: 'Web projects', createdAt: at(40, 9, 0) },
    { id: 'sp_apps', name: 'Mobile apps', createdAt: at(40, 9, 1) },
  ];

  /* ---- Nova Café ---- */
  const p = withClock(at(5, 9, 50), () => newProject({ name: 'Nova Café Website', client: 'Sara Ahmed', description: 'Marketing site for a neighbourhood café: menu, location and story.', color: '#f59e0b', spaceId: 'sp_web' }));
  const msg = (t, from, text, extra = {}) => withClock(t, () => addMessage(p, { from, text, ...extra }));
  const rec = (t, m, data) => withClock(t + 60000, () => addItem(p, 'owner', { ...data, sourceMsg: m.id, via: 'rules' }));

  const t1 = at(5, 10, 2), t2 = at(5, 10, 10), t3 = at(5, 10, 31), t4 = at(4, 9, 15), t5 = at(3, 11, 5), t6 = at(2, 14, 0), t7 = at(2, 15, 30);
  const m1 = msg(t1, 'client', 'Hi! Excited to start 🙌 We want a warm, simple site. The menu and location pages matter most.');
  const m2 = msg(t2, 'owner', "Great. For v1 I'm thinking Home, Menu, About, Contact. Do you want online ordering (option A) or keep it simple without it (option B)?");
  const m3 = msg(t3, 'client', "Let's go with option B, no online ordering for now. Budget is capped at $2,500.");
  const m4 = msg(t4, 'client', 'brand guidelines attached. pls reduce the logo by 20%, it feels too heavy', { attachments: [file('nova-brand-guidelines.pdf', 2480000, 'application/pdf')] });
  const m5 = msg(t5, 'client', 'stg pwd is nova-old-77, menu pics in the zip', { attachments: [file('menu-photos.zip', 18400000, 'application/zip')] });
  const m6 = msg(t6, 'owner', 'Menu page is ready for review.');
  const m7 = msg(t7, 'client', 'Looks great, approved! About page next pls');

  rec(t1, m1, { type: 'requirement', title: 'Warm, simple look — Menu and Location pages are the priority' });
  const menu = rec(t1, m1, { type: 'task', title: 'Build the Menu page', assignee: 'owner' });
  rec(t2, m2, { type: 'requirement', title: 'Pages for v1: Home, Menu, About, Contact' });
  rec(t3, m3, { type: 'decision', title: 'Option B — no online ordering for now', detail: m3.text });
  rec(t3, m3, { type: 'requirement', title: 'Online ordering', scope: 'out', detail: 'Excluded from v1 (option B).' });
  rec(t3, m3, { type: 'sensitive', category: 'financial', title: 'Budget cap', value: '$2,500' });
  rec(t4, m4, { type: 'requirement', title: 'Logo 20% smaller than the brand guidelines version' });
  rec(t4, m4, { type: 'task', title: 'Reduce the logo size by 20%', assignee: 'owner' });
  rec(t5, m5, { type: 'sensitive', category: 'credential', title: 'Staging password', value: 'nova-old-77' });
  withClock(t6 + 60000, () => setStatus(p, 'owner', menu.id, 'done', { msg: m6.id }));
  rec(t7, m7, { type: 'decision', title: 'Menu page approved', detail: m7.text });
  rec(t7, m7, { type: 'task', title: 'Build the About page', assignee: 'owner' });
  [m1, m2, m3, m4, m5, m6, m7].forEach(m => { m.analyzed = true; });

  // Not analysed yet → the brain reads these on first launch (shorthand on purpose).
  msg(at(1, 16, 0), 'owner', 'About page draft is up: https://staging.novacafe.dev/about');
  msg(at(0, 9, 12), 'client', 'ty! new pwd for stg is xyz123. pls send the mobile build by fri, my mail is sara@novacafe.com. info doc: keep the header sticky on mobile. Also can u check the color contrast?');
  msg(at(0, 9, 20), 'client', 'actually make the logo bigger again, the 20% smaller version looks too tiny on mobile');

  /* ---- Orbit Fitness ---- */
  const q = withClock(at(3, 9, 0), () => newProject({ name: 'Orbit Fitness App', client: 'Daniel Cruz', description: 'Workout tracking app — onboarding and paywall screens.', color: '#0ea5e9', spaceId: 'sp_apps' }));
  const qm1 = withClock(at(3, 10, 5), () => addMessage(q, { from: 'client', text: 'We need onboarding screens by next Monday. iOS first, android later.' }));
  const qm2 = withClock(at(3, 10, 20), () => addMessage(q, { from: 'owner', text: 'Perfect, starting today. Any reference apps you like?' }));
  withClock(at(3, 10, 21), () => {
    addItem(q, 'owner', { type: 'task', title: 'Design onboarding screens', assignee: 'owner', sourceMsg: qm1.id, via: 'rules' });
    addItem(q, 'owner', { type: 'requirement', title: 'iOS first, Android later', sourceMsg: qm1.id, via: 'rules' });
    addItem(q, 'owner', { type: 'question', title: 'Which reference apps does Daniel like?', sourceMsg: qm2.id, via: 'rules' });
  });
  [qm1, qm2].forEach(m => { m.analyzed = true; });

  return normalizeState({ version: 1, settings: defaultSettings(), spaces, projects: [p, q] });
}
