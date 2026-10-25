import { uid } from './util';

const BY_NAME = [
  ['Contracts & finance', /\b(contract|agreement|nda|sow|invoice|quote|quotation|proposal|receipt|estimate|po)\b/i],
  ['Brand assets', /\b(brand|branding|logo|logos|guideline|guidelines|styleguide|style guide|font|fonts|palette)\b/i],
  ['Briefs & specs', /\b(brief|spec|specs|requirement|requirements|scope|sitemap|wireframe|wireframes)\b/i],
];
const BY_EXT = [
  ['Images', /\.(png|jpe?g|gif|webp|svg|heic|bmp|tiff?|avif)$/i],
  ['Design files', /\.(fig|sketch|xd|psd|ai|indd|eps)$/i],
  ['Video', /\.(mp4|mov|avi|mkv|webm|m4v)$/i],
  ['Audio', /\.(mp3|wav|m4a|ogg|aac|weba|flac)$/i],
  ['Spreadsheets', /\.(xlsx?|csv|ods|numbers|tsv)$/i],
  ['Presentations', /\.(pptx?|key|odp)$/i],
  ['Documents', /\.(pdf|docx?|txt|md|rtf|odt|pages)$/i],
  ['Archives', /\.(zip|rar|7z|tar|gz|tgz)$/i],
  ['Code', /\.(jsx?|tsx?|html?|css|scss|json|py|php|rb|java|go|sql|sh|ya?ml|xml)$/i],
];
export const FILE_CATEGORIES = ['Brand assets', 'Briefs & specs', 'Contracts & finance', 'Images', 'Design files', 'Documents',
  'Spreadsheets', 'Presentations', 'Video', 'Audio', 'Archives', 'Code', 'Environments', 'Shared drives', 'Links', 'Other'];

export function categorizeFile(name = '', mime = '') {
  const n = name.replace(/[_\-.]/g, ' ');
  for (const [c, re] of BY_NAME) if (re.test(n)) return c;
  for (const [c, re] of BY_EXT) if (re.test(name)) return c;
  if (mime.startsWith('image/')) return 'Images';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('video/')) return 'Video';
  return 'Other';
}

export function categorizeLink(url = '') {
  const u = url.toLowerCase();
  if (/figma\.com|canva\.com|dribbble|behance|framer\.com|miro\.com/.test(u)) return 'Design files';
  if (/docs\.google|notion\.so|notion\.site|confluence|coda\.io|paper\.dropbox/.test(u)) return 'Documents';
  if (/drive\.google|dropbox\.com|wetransfer|onedrive|sharepoint|box\.com|icloud\.com/.test(u)) return 'Shared drives';
  if (/github\.com|gitlab|bitbucket|vercel\.app|netlify\.app/.test(u)) return 'Code';
  if (/staging|\bstg\b|\/\/dev\.|localhost|preview|\/\/test\./.test(u)) return 'Environments';
  if (/youtube|youtu\.be|vimeo|loom\.com/.test(u)) return 'Video';
  return 'Links';
}

export function linkTitle(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    const path = u.pathname.replace(/\/$/, '');
    return u.hostname.replace(/^www\./, '') + (path ? (path.length > 28 ? path.slice(0, 28) + '…' : path) : '');
  } catch { return url.slice(0, 48); }
}

export const MAX_INLINE = 2 * 1024 * 1024;
export const readAsDataURL = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

/** Browser File → attachment record. Files up to 2 MB are kept inline so they can be downloaded later. */
export async function toAttachment(file, kind) {
  const k = kind || (file.type.startsWith('image/') ? 'image' : 'file');
  return {
    id: uid('a'),
    name: file.name || 'file',
    size: file.size,
    mime: file.type || '',
    kind: k,
    category: k === 'voice' ? 'Audio' : categorizeFile(file.name, file.type),
    dataUrl: file.size <= MAX_INLINE ? await readAsDataURL(file) : null,
  };
}
