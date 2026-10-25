// Shorthand people use in client chats. Used two ways:
//  1. expand() normalises text before the built-in rules look for intent.
//  2. GLOSSARY is handed to Gemini so it reads the same shorthand.

export const SHORTHAND = {
  // credentials & accounts
  pass: 'password', passwd: 'password', pwd: 'password', pw: 'password', pswd: 'password', psw: 'password',
  pword: 'password', 'p/w': 'password', pwds: 'passwords', creds: 'credentials', cred: 'credential',
  usr: 'username', uname: 'username', 'u/n': 'username', acc: 'account', acct: 'account', accs: 'accounts',
  otp: 'one-time code', '2fa': 'two-factor code', apikey: 'api key',
  // info & documents
  info: 'information', infos: 'information', inf: 'information', deets: 'details', dets: 'details',
  doc: 'document', docs: 'documents', txt: 'text file', spec: 'specification', specs: 'specifications',
  req: 'requirement', reqs: 'requirements', ref: 'reference', refs: 'references', att: 'attachment', attch: 'attachment',
  ss: 'screenshot', scrn: 'screenshot', screenie: 'screenshot', img: 'image', imgs: 'images', pic: 'picture', pics: 'pictures',
  vid: 'video', vids: 'videos', lnk: 'link', ver: 'version', rev: 'revision', inv: 'invoice', est: 'estimate',
  // contact
  mail: 'email', 'e-mail': 'email', eml: 'email', emails: 'emails', addr: 'address', ph: 'phone', phn: 'phone',
  tel: 'phone', mob: 'mobile', cell: 'mobile phone', num: 'number', wa: 'whatsapp', msg: 'message', msgs: 'messages',
  dm: 'direct message', mtg: 'meeting', mtng: 'meeting',
  // environments & tech
  stg: 'staging', stage: 'staging', prod: 'production', dev: 'development', env: 'environment', db: 'database',
  repo: 'repository', fe: 'frontend', be: 'backend', ui: 'user interface', ux: 'user experience', bg: 'background',
  btn: 'button', nav: 'navigation', hdr: 'header', ftr: 'footer', pg: 'page', pgs: 'pages', mvp: 'first version',
  // politeness & reactions
  pls: 'please', plz: 'please', pl: 'please', plss: 'please', pleasee: 'please', kindly: 'please',
  thx: 'thanks', thnx: 'thanks', tnx: 'thanks', ty: 'thanks', tysm: 'thanks', np: 'no problem',
  k: 'ok', kk: 'ok', okk: 'ok', okie: 'ok', okay: 'ok', yep: 'yes', yup: 'yes', ya: 'yes', nope: 'no',
  lgtm: 'looks good to me', gtg: 'good to go', nvm: 'never mind', idk: 'i do not know', imo: 'in my opinion',
  btw: 'by the way', fyi: 'for your information', asap: 'as soon as possible', imp: 'important', urgnt: 'urgent',
  // time
  tmrw: 'tomorrow', tmr: 'tomorrow', tomo: 'tomorrow', '2moro': 'tomorrow', '2mrw': 'tomorrow', tdy: 'today',
  '2day': 'today', yday: 'yesterday', tonite: 'tonight', eod: 'end of day', eow: 'end of week', eom: 'end of month',
  wk: 'week', wks: 'weeks', wkend: 'weekend', hr: 'hour', hrs: 'hours', min: 'minute', mins: 'minutes',
  // grammar shortcuts
  'w/': 'with', 'w/o': 'without', b4: 'before', bc: 'because', bcz: 'because', cuz: 'because', coz: 'because',
  u: 'you', ur: 'your', r: 'are', n: 'and', '&': 'and', abt: 'about', smth: 'something', sth: 'something',
  approx: 'approximately', qty: 'quantity', amt: 'amount', diff: 'different', pref: 'preferably', thru: 'through',
};

const entries = Object.entries(SHORTHAND).sort((a, b) => b[0].length - a[0].length);
const esc = s => s.replace(/[.*+?^${}()|[\]\\/&]/g, '\\$&');
const RE = new RegExp(`(^|[^\\w@.\\-/])(${entries.map(e => esc(e[0])).join('|')})(?=$|[^\\w@\\-])`, 'gi');

/** Replace shorthand tokens with their long form (for rule matching, never for display). */
export const expand = t => (t || '').replace(RE, (m, pre, w) => pre + (SHORTHAND[w.toLowerCase()] ?? w));

export const GLOSSARY = entries.map(([k, v]) => `${k}=${v}`).join(', ');
