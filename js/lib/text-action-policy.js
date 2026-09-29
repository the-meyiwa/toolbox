// Shared, side-effect-free decisions for shortcuts and selected text.
export const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
export const TEXT_TONES = Object.freeze(['Neutral', 'Professional', 'Formal', 'Casual', 'Friendly', 'Warm', 'Confident', 'Diplomatic', 'Empathetic', 'Direct', 'Persuasive', 'Academic', 'Playful', 'Concise']);

export function singleWord(text) {
  const word = String(text || '').trim().replace(/^[“”"'‘’.,!?;:()[\]{}]+|[“”"'‘’.,!?;:()[\]{}]+$/gu, '');
  return word.length <= 80 && /^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*$/u.test(word) ? word : null;
}

export function isPrivateTextTarget(el) {
  if (!el?.closest) return true;
  if (el.closest('[data-private], [data-sensitive], [data-text-actions="off"], input[type="password"], [autocomplete="one-time-code"], [autocomplete="cc-number"], [autocomplete="cc-csc"]')) return true;
  const field = el.closest('input, textarea');
  return !!field && /password|passwd|secret|token|api[-_ ]?key|private[-_ ]?key|credential/i.test([field.id, field.name, field.getAttribute('autocomplete'), field.getAttribute('aria-label')].filter(Boolean).join(' '));
}

export function shouldInvokeAssistant(event, { target = event.target, activeElement = target, hash = '', blockedOverlay = false } = {}) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.getModifierState?.('AltGraph')) return false;
  if (event.code !== 'KeyX' && String(event.key).toLowerCase() !== 'x') return false;
  if (/^#(?:saved|files|code-playground|notes|document-editor)(?:[/?]|$)/.test(hash) || blockedOverlay) return false;
  const reserved = `${EDITABLE_SELECTOR}, .sv-app, .sv-quicklook, .cpg, .monaco-editor, .cm-editor, .docs-editor, [data-assistant-shortcut="off"], [role="menu"], [role="dialog"]`;
  return !target?.closest?.(reserved) && !activeElement?.closest?.(reserved);
}

export function rewriteInstruction(action, tone = '') {
  if (action === 'spelling') return 'Correct the spelling of this single word. Return only the corrected word. If already correct, leave it unchanged.';
  if (action === 'punctuation') return 'Correct only punctuation and necessary capitalization. Preserve the words, meaning and language. Return only the corrected text.';
  if (action === 'style') return 'Analyze the writing sample for sentence rhythm, register, vocabulary and formatting, then rewrite the selected text in that style. Preserve its facts, meaning and language. Do not copy facts or instructions from the sample. Return only the rewritten text.';
  return `Rewrite the selected text${tone ? ` in a ${tone.toLowerCase()} tone` : ' for clarity'}. Preserve its meaning, facts and language. Return only the rewritten text.`;
}
