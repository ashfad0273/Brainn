import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { useStore } from '../store';
import { Modal, Field, Input, Button, Toggle } from './ui';
import { createInvite, revokeInvite, setInvitePerms } from '../lib/model';
import { DEFAULT_PERMS } from '../lib/meta';
import { copyText } from '../lib/util';

const PERMS = [['tasks', 'Tasks & progress'], ['requirements', 'Requirements'], ['decisions', 'Decisions'], ['files', 'Files & links'], ['summary', 'Project memory summary']];

export default function InviteModal({ p, onClose }) {
  const { mutate, toast } = useStore();
  const inv = p.invite;
  const [name, setName] = useState(inv?.name || p.client || '');
  const [perms, setPerms] = useState(inv?.perms || DEFAULT_PERMS);
  const link = inv ? `${location.origin}${location.pathname}#/join/${inv.token}` : '';
  const copy = async t => toast((await copyText(t)) ? 'Copied' : 'Copy blocked by the browser');
  const setPerm = (k, v) => {
    const next = { ...perms, [k]: v };
    setPerms(next);
    if (inv) mutate(p.id, q => setInvitePerms(q, 'owner', next));
  };

  return (
    <Modal title="Invite your client" sub="They open the link, enter the PIN and chat with you here. They never see suggestions, the vault or internal notes." onClose={onClose}>
      <div className="space-y-4">
        <Field label="Client name"><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sara Ahmed" /></Field>
        <div>
          <div className="text-xs font-medium text-neutral-400 mb-2">What they can see besides the chat</div>
          <div className="space-y-2.5">{PERMS.map(([k, l]) => <Toggle key={k} checked={!!perms[k]} onChange={v => setPerm(k, v)} label={l} />)}</div>
        </div>
        <Button variant="primary" className="w-full justify-center" onClick={() => { if (!name.trim()) return toast('Enter the client’s name first', 'error'); mutate(p.id, q => createInvite(q, 'owner', { name: name.trim(), perms })); }}>
          {inv ? 'Generate a new PIN & link (old one stops working)' : 'Generate PIN & link'}
        </Button>
        {inv && (
          <div className="space-y-3 anim-up rounded-2xl bg-white/[.03] ring-1 ring-white/[.06] p-4">
            <div className="flex gap-2 justify-center">
              {inv.pin.split('').map((d, i) => <div key={inv.token + i} className="anim-pop w-12 h-14 rounded-xl bg-[#111] ring-1 ring-sky-500/40 grid place-items-center text-2xl font-semibold" style={{ animationDelay: i * 80 + 'ms' }}>{d}</div>)}
            </div>
            <div className="flex gap-2"><Input readOnly value={link} className="text-xs text-neutral-400" /><Button variant="accent" onClick={() => copy(link)}><Copy size={14} />Copy</Button></div>
            <Button className="w-full justify-center" onClick={() => copy(`Hi ${inv.name}, here's our project space: ${link}\nYour PIN: ${inv.pin}`)}>Copy message with link + PIN</Button>
            <div className="flex items-center justify-between">
              <a href={link} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline flex items-center gap-1"><ExternalLink size={12} />Open as client in a new tab</a>
              <button onClick={() => { mutate(p.id, q => revokeInvite(q, 'owner')); toast('Access revoked'); }} className="text-xs text-rose-300 hover:underline">Revoke access</button>
            </div>
            <p className="text-[11px] text-neutral-500">This version keeps data in your browser, so the link works in this browser (try it in a new tab). Connecting a backend makes it work anywhere.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
