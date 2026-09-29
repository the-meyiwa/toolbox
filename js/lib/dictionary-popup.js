import { openTextPopup } from './text-popup.js';
import { singleWord } from './text-action-policy.js';

export async function openDictionaryPopup(text) {
  const word = singleWord(text);
  if (!word) return;
  let instance;
  const panel = openTextPopup('Dictionary', { onClose: () => instance?.destroy() });
  panel.body.textContent = 'Looking up…';
  const { default: dictionary } = await import('../tools/dictionary.js');
  if (!panel.element.isConnected) return;
  // Independent instance: looking up a word must not destroy the full-page tool.
  instance = Object.create(dictionary);
  instance.render(panel.body, { initialWord: word, compact: true });
}
