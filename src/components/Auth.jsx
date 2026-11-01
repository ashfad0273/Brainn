import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Brain, Loader2, MailCheck, ArrowLeft } from '@/lib/icons';
import { StoreProvider } from '../store';
import { Button, Field, Input } from './ui';
import { api, hasServer, getSession, setSession, clearSession, browserTz } from '../lib/api';
import { MEMBER_ROLES } from '../lib/meta';

/** The signed-in person ({ user, org, signOut, setUser }); null in local-only mode. */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

/** #/invite/<token> (first password) or #/reset/<token> (new password) → { kind, token }. */
const linkToken = () => { const m = location.hash.match(/^#\/(invite|reset)\/([\w-]+)/); return m ? { kind: m[1], token: m[2] } : null; };
const appUrl = () => location.origin + location.pathname;

function Logo({ org, size = 'lg' }) {
  const s = size === 'lg' ? 'w-14 h-14' : 'w-9 h-9';
  return org?.logo
    ? <img src={org.logo} alt="" className={`${s} rounded-2xl object-cover mx-auto ring-1 ring-border`} />
    : <div className={`${s} rounded-2xl grid place-items-center mx-auto text-btn-primary-fg`} style={{ background: org?.color || '#fff' }}><Brain size={size === 'lg' ? 26 : 18} /></div>;
}

function Screen({ org, title, sub, children }) {
  return (
    <div className="h-full overflow-auto grid place-items-center p-5">
      <div className="w-full max-w-sm anim-pop">
        <Logo org={org} />
        <h1 className="text-2xl font-medium text-center mt-5">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground text-center mt-1.5">{sub}</p>}
        <div className="mt-7 space-y-3">{children}</div>
      </div>
    </div>
  );
}

const Splash = ({ text }) => (
  <div className="h-full grid place-items-center text-center p-6">
    <div><Loader2 size={30} className="mx-auto text-muted-foreground animate-spin" /><p className="text-sm text-muted-foreground mt-3">{text}</p></div>
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

const ErrorText = ({ text }) => (text ? <p className="text-sm text-destructive-foreground text-center">{text}</p> : null);

function Login({ org, onIn, onForgot }) {
  const f = useForm({ email: '', password: '' });
  return (
    <Screen org={org} title={`Sign in to ${org?.name || 'Project Brain'}`}>
      <form onSubmit={f.run(async () => onIn(await api('/v1/auth/login', { method: 'POST', json: { ...f.d, tz: browserTz() } })))} className="space-y-3">
        <Field label="Email"><Input autoFocus type="email" autoComplete="email" value={f.d.email} onChange={f.set('email')} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" value={f.d.password} onChange={f.set('password')} /></Field>
        <ErrorText text={f.err} />
        <Button type="submit" variant="primary" className="w-full justify-center" disabled={f.busy}>{f.busy ? <Loader2 size={15} className="animate-spin" /> : 'Sign in'}</Button>
      </form>
      <button type="button" onClick={() => onForgot(f.d.email)} className="block mx-auto text-xs text-muted-foreground hover:text-foreground hover:underline">Forgot your password?</button>
    </Screen>
  );
}

const BackLink = ({ onClick }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-1 mx-auto text-xs text-muted-foreground hover:text-foreground hover:underline"><ArrowLeft size={13} />Back to sign in</button>
);

/** Ask for a reset email; without email sending, explain who can reset it. */
function Forgot({ org, email, onBack, onOwner }) {
  const f = useForm({ email });
  const [done, setDone] = useState(null);
  if (done) return (
    <Screen org={org} title={done.canEmail ? 'Check your email' : 'Ask the workspace owner'}
      sub={done.canEmail
        ? `If ${done.email} has an account, a link to set a new password is on its way. It works for 24 hours.`
        : `This workspace can’t send emails yet, so the owner resets passwords: Settings → People → your name → Reset password. They’ll send you a link.`}>
      <BackLink onClick={onBack} />
    </Screen>
  );
  return (
    <Screen org={org} title="Reset your password" sub="Enter the email you sign in with.">
      <form onSubmit={f.run(async () => setDone({ ...(await api('/v1/auth/forgot', { method: 'POST', json: { email: f.d.email, appUrl: appUrl() } })), email: f.d.email }))} className="space-y-3">
        <Field label="Email"><Input autoFocus type="email" autoComplete="email" value={f.d.email} onChange={f.set('email')} /></Field>
        <ErrorText text={f.err} />
        <Button type="submit" variant="primary" className="w-full justify-center" disabled={f.busy || !f.d.email.trim()}>{f.busy ? <Loader2 size={15} className="animate-spin" /> : 'Send reset link'}</Button>
      </form>
      <button type="button" onClick={onOwner} className="block mx-auto text-xs text-muted-foreground hover:text-foreground hover:underline">I’m the workspace owner — use the setup code</button>
      <BackLink onClick={onBack} />
    </Screen>
  );
}

/** The owner proves who they are with the setup code (APP_TOKEN), so this works without email. */
function Recover({ org, onIn, onBack }) {
  const f = useForm({ setupCode: '', password: '', again: '' });
  return (
    <Screen org={org} title="Reset the owner password" sub="Use the setup code — the APP_TOKEN set on the worker.">
      <form onSubmit={f.run(async () => {
        if (f.d.password !== f.d.again) throw new Error('The two passwords differ');
        onIn(await api('/v1/auth/recover', { method: 'POST', json: { setupCode: f.d.setupCode, password: f.d.password, tz: browserTz() } }));
      })} className="space-y-3">
        <Field label="Setup code"><Input autoFocus type="password" autoComplete="off" value={f.d.setupCode} onChange={f.set('setupCode')} /></Field>
        <Field label="New password" hint="At least 8 characters. You’re signed out on your other devices."><Input type="password" autoComplete="new-password" value={f.d.password} onChange={f.set('password')} /></Field>
        <Field label="Repeat password"><Input type="password" autoComplete="new-password" value={f.d.again} onChange={f.set('again')} /></Field>
        <ErrorText text={f.err} />
        <Button type="submit" variant="primary" className="w-full justify-center" disabled={f.busy}>{f.busy ? <Loader2 size={15} className="animate-spin" /> : 'Set password and sign in'}</Button>
      </form>
      <BackLink onClick={onBack} />
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

/** Opens an invitation (choose a password and name) or a reset link (choose a new password). */
function AcceptInvite({ token, reset, onIn }) {
  const [inv, setInv] = useState(null);
  const [bad, setBad] = useState('');
  const f = useForm({ name: '', password: '', again: '' });
  useEffect(() => {
    api(`/v1/invites/${token}`).then(x => { setInv(x); f.set('name')({ target: { value: x.name || '' } }); }).catch(e => setBad(e.message));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (bad) return <Screen title={reset ? 'This reset link isn’t valid' : 'This invitation isn’t valid'} sub={reset ? 'It was already used or is older than 24 hours. Ask for a new one from the sign-in page.' : bad}><Button className="w-full justify-center" onClick={() => { location.hash = '#/'; }}>Go to sign in</Button></Screen>;
  if (!inv) return <Splash text={reset ? 'Opening your reset link…' : 'Opening your invitation…'} />;
  if (reset) return (
    <Screen org={inv.org} title="Set a new password" sub={`For ${inv.email}. You’re signed out on your other devices.`}>
      <form onSubmit={f.run(async () => {
        if (f.d.password !== f.d.again) throw new Error('The two passwords differ');
        const r = await api(`/v1/invites/${token}/accept`, { method: 'POST', json: { name: inv.name, password: f.d.password, tz: browserTz() } });
        location.hash = '#/';
        onIn(r);
      })} className="space-y-3">
        <Input type="email" value={inv.email} readOnly autoComplete="username" className="hidden" />
        <Field label="New password" hint="At least 8 characters."><Input autoFocus type="password" autoComplete="new-password" value={f.d.password} onChange={f.set('password')} /></Field>
        <Field label="Repeat password"><Input type="password" autoComplete="new-password" value={f.d.again} onChange={f.set('again')} /></Field>
        <ErrorText text={f.err} />
        <Button type="submit" variant="primary" className="w-full justify-center" disabled={f.busy}>{f.busy ? <Loader2 size={15} className="animate-spin" /> : 'Save and sign in'}</Button>
      </form>
    </Screen>
  );
  return (
    <Screen org={inv.org} title={`Join ${inv.org.name}`} sub={`${inv.inviter} invited ${inv.email} as ${MEMBER_ROLES[inv.label] || inv.label}. Set a password to finish.`}>
      <form onSubmit={f.run(async () => {
        if (f.d.password !== f.d.again) throw new Error('The two passwords differ');
        const r = await api(`/v1/invites/${token}/accept`, { method: 'POST', json: { name: f.d.name, password: f.d.password, tz: browserTz() } });
        location.hash = '#/';
        onIn(r);
      })} className="space-y-3">
        <Field label="Email" hint="The address you were invited with — you’ll sign in with it.">
          <div className="relative"><Input type="email" value={inv.email} readOnly autoComplete="username" className="pr-8 text-foreground" /><MailCheck size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pos" /></div>
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
  const [invite, setInvite] = useState(linkToken);
  const [help, setHelp] = useState(null); // null | { view: 'forgot', email } | { view: 'recover' }

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
    const hash = () => setInvite(linkToken());
    window.addEventListener('pb-signed-out', out);
    window.addEventListener('hashchange', hash);
    return () => { window.removeEventListener('pb-signed-out', out); window.removeEventListener('hashchange', hash); };
  }, [check]);

  const onIn = r => { setSession(r.session); setHelp(null); setSt({ phase: 'checking' }); check(); };
  const signOut = useCallback(() => { clearSession(); location.hash = '#/'; setSt(s => ({ phase: 'login', org: s.org })); }, []);
  const setUser = useCallback(user => setSt(s => ({ ...s, user })), []);

  if (st.phase === 'local') return <StoreProvider mode="local">{children}</StoreProvider>;
  if (invite) return <AcceptInvite key={invite.token} token={invite.token} reset={invite.kind === 'reset'} onIn={onIn} />;
  if (st.phase === 'checking') return <Splash text="Opening your workspace…" />;
  if (st.phase === 'offline') return <Screen title="Can’t reach the server" sub={st.error}><Button className="w-full justify-center" onClick={check}>Try again</Button></Screen>;
  if (st.phase === 'setup') return <Setup org={st.org} onIn={onIn} />;
  if (st.phase === 'login') {
    if (help?.view === 'forgot') return <Forgot org={st.org} email={help.email} onBack={() => setHelp(null)} onOwner={() => setHelp({ view: 'recover' })} />;
    if (help?.view === 'recover') return <Recover org={st.org} onIn={onIn} onBack={() => setHelp(null)} />;
    return <Login org={st.org} onIn={onIn} onForgot={email => setHelp({ view: 'forgot', email })} />;
  }
  const mode = st.user.role === 'owner' ? 'owner' : 'member';
  return (
    <AuthCtx.Provider value={{ user: st.user, org: st.org, signOut, setUser }}>
      <StoreProvider key={st.user.id} mode={mode} user={st.user} ai={st.ai}>{children}</StoreProvider>
    </AuthCtx.Provider>
  );
}
