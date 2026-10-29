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
  const p = withClock(at(5, 9, 50), () => newProject({ id: 'p1jftgiae4', name: 'Nova Café Website', client: 'Sara Ahmed', description: 'Marketing site for a neighbourhood café: menu, location and story.', color: '#f59e0b', spaceId: 'sp_web' }));
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
  const q = withClock(at(3, 9, 0), () => newProject({ id: 'ph35pwtae5', name: 'Orbit Fitness App', client: 'Daniel Cruz', description: 'Workout tracking app — onboarding and paywall screens.', color: '#0ea5e9', spaceId: 'sp_apps' }));
  const qm1 = withClock(at(3, 10, 5), () => addMessage(q, { from: 'client', text: 'We need onboarding screens by next Monday. iOS first, android later.' }));
  const qm2 = withClock(at(3, 10, 20), () => addMessage(q, { from: 'owner', text: 'Perfect, starting today. Any reference apps you like?' }));
  withClock(at(3, 10, 21), () => {
    addItem(q, 'owner', { type: 'task', title: 'Design onboarding screens', assignee: 'owner', sourceMsg: qm1.id, via: 'rules' });
    addItem(q, 'owner', { type: 'requirement', title: 'iOS first, Android later', sourceMsg: qm1.id, via: 'rules' });
    addItem(q, 'owner', { type: 'question', title: 'Which reference apps does Daniel like?', sourceMsg: qm2.id, via: 'rules' });
  });
  [qm1, qm2].forEach(m => { m.analyzed = true; });

  return normalizeState({ version: 1, settings: defaultSettings(), spaces, projects: [p, q, ...demoApps()] });
}

/* ---- Demo app projects ----
   Four apps at different stages, so every page has something to show: an MVP mid-build, one due
   this week, one on hold past its deadline and one shipped. Fixed ids, so loadDemoApps() can add
   the ones a saved demo workspace is missing. */

const dayISO = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

// One chat: each step is a message on a day, the records it led to, and whether the brain has read it.
function appProject(def, steps) {
  const p = withClock(at(steps[0].d, 9, 0), () => newProject({ spaceId: 'sp_apps', ...def }));
  steps.forEach(({ d, h = 10, m = 0, from, text, files = [], items = [], read = true }) => {
    const t = at(d, h, m);
    const msg = withClock(t, () => addMessage(p, { from, text, attachments: files.map(f => file(...f)) }));
    msg.analyzed = read;
    items.forEach(({ status, ...it }) => {
      const rec = withClock(t + 60000, () => addItem(p, 'owner', { assignee: it.type === 'task' ? 'owner' : '', ...it, sourceMsg: msg.id, via: 'rules' }));
      if (status) withClock(t + 120000, () => setStatus(p, 'owner', rec.id, status, { msg: msg.id }));
    });
  });
  return p;
}

export const DEMO_APP_IDS = ['pdemo_pulse', 'pdemo_harbor', 'pdemo_leaf', 'pdemo_tempo'];

export function demoApps() {
  const pulse = appProject({ id: 'pdemo_pulse', name: 'Pulse Banking App', client: 'Maya Chen', description: 'Mobile banking MVP: accounts, transfers and card controls.', color: '#8b5cf6', deadline: dayISO(12) }, [
    { d: 8, from: 'client', text: 'Kickoff notes attached. For the MVP we need the accounts overview, transfers and card controls.', files: [['pulse-mvp-scope.pdf', 1240000, 'application/pdf']],
      items: [{ type: 'requirement', title: 'MVP: accounts overview, transfers, card controls' }] },
    { d: 8, h: 11, from: 'owner', text: 'Got it. Face ID login on day one, or a PIN only for the MVP?' },
    { d: 7, from: 'client', text: 'Face ID from day one please. Compliance also wants a 5 minute session timeout.',
      items: [{ type: 'decision', title: 'Face ID login from day one' }, { type: 'requirement', title: '5-minute session timeout' }, { type: 'risk', title: 'App Store review for banking apps can take 2+ weeks' }] },
    { d: 6, from: 'owner', text: 'Starting with the transfer flow, then card controls.',
      items: [{ type: 'task', title: 'Design the transfer flow', status: 'done' }, { type: 'task', title: 'Design card controls', due: dayISO(3) }, { type: 'question', title: 'Which partner issues the cards?' }] },
    { d: 2, from: 'owner', text: 'Accounts overview and the transfer flow are ready for review in Figma.' },
    { d: 1, h: 17, from: 'client', text: 'Love the overview! Can the transfer confirmation show the fee before sending?', read: false },
  ]);

  const harbor = appProject({ id: 'pdemo_harbor', name: 'Harbor Hotel Booking', client: 'Lucas Martin', description: 'Booking app for a boutique hotel group: dates, rooms, guests, pay.', color: '#6366f1', deadline: dayISO(5) }, [
    { d: 6, from: 'client', text: 'Booking flow first: dates, rooms, guests, pay. Apple Pay is a must.',
      items: [{ type: 'requirement', title: 'Booking flow: dates, rooms, guests, pay' }, { type: 'requirement', title: 'Apple Pay at checkout' }, { type: 'task', title: 'Payment screen with Apple Pay', due: dayISO(0) }] },
    { d: 5, from: 'owner', text: 'Dates and rooms are done. Should guests create an account before paying?',
      items: [{ type: 'task', title: 'Date and room pickers', status: 'done' }] },
    { d: 4, from: 'client', text: 'Guest checkout please, the account can be optional after booking. Room photos attached.', files: [['harbor-room-photos.zip', 42600000, 'application/zip']],
      items: [{ type: 'decision', title: 'Guest checkout; account optional after booking' }, { type: 'task', title: 'Room detail page', due: dayISO(-1) }, { type: 'task', title: 'Booking confirmation and email', due: dayISO(2) }] },
    { d: 0, h: 8, m: 40, from: 'client', text: 'Can we also show the cancellation policy on the room page? The hotel just asked.', read: false },
  ]);

  const leaf = appProject({ id: 'pdemo_leaf', name: 'Leaf Grocery Delivery', client: 'Omar Farouk', description: 'Grocery delivery app with delivery slots and saved baskets.', color: '#10b981', deadline: dayISO(-4), status: 'on_hold' }, [
    { d: 20, from: 'client', text: "Here's the brand kit and our store list. Delivery slots matter more than anything.", files: [['leaf-brand-kit.zip', 8800000, 'application/zip'], ['leaf-stores.csv', 42000, 'text/csv']],
      items: [{ type: 'requirement', title: 'Delivery slot picker' }] },
    { d: 18, from: 'owner', text: 'Slot picker is designed. Same-day only, or the next 7 days?' },
    { d: 17, from: 'client', text: 'Next 7 days. Same-day can be phase 2.',
      items: [{ type: 'decision', title: 'Same-day delivery moves to phase 2' }, { type: 'task', title: 'Checkout and payment screens', due: dayISO(-6) }] },
    { d: 9, from: 'client', text: 'We have to pause for a few weeks, our investor round is taking all our time. Sorry!',
      items: [{ type: 'question', title: 'When does the project restart?' }, { type: 'task', title: 'Saved baskets', status: 'blocked' }] },
    { d: 9, h: 12, from: 'owner', text: "No problem, everything is saved here. Ping me when you're ready." },
  ]);

  const tempo = appProject({ id: 'pdemo_tempo', name: 'Tempo Habit Tracker', client: 'Priya Nair', description: 'A simple habit tracker with streaks and a home screen widget.', color: '#ec4899', deadline: dayISO(-10), status: 'completed' }, [
    { d: 35, from: 'client', text: 'A simple habit tracker: streaks and a home screen widget, nothing more.',
      items: [{ type: 'requirement', title: 'Streaks and a home screen widget' }, { type: 'task', title: 'Streak screen', status: 'done' }, { type: 'task', title: 'Home screen widget', status: 'done' }] },
    { d: 20, from: 'owner', text: 'Widget and streaks are in TestFlight.', files: [['tempo-testflight-notes.pdf', 320000, 'application/pdf']] },
    { d: 11, from: 'client', text: 'All good, shipping it! Thank you 🎉', items: [{ type: 'decision', title: 'Ship v1.0' }] },
  ]);

  return [pulse, harbor, leaf, tempo];
}

/** A saved demo workspace gets the demo apps it is missing (merged by id, so nothing is overwritten). */
export function loadDemoApps(state) {
  const have = new Set(state.projects.map(p => p.id));
  const missing = DEMO_APP_IDS.filter(id => !have.has(id));
  if (!missing.length) return null;
  return { spaces: [{ id: 'sp_apps', name: 'Mobile apps', createdAt: at(40, 9, 1) }], projects: demoApps().filter(p => missing.includes(p.id)) };
}
