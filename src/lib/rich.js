// Small helpers for the contentEditable editors (chat composer, template editor).

/** Formatted HTML that is safe to insert: no scripts, frames, event handlers or javascript: links. */
export function cleanHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button').forEach(n => n.remove());
  for (const el of doc.body.querySelectorAll('*')) {
    for (const a of [...el.attributes]) {
      const v = a.value.trim().toLowerCase();
      if (a.name.startsWith('on') || ((a.name === 'href' || a.name === 'src') && (v.startsWith('javascript:') || v.startsWith('data:text')))) el.removeAttribute(a.name);
    }
  }
  return doc.body.innerHTML;
}

/** Caret position as a character offset into the editor's text, or null if the caret is elsewhere. */
export function getCaret(el) {
  const sel = window.getSelection();
  if (!el || !sel || !sel.rangeCount || !el.contains(sel.focusNode)) return null;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(sel.focusNode, sel.focusOffset);
  return r.toString().length;
}

/** Put the caret back at a character offset (end of the text if it's past it). */
export function setCaret(el, offset) {
  if (!el) return;
  const sel = window.getSelection();
  const r = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n, left = Math.max(0, offset ?? Infinity);
  while ((n = walker.nextNode())) {
    if (left <= n.length) { r.setStart(n, left); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return; }
    left -= n.length;
  }
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Text before the caret inside the current text node (for @mention / #template triggers). */
export function textBeforeCaret() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  return { node, offset: range.startOffset, text: node.textContent.slice(0, range.startOffset) };
}

/** Remove the `length` characters right before the caret (the typed trigger) and leave the caret there. */
export function eraseBeforeCaret(length) {
  const at = textBeforeCaret();
  if (!at) return false;
  const start = Math.max(0, at.offset - length);
  at.node.textContent = at.node.textContent.slice(0, start) + at.node.textContent.slice(at.offset);
  const r = document.createRange();
  r.setStart(at.node, start);
  r.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
}
