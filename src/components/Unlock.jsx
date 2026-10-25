import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useStore } from '../store';
import { Button, Input, Spinner } from './ui';
import { cx } from '../lib/util';

export default function Unlock() {
  const { unlock } = useStore();
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async e => {
    e.preventDefault();
    if (!pass) return;
    setBusy(true); setErr('');
    try { await unlock(pass); } catch { setErr('That passphrase did not unlock the workspace.'); setBusy(false); }
  };
  return (
    <div className="h-full grid place-items-center p-6">
      <form onSubmit={go} className="w-full max-w-sm text-center anim-pop">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white text-neutral-900 grid place-items-center"><Lock size={24} /></div>
        <h1 className="text-2xl font-semibold mt-5">Workspace locked</h1>
        <p className="text-sm text-neutral-500 mt-1">Everything in this workspace is encrypted. Enter your passphrase to open it.</p>
        <Input autoFocus type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Passphrase" className={cx('mt-6 text-center', err && 'ring-rose-500/60')} />
        <div className="h-5 mt-2 text-sm text-rose-300">{err}</div>
        <Button type="submit" variant="primary" className="w-full justify-center mt-2" disabled={busy}>{busy ? <Spinner /> : 'Unlock'}</Button>
      </form>
    </div>
  );
}
