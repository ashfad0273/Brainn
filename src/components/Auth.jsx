import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Brain, Loader2, MailCheck } from 'lucide-react';
import { StoreProvider } from '../store';
import { Button, Field, Input } from './ui';
import { api, hasServer, getSession, setSession, clearSession, browserTz } from '../lib/api';
import { MEMBER_ROLES } from '../lib/meta';

/** The signed-in person ({ user, org, signOut, setUser }); null in local-only mode. */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const inviteToken = () => (location.hash.match(/^#\/invite\/([\w-]+)/) || [])[1] || null;

function Logo({ org, size = 'lg' }) {
  const s = size === 'lg' ? 'w-14 h-14' : 'w-9 h-9';
  return org?.logo
    ? <img src={org.logo} alt="" className={`${s} rounded-2xl object-cover mx-auto ring-1 ring-white/10`} />
    : <div className={`${s} rounded-2xl grid place-items-center mx-auto text-neutral-900`} style={{ background: org?.color || '#fff' }}><Brain size={size === 'lg' ? 26 : 18} /></div>;
}

function Screen({ org, title, sub, children }) {
  return (
    <div className="h-full overflow-auto grid place-items-center p-5">
      <div className="w-full max-w-sm anim-pop">
        <Logo org={org} />
        <h1 className="text-2xl font-semibold text-center mt-5">{title}</h1>
        {sub && <p className="text-sm text-neutral-500 text-center mt-1.5">{sub}</p>}
        <div className="mt-7 space-y-3">{children}</div>
      </div>
    </div>
  );
}

const Splash = ({ text }) => (
  <div className="h-full grid place-items-center text-center p-6">
    <div><Loader2 size={30} className="mx-auto text-neutral-500 animate-spin" /><p className="text-sm text-neutral-500 mt-3">{text}</p></div>
  </div>
);

function useForm(init) {
  const [d, setD] = useState(init);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setD(x => ({ ...x, [k]: e.target.value }));
  const run = fn => async e => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await fn(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return { d, set, err, busy, run };
}

const ErrorText = ({ text }) => (text ? <p className="text-sm text-rose-300 text-center">{text}</p> : null);

function Login({ org, onIn }) {
  const f = useForm({ email: '', password: '' });
  return (
    <Screen org={org} title={`Sign in to ${org?.name || 'Project Brain'}`}>
      <form onSubmit={f.run(async () => onIn(await api('/v1/auth/login', { method: 'POST', json: { ...f.d, tz: browserTz() } })))} className="space-y-3">
        <Field label="Email"><Input autoFocus type="email" autoComplete="email" value={f.d.email} onChange={f.set('email')} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" value={f.d.password} onChange={f.set('password')} /></Field>
        <ErrorText text={f.err} />
        <Button type="submit" variant="primary" className="w-full justify-center" disabled={f.busy}>{f.busy ? <Loader2 size={15} className="animate-spin" /> : 'Sign in'}</Button>
      </form>
      <p className="text-xs text-neutral-600 text-center">Forgot your password? Ask the workspace owner to send you a new invitation.</p>
    </Screen>
  );
}

function Setup({ org, onIn }) {
  const f = useForm({ setupCode: '', name: '', email: '', password: '', again: '' });
  return (
    <Screen org={org} title="Create the owner account" sub="One time only. Use the APP_TOKEN you set on the worker as the setup code.">
      <form onSubmit={f.run(async () => {
        if (f.d.password !== f.d.again) throw new Error('The two passwords differ');
        onIn(await api('/v1/auth/setup', { method: 'POST', json: { ...f.d, tz: browserTz() } }));
      })} className="space-y-3">
        <Field label="Setup code"><Input type="password" autoComplete="off" value={f.d.setupCode} onChange={f.set('setupCode')} /></Field>
        <Field label="Your name"><Input value={f.d.name} onChange={f.set('name')} /></Field>
        <Field label="Email"><Input type="email" autoComplete="email" value={f.d.email} onChange={f.set('email')} /></Field>
        <Field label="Password" hint="At least 8 characters."><Input type="password" autoComplete="new-password" value={f.d.password} onChange={f.set('password')} /></Field>
        <Field label="Repeat password"><Input type="password" autoComplete="new-password" value={f.d.again} onChange={f.set('again')} /></Field>
        <ErrorText text={f.err} />
        <Button type="submit" variant="primary" className="w-full justify-center" disabled={f.busy}>{f.busy ? <Loader2 size={15} className="animate-spin" /> : 'Create account'}</Button>
      </form>
    </Screen>
  );
}

function AcceptInvite({ token, onIn }) {
  const [inv, setInv] = useState(null);
  const [bad, setBad] = useState('');
  const f = useForm({ name: '', password: '', again: '' });
  useEffect(() => {
    api(`/v1/invites/${token}`).then(x => { setInv(x); f.set('name')({ target: { value: x.name || '' } }); }).catch(e => setBad(e.message));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (bad) return <Screen title="This invitation isn’t valid" sub={bad}><Button className="w-full justify-center" onClick={() => { location.hash = '#/'; }}>Go to sign in</Button></Screen>;
  if (!inv) return <Splash text="Opening your invitation…" />;
  return (
    <Screen org={inv.org} title={`Join ${inv.org.name}`} sub={`${inv.inviter} invited ${inv.email} as ${MEMBER_ROLES[inv.label] || inv.label}. Set a password to finish.`}>
      <form onSubmit={f.run(async () => {
        if (f.d.password !== f.d.again) throw new Error('The two passwords differ');
        const r = await api(`/v1/invites/${token}/accept`, { method: 'POST', json: { name: f.d.name, password: f.d.password, tz: browserTz() } });
        location.hash = '#/';
        onIn(r);
      })} className="space-y-3">
        <Field label="Email" hint="The address you were invited with — you’ll sign in with it.">
          <div className="relative"><Input type="email" value={inv.email} readOnly autoComplete="username" className="pr-8 text-neutral-300" /><MailCheck size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400" /></div>
        </Field>
        <Field label="Your name"><Input autoFocus value={f.d.name} onChange={f.set('name')} /></Field>
        <Field label="Password" hint="At least 8 characters. You’ll sign in with your email and this password."><Input type="password" autoComplete="new-password" value={f.d.password} onChange={f.set('password')} /></Field>
        <Field label="Repeat password"><Input type="password" autoComplete="new-password" value={f.d.again} onChange={f.set('again')} /></Field>
        <ErrorText text={f.err} />
        <Button type="submit" variant="primary" className="w-full justify-center" disabled={f.busy}>{f.busy ? <Loader2 size={15} className="animate-spin" /> : 'Join'}</Button>
      </form>
    </Screen>
  );
}

/**
 * Decides who is using the app. Without a server: local-only, as before. With one: the owner gets their
 * workspace (local copy + sync), invited people get the projects they were given, everyone else signs in.
 */
export default function AuthGate({ children }) {
  const [st, setSt] = useState({ phase: hasServer() ? 'checking' : 'local' });
  const [invite, setInvite] = useState(inviteToken);

  const check = useCallback(async () => {
    if (getSession()) {
      try { const me = await api('/v1/auth/me'); setSt({ phase: 'in', ...me }); return; } catch (e) { if (e.status !== 401) { setSt({ phase: 'offline', error: e.message }); return; } }
    }
    try { const s = await api('/v1/auth/status'); setSt({ phase: s.hasOwner ? 'login' : 'setup', org: s.org }); }
    catch (e) { setSt({ phase: 'offline', error: e.message }); }
  }, []);

  useEffect(() => {
    if (!hasServer()) return;
    check();
    const out = () => setSt(s => ({ phase: 'login', org: s.org }));
    const hash = () => setInvite(inviteToken());
    window.addEventListener('pb-signed-out', out);
    window.addEventListener('hashchange', hash);
    return () => { window.removeEventListener('pb-signed-out', out); window.removeEventListener('hashchange', hash); };
  }, [check]);

  const onIn = r => { setSession(r.session); setSt({ phase: 'checking' }); check(); };
  const signOut = useCallback(() => { clearSession(); location.hash = '#/'; setSt(s => ({ phase: 'login', org: s.org })); }, []);
  const setUser = useCallback(user => setSt(s => ({ ...s, user })), []);

  if (st.phase === 'local') return <StoreProvider mode="local">{children}</StoreProvider>;
  if (invite) return <AcceptInvite token={invite} onIn={onIn} />;
  if (st.phase === 'checking') return <Splash text="Opening your workspace…" />;
  if (st.phase === 'offline') return <Screen title="Can’t reach the server" sub={st.error}><Button className="w-full justify-center" onClick={check}>Try again</Button></Screen>;
  if (st.phase === 'setup') return <Setup org={st.org} onIn={onIn} />;
  if (st.phase === 'login') return <Login org={st.org} onIn={onIn} />;
  const mode = st.user.role === 'owner' ? 'owner' : 'member';
  return (
    <AuthCtx.Provider value={{ user: st.user, org: st.org, signOut, setUser }}>
      <StoreProvider key={st.user.id} mode={mode} user={st.user} ai={st.ai}>{children}</StoreProvider>
    </AuthCtx.Provider>
  );
}
