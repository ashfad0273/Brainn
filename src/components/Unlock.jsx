import { useState } from 'react';
import { Lock } from '@/lib/icons';
import { IconChip } from '@ume/ui/components/patterns/IconChip';
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
        <IconChip icon={Lock} hue="brand" size="lg" className="mx-auto" />
        <h1 className="text-2xl font-medium mt-5">Workspace locked</h1>
        <p className="text-sm text-muted-foreground mt-1">Everything in this workspace is encrypted. Enter your passphrase to open it.</p>
        <Input autoFocus type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Passphrase" className={cx('mt-6 text-center', err && 'ring-rose-ring')} />
        <div className="h-5 mt-2 text-sm text-destructive-foreground">{err}</div>
        <Button type="submit" variant="primary" className="w-full justify-center mt-2" disabled={busy}>{busy ? <Spinner /> : 'Unlock'}</Button>
      </form>
    </div>
  );
}
