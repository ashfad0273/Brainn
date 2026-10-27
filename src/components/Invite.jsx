import { useState } from 'react';
import { Copy, UserPlus, ChevronDown, Ban, MailCheck, Link2, KeyRound } from 'lucide-react';
import { useStore } from '../store';
import { Modal, Field, Input, Select, Button, Toggle, Badge } from './ui';
import { addMember, updateMember, revokeMember } from '../lib/model';
import { DEFAULT_PERMS, MEMBER_ROLES, INVITE_LABELS, memberRole } from '../lib/meta';
import { api, hasServer } from '../lib/api';
import { copyText, cx, fmtRel } from '../lib/util';

export const PERMS = [
  ['tasks', 'Tasks & progress'], ['requirements', 'Requirements'], ['decisions', 'Decisions'], ['files', 'Files & links'],
  ['summary', 'Project memory summary'], ['suggestions', 'AI suggestions — see them and accept, edit or ignore'],
];
export const appUrl = () => location.origin + location.pathname;

/** Create (or find) someone's account and get their invitation link to send them. */
export async function invitePerson({ email, name, label }) {
  return api('/v1/people/invite', { method: 'POST', json: { email, name, label, labelName: MEMBER_ROLES[label], appUrl: appUrl() } });
}

/** After inviting: the link to share, and whether the email went out. */
export function InviteResult({ r }) {
  const { toast } = useStore();
  if (!r) return null;
  if (r.existing) return <div className="text-xs text-emerald-300 flex items-center gap-1.5"><MailCheck size={14} />{r.user.email} already has an account — they’ll see this project next time they open the app.</div>;
  const copy = async t => toast((await copyText(t)) ? 'Copied' : 'Copy blocked by the browser');
  return (
    <div className="space-y-2 rounded-xl bg-black/20 p-3">
      <div className="text-xs flex items-start gap-1.5 text-sky-200">
        <Link2 size={14} className="shrink-0" />
        {r.emailed ? `Invitation emailed to ${r.user.email}.` : `Not emailed — ${r.emailError || 'email sending isn’t set up'} Copy the link and send it to ${r.user.email}.`}
      </div>
      <div className="flex gap-2"><Input readOnly value={r.link} className="text-xs text-neutral-400" /><Button variant="accent" onClick={() => copy(r.link)}><Copy size={14} />Copy</Button></div>
      <div className="text-[11px] text-neutral-500">The link works for 7 days. They set their own password, then sign in with their email.</div>
    </div>
  );
}

export function PermToggles({ perms, onChange }) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-400 mb-2">What they can see besides the chat</div>
      <div className="space-y-2.5">{PERMS.map(([k, l]) => <Toggle key={k} checked={!!perms[k]} onChange={v => onChange({ ...perms, [k]: v })} label={l} />)}</div>
    </div>
  );
}

function MemberCard({ p, m, person, open, setOpen, onInvite }) {
  const { mutate, toast } = useStore();
  const mut = fn => mutate(p.id, fn);
  const legacy = !m.userId;
  const status = legacy ? 'legacy' : person?.status || 'invited';
  return (
    <div className="rounded-2xl bg-white/[.03] ring-1 ring-white/[.06]">
      <button type="button" onClick={() => setOpen(open ? null : m.id)} className="w-full flex items-center gap-3 p-3 text-left">
        <span className="w-9 h-9 rounded-xl bg-orange-600 grid place-items-center text-sm font-semibold text-white shrink-0">{m.name[0]?.toUpperCase()}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">{m.name}</span>
          <span className="block text-xs text-neutral-500 truncate">{memberRole(m)}{m.email || person?.email ? ` · ${m.email || person.email}` : ''}</span>
        </span>
        {status === 'legacy' && <Badge tone="amber">needs email invite</Badge>}
        {status === 'invited' && <Badge tone="sky">invited</Badge>}
        {status === 'disabled' && <Badge tone="rose">turned off</Badge>}
        {m.perms?.suggestions && <Badge tone="violet">reviews AI</Badge>}
        <ChevronDown size={16} className={cx('text-neutral-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 anim-fade">
          {legacy && (
            <div className="rounded-xl bg-amber-500/5 ring-1 ring-amber-500/20 p-3 text-xs text-amber-200/90 space-y-2">
              <p>{m.name} was added with an old PIN link, which no longer works. Invite them by email to keep their access — their past messages stay theirs.</p>
              {hasServer() && <Button size="sm" onClick={() => onInvite(m)}><KeyRound size={13} />Invite by email</Button>}
            </div>
          )}
          <PermToggles perms={{ ...DEFAULT_PERMS, ...m.perms }} onChange={perms => mut(q => updateMember(q, 'owner', m.id, { perms }))} />
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[11px] text-neutral-600 flex-1">Added {fmtRel(m.createdAt)}</span>
            <button onClick={() => { if (confirm(`Remove ${m.name} from ${p.name}? They stop seeing this project. Their messages stay in the chat.`)) { mut(q => revokeMember(q, 'owner', m.id)); setOpen(null); toast('Removed from the project'); } }} className="text-xs text-rose-300 hover:underline flex items-center gap-1"><Ban size={12} />Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Who can open this project: people from your People list, or someone new invited by email. */
export default function MembersModal({ p, onClose }) {
  const { mutate, toast, people, refreshPeople } = useStore();
  const members = (p.members || []).filter(m => !m.revokedAt);
  const removed = (p.members || []).filter(m => m.revokedAt).sort((a, b) => b.revokedAt - a.revokedAt);
  const byId = new Map((people || []).map(x => [x.id, x]));
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(members.length === 0);
  const [showRemoved, setShowRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const blank = () => ({ who: 'new', email: '', name: members.length ? '' : p.client || '', label: 'client', perms: DEFAULT_PERMS, legacyId: null });
  const [d, setD] = useState(blank);
  const available = (people || []).filter(x => x.role !== 'owner' && x.status !== 'disabled' && !members.some(m => m.userId === x.id));

  const add = async () => {
    setBusy(true); setResult(null);
    try {
      let user, r = null;
      if (d.who === 'new') {
        if (!d.email.trim()) throw new Error('Enter their email');
        r = await invitePerson({ email: d.email.trim(), name: d.name.trim(), label: d.label });
        user = r.user;
        refreshPeople();
      } else user = byId.get(d.who);
      if (members.some(m => m.userId === user.id)) throw new Error(`${user.name || user.email} is already in this project`);
      const name = user.name || d.name.trim() || user.email.split('@')[0];
      if (d.legacyId) mutate(p.id, q => updateMember(q, 'owner', d.legacyId, { userId: user.id, email: user.email, role: user.label }));
      else mutate(p.id, q => addMember(q, 'owner', { userId: user.id, email: user.email, name, role: user.label, perms: d.perms }));
      setResult(r);
      setD(blank());
      toast(`${name} can open ${p.name}`);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (!hasServer()) {
    return (
      <Modal title="Project members" onClose={onClose}>
        <p className="text-sm text-neutral-400">Inviting people needs the sync server. Set <code className="text-neutral-200">VITE_WORKER_URL</code> to your worker’s address and sign in as the owner.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Project members" sub="People you invite sign in with their email and see only the projects you add them to, limited to what you switch on below." onClose={onClose}>
      <div className="space-y-3">
        {members.map(m => <MemberCard key={m.id} p={p} m={m} person={byId.get(m.userId)} open={open === m.id} setOpen={setOpen}
          onInvite={lm => { setAdding(true); setD({ ...blank(), name: lm.name, label: INVITE_LABELS.includes(lm.role) ? lm.role : 'client', legacyId: lm.id }); }} />)}

        <InviteResult r={result} />

        {adding ? (
          <div className="space-y-3 rounded-2xl ring-1 ring-sky-500/30 bg-sky-500/[.03] p-4 anim-up">
            {available.length > 0 && !d.legacyId && (
              <Field label="Who">
                <Select value={d.who} onChange={e => setD(x => ({ ...x, who: e.target.value }))}>
                  <option value="new">Someone new — invite by email</option>
                  {available.map(x => <option key={x.id} value={x.id}>{x.name || x.email} · {MEMBER_ROLES[x.label] || x.label}{x.status === 'invited' ? ' (invited)' : ''}</option>)}
                </Select>
              </Field>
            )}
            {d.who === 'new' && <>
              <Field label="Email"><Input autoFocus type="email" value={d.email} onChange={e => setD(x => ({ ...x, email: e.target.value }))} placeholder="name@company.com" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name"><Input value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Sara Ahmed" /></Field>
                <Field label="Label"><Select value={d.label} onChange={e => setD(x => ({ ...x, label: e.target.value }))}>{INVITE_LABELS.map(k => <option key={k} value={k}>{MEMBER_ROLES[k]}</option>)}</Select></Field>
              </div>
            </>}
            {!d.legacyId && <PermToggles perms={d.perms} onChange={perms => setD(x => ({ ...x, perms }))} />}
            <div className="flex justify-end gap-2">
              {members.length > 0 && <Button variant="ghost" onClick={() => { setAdding(false); setD(blank()); }}>Cancel</Button>}
              <Button variant="primary" onClick={add} disabled={busy}>{d.who === 'new' ? <><Link2 size={14} />Invite</> : 'Add to project'}</Button>
            </div>
          </div>
        ) : (
          <Button className="w-full justify-center" onClick={() => setAdding(true)}><UserPlus size={15} />Add someone</Button>
        )}

        {removed.length > 0 && (
          <div>
            <button onClick={() => setShowRemoved(!showRemoved)} className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1">
              <ChevronDown size={13} className={cx('transition', showRemoved && 'rotate-180')} />{removed.length} removed (kept in the record)
            </button>
            {showRemoved && removed.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs text-neutral-500 py-1.5 px-1">
                <span className="flex-1 truncate">{m.name} · {memberRole(m)}</span><Badge>removed {fmtRel(m.revokedAt)}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
