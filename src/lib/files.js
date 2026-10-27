import { uid } from './util';
import { putBlob, isQuotaError } from './blobs';

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

/** Automatically downscales and compresses large camera photos so they fit within the 1.8 MB storage limit. */
export async function optimizeImageIfNeeded(file, maxBytes = 1_500_000, maxDimension = 2048) {
  if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }
  if (file.size <= 1_200_000) return file;

  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        if (!width || !height) return resolve(file);

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(blob => {
          if (!blob) return resolve(file);
          if (blob.size <= maxBytes) {
            const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            return resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
          }

          const s = Math.min(1440 / Math.max(width, height), 0.75);
          const w2 = Math.round(width * s);
          const h2 = Math.round(height * s);
          const c2 = document.createElement('canvas');
          c2.width = w2;
          c2.height = h2;
          const ctx2 = c2.getContext('2d');
          if (!ctx2) return resolve(file);
          ctx2.drawImage(img, 0, 0, w2, h2);

          c2.toBlob(b2 => {
            if (!b2) return resolve(file);
            const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([b2], name, { type: 'image/jpeg', lastModified: Date.now() }));
          }, 'image/jpeg', 0.75);
        }, 'image/jpeg', 0.82);
      } catch (err) {
        console.warn('Image optimization skipped:', err);
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/** Browser File → attachment record. The original bytes go to IndexedDB (lib/blobs); the record only references them. */
export async function toAttachment(origFile, kind) {
  const file = await optimizeImageIfNeeded(origFile);
  if (file.size > 1_850_000) {
    throw new Error(`“${file.name}” (${(file.size / 1048576).toFixed(1)} MB) exceeds the 1.8 MB storage limit. Choose a smaller file or enable Cloudflare R2.`);
  }
  const k = kind || (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name) ? 'image' : 'file');
  const id = uid('a');
  try { await putBlob(id, file); }
  catch (e) {
    throw new Error(isQuotaError(e)
      ? `Browser storage is full — “${file.name}” (${(file.size / 1048576).toFixed(1)} MB) was not saved. Free up space and try again.`
      : `Could not store “${file.name}”: ${e.message}`);
  }
  return {
    id,
    name: file.name || 'file',
    size: file.size,
    mime: file.type || '',
    kind: k,
    category: k === 'voice' ? 'Audio' : categorizeFile(file.name, file.type),
    stored: true,
  };
}
