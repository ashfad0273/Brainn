// Reading attachments in the browser, before anything is sent to an AI provider.
// Every supported file becomes the same structured JSON:
//   { kind, name, mime, pages?, blocks: [...], warnings: [] }
//   block = { type: 'heading', level, text } | { type: 'paragraph', text, bold?: [], underline?: [] }
//         | { type: 'list', ordered, items: [] } | { type: 'table', rows: [[cell]] }
//         | { type: 'image', page?, width?, height?, ocrText, note? }
// PDFs: text layer via pdf.js (scanned pages are rendered and OCR'd). Word (.docx): mammoth.
// Images: OCR with tesseract.js. The libraries load on demand; the OCR engine and its English
// language data are downloaded once from a CDN, but the file itself never leaves the browser here.

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ocrWorkerUrl from 'tesseract.js/dist/worker.min.js?url';

const MAX_PAGES = 60, MAX_OCR_PAGES = 12, MAX_DOC_IMAGES = 10, VISION_PAGES = 4;

export function readableKind(a) {
  const n = (a.name || '').toLowerCase(), m = a.mime || '';
  if (a.kind === 'voice') return null;
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx') || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (/^image\/(png|jpe?g|webp|gif|bmp)$/.test(m) || /\.(png|jpe?g|webp|gif|bmp)$/.test(n)) return 'image';
  if (/^text\//.test(m) || /\.(txt|md|markdown|csv|tsv|json|rtf)$/.test(n)) return 'text';
  return null;
}

/* ---------- OCR ---------- */

function ocrEngine(onProgress) {
  let w = null;
  return {
    async recognize(img) {
      if (!w) {
        onProgress?.('Loading the OCR engine…');
        const { createWorker } = await import('tesseract.js');
        w = await createWorker('eng', 1, { workerPath: ocrWorkerUrl });
      }
      const { data } = await w.recognize(img);
      return data;
    },
    async done() { if (w) await w.terminate(); },
  };
}
/** OCR result → paragraphs (tesseract's own layout, or blank-line separated text). */
function ocrParagraphs(data) {
  const paras = data.paragraphs?.length ? data.paragraphs.map(p => p.text)
    : data.blocks?.length ? data.blocks.flatMap(b => (b.paragraphs || []).map(p => p.text))
      : String(data.text || '').split(/\n\s*\n/);
  return paras.map(t => t.replace(/\s*\n\s*/g, ' ').trim()).filter(t => t.length > 1);
}
const ocrText = data => ocrParagraphs(data).join('\n');

/* ---------- images ---------- */

async function imageSize(blob) {
  try { const b = await createImageBitmap(blob); const s = { width: b.width, height: b.height }; b.close?.(); return s; } catch { return {}; }
}
/** A downscaled JPEG (base64) for Gemini vision — only made when the owner asked for it. */
export async function toVisionImage(src, max = 1600) {
  const bmp = src instanceof HTMLCanvasElement ? src : await createImageBitmap(src);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.85);
  return { mime: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

async function readImage(blob, ocr) {
  const size = await imageSize(blob);
  const data = await ocr.recognize(blob);
  const paras = ocrParagraphs(data);
  return {
    pages: 1,
    blocks: [{ type: 'image', ...size, ocrText: paras.join('\n'), confidence: Math.round(data.confidence || 0), note: paras.length ? 'text read from the image with OCR' : 'no readable text in the image' }],
  };
}

/* ---------- PDF ---------- */

const BULLET = /^\s*(?:[•●▪◦‣∙·\-–*]|\(?\d{1,3}[.)]|\(?[a-z][.)])\s+/i;

/** Text items of one page → lines (top to bottom), each with its segments and font size. */
function pdfLines(items, fontName) {
  const segs = items.filter(i => i.str && i.str.trim()).map(i => ({
    str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, size: Math.hypot(i.transform[2], i.transform[3]) || Math.abs(i.transform[0]) || 10,
    bold: /bold|black|heavy|semibold|demi/i.test(fontName(i.fontName)),
  }));
  segs.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const s of segs) {
    const l = lines.find(x => Math.abs(x.y - s.y) < Math.max(2, x.size * 0.45));
    if (l) { l.segs.push(s); l.size = Math.max(l.size, s.size); } else lines.push({ y: s.y, size: s.size, segs: [s] });
  }
  for (const l of lines) {
    l.segs.sort((a, b) => a.x - b.x);
    // cells: runs of text separated by a wide gap (columns of a table)
    l.cells = [];
    let cur = null;
    for (const s of l.segs) {
      if (cur && s.x - (cur.end) > l.size * 1.8) { l.cells.push(cur); cur = null; }
      if (!cur) cur = { text: '', end: 0 };
      cur.text += (cur.text && !/\s$/.test(cur.text) && s.x - cur.end > l.size * 0.15 ? ' ' : '') + s.str;
      cur.end = s.x + s.w;
    }
    if (cur) l.cells.push(cur);
    l.text = l.cells.map(c => c.text.trim()).join('  ').replace(/\s+/g, ' ').trim();
    l.bold = l.segs.every(s => s.bold);
    l.boldParts = l.segs.filter(s => s.bold).map(s => s.str.trim()).filter(Boolean);
  }
  return lines.sort((a, b) => b.y - a.y);
}

function linesToBlocks(lines, body, page) {
  const blocks = [];
  let para = null, list = null, table = null;
  const flush = () => {
    if (para) { blocks.push({ type: 'paragraph', page, text: para.text, ...(para.bold.length ? { bold: [...new Set(para.bold)] } : {}) }); para = null; }
    if (list) { blocks.push({ type: 'list', page, ordered: list.ordered, items: list.items }); list = null; }
    if (table) { if (table.rows.length >= 2) blocks.push({ type: 'table', page, rows: table.rows }); else blocks.push({ type: 'paragraph', page, text: table.rows[0].join(' ') }); table = null; }
  };
  let prevY = null;
  for (const l of lines) {
    const gap = prevY == null ? 0 : prevY - l.y;
    prevY = l.y;
    if (l.cells.length >= 2 && !BULLET.test(l.text)) {
      if (!table || Math.abs(table.cols - l.cells.length) > 1) { flush(); table = { cols: l.cells.length, rows: [] }; }
      table.rows.push(l.cells.map(c => c.text.trim()));
      continue;
    }
    const big = l.size >= body * 1.25, short = l.text.length <= 120;
    if ((big || (l.bold && l.text.length <= 80)) && short) {
      flush();
      blocks.push({ type: 'heading', page, level: l.size >= body * 1.8 ? 1 : l.size >= body * 1.4 ? 2 : 3, text: l.text });
      continue;
    }
    if (BULLET.test(l.text)) {
      const ordered = /^\s*\(?[\da-z]{1,3}[.)]\s/i.test(l.text);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(l.text.replace(BULLET, '').trim());
      continue;
    }
    if (list && gap < l.size * 1.6 && list.items.length) { list.items[list.items.length - 1] += ' ' + l.text; continue; }
    if (para && gap < l.size * 1.7 && Math.abs(gap) > 0) { para.text += (para.text.endsWith('-') ? '' : ' ') + l.text; para.bold.push(...l.boldParts); continue; }
    flush();
    para = { text: l.text, bold: [...l.boldParts] };
  }
  flush();
  return blocks;
}

async function renderPage(page, scale = 2) {
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c;
}

async function readPdf(blob, ocr, onProgress, wantVision) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const IMG = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageXObjectRepeat].filter(Boolean));
  const blocks = [], warnings = [], vision = [];
  let ocrPages = 0;
  const n = Math.min(pdf.numPages, MAX_PAGES);
  if (pdf.numPages > n) warnings.push(`Only the first ${n} of ${pdf.numPages} pages were read.`);

  // body font size = the most common size across the document (headings are bigger)
  const pages = [];
  for (let i = 1; i <= n; i++) {
    onProgress?.(`Reading page ${i} of ${n}…`);
    const page = await pdf.getPage(i);
    const ops = await page.getOperatorList();
    const images = ops.fnArray.filter(f => IMG.has(f)).length;
    const tc = await page.getTextContent();
    const fontName = id => { try { return page.commonObjs.get(id)?.name || ''; } catch { return ''; } };
    pages.push({ i, page, images, lines: pdfLines(tc.items, fontName) });
  }
  const sizes = {};
  pages.forEach(pg => pg.lines.forEach(l => { const k = Math.round(l.size); sizes[k] = (sizes[k] || 0) + l.text.length; }));
  const body = +Object.entries(sizes).sort((a, b) => b[1] - a[1])[0]?.[0] || 10;

  for (const pg of pages) {
    const chars = pg.lines.reduce((a, l) => a + l.text.length, 0);
    if (chars < 25) {
      // no text layer: a scanned page (or a picture) → render it and OCR it
      if (ocrPages >= MAX_OCR_PAGES) { warnings.push(`Page ${pg.i} looks scanned but was not OCR'd (limit of ${MAX_OCR_PAGES} pages).`); continue; }
      onProgress?.(`OCR on scanned page ${pg.i}…`);
      const canvas = await renderPage(pg.page);
      const data = await ocr.recognize(canvas);
      ocrParagraphs(data).forEach(t => blocks.push(BULLET.test(t) ? { type: 'list', page: pg.i, ordered: false, items: [t.replace(BULLET, '')] } : { type: 'paragraph', page: pg.i, text: t, ocr: true }));
      if (wantVision && vision.length < VISION_PAGES) vision.push(await toVisionImage(canvas));
      ocrPages++;
      continue;
    }
    blocks.push(...linesToBlocks(pg.lines, body, pg.i));
    if (pg.images) blocks.push({ type: 'image', page: pg.i, count: pg.images, ocrText: '', note: `${pg.images} picture${pg.images > 1 ? 's' : ''} on this page (pictures inside a PDF with text are not OCR'd)` });
  }
  if (ocrPages) warnings.push(`${ocrPages} scanned page${ocrPages > 1 ? 's were' : ' was'} read with OCR.`);
  warnings.push('Underlined text cannot be detected in PDFs; bold is detected from font names.');
  return { pages: pdf.numPages, blocks, warnings, vision };
}

/* ---------- Word (.docx) ---------- */

/** Structured blocks from mammoth's HTML (headings, paragraphs with bold/underline, lists, tables, images). */
function htmlToBlocks(html, images) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks = [];
  const txt = el => el.textContent.replace(/\s+/g, ' ').trim();
  const marks = (el, sel) => [...el.querySelectorAll(sel)].map(txt).filter(Boolean);
  const pushImages = el => el.querySelectorAll('img').forEach(img => {
    const im = images[+img.getAttribute('data-i')];
    if (im) blocks.push({ type: 'image', alt: img.getAttribute('alt') || '', ocrText: im.ocrText || '', note: im.note });
  });
  for (const el of doc.body.children) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) { if (txt(el)) blocks.push({ type: 'heading', level: +tag[1], text: txt(el) }); }
    else if (tag === 'ul' || tag === 'ol') blocks.push({ type: 'list', ordered: tag === 'ol', items: [...el.querySelectorAll(':scope > li')].map(txt).filter(Boolean) });
    else if (tag === 'table') blocks.push({ type: 'table', rows: [...el.querySelectorAll('tr')].map(tr => [...tr.children].map(txt)) });
    else if (txt(el)) {
      const bold = marks(el, 'strong, b'), underline = marks(el, 'u');
      blocks.push({ type: 'paragraph', text: txt(el), ...(bold.length ? { bold } : {}), ...(underline.length ? { underline } : {}) });
    }
    pushImages(el);
  }
  return blocks;
}

async function readDocx(blob, ocr, onProgress, wantVision) {
  const mod = await import('mammoth/mammoth.browser.min.js');
  const mammoth = mod.default || mod;
  const images = [], vision = [];
  const res = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() }, {
    styleMap: ['u => u'],
    convertImage: mammoth.images.imgElement(async image => {
      const i = images.length;
      images.push({ type: image.contentType, b64: await image.read('base64') });
      return { src: '', 'data-i': String(i), alt: image.altText || '' };
    }),
  });
  for (const [i, im] of images.entries()) {
    if (i >= MAX_DOC_IMAGES) { im.note = 'picture not OCR\'d (limit reached)'; continue; }
    onProgress?.(`OCR on picture ${i + 1} of ${Math.min(images.length, MAX_DOC_IMAGES)}…`);
    try {
      const b = await (await fetch(`data:${im.type};base64,${im.b64}`)).blob();
      const data = await ocr.recognize(b);
      im.ocrText = ocrText(data);
      im.note = im.ocrText ? 'text read from the picture with OCR' : 'picture with no readable text';
      if (wantVision && vision.length < VISION_PAGES) vision.push(await toVisionImage(b));
    } catch { im.note = 'picture could not be read'; }
  }
  return { blocks: htmlToBlocks(res.value, images), warnings: res.messages.filter(m => m.type === 'warning').slice(0, 5).map(m => m.message), vision };
}

/* ---------- plain text / markdown / csv ---------- */

function readText(text, name) {
  const blocks = [];
  if (/\.(csv|tsv)$/i.test(name)) {
    const sep = /\.tsv$/i.test(name) ? '\t' : ',';
    const rows = text.split(/\r?\n/).filter(Boolean).slice(0, 400).map(r => r.split(sep).map(c => c.replace(/^"|"$/g, '').trim()));
    return { blocks: [{ type: 'table', rows }] };
  }
  let list = null;
  for (const raw of text.split(/\r?\n\s*\r?\n|\r?\n(?=#|\s*[-*•] |\s*\d+[.)] )/)) {
    const t = raw.trim();
    if (!t) continue;
    const h = t.match(/^(#{1,6})\s+(.+)/);
    if (h) { list = null; blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() }); continue; }
    if (BULLET.test(t)) {
      const ordered = /^\s*\d+[.)]/.test(t);
      if (!list || list.ordered !== ordered) { list = { type: 'list', ordered, items: [] }; blocks.push(list); }
      list.items.push(t.replace(BULLET, '').replace(/\s+/g, ' '));
      continue;
    }
    list = null;
    const bold = [...t.matchAll(/\*\*(.+?)\*\*|__(.+?)__/g)].map(m => m[1] || m[2]);
    blocks.push({ type: 'paragraph', text: t.replace(/\s+/g, ' ').replace(/\*\*|__/g, ''), ...(bold.length ? { bold } : {}) });
  }
  return { blocks };
}

/**
 * File → structured JSON (+ optional vision images for Gemini).
 * opts.vision: also prepare the image(s) themselves, for when the owner lets Gemini look at them.
 */
export async function readFile(blob, { name, mime }, { onProgress, vision: wantVision = false } = {}) {
  const kind = readableKind({ name, mime });
  if (!kind) throw new Error('This file type can’t be read yet (supported: PDF, Word .docx, images, text).');
  const ocr = ocrEngine(onProgress);
  try {
    let r;
    if (kind === 'pdf') r = await readPdf(blob, ocr, onProgress, wantVision);
    else if (kind === 'docx') r = await readDocx(blob, ocr, onProgress, wantVision);
    else if (kind === 'image') {
      onProgress?.('Reading text in the image…');
      r = await readImage(blob, ocr);
      if (wantVision) r.vision = [await toVisionImage(blob)];
    } else r = readText(await blob.text(), name);
    const doc = { kind, name, mime, ...(r.pages ? { pages: r.pages } : {}), blocks: r.blocks, ...(r.warnings?.length ? { warnings: r.warnings } : {}) };
    return { doc, vision: r.vision || [] };
  } finally {
    await ocr.done();
  }
}

/** Short stats for the UI. */
export function docStats(doc) {
  const c = t => doc.blocks.filter(b => b.type === t).length;
  const chars = JSON.stringify(doc.blocks).length;
  return { headings: c('heading'), paragraphs: c('paragraph'), lists: c('list'), tables: c('table'), images: c('image'), chars };
}
