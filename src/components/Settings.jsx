import { useEffect, useRef, useState } from 'react';
import { Sparkles, ShieldCheck, Database, User, Eye, EyeOff, Lock } from 'lucide-react';
import { useStore } from '../store';
import { Modal, Field, Input, Button, Toggle, Spinner } from './ui';
import { testConnection, listModels, providerOf, PROVIDERS, badTokenChar } from '../lib/gemini';
import { GLOSSARY } from '../lib/shorthand';
import { cx, download } from '../lib/util';

const PROVIDER_CARDS = [
  ['rules', 'Built-in rules', 'Runs entirely in this browser. Nothing is sent anywhere. Good at clear, common phrasing.'],
  ['cloudflare', 'Cloudflare AI', 'Your own Worker on Workers AI (Llama). Redacted text goes only to your Cloudflare account.'],
  ['gemini', 'Gemini', 'Google’s API with your key. Strongest understanding; redacted text goes to Google.'],
];
const TABS = [['ai', 'AI', Sparkles], ['profile', 'Profile', User], ['security', 'Security', ShieldCheck], ['data', 'Data', Database]];

function StorageUsage() {
  const [est, setEst] = useState(null);
  useEffect(() => { navigator.storage?.estimate?.().then(setEst).catch(() => {}); }, []);
  const mb = n => (n / 1048576 >= 1024 ? (n / 1073741824).toFixed(2) + ' GB' : (n / 1048576).toFixed(1) + ' MB');
  if (!est?.quota) return <p className="text-xs text-neutral-500">Storage usage isn’t available in this browser.</p>;
  const pct = Math.min(100, (est.usage / est.quota) * 100);
  return (
    <div className="rounded-xl bg-white/[.03] ring-1 ring-white/5 p-3">
      <div className="flex justify-between text-sm"><span className="text-neutral-300">Browser storage used</span><span className="text-neutral-400 tabular-nums">{mb(est.usage)} of {mb(est.quota)}</span></div>
      <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden"><div className={cx('h-full rounded-full', pct > 85 ? 'bg-rose-400' : 'bg-sky-400')} style={{ width: Math.max(pct, 1) + '%' }} /></div>
      <p className="text-xs text-neutral-500 mt-2">Attached images and files are kept here at their original size.</p>
    </div>
  );
}

export default function SettingsModal({ onClose, initialTab = 'ai' }) {
  const { state, setSettings, toast, encrypted, enableEncryption, disableEncryption, lock, importState } = useStore();
  const s = state.settings;
  const [tab, setTab] = useState(initialTab);
  const [key, setKey] = useState(s.apiKey);
  const [model, setModel] = useState(s.model);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState(null);
  const [busy, setBusy] = useState('');
  const [owner, setOwner] = useState(s.ownerName);
  const [ws, setWs] = useState(s.workspaceName);
  const [pass, setPass] = useState({ a: '', b: '' });
  const fileRef = useRef();

  const saveGemini = () => { setSettings({ provider: 'gemini', apiKey: key.trim(), model: model.trim() || 'gemini-3.5-flash-lite' }); toast(key.trim() ? 'Gemini key saved' : 'Gemini key removed'); };
  const [provider, setProvider] = useState(providerOf(s));
  const [cf, setCf] = useState({ url: s.workerUrl || '', token: s.workerToken || '', model: s.cfModel || '' });
  const saveCf = () => {
    if (badTokenChar(cf.token)) return toast('The token has spaces or special characters that can’t be sent. Set a new one with only letters, numbers and ASCII symbols.', 'error');
    setSettings({ provider: 'cloudflare', workerUrl: cf.url.trim(), workerToken: cf.token.trim(), cfModel: cf.model }); toast('Cloudflare settings saved'); };
  const test = async over => {
    setBusy('test');
    const name = PROVIDERS[over.provider];
    try { await testConnection({ ...s, ...over }); toast(`✓ ${name} is working`); }
    catch (e) { toast(`${name}: ${e.message}`, 'error'); }
    finally { setBusy(''); }
  };
  const load = async () => {
    setBusy('models');
    try { const m = await listModels(key); setModels(m); if (!m.includes(model.trim())) toast(`“${model.trim()}” isn't in your list — pick one below`, 'error'); }
    catch (e) { toast('Gemini: ' + e.message, 'error'); }
    finally { setBusy(''); }
  };
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

  return (
    <Modal wide title="Settings" onClose={onClose}>
      <div className="flex flex-col sm:flex-row gap-5">
        <nav className="flex sm:flex-col gap-1 sm:w-40 shrink-0 overflow-x-auto">
          {TABS.map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left whitespace-nowrap', tab === k ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5')}><I size={15} />{l}</button>
          ))}
        </nav>
        <div className="flex-1 min-w-0 space-y-4">
          {tab === 'ai' && <>
            <p className="text-sm text-neutral-400">Choose what reads your chats. The AI understands shorthand — <i>pass, pwd, info, doc, txt, mail, stg, tmrw, eow, lgtm, nvm</i> and many more. If a provider fails, the built-in rules take over.</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {PROVIDER_CARDS.map(([k, title, desc]) => (
                <button key={k} onClick={() => { setProvider(k); setSettings({ provider: k }); }}
                  className={cx('text-left rounded-xl p-3 ring-1 ring-inset transition', provider === k ? 'bg-sky-500/10 ring-sky-500/50' : 'ring-white/10 hover:bg-white/5')}>
                  <div className="text-sm font-medium text-neutral-100 flex items-center gap-2"><span className={cx('w-2 h-2 rounded-full', provider === k ? 'bg-sky-400' : 'bg-neutral-600')} />{title}</div>
                  <div className="text-xs text-neutral-500 mt-1 leading-relaxed">{desc}</div>
                </button>
              ))}
            </div>
            {provider !== 'rules' && (
              <div className="rounded-xl bg-emerald-500/5 ring-1 ring-emerald-500/20 p-3 text-xs text-emerald-200/90 flex gap-2">
                <ShieldCheck size={15} className="shrink-0 mt-px" />
                Passwords, API keys, tokens and card / bank account numbers are replaced with placeholders before anything leaves this browser. Names, emails, phone numbers and the rest of the conversation are still sent.
              </div>
            )}

            {provider === 'cloudflare' && <>
              <Field label="Worker URL" hint={<>Deploy the Worker in the <code className="text-neutral-300">worker/</code> folder (see its README), then paste the URL it prints.</>}>
                <Input value={cf.url} onChange={e => setCf(x => ({ ...x, url: e.target.value }))} placeholder="https://project-brain-ai.your-name.workers.dev" />
              </Field>
              <Field label="Worker token" hint={`The same value you set with “wrangler secret put APP_TOKEN”. Stored only in this browser${encrypted ? ' (encrypted)' : ''}.`}>
                <div className="flex gap-2">
                  <Input type={showKey ? 'text' : 'password'} value={cf.token} onChange={e => setCf(x => ({ ...x, token: e.target.value }))} autoComplete="off" />
                  <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
                </div>
              </Field>
              <Field label="Model">
                <select value={cf.model} onChange={e => setCf(x => ({ ...x, model: e.target.value }))} className="w-full bg-[#111] ring-1 ring-inset ring-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-sky-500/70">
                  <option value="">Worker default (Llama 3.3 70B)</option>
                  <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Llama 3.3 70B — best quality</option>
                  <option value="@cf/meta/llama-3.1-8b-instruct-fast">Llama 3.1 8B — fastest, cheapest</option>
                </select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={saveCf}>Save</Button>
                <Button onClick={() => test({ provider: 'cloudflare', workerUrl: cf.url.trim(), workerToken: cf.token.trim(), cfModel: cf.model })} disabled={!cf.url.trim() || !cf.token.trim() || busy === 'test'}>{busy === 'test' ? <Spinner /> : 'Test connection'}</Button>
              </div>
            </>}

            {provider === 'gemini' && <>
            <div className="rounded-xl bg-amber-500/5 ring-1 ring-amber-500/20 p-3 text-xs text-amber-200/90">On a free Gemini key Google may use what you send to improve its products, and human reviewers may read it. Use a key from a Google Cloud project with billing turned on for client work.</div>
            <Field label="Gemini API key" hint={<>Get one at <a className="text-sky-400 hover:underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>. Stored only in this browser{encrypted ? ' (encrypted)' : ''}.</>}>
              <div className="flex gap-2">
                <Input type={showKey ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} placeholder="AIza…" autoComplete="off" />
                <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
              </div>
            </Field>
            <Field label="Model" hint="Default: gemini-3.5-flash-lite. Use the exact model ID from Google AI Studio, or load the list for your key.">
              <div className="flex gap-2">
                <Input value={model} onChange={e => setModel(e.target.value)} list="pb-models" />
                <Button onClick={load} disabled={!key.trim() || busy === 'models'}>{busy === 'models' ? <Spinner /> : 'Load models'}</Button>
              </div>
              <datalist id="pb-models">{(models || []).map(m => <option key={m} value={m} />)}</datalist>
              {models && <div className="flex flex-wrap gap-1 mt-2 max-h-28 overflow-auto">{models.filter(m => /flash|lite/.test(m)).map(m => <button key={m} onClick={() => setModel(m)} className={cx('text-xs px-2 py-1 rounded-md ring-1 ring-inset', m === model ? 'bg-white text-neutral-900 ring-white' : 'ring-white/10 text-neutral-300 hover:bg-white/5')}>{m}</button>)}</div>}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={saveGemini}>Save</Button>
              <Button onClick={() => test({ provider: 'gemini', apiKey: key.trim(), model: model.trim() })} disabled={!key.trim() || busy === 'test'}>{busy === 'test' ? <Spinner /> : 'Test connection'}</Button>
            </div>
            </>}
            <div className="pt-2 space-y-3 border-t border-white/5">
              <Toggle checked={s.autoAnalyze} onChange={v => setSettings({ autoAnalyze: v })} label="Read new messages automatically" hint="Otherwise use “Re-scan” in the suggestions panel." />
            </div>
            <details className="text-xs text-neutral-500"><summary className="cursor-pointer hover:text-neutral-300">Shorthand the brain understands</summary><p className="mt-2 leading-relaxed">{GLOSSARY}</p></details>
          </>}

          {tab === 'profile' && <>
            <Field label="Your name" hint="Shown on your messages and in the client's view."><Input value={owner} onChange={e => setOwner(e.target.value)} /></Field>
            <Field label="Workspace name"><Input value={ws} onChange={e => setWs(e.target.value)} /></Field>
            <Button variant="primary" onClick={() => { setSettings({ ownerName: owner.trim() || 'You', workspaceName: ws.trim() || 'My workspace' }); toast('Saved'); }}>Save</Button>
          </>}

          {tab === 'security' && <>
            <div className={cx('rounded-xl p-3 text-sm flex gap-2', encrypted ? 'bg-emerald-500/5 text-emerald-200' : 'bg-amber-500/5 text-amber-200')}>
              {encrypted ? <ShieldCheck size={18} /> : <Lock size={18} />}
              {encrypted ? 'Encrypted at rest with AES-256-GCM. The passphrase is never stored — if you lose it, the data cannot be recovered.' : 'Not encrypted. Anyone with access to this browser profile can read the workspace.'}
            </div>
            <Field label={encrypted ? 'New passphrase' : 'Passphrase'}><Input type="password" value={pass.a} onChange={e => setPass(x => ({ ...x, a: e.target.value }))} autoComplete="new-password" /></Field>
            <Field label="Repeat passphrase"><Input type="password" value={pass.b} onChange={e => setPass(x => ({ ...x, b: e.target.value }))} autoComplete="new-password" /></Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={encrypt} disabled={busy === 'enc'}>{busy === 'enc' ? <Spinner /> : encrypted ? 'Change passphrase' : 'Encrypt workspace'}</Button>
              {encrypted && <Button onClick={() => { onClose(); lock(); }}>Lock now</Button>}
              {encrypted && <Button variant="danger" onClick={async () => { await disableEncryption(); toast('Encryption turned off'); }}>Turn off encryption</Button>}
            </div>
            <p className="text-xs text-neutral-500">Client invite links open in this same browser, so with encryption on the workspace must be unlocked in that tab too. A hosted backend would remove this limit.</p>
          </>}

          {tab === 'data' && <>
            <p className="text-sm text-neutral-400">Everything lives in this browser (IndexedDB). Nothing is ever deleted; exports are complete records you can keep or move to another browser.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => download(`project-brain-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '', workerToken: '' } }, null, 2))}>Export workspace</Button>
              <Button onClick={() => fileRef.current.click()}>Import & merge</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { e.target.files[0] && importFile(e.target.files[0]); e.target.value = ''; }} />
            </div>
            <StorageUsage />
            <p className="text-xs text-neutral-500">Exports leave out your Gemini key and Worker token. Importing merges records by ID — existing history is never replaced.</p>
          </>}
        </div>
      </div>
    </Modal>
  );
}
