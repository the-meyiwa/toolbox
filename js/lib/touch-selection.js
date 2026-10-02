/* ============================================================
   TOOLBOX — Touch selection (phones and tablets)

   On touch screens the browser surrounds selected text with its own
   bubble (Copy, Look Up, Translate, Search…) and long presses with its
   own menus and link previews. Toolbox replaces all of that:

   - the browser's long-press menus, link/image callouts and drag
     previews are turned off everywhere outside text fields;
   - page text is not selected by the browser at all, so its bubble
     never appears. Instead, press and hold on text: Toolbox selects the
     word (with a light tap of haptics), drag to extend it, and lift to
     get Toolbox's own selection bar (Copy, Ask Assistant, Define…).
     Tap anywhere else to clear it.

   Text fields, editors and anything marked [data-native-selection]
   keep native editing, which typing, the caret and autofill need.
   ============================================================ */

import { showRange } from './squircle-selection.js';
import { openSelectionBar } from './text-actions.js';
import { closeContextMenu } from './context-menu.js';

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .cm-editor, .monaco-editor, [data-native-selection]';
const MENUS = '.finder-context-menu, .tb-text-popup, .sq-sel';
const HOLD_MS = 420;
const SLOP = 10;

const coarse = () => typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
const editable = (el) => !!el?.closest?.(EDITABLE);

/** A collapsed range at a screen point, in whichever form this browser offers. */
function caretAt(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  const pos = document.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const r = document.createRange();
  r.setStart(pos.offsetNode, pos.offset);
  r.collapse(true);
  return r;
}

/** The word around an offset in a text node. */
function wordAt(node, offset) {
  const text = node.nodeValue || '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    for (const seg of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)) {
      if (offset >= seg.index && offset <= seg.index + seg.segment.length && seg.isWordLike) return [seg.index, seg.index + seg.segment.length];
    }
  }
  let a = offset, b = offset;
  while (a > 0 && /[\p{L}\p{N}_'’-]/u.test(text[a - 1])) a--;
  while (b < text.length && /[\p{L}\p{N}_'’-]/u.test(text[b])) b++;
  return a < b ? [a, b] : null;
}

export function installTouchSelection() {
  if (typeof document === 'undefined' || window.__toolboxTouchSelection || !coarse()) return;
  window.__toolboxTouchSelection = true;
  document.documentElement.classList.add('tb-touch');

  // The browser's own long-press menu never shows outside fields. This runs last (bubbling, on
  // window), after Toolbox's own menus have had their chance to open.
  window.addEventListener('contextmenu', (e) => { if (!editable(e.target)) e.preventDefault(); });
  // No dragging links and images out (that opens the browser's drag preview).
  document.addEventListener('dragstart', (e) => { if (e.pointerType !== 'mouse' && !e.target.closest?.('[draggable="true"], [data-tb-file]')) e.preventDefault(); }, true);

  let timer = 0;
  let start = null;        // where the finger went down
  let anchor = null;       // the first word selected: [node, from, to]
  let range = null;        // the current selection
  let extending = false;
  let swallowClick = false;

  const clear = () => {
    range = null; anchor = null; extending = false;
    showRange(null);
  };

  const select = (x, y) => {
    const caret = caretAt(x, y);
    const node = caret?.startContainer;
    if (!node || node.nodeType !== 3 || editable(node.parentElement) || node.parentElement?.closest(MENUS)) return false;
    const word = wordAt(node, caret.startOffset);
    if (!word) return false;
    anchor = [node, word[0], word[1]];
    range = document.createRange();
    range.setStart(node, word[0]);
    range.setEnd(node, word[1]);
    showRange(range);
    try { navigator.vibrate?.(8); } catch { /* not allowed */ }
    return true;
  };

  /** Drag after the hold: the selection runs from the first word to the word under the finger. */
  const extendTo = (x, y) => {
    const caret = caretAt(x, y);
    const node = caret?.startContainer;
    if (!anchor || !node || node.nodeType !== 3 || editable(node.parentElement)) return;
    const word = wordAt(node, caret.startOffset) || [caret.startOffset, caret.startOffset];
    const a = document.createRange(); a.setStart(anchor[0], anchor[1]);
    const b = document.createRange(); b.setStart(node, word[0]);
    const r = document.createRange();
    if (a.compareBoundaryPoints(Range.START_TO_START, b) <= 0) { r.setStart(anchor[0], anchor[1]); r.setEnd(node, word[1]); }
    else { r.setStart(node, word[0]); r.setEnd(anchor[0], anchor[2]); }
    if (r.collapsed) return;
    range = r;
    showRange(range);
  };

  const openBar = () => {
    if (!range) return;
    const text = range.toString();
    if (!text.trim()) { clear(); return; }
    const target = range.startContainer.parentElement;
    openSelectionBar({ text, target, range: range.cloneRange(), editable: null, writable: false, html: null, rect: range.getBoundingClientRect() });
  };

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { clearTimeout(timer); return; }
    const t = e.touches[0];
    const el = e.target;
    // A tap outside the bar clears Toolbox's selection.
    if (range && !el.closest?.(MENUS)) { clear(); closeContextMenu(); }
    if (editable(el) || el.closest?.(MENUS)) return;
    start = { x: t.clientX, y: t.clientY };
    extending = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!start) return;
      if (select(start.x, start.y)) { extending = true; swallowClick = true; }
    }, HOLD_MS);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t) return;
    if (extending) {
      // While extending, the finger drags the selection, not the page.
      if (e.cancelable) e.preventDefault();
      extendTo(t.clientX, t.clientY);
      return;
    }
    if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > SLOP) { clearTimeout(timer); start = null; }
  }, { passive: false, capture: true });

  const end = () => {
    clearTimeout(timer);
    start = null;
    if (extending) { extending = false; openBar(); }
  };
  document.addEventListener('touchend', end, { capture: true });
  document.addEventListener('touchcancel', () => { clearTimeout(timer); start = null; if (extending) { extending = false; openBar(); } }, { capture: true });

  // The click a long press produces must not also follow a link or press a button.
  document.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    if (!e.target.closest?.(MENUS)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.addEventListener('hashchange', clear);
}
