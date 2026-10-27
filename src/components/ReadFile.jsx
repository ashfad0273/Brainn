import { useState } from 'react';
import { ScanText, ShieldCheck, Eye, ChevronDown, Sparkles } from '@/lib/icons';
import { useStore } from '../store';
import { useP, Modal, Button, Toggle, Spinner, Badge } from './ui';
import { readAttachment } from '../lib/brain';
import { aiReady, PROVIDERS } from '../lib/gemini';
import { readableKind } from '../lib/docread';
import { cx } from '../lib/util';

const LAST = 'pb-read-provider';
const CHOICES = [
  ['gemini', 'Gemini', 'Google’s model. Can also look at the picture itself if you allow it below.'],
  ['cloudflare', 'Cloudflare AI', 'Your own Worker. Text models only: it reads the extracted text and OCR, not the pixels.'],
];

/** Shows what the AI read in a file: description, image context and the structured JSON that was sent. */
export function ReadingView({ r }) {
  const [json, setJson] = useState(false);
  const s = r.stats || {};
  return (
    <div className="space-y-3">
      {r.description && <p className="text-sm text-foreground whitespace-pre-wrap">{r.description}</p>}
      {r.imageContext && <div className="rounded-xl bg-field ring-1 ring-border p-3"><div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Eye size={12} />Images & visuals</div><p className="text-sm text-foreground whitespace-pre-wrap">{r.imageContext}</p></div>}
      <div className="flex flex-wrap gap-1.5">
        {['headings', 'paragraphs', 'lists', 'tables', 'images'].filter(k => s[k]).map(k => <Badge key={k}>{s[k]} {k}</Badge>)}
        {r.truncated && <Badge tone="amber">long file — only the first part was sent</Badge>}
        {r.vision && <Badge tone="sky">Gemini saw the image</Badge>}
      </div>
      {r.doc && (
        <div>
          <button onClick={() => setJson(!json)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ChevronDown size={13} className={cx('transition', json && 'rotate-180')} />Structured JSON sent to the AI (secrets masked)
          </button>
          {json && <pre className="mt-2 text-xs leading-relaxed bg-modal-scrim rounded-xl p-3 overflow-auto max-h-72 text-muted-foreground">{JSON.stringify(r.doc, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}

/** Pick Gemini or Cloudflare, then read one attachment: extract in the browser → redact → AI → suggestions. */
export default function ReadFileModal({ message, attachment, onClose }) {
  const { p } = useP();
  const { state, stateRef, mutate, toast } = useStore();
  const ready = Object.fromEntries(CHOICES.map(([k]) => [k, aiReady({ ...state.settings, provider: k })]));
  const remembered = (() => { try { return localStorage.getItem(LAST); } catch { return null; } })();
  const [provider, setProvider] = useState(ready[remembered] ? remembered : ready.gemini ? 'gemini' : ready.cloudflare ? 'cloudflare' : '');
  const [vision, setVision] = useState(false);
  const [step, setStep] = useState('choose'); // choose | busy | done
  const [progress, setProgress] = useState('');
  const [res, setRes] = useState(null);
  const kind = readableKind(attachment);
  const visual = kind === 'image' || kind === 'pdf' || kind === 'docx';

  const run = async () => {
    try { localStorage.setItem(LAST, provider); } catch { /* storage blocked */ }
    setStep('busy');
    try {
      const latest = () => stateRef.current.projects.find(x => x.id === p.id);
      const r = await readAttachment({
        state: stateRef.current, project: latest(), message, attachment, provider, vision: vision && provider === 'gemini',
        mutate, latest, onProgress: setProgress,
      });
      setRes({ ...r, vision: vision && provider === 'gemini' });
      setStep('done');
      toast(r.count ? `✨ ${r.count} suggestion${r.count > 1 ? 's' : ''} from ${attachment.name}` : `Read ${attachment.name} — nothing new to record`);
    } catch (e) {
      console.error(e);
      toast(`Couldn’t read the file: ${e.message}`, 'error');
      setStep('choose');
    }
  };

  return (
    <Modal title={`Read “${attachment.name}”`} sub="The file is converted to structured text in your browser (headings, bold, lists, tables, OCR of images). Only that JSON — with secrets redacted — is sent." onClose={step === 'busy' ? () => {} : onClose}
      footer={step === 'choose'
        ? <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!provider} onClick={run}><ScanText size={15} />Read file</Button></>
        : step === 'done' ? <Button variant="primary" onClick={onClose}>Done</Button> : null}>
      {step === 'choose' && (
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Which AI should read it?</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {CHOICES.map(([k, title, text]) => (
                <button key={k} type="button" disabled={!ready[k]} onClick={() => setProvider(k)}
                  className={cx('text-left rounded-xl p-3 ring-1 ring-inset transition disabled:opacity-40 disabled:cursor-not-allowed', provider === k ? 'bg-primary-soft ring-blue-ring' : 'ring-border hover:bg-field-hover')}>
                  <div className="text-sm font-medium text-foreground flex items-center gap-2"><span className={cx('w-2 h-2 rounded-full', provider === k ? 'bg-primary' : 'bg-grey-400')} />{title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{ready[k] ? text : `Not set up — add ${PROVIDERS[k]} in Settings → AI.`}</div>
                </button>
              ))}
            </div>
          </div>
          {provider === 'gemini' && visual && (
            <div className="rounded-xl ring-1 ring-amber-ring bg-warn-soft p-3">
              <Toggle checked={vision} onChange={setVision} label="Also let Gemini see the image itself"
                hint={`For pictures, mockups and scanned pages, OCR only finds text. With this on, the ${kind === 'image' ? 'image' : 'pictures / scanned pages'} are sent to Google as-is — text inside a picture can't be redacted.`} />
            </div>
          )}
          <p className="text-xs text-muted-foreground flex items-start gap-1.5"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-pos" />Passwords, keys, tokens and card / account numbers become [SECRET_n] before sending. The OCR engine is downloaded once; the file itself stays in your browser{vision && provider === 'gemini' ? ' (except the image you chose to share)' : ''}.</p>
        </div>
      )}
      {step === 'busy' && <div className="py-10 text-center text-sm text-muted-foreground"><Spinner size={20} /><div className="mt-3">{progress || 'Starting…'}</div></div>}
      {step === 'done' && res && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm"><Sparkles size={15} className="text-primary" />{res.count ? `${res.count} suggestion${res.count > 1 ? 's' : ''} added — review them in Suggestions.` : 'Nothing new to record from this file.'}</div>
          <ReadingView r={res} />
        </div>
      )}
    </Modal>
  );
}
