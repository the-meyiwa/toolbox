/* ============================================================
   TOOLBOX — Back stack

   Anything the person can dismiss (a sheet, a panel, a pop-up)
   registers a closer here while it is open. The edge swipe, the
   phone's Back button and gesture, and the browser's Back button
   all ask this stack first, so they close what is on top before
   they leave the page underneath.

   Each entry also puts one history entry on the browser's stack
   (same address), so the system Back closes the sheet instead of
   leaving the page. Closing it any other way takes that entry off
   again, so the history stays as it was.
   ============================================================ */

const stack = [];
let seq = 0;
let skipPops = 0;

const canPush = () => typeof history !== 'undefined' && typeof history.pushState === 'function';

function drop(entry) {
  const i = stack.indexOf(entry);
  if (i < 0) return;
  stack.splice(i, 1);
  // Closed some other way: take its history entry off, quietly.
  if (entry.inHistory && history.state?.tbOverlay === entry.id) { entry.inHistory = false; skipPops++; try { history.back(); } catch { skipPops = Math.max(0, skipPops - 1); } }
}

/** Registers `close` while something is open. Returns the function that removes it. */
export function pushBack(close) {
  const entry = { close, id: ++seq, inHistory: false };
  stack.push(entry);
  if (canPush()) {
    try { history.pushState({ ...(history.state || {}), tbOverlay: entry.id }, ''); entry.inHistory = true; } catch { /* sandboxed frame */ }
  }
  return () => drop(entry);
}

/** Closes the topmost registered thing. True if there was one. */
export function popBack() {
  const entry = stack[stack.length - 1];
  if (!entry) return false;
  try { entry.close(); } catch { /* a closer that throws must not trap the person */ }
  // A closer that did not unregister itself is removed anyway.
  if (stack.includes(entry)) drop(entry);
  return true;
}

export const hasBack = () => stack.length > 0;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (skipPops > 0) { skipPops--; return; }
    // An entry left behind by a sheet that closed while the person moved on (a search result that
    // opened a tool, say) leads nowhere: step over it so Back is not pressed twice for one page.
    const here = history.state?.tbOverlay;
    if (here && !stack.some(e => e.id === here)) { try { history.back(); } catch { /* ignore */ } return; }
    // The person went Back: if the entry that held the top sheet is gone, close the sheet.
    const top = stack[stack.length - 1];
    if (top && top.inHistory && history.state?.tbOverlay !== top.id) {
      top.inHistory = false;
      stack.pop();
      try { top.close(); } catch { /* ignore */ }
    }
  });
}
