/* ============================================================
   TOOLBOX — Light turns

   "hello", "how are you?", "thanks!" do not need tools, a long system
   prompt or a reasoning model. They go out as a light turn: a short
   prompt, no tool definitions, a capped reply, on the fastest and
   cheapest models. That answers in a fraction of a second and spends a
   tiny share of the shared AI allowance (and does not use up a person's
   daily message allowance).

   Shared by the browser (to build the light request) and the server
   (which re-checks the text before honouring it, so a light turn can
   never be used to send a real task cheaply).
   ============================================================ */

const OPENERS = [
  'hi', 'hey', 'hello', 'hiya', 'howdy', 'yo', 'sup', 'hola', 'bonjour',
  'good morning', 'good afternoon', 'good evening', 'good night', 'gm', 'gn', 'morning', 'evening',
  'thanks', 'thank you', 'thank u', 'thx', 'ty', 'cheers', 'appreciate it',
  'ok', 'okay', 'k', 'cool', 'nice', 'great', 'awesome', 'perfect', 'sounds good', 'got it', 'alright', 'sure', 'yes', 'no', 'yep', 'nope',
  'bye', 'goodbye', 'see you', 'see ya', 'later', 'take care',
  'how are you', 'how are you doing', "how's it going", 'how is it going', "what's up", 'whats up', 'how have you been',
  'who are you', 'what are you', "what's your name", 'what is your name', 'are you there', 'you there',
  'lol', 'haha', 'hahaha', 'wow', 'omg', 'nice one', 'well done', 'good job', 'love you', 'you rock',
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const LIGHT = new RegExp(`^(?:(?:${OPENERS.map(esc).join('|')})(?:\\s+(?:there|again|so much|a lot|man|bro|buddy|friend|assistant|toolbox|today|mate))?[\\s,.!?~:)(-]*)+$`, 'i');

/** True for a short greeting, thanks or small-talk line that needs no tools or reasoning. */
export function isLightPrompt(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t || t.length > 60) return false;
  return LIGHT.test(t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || 'hi');
}

/** The short system prompt a light turn uses instead of the full one. */
export const LIGHT_SYSTEM = [
  'You are the Toolbox Assistant, the helper built into Toolbox (a collection of tools that run in the browser: files, PDFs, images, maths, writing, code, calendar, notes, research and more).',
  'This message is small talk. Reply warmly and briefly: one to three short sentences, plain text, no lists or headings.',
  'Do not invent facts about the person. If they hint at something you could do for them, invite them to ask.',
].join(' ');

/** Hard caps for a light reply. */
export const LIGHT_MAX_TOKENS = 320;
