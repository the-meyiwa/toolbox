/* ============================================================
   TOOLBOX — DOM morph

   Updates a live element to match new markup without rebuilding it:
   nodes that did not change are left exactly as they are (icons are
   not re-created, images do not reload, running animations are not
   restarted, focus and selection survive); changed attributes and text
   are patched; list items keep their identity by key (data-path,
   data-key or id) so a re-sorted list moves nodes instead of
   recreating them.
   ============================================================ */

// Pieces that scripts add after rendering (a sliding pill, an indicator) are not in the markup;
// they are left in place, so they keep gliding instead of being torn out on every update.
const KEEP = '.segmented-slider-pill, [data-morph-keep]';
const kept = (n) => n.nodeType === 1 && n.matches?.(KEEP);

const keyOf = (n) => (n.nodeType === 1 ? (n.getAttribute('data-path') || n.getAttribute('data-key') || n.id || null) : null);

function syncAttributes(from, to) {
  // Inline styles a script set (positions, sizes) stay unless the markup now sets its own.
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name) && name !== 'style') from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  // Form state lives in properties, not attributes.
  if (from.tagName === 'INPUT' || from.tagName === 'TEXTAREA') {
    if (from !== document.activeElement && from.value !== to.value) from.value = to.value;
    if ('checked' in from) from.checked = to.checked;
  } else if (from.tagName === 'SELECT' && from.value !== to.value) from.value = to.value;
}

function same(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  if (a.tagName !== b.tagName) return false;
  const ka = keyOf(a), kb = keyOf(b);
  return ka === kb;
}

function morphNode(from, to) {
  if (from.nodeType === 3 || from.nodeType === 8) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  if (from.isEqualNode(to)) return;
  syncAttributes(from, to);
  // An SVG or other leaf-ish subtree that changed is cheaper and safer to replace whole.
  if (from.namespaceURI === 'http://www.w3.org/2000/svg' && from.tagName.toLowerCase() === 'svg') {
    if (from.innerHTML !== to.innerHTML) from.innerHTML = to.innerHTML;
    return;
  }
  morphChildren(from, to);
}

/** Make `parent`'s children match `next`'s children. */
export function morphChildren(parent, next) {
  const want = [...next.childNodes];
  const have = [...parent.childNodes];
  const keyed = new Map();
  for (const n of have) { const k = keyOf(n); if (k) keyed.set(k, n); }
  let cursor = parent.firstChild;
  const skipKept = () => { while (cursor && kept(cursor)) cursor = cursor.nextSibling; };
  for (const w of want) {
    skipKept();
    const k = keyOf(w);
    let match = null;
    if (k && keyed.has(k)) { match = keyed.get(k); keyed.delete(k); if (match.tagName !== w.tagName) match = null; }
    else if (!k && cursor && same(cursor, w)) match = cursor;
    if (match) {
      if (match !== cursor) parent.insertBefore(match, cursor);
      morphNode(match, w);
      cursor = match.nextSibling;
    } else {
      const fresh = document.importNode(w, true);
      parent.insertBefore(fresh, cursor);
    }
  }
  // Whatever was not matched is gone.
  while (cursor) { const nextSib = cursor.nextSibling; if (!kept(cursor)) cursor.remove(); cursor = nextSib; }
  for (const leftover of keyed.values()) if (leftover.parentNode === parent && !kept(leftover)) leftover.remove();
}

/** Morph `el`'s contents to `html`. The first call (empty element) just sets it. */
export function morphHtml(el, html) {
  if (!el.firstChild) { el.innerHTML = html; return; }
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphChildren(el, tpl.content);
}
