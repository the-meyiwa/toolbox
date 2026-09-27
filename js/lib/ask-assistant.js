/* ============================================================
   "Ask Assistant": hand a file (and an optional question) to the
   Assistant pop-up. The Assistant attaches it to a fresh message and
   leaves the question in the composer for the person to send.
   ============================================================ */

import { openAssistant } from './assistant-popup.js';

/**
 * @param {{ name: string, blob?: Blob, text?: string, type?: string, prompt?: string }} item
 */
export function askAssistant({ name, blob, text, type, prompt = '' }) {
  const body = blob || new Blob([text ?? ''], { type: type || 'text/plain' });
  const file = new File([body], name || 'file', { type: type || body.type || 'application/octet-stream' });
  // Opens over the current page; signed out, the pop-up shows the sign-in screen.
  openAssistant({ artifact: { from: 'ask-assistant', name: file.name, file, prompt } });
}

export const ASK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
