import { useState } from 'react';
import { Copy, ExternalLink, UserPlus, ChevronDown, RefreshCw, Ban, Pencil } from 'lucide-react';
import { useStore } from '../store';
import { Modal, Field, Input, Select, Button, Toggle, Badge } from './ui';
import { addMember, updateMember, resetMemberAccess, revokeMember } from '../lib/model';
import { DEFAULT_PERMS, MEMBER_ROLES, memberRole } from '../lib/meta';
import { copyText, cx, fmtRel, uid } from '../lib/util';

const PERMS = [['tasks', 'Tasks & progress'], ['requirements', 'Requirements'], ['decisions', 'Decisions'], ['files', 'Files & links'], ['summary', 'Project memory summary']];
export const memberLink = m => `${location.origin}${location.pathname}#/join/${m.token}`;

function RoleFields({ d, set }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Role"><Select value={d.role} onChange={e => set({ role: e.target.value })}>{Object.entries(MEMBER_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      {d.role === 'other'
        ? <Field label="Designation"><Input value={d.designation} onChange={e => set({ designation: e.target.value })} placeholder="e.g. Copywriter" /></Field>
        : <div />}
    </div>
  );
}

function PermToggles({ perms, onChange }) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-400 mb-2">What they can see besides the chat</div>
      <div className="space-y-2.5">{PERMS.map(([k, l]) => <Toggle key={k} checked={!!perms[k]} onChange={v => onChange({ ...perms, [k]: v })} label={l} />)}</div>
    </div>
  );
}

function MemberCard({ p, m, open, setOpen }) {
  const { mutate, toast } = useStore();
  const [edit, setEdit] = useState(null);
  const link = memberLink(m);
  const copy = async t => toast((await copyText(t)) ? 'Copied' : 'Copy blocked by the browser');
  const mut = fn => mutate(p.id, fn);
  return (
    <div className="rounded-2xl bg-white/[.03] ring-1 ring-white/[.06]">
      <button type="button" onClick={() => setOpen(open ? null : m.id)} className="w-full flex items-center gap-3 p-3 text-left">
        <span className="w-9 h-9 rounded-xl bg-orange-600 grid place-items-center text-sm font-semibold text-white shrink-0">{m.name[0]?.toUpperCase()}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">{m.name}</span>
          <span className="block text-xs text-neutral-500 truncate">{memberRole(m)} · PIN {m.pin}</span>
        </span>
        <ChevronDown size={16} className={cx('text-neutral-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 anim-fade">
          <div className="flex gap-2 justify-center">
            {m.pin.split('').map((d, i) => <div key={m.token + i} className="anim-pop w-11 h-12 rounded-xl bg-[#111] ring-1 ring-sky-500/40 grid place-items-center text-xl font-semibold" style={{ animationDelay: i * 60 + 'ms' }}>{d}</div>)}
          </div>
          <div className="flex gap-2"><Input readOnly value={link} className="text-xs text-neutral-400" /><Button variant="accent" onClick={() => copy(link)}><Copy size={14} />Copy</Button></div>
          <Button className="w-full justify-center" onClick={() => copy(`Hi ${m.name.split(' ')[0]}, here's our project space for ${p.name}: ${link}\nYour PIN: ${m.pin}`)}>Copy message with link + PIN</Button>
          {edit ? (
            <div className="space-y-3 rounded-xl bg-black/20 p-3">
              <Field label="Name"><Input value={edit.name} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} /></Field>
              <RoleFields d={edit} set={v => setEdit(x => ({ ...x, ...v }))} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEdit(null)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={() => { if (edit.role === 'other' && !edit.designation.trim()) return toast('Enter a designation', 'error'); mut(q => updateMember(q, 'owner', m.id, edit)); setEdit(null); }}>Save</Button>
              </div>
            </div>
          ) : (
            <PermToggles perms={m.perms} onChange={perms => mut(q => updateMember(q, 'owner', m.id, { perms }))} />
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            <a href={link} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline flex items-center gap-1"><ExternalLink size={12} />Open as {m.name.split(' ')[0]}</a>
            {!edit && <button onClick={() => setEdit({ name: m.name, role: m.role, designation: m.designation || '' })} className="text-xs text-neutral-300 hover:underline flex items-center gap-1"><Pencil size={12} />Edit name & role</button>}
            <button onClick={() => { mut(q => resetMemberAccess(q, 'owner', m.id)); toast('New PIN and link — the old ones stopped working'); }} className="text-xs text-neutral-300 hover:underline flex items-center gap-1"><RefreshCw size={12} />New PIN & link</button>
            <div className="flex-1" />
            <button onClick={() => { if (confirm(`Revoke ${m.name}'s access? Their link and PIN stop working. Their messages stay in the chat.`)) { mut(q => revokeMember(q, 'owner', m.id)); setOpen(null); toast('Access revoked'); } }} className="text-xs text-rose-300 hover:underline flex items-center gap-1"><Ban size={12} />Revoke</button>
          </div>
          <div className="text-[11px] text-neutral-600">Invited {fmtRel(m.createdAt)}</div>
        </div>
      )}
    </div>
  );
}

export default function MembersModal({ p, onClose }) {
  const { mutate, toast } = useStore();
  const members = (p.members || []).filter(m => !m.revokedAt);
  const revoked = (p.members || []).filter(m => m.revokedAt).sort((a, b) => b.revokedAt - a.revokedAt);
  const [open, setOpen] = useState(members.length === 1 ? members[0].id : null);
  const [adding, setAdding] = useState(members.length === 0);
  const [showRevoked, setShowRevoked] = useState(false);
  const blank = () => ({ name: members.length ? '' : p.client || '', role: 'client', designation: '', perms: DEFAULT_PERMS });
  const [d, setD] = useState(blank);

  const add = () => {
    if (!d.name.trim()) return toast('Enter their name first', 'error');
    if (d.role === 'other' && !d.designation.trim()) return toast('Enter a designation for “Other”', 'error');
    const id = uid('mb_');
    mutate(p.id, q => addMember(q, 'owner', { ...d, id }));
    setOpen(id);
    setAdding(false);
    setD(blank());
  };

  return (
    <Modal title="Project members" sub="Everyone gets their own link and PIN. They chat with you here and never see suggestions, the vault or internal notes." onClose={onClose}>
      <div className="space-y-3">
        {members.map(m => <MemberCard key={m.id} p={p} m={m} open={open === m.id} setOpen={setOpen} />)}

        {adding ? (
          <div className="space-y-3 rounded-2xl ring-1 ring-sky-500/30 bg-sky-500/[.03] p-4 anim-up">
            <Field label="Name"><Input autoFocus value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Sara Ahmed" /></Field>
            <RoleFields d={d} set={v => setD(x => ({ ...x, ...v }))} />
            <PermToggles perms={d.perms} onChange={perms => setD(x => ({ ...x, perms }))} />
            <div className="flex justify-end gap-2">
              {members.length > 0 && <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>}
              <Button variant="primary" onClick={add}>Generate PIN & link</Button>
            </div>
          </div>
        ) : (
          <Button className="w-full justify-center" onClick={() => setAdding(true)}><UserPlus size={15} />Add a member</Button>
        )}

        {revoked.length > 0 && (
          <div>
            <button onClick={() => setShowRevoked(!showRevoked)} className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1">
              <ChevronDown size={13} className={cx('transition', showRevoked && 'rotate-180')} />{revoked.length} revoked (kept in the record)
            </button>
            {showRevoked && revoked.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs text-neutral-500 py-1.5 px-1">
                <span className="flex-1 truncate">{m.name} · {memberRole(m)}</span><Badge>revoked {fmtRel(m.revokedAt)}</Badge>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-neutral-500">This version keeps data in your browser, so links work in this browser (try one in a new tab). Connecting a backend makes them work anywhere.</p>
      </div>
    </Modal>
  );
}
