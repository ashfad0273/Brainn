import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, Eye, EyeOff, Lock, LogOut, Plus, Trash2, Pencil,
  Bold, Italic, Strikethrough, List, ListOrdered, Copy, Ban, RotateCcw, ImagePlus, X,
} from '@/lib/icons';
import { useStore } from '../store';
import { useAuth } from './Auth';
import { Field, Input, Select, Button, Toggle, Spinner, Badge } from './ui';
import { CardShell, settingsTabs } from './Shell';
import { useTheme } from '@ume/ui/hooks/use-theme';
import { SegmentedControl } from '@ume/ui/components/ui/segmented-control';
import { SettingsRow, SettingsRows, SettingsSection } from '@ume/ui/components/patterns/SettingsRow';
import { invitePerson, InviteResult, appUrl } from './Invite';
import { testConnection, listModels, providerOf, PROVIDERS, badTokenChar, setServerAi } from '../lib/gemini';
import { addMember, revokeMember, updateMember } from '../lib/model';
import { DEFAULT_PERMS, MEMBER_ROLES, INVITE_LABELS } from '../lib/meta';
import { GLOSSARY } from '../lib/shorthand';
import { api, hasServer, browserTz } from '../lib/api';
import { allZones, tzCity } from '../lib/time';
import { cleanHtml } from '../lib/rich';
import { cx, download, uid, now, copyText } from '../lib/util';

const PROVIDER_CARDS = [
  ['rules', 'Built-in rules', 'Runs entirely in this browser. Nothing is sent anywhere. Good at clear, common phrasing.'],
  ['cloudflare', 'Cloudflare AI', 'Workers AI (Llama) on your worker. Redacted text goes only to your Cloudflare account.'],
  ['gemini', 'Gemini', 'Google’s Gemini. Strongest understanding; redacted text goes to Google.'],
];

function StorageUsage() {
  const [est, setEst] = useState(null);
  useEffect(() => { navigator.storage?.estimate?.().then(setEst).catch(() => {}); }, []);
  const mb = n => (n / 1048576 >= 1024 ? (n / 1073741824).toFixed(2) + ' GB' : (n / 1048576).toFixed(1) + ' MB');
  const pct = est?.quota ? Math.min(100, (est.usage / est.quota) * 100) : 0;
  return (
    <SettingsRow label="Browser storage" help="Attached images and files are kept here at their original size.">
      {est?.quota ? <>
        <span className="text-sm tabular-nums text-text-secondary">{mb(est.usage)} of {mb(est.quota)}</span>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-field"><div className={cx('h-full rounded-full', pct > 85 ? 'bg-rose' : 'bg-primary')} style={{ width: Math.max(pct, 1) + '%' }} /></div>
      </> : <span className="text-sm text-muted-foreground">Not available in this browser</span>}
    </SettingsRow>
  );
}

/* The tab's Save, under its rows. */
const SaveRow = ({ children }) => <div className="flex flex-wrap justify-end gap-2 pt-4">{children}</div>;

function TzSelect({ value, onChange }) {
  const zones = allZones();
  return (
    // data-slot: a SettingsRow gives a field its own full-width line on phones.
    <div data-slot="input-control" className="w-full sm:w-64">
      <Select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Automatic ({tzCity(browserTz()) || 'this device'})</option>
        {zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
      </Select>
    </div>
  );
}

const Hours = ({ start, end, onChange }) => (
  <div className="flex items-center gap-2">
    <Input type="time" className="w-32" value={start} onChange={e => onChange({ start: e.target.value, end })} aria-label="From" />
    <span className="text-muted-foreground text-sm">to</span>
    <Input type="time" className="w-32" value={end} onChange={e => onChange({ start, end: e.target.value })} aria-label="Until" />
  </div>
);

/** A small image squeezed into a data URL, so it travels with the settings (login page, emails, sidebar). */
async function logoDataUrl(file, size = 160) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, size / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/* ---------------- keys stored on the server ---------------- */

/** The server's Gemini key: set, replaced or removed here; the value itself never comes back. */
function useServerKeys() {
  const { toast } = useStore();
  const [keys, setKeys] = useState(null);
  useEffect(() => { if (hasServer()) api('/v1/admin/keys').then(setKeys).catch(e => toast(e.message, 'error')); }, [toast]);
  const save = async patch => {
    const k = await api('/v1/admin/keys', { method: 'PUT', json: patch });
    setKeys(k);
    setServerAi({ gemini: k.gemini.set });
    return k;
  };
  return [keys, save];
}

/** A key field: shows whether one is set (last 4 characters only), lets you replace or remove it. */
function KeyField({ label, hint, info, placeholder, onSave }) {
  const { toast } = useStore();
  const [v, setV] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async value => {
    setBusy(true);
    try { await onSave(value); setV(''); toast(value ? `${label} saved` : `${label} removed`); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Field label={label} hint={hint}>
      {info?.set && (
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span className="px-2 py-1 rounded-md bg-pos-soft text-pos ring-1 ring-inset ring-green-ring font-mono">{info.hint}</span>
          <span className="text-muted-foreground">{info.source === 'worker' ? 'set with wrangler — saving one here replaces it' : 'saved on the server'}</span>
          {info.source === 'app' && <button onClick={() => confirm(`Remove the ${label.toLowerCase()}?`) && run('')} disabled={busy} className="ml-auto text-destructive-foreground hover:underline">Remove</button>}
        </div>
      )}
      <div className="flex gap-2">
        <Input type={show ? 'text' : 'password'} value={v} onChange={e => setV(e.target.value)} placeholder={info?.set ? 'Paste a new key to replace it' : placeholder} autoComplete="off" />
        <Button variant="ghost" size="icon" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
        <Button variant="primary" onClick={() => run(v.trim())} disabled={busy || !v.trim()}>{busy ? <Spinner /> : 'Save'}</Button>
      </div>
    </Field>
  );
}

/* ---------------- Organization ---------------- */

function OrgTab() {
  const { state, setSettings, toast } = useStore();
  const [o, setO] = useState({ ...state.settings.org, name: state.settings.org?.name || state.settings.workspaceName });
  const ref = useRef();
  const save = () => { setSettings({ org: { ...o, name: o.name.trim() || 'My workspace' }, workspaceName: o.name.trim() || 'My workspace' }); toast('Organization saved'); };
  return <>
    <SettingsRows>
      <SettingsRow label="Organization name" help="Shown in the sidebar, on the sign-in page and in invitation emails." htmlFor="org-name">
        <Input id="org-name" className="sm:w-64" value={o.name} onChange={e => setO(x => ({ ...x, name: e.target.value }))} />
      </SettingsRow>
      <SettingsRow label="Logo" help="A square image works best. It replaces the B in the sidebar.">
        <input ref={ref} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files[0]; e.target.value = ''; if (f) { try { setO(x => ({ ...x, logo: '' })); const logo = await logoDataUrl(f); setO(x => ({ ...x, logo })); } catch { toast('Could not read that image', 'error'); } } }} />
        <div className="flex items-center gap-2">
          {o.logo && <Button variant="ghost" size="sm" onClick={() => setO(x => ({ ...x, logo: '' }))}>Remove</Button>}
          <button type="button" onClick={() => ref.current.click()} aria-label={o.logo ? 'Change logo' : 'Add a logo'} className="grid size-12 place-items-center overflow-hidden rounded-xl border border-dashed border-border-strong text-icon-muted outline-none hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            {o.logo ? <img src={o.logo} alt="" className="size-full object-cover" /> : <ImagePlus size={18} />}
          </button>
        </div>
      </SettingsRow>
      <SettingsRow label="Time zone" help="Your team’s time, for the “their local time” and “best time to reach” hints.">
        <TzSelect value={o.tz || ''} onChange={tz => setO(x => ({ ...x, tz }))} />
      </SettingsRow>
      <SettingsRow label="Working hours" help="When your team usually replies.">
        <Hours start={o.workStart || '09:00'} end={o.workEnd || '18:00'} onChange={h => setO(x => ({ ...x, workStart: h.start, workEnd: h.end }))} />
      </SettingsRow>
      <SettingsRow label="Brand color" help="Used on the sign-in page and in invitation emails.">
        <label className="flex h-11 items-center gap-2.5 rounded-xl border border-input bg-card ps-2 pe-3 shadow-xs hover:border-border-strong">
          <input type="color" value={o.color || '#0ea5e9'} onChange={e => setO(x => ({ ...x, color: e.target.value }))} className="size-7 cursor-pointer rounded-md bg-transparent" aria-label="Brand color" />
          <span className="font-mono text-sm text-text-secondary uppercase">{o.color || '#0ea5e9'}</span>
        </label>
      </SettingsRow>
    </SettingsRows>
    <SaveRow><Button variant="primary" onClick={save}>Save</Button></SaveRow>
  </>;
}

/* ---------------- Templates ---------------- */

function TemplateEditor({ t, onSave, onCancel, taken }) {
  const [shortcut, setShortcut] = useState(t?.shortcut || '');
  const ed = useRef();
  useEffect(() => { ed.current.innerHTML = cleanHtml(t?.html || ''); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cmd = c => { ed.current.focus(); document.execCommand(c); };
  const save = () => {
    const sc = shortcut.trim().replace(/^#/, '');
    if (!/^[\w-]{1,30}$/.test(sc)) return alert('Use letters, numbers, - or _ for the shortcut (no spaces)');
    if (taken(sc)) return alert(`#${sc} is already used`);
    const html = cleanHtml(ed.current.innerHTML);
    if (!ed.current.innerText.trim()) return alert('Write the template text');
    onSave({ id: t?.id || uid('tpl_'), shortcut: sc, html, text: ed.current.innerText.trim(), updatedAt: now() });
  };
  const btn = 'p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground';
  return (
    <div className="space-y-3 rounded-2xl ring-1 ring-blue-ring bg-primary-soft p-4">
      <Field label="Shortcut" hint="Type # and this in any chat to insert the template.">
        <div className="flex items-center gap-1"><span className="text-muted-foreground">#</span><Input autoFocus value={shortcut} onChange={e => setShortcut(e.target.value.replace(/\s/g, ''))} placeholder="thanks" /></div>
      </Field>
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1">Message</div>
        <div className="rounded-xl ring-1 ring-border bg-background overflow-hidden focus-within:ring-ring">
          <div className="flex gap-0.5 px-1.5 py-1 border-b border-border">
            <button type="button" className={btn} onClick={() => cmd('bold')}><Bold size={13} /></button>
            <button type="button" className={btn} onClick={() => cmd('italic')}><Italic size={13} /></button>
            <button type="button" className={btn} onClick={() => cmd('strikeThrough')}><Strikethrough size={13} /></button>
            <button type="button" className={btn} onClick={() => cmd('insertUnorderedList')}><List size={13} /></button>
            <button type="button" className={btn} onClick={() => cmd('insertOrderedList')}><ListOrdered size={13} /></button>
          </div>
          <div ref={ed} contentEditable suppressContentEditableWarning className="min-h-[90px] max-h-60 overflow-auto px-3 py-2 text-sm outline-none [&_strong]:font-medium [&_b]:font-medium [&_em]:italic [&_i]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" />
        </div>
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button variant="primary" onClick={save}>Save template</Button></div>
    </div>
  );
}

function TemplatesTab() {
  const { state, setSettings, toast } = useStore();
  const list = state.settings.templates || [];
  const [edit, setEdit] = useState(null); // 'new' | template
  const [q, setQ] = useState('');
  const save = t => {
    setSettings({ templates: [...list.filter(x => x.id !== t.id), t].sort((a, b) => a.shortcut.localeCompare(b.shortcut)) });
    setEdit(null);
    toast(`#${t.shortcut} saved`);
  };
  const shown = list.filter(t => !q || (t.shortcut + ' ' + t.text).toLowerCase().includes(q.toLowerCase()));
  return <>
    <p className="text-sm text-muted-foreground">Reusable messages. In any chat, type <b className="text-foreground">#</b> and the shortcut — e.g. <code className="text-primary">#thanks</code> — then Enter. Formatting is kept. No limit on how many.</p>
    <div className="flex gap-2">
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${list.length} template${list.length === 1 ? '' : 's'}`} />
      <Button variant="primary" onClick={() => setEdit('new')}><Plus size={14} />New</Button>
    </div>
    {edit && <TemplateEditor t={edit === 'new' ? null : edit} onSave={save} onCancel={() => setEdit(null)} taken={sc => list.some(x => x.shortcut.toLowerCase() === sc.toLowerCase() && x.id !== (edit === 'new' ? null : edit.id))} />}
    <div className="space-y-1.5">
      {shown.map(t => (
        <div key={t.id} className="rounded-xl bg-field ring-1 ring-border p-3 flex gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-primary">#{t.shortcut}</div>
            <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.text}</div>
          </div>
          <Button variant="ghost" size="iconSm" onClick={() => setEdit(t)} title="Edit"><Pencil size={13} /></Button>
          <Button variant="ghost" size="iconSm" onClick={() => { if (confirm(`Delete #${t.shortcut}?`)) setSettings({ templates: list.filter(x => x.id !== t.id) }); }} title="Delete"><Trash2 size={13} /></Button>
        </div>
      ))}
      {!list.length && !edit && <div className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-4 text-center">No templates yet.</div>}
    </div>
  </>;
}

/* ---------------- People ---------------- */

function PersonRow({ u, projects }) {
  const { mutate, toast, refreshPeople } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null);
  const inProject = p => (p.members || []).find(m => m.userId === u.id && !m.revokedAt);
  const patch = async body => {
    setBusy(true);
    try { await api(`/v1/people/${u.id}`, { method: 'PATCH', json: body }); await refreshPeople(); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const setLabel = async label => {
    await patch({ label });
    projects.forEach(p => { const m = inProject(p); if (m && m.role !== label) mutate(p.id, q => updateMember(q, 'owner', m.id, { role: label })); });
  };
  const toggleProject = (p, on) => {
    if (on) mutate(p.id, q => addMember(q, 'owner', { userId: u.id, email: u.email, name: u.name || u.email.split('@')[0], role: u.label, perms: DEFAULT_PERMS }));
    else { const m = inProject(p); if (m) mutate(p.id, q => revokeMember(q, 'owner', m.id)); }
  };
  const reinvite = async () => {
    setBusy(true);
    try { setLink(await api(`/v1/people/${u.id}/reinvite`, { method: 'POST', json: { appUrl: appUrl(), labelName: MEMBER_ROLES[u.label] } })); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const count = projects.filter(inProject).length;
  return (
    <div className={cx('rounded-xl bg-field ring-1 ring-border', u.status === 'disabled' && 'opacity-60')}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 text-left">
        <span className="w-8 h-8 rounded-lg bg-violet grid place-items-center text-xs font-medium text-primary-foreground shrink-0">{(u.name || u.email)[0].toUpperCase()}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm truncate">{u.name || u.email}</span>
          <span className="block text-xs text-muted-foreground truncate">{MEMBER_ROLES[u.label] || u.label} · {u.email} · {count} project{count === 1 ? '' : 's'}{u.tz ? ` · ${tzCity(u.tz)}` : ''}</span>
        </span>
        {u.status === 'invited' && <Badge tone="sky">invited</Badge>}
        {u.status === 'disabled' && <Badge tone="rose">turned off</Badge>}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 anim-fade">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Label"><Select value={u.label} disabled={busy} onChange={e => setLabel(e.target.value)}>{INVITE_LABELS.map(k => <option key={k} value={k}>{MEMBER_ROLES[k]}</option>)}</Select></Field>
            <Field label="Time zone"><TzSelect value={u.tz} onChange={tz => patch({ tz })} /></Field>
          </div>
          <Field label="Working hours (their time)"><Hours start={u.workStart} end={u.workEnd} onChange={h => patch({ workStart: h.start, workEnd: h.end })} /></Field>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Projects they can open <span className="text-text-tertiary font-normal">— fine-tune what they see in each project’s Members</span></div>
            <div className="space-y-2">{projects.map(p => <Toggle key={p.id} checked={!!inProject(p)} onChange={v => toggleProject(p, v)} label={p.name} />)}</div>
          </div>
          {link && <InviteResult r={link} />}
          <div className="flex flex-wrap gap-2 pt-1">
            {u.status === 'invited' && <Button size="sm" onClick={reinvite} disabled={busy}><RotateCcw size={13} />New invitation link</Button>}
            {u.status !== 'disabled'
              ? <Button size="sm" variant="ghost" className="text-destructive-foreground" disabled={busy} onClick={() => confirm(`Turn off ${u.name || u.email}’s account? They’re signed out everywhere and can’t sign in. Their messages stay.`) && patch({ disabled: true })}><Ban size={13} />Turn off account</Button>
              : <Button size="sm" disabled={busy} onClick={() => patch({ disabled: false })}>Turn account back on</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

function PeopleTab() {
  const { state, people, refreshPeople, mutate, toast } = useStore();
  const [d, setD] = useState({ email: '', name: '', label: 'client', projects: [] });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const projects = state.projects.filter(p => !p.archived);
  const others = (people || []).filter(u => u.role !== 'owner');
  useEffect(() => { refreshPeople(); }, [refreshPeople]);

  const invite = async e => {
    e.preventDefault();
    setBusy(true); setResult(null);
    try {
      const r = await invitePerson(d);
      const u = r.user;
      for (const pid of d.projects) {
        const p = state.projects.find(x => x.id === pid);
        if (p && !(p.members || []).some(m => m.userId === u.id && !m.revokedAt)) mutate(pid, q => addMember(q, 'owner', { userId: u.id, email: u.email, name: u.name || d.name || u.email.split('@')[0], role: u.label, perms: DEFAULT_PERMS }));
      }
      setResult(r);
      setD({ email: '', name: '', label: d.label, projects: [] });
      refreshPeople();
    } catch (x) { toast(x.message, 'error'); } finally { setBusy(false); }
  };

  if (!hasServer()) return <p className="text-sm text-muted-foreground">Inviting people needs the sync server (VITE_WORKER_URL).</p>;
  return <>
    <form onSubmit={invite} className="space-y-3 rounded-2xl ring-1 ring-border p-4">
      <div className="text-sm font-medium">Invite someone</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Email"><Input type="email" value={d.email} onChange={e => setD(x => ({ ...x, email: e.target.value }))} placeholder="name@company.com" /></Field>
        <Field label="Name (optional)"><Input value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></Field>
      </div>
      <Field label="Label"><div className="flex flex-wrap gap-1.5">{INVITE_LABELS.map(k => (
        <button key={k} type="button" onClick={() => setD(x => ({ ...x, label: k }))} className={cx('px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset', d.label === k ? 'bg-primary-soft ring-blue-ring text-primary' : 'ring-border text-muted-foreground hover:text-foreground')}>{MEMBER_ROLES[k]}</button>
      ))}</div></Field>
      {projects.length > 0 && (
        <Field label="Projects they can open" hint="They see only these. What they see inside each one is set in the project’s Members.">
          <div className="space-y-2 max-h-40 overflow-auto">{projects.map(p => <Toggle key={p.id} checked={d.projects.includes(p.id)} onChange={v => setD(x => ({ ...x, projects: v ? [...x.projects, p.id] : x.projects.filter(i => i !== p.id) }))} label={p.name} />)}</div>
        </Field>
      )}
      <Button type="submit" variant="primary" disabled={busy || !d.email.trim()}>{busy ? <Spinner /> : 'Send invitation'}</Button>
      <InviteResult r={result} />
    </form>
    <div className="space-y-2">
      {others.map(u => <PersonRow key={u.id} u={u} projects={projects} />)}
      {!others.length && <div className="text-sm text-muted-foreground text-center py-3">Nobody invited yet.</div>}
    </div>
  </>;
}

/* ---------------- Account (signed-in person) ---------------- */

function AccountTab() {
  const { state, setSettings, toast, mode, refreshPeople } = useStore();
  const auth = useAuth();
  const u = auth.user;
  const [d, setD] = useState({ name: u.name, tz: u.tz, workStart: u.workStart, workEnd: u.workEnd, chatName: state.settings.ownerName });
  const [pw, setPw] = useState({ password: '', newPassword: '', again: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api('/v1/auth/me', { method: 'PATCH', json: { name: d.name, tz: d.tz, workStart: d.workStart, workEnd: d.workEnd } });
      auth.setUser(r.user);
      if (mode !== 'member') setSettings({ ownerName: d.chatName.trim() || d.name || 'You' });
      refreshPeople();
      toast('Saved');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const changePw = async () => {
    if (pw.newPassword !== pw.again) return toast('The two new passwords differ', 'error');
    setBusy(true);
    try {
      const r = await api('/v1/auth/me', { method: 'PATCH', json: { password: pw.password, newPassword: pw.newPassword } });
      if (r.session) { const { setSession } = await import('../lib/api'); setSession(r.session); }
      setPw({ password: '', newPassword: '', again: '' });
      toast('Password changed — other devices were signed out');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return <>
    <SettingsSection title="Account">
      <SettingsRows>
        <SettingsRow label="Email" help="You sign in with this."><span className="text-sm text-text-secondary">{u.email}</span></SettingsRow>
        <SettingsRow label="Your name" htmlFor="acc-name"><Input id="acc-name" className="sm:w-64" value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></SettingsRow>
        {mode !== 'member' && <SettingsRow label="Name on your messages" help="What clients and your team see next to your messages." htmlFor="acc-chat"><Input id="acc-chat" className="sm:w-64" value={d.chatName} onChange={e => setD(x => ({ ...x, chatName: e.target.value }))} /></SettingsRow>}
        <SettingsRow label="Your time zone" help="Picked up when you sign in, unless you choose one."><TzSelect value={d.tz} onChange={tz => setD(x => ({ ...x, tz }))} /></SettingsRow>
        <SettingsRow label="Your working hours"><Hours start={d.workStart} end={d.workEnd} onChange={h => setD(x => ({ ...x, workStart: h.start, workEnd: h.end }))} /></SettingsRow>
      </SettingsRows>
      <SaveRow><Button variant="primary" onClick={save} disabled={busy}>Save</Button></SaveRow>
    </SettingsSection>
    <SettingsSection title="Password" description="Changing it signs your other devices out.">
      <SettingsRows>
        <SettingsRow label="Current password" htmlFor="pw-now"><Input id="pw-now" className="sm:w-64" type="password" autoComplete="current-password" value={pw.password} onChange={e => setPw(x => ({ ...x, password: e.target.value }))} /></SettingsRow>
        <SettingsRow label="New password" htmlFor="pw-new"><Input id="pw-new" className="sm:w-64" type="password" autoComplete="new-password" value={pw.newPassword} onChange={e => setPw(x => ({ ...x, newPassword: e.target.value }))} /></SettingsRow>
        <SettingsRow label="Repeat new password" htmlFor="pw-again"><Input id="pw-again" className="sm:w-64" type="password" autoComplete="new-password" value={pw.again} onChange={e => setPw(x => ({ ...x, again: e.target.value }))} /></SettingsRow>
      </SettingsRows>
      <SaveRow><Button onClick={changePw} disabled={busy || !pw.newPassword}>Change password</Button></SaveRow>
    </SettingsSection>
  </>;
}

/* ---------------- AI ---------------- */

function AiTab() {
  const { state, setSettings, toast, encrypted } = useStore();
  const s = state.settings;
  const server = hasServer();
  const [key, setKey] = useState(s.apiKey);
  const [model, setModel] = useState(s.model);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState(null);
  const [busy, setBusy] = useState('');
  const [provider, setProvider] = useState(providerOf(s));
  const [cf, setCf] = useState({ url: s.workerUrl || '', token: s.workerToken || '', model: s.cfModel || '' });
  const [keys, saveKeys] = useServerKeys();

  const saveGemini = () => { setSettings({ provider: 'gemini', ...(server ? {} : { apiKey: key.trim() }), model: model.trim() || 'gemini-3.5-flash-lite' }); toast('Gemini settings saved'); };
  const saveCf = () => {
    if (!server && badTokenChar(cf.token)) return toast('The token has spaces or special characters that can’t be sent. Set a new one with only letters, numbers and ASCII symbols.', 'error');
    setSettings({ provider: 'cloudflare', cfModel: cf.model, ...(server ? {} : { workerUrl: cf.url.trim(), workerToken: cf.token.trim() }) }); toast('Cloudflare settings saved');
  };
  const test = async over => {
    setBusy('test');
    const name = PROVIDERS[over.provider];
    try { await testConnection({ ...s, ...over }); toast(`✓ ${name} is working`); }
    catch (e) { toast(`${name}: ${e.message}`, 'error'); }
    finally { setBusy(''); }
  };
  const load = async () => {
    setBusy('models');
    try { const m = await listModels(key); setModels(m); if (!m.includes(model.trim())) toast(`“${model.trim()}” isn't in the list — pick one below`, 'error'); }
    catch (e) { toast('Gemini: ' + e.message, 'error'); }
    finally { setBusy(''); }
  };

  return <>
    <p className="text-sm text-muted-foreground">Choose what reads your chats and powers writing / rephrasing{server ? ' — for you and everyone you invite' : ''}. The AI understands shorthand — <i>pass, pwd, info, doc, txt, mail, stg, tmrw, eow, lgtm, nvm</i> and more. If a provider fails, the built-in rules take over for suggestions.</p>
    <div className="grid sm:grid-cols-3 gap-2">
      {PROVIDER_CARDS.map(([k, title, desc]) => (
        <button key={k} onClick={() => { setProvider(k); setSettings({ provider: k }); }}
          className={cx('text-left rounded-xl p-3 ring-1 ring-inset transition', provider === k ? 'bg-primary-soft ring-blue-ring' : 'ring-border hover:bg-field-hover')}>
          <div className="text-sm font-medium text-foreground flex items-center gap-2"><span className={cx('w-2 h-2 rounded-full', provider === k ? 'bg-primary' : 'bg-grey-400')} />{title}</div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</div>
        </button>
      ))}
    </div>
    {provider !== 'rules' && (
      <div className="rounded-xl bg-pos-soft ring-1 ring-green-ring p-3 text-xs text-pos flex gap-2">
        <ShieldCheck size={15} className="shrink-0 mt-px" />
        Passwords, API keys, tokens and card / bank account numbers are replaced with placeholders before anything is sent. Names, emails, phone numbers and the rest of the conversation are still sent.
      </div>
    )}

    {provider === 'cloudflare' && <>
      {!server && <>
        <Field label="Worker URL" hint={<>Deploy the Worker in the <code className="text-foreground">worker/</code> folder (see its README), then paste the URL it prints.</>}>
          <Input value={cf.url} onChange={e => setCf(x => ({ ...x, url: e.target.value }))} placeholder="https://project-brain-ai.your-name.workers.dev" />
        </Field>
        <Field label="Worker token" hint={`The same value you set with “wrangler secret put APP_TOKEN”. Stored only in this browser${encrypted ? ' (encrypted)' : ''}.`}>
          <div className="flex gap-2">
            <Input type={showKey ? 'text' : 'password'} value={cf.token} onChange={e => setCf(x => ({ ...x, token: e.target.value }))} autoComplete="off" />
            <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
          </div>
        </Field>
      </>}
      <Field label="Model">
        <Select value={cf.model} onChange={e => setCf(x => ({ ...x, model: e.target.value }))}>
          <option value="">Worker default (Llama 3.3 70B)</option>
          <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Llama 3.3 70B — best quality</option>
          <option value="@cf/meta/llama-3.1-8b-instruct-fast">Llama 3.1 8B — fastest, cheapest</option>
        </Select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={saveCf}>Save</Button>
        <Button onClick={() => test({ provider: 'cloudflare', workerUrl: cf.url.trim(), workerToken: cf.token.trim(), cfModel: cf.model })} disabled={(!server && (!cf.url.trim() || !cf.token.trim())) || busy === 'test'}>{busy === 'test' ? <Spinner /> : 'Test connection'}</Button>
      </div>
    </>}

    {provider === 'gemini' && <>
      {server
        ? <>
          <div className="rounded-xl bg-warn-soft ring-1 ring-amber-ring p-3 text-xs text-warn-ink">On a free Gemini key Google may use what you send to improve its products, and human reviewers may read it. Use a key from a Google Cloud project with billing turned on for client work.</div>
          <KeyField label="Gemini API key" info={keys?.gemini} placeholder="AIza…" onSave={gemini => saveKeys({ gemini })}
            hint={<>From <a className="text-primary hover:underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>. Kept encrypted on your server — everyone you invite uses it through the server (with a daily limit each) and never sees it.</>} />
        </>
        : <>
          <div className="rounded-xl bg-warn-soft ring-1 ring-amber-ring p-3 text-xs text-warn-ink">On a free Gemini key Google may use what you send to improve its products, and human reviewers may read it. Use a key from a Google Cloud project with billing turned on for client work.</div>
          <Field label="Gemini API key" hint={<>Get one at <a className="text-primary hover:underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>. Stored only in this browser{encrypted ? ' (encrypted)' : ''}.</>}>
            <div className="flex gap-2">
              <Input type={showKey ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} placeholder="AIza…" autoComplete="off" />
              <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
            </div>
          </Field>
        </>}
      <Field label="Model" hint="Default: gemini-3.5-flash-lite. Use the exact model ID, or load the list.">
        <div className="flex gap-2">
          <Input value={model} onChange={e => setModel(e.target.value)} list="pb-models" />
          <Button onClick={load} disabled={(!server && !key.trim()) || busy === 'models'}>{busy === 'models' ? <Spinner /> : 'Load models'}</Button>
        </div>
        <datalist id="pb-models">{(models || []).map(m => <option key={m} value={m} />)}</datalist>
        {models && <div className="flex flex-wrap gap-1 mt-2 max-h-28 overflow-auto">{models.filter(m => /flash|lite/.test(m)).map(m => <button key={m} onClick={() => setModel(m)} className={cx('text-xs px-2 py-1 rounded-md ring-1 ring-inset', m === model ? 'bg-card text-text-figure shadow-button ring-border' : 'ring-border text-foreground hover:bg-field-hover')}>{m}</button>)}</div>}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={saveGemini}>Save</Button>
        <Button onClick={() => test({ provider: 'gemini', apiKey: key.trim(), model: model.trim() })} disabled={(!server && !key.trim()) || busy === 'test'}>{busy === 'test' ? <Spinner /> : 'Test connection'}</Button>
      </div>
    </>}
    <div className="pt-2 space-y-3 border-t border-border">
      <Toggle checked={s.autoAnalyze} onChange={v => setSettings({ autoAnalyze: v })} label="Read new messages automatically" hint="Suggestions appear under each message. Otherwise use “Re-scan” in the chat." />
    </div>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer hover:text-foreground">Shorthand the brain understands</summary><p className="mt-2 leading-relaxed">{GLOSSARY}</p></details>
  </>;
}

/* ---------------- the modal ---------------- */

/* Light, dark or the system's: Ume's theme, shared with theme-init.js. */
function ThemeRow() {
  const { preference, setPreference } = useTheme();
  return (
    <SettingsRow label="Theme" help="Follows your device unless you pick one.">
      <SegmentedControl fit aria-label="Theme" value={preference} onValueChange={setPreference}
        options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
    </SettingsRow>
  );
}

/** Settings as a page (#/settings/:tab), with its pages listed under Settings in the sidebar. */
export default function SettingsPage({ tab: wanted }) {
  const { state, setSettings, toast, encrypted, enableEncryption, disableEncryption, lock, importState, mode } = useStore();
  const auth = useAuth();
  const s = state.settings;
  const member = mode === 'member';
  const tabs = settingsTabs(member, auth);
  const tab = tabs.some(t => t[0] === wanted) ? wanted : tabs[0][0];
  const [owner, setOwner] = useState(s.ownerName);
  const [pass, setPass] = useState({ a: '', b: '' });
  const [busy, setBusy] = useState('');
  const fileRef = useRef();

  const encrypt = async () => {
    if (pass.a.length < 8) return toast('Use at least 8 characters', 'error');
    if (pass.a !== pass.b) return toast('The two passphrases differ', 'error');
    setBusy('enc');
    try { await enableEncryption(pass.a); setPass({ a: '', b: '' }); toast(encrypted ? 'Passphrase changed' : '🔒 Workspace encrypted'); }
    finally { setBusy(''); }
  };
  const importFile = async f => {
    try {
      const j = JSON.parse(await f.text());
      const obj = j.projects ? j : j.messages ? { projects: [j] } : null;
      if (!obj) throw new Error('not a Project Brain file');
      importState(obj);
      toast(`Imported ${obj.projects.length} project${obj.projects.length > 1 ? 's' : ''} (merged, nothing overwritten)`);
    } catch (e) { toast('Import failed: ' + e.message, 'error'); }
  };

  const section = rows => <SettingsSection>{rows}</SettingsSection>;
  return (
    <CardShell title="Settings" subtitle="Your workspace, AI, account and data." tabs={tabs} tab={tab} onTab={k => { location.hash = `#/settings/${k}`; }}>
      <div className="flex flex-col gap-10">
        {tab === 'org' && section(<OrgTab />)}
        {tab === 'people' && <div className="space-y-4"><PeopleTab /></div>}
        {tab === 'templates' && <div className="space-y-4"><TemplatesTab /></div>}
        {tab === 'ai' && <div className="space-y-4"><AiTab /></div>}

        {tab === 'profile' && (auth ? <>
          {section(<SettingsRows><ThemeRow /></SettingsRows>)}
          <AccountTab />
          <SettingsSection title="Sign out">
            <SettingsRows><SettingsRow label="Sign out of Brainn" help="On this device only."><Button variant="danger" onClick={auth.signOut}><LogOut />Sign out</Button></SettingsRow></SettingsRows>
          </SettingsSection>
        </> : section(<>
          <SettingsRows>
            <ThemeRow />
            <SettingsRow label="Your name" help="Shown on your messages." htmlFor="owner-name"><Input id="owner-name" className="sm:w-64" value={owner} onChange={e => setOwner(e.target.value)} /></SettingsRow>
          </SettingsRows>
          <SaveRow><Button variant="primary" onClick={() => { setSettings({ ownerName: owner.trim() || 'You' }); toast('Saved'); }}>Save</Button></SaveRow>
        </>))}

        {tab === 'security' && section(<>
          <div className={cx('mb-4 flex gap-3 rounded-2xl p-4 text-sm', encrypted ? 'bg-pos-soft text-pos' : 'bg-warn-soft text-warn-ink')}>
            {encrypted ? <ShieldCheck size={18} className="shrink-0" /> : <Lock size={18} className="shrink-0" />}
            {encrypted ? 'This browser’s copy is encrypted at rest with AES-256-GCM. The passphrase is never stored: if you lose it, the local copy can’t be recovered.' : 'This browser’s copy isn’t encrypted. Anyone with access to this browser profile can read it.'}
          </div>
          <SettingsRows>
            <SettingsRow label={encrypted ? 'New passphrase' : 'Passphrase'} help="At least 8 characters." htmlFor="pass-a"><Input id="pass-a" className="sm:w-64" type="password" value={pass.a} onChange={e => setPass(x => ({ ...x, a: e.target.value }))} autoComplete="new-password" /></SettingsRow>
            <SettingsRow label="Repeat passphrase" htmlFor="pass-b"><Input id="pass-b" className="sm:w-64" type="password" value={pass.b} onChange={e => setPass(x => ({ ...x, b: e.target.value }))} autoComplete="new-password" /></SettingsRow>
          </SettingsRows>
          <SaveRow>
            {encrypted && <Button variant="danger" onClick={async () => { await disableEncryption(); toast('Encryption turned off'); }}>Turn off encryption</Button>}
            {encrypted && <Button onClick={lock}>Lock now</Button>}
            <Button variant="primary" onClick={encrypt} disabled={busy === 'enc'}>{busy === 'enc' ? <Spinner /> : encrypted ? 'Change passphrase' : 'Encrypt workspace'}</Button>
          </SaveRow>
          {hasServer() && <p className="mt-4 text-xs text-muted-foreground">The server keeps its own copy so invited people and your other devices can see projects. Vault records never leave this browser.</p>}
        </>)}

        {tab === 'data' && section(<>
          <SettingsRows>
            <SettingsRow label="Export workspace" help="A complete record to keep or move to another browser. Keys and tokens are left out.">
              <Button onClick={() => download(`project-brain-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '', workerToken: '' } }, null, 2))}>Export</Button>
            </SettingsRow>
            <SettingsRow label="Import and merge" help="Adds records by ID. Existing history is never replaced.">
              <Button onClick={() => fileRef.current.click()}>Import</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { e.target.files[0] && importFile(e.target.files[0]); e.target.value = ''; }} />
            </SettingsRow>
            <StorageUsage />
          </SettingsRows>
          <p className="mt-4 text-xs text-muted-foreground">Nothing is ever deleted.</p>
        </>)}
      </div>
    </CardShell>
  );
}
