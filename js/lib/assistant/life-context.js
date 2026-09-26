/* ============================================================
   TOOLBOX — Assistant: what it can see of the person's life

   Gathers a small snapshot of the person's own things (what
   their documents are about, what is next on the calendar,
   where they are, what they asked the Assistant to remember)
   and turns it into:

   - the intro on the empty chat screen, in a casual first-person
     voice, built only from what is actually there;
   - starter chips that point at their own stuff;
   - a compact context block the model gets when someone greets
     it or asks what it can do, so its answer is personal too.

   Nothing here is sent anywhere by itself.
   ============================================================ */

import { loadEvents } from '../calendar-store.js';
import { upcomingReminders } from '../reminders.js';

export const STORAGE_LAST_PLACE = 'toolbox_assistant_last_place_v1';
const MEMORY_KEY = 'toolbox_assistant_memory_v1';

const read = (key, fallback) => { try { return JSON.parse(globalThis.localStorage?.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };

/** Keeps the last area the person was located in (from the location tool), for the intro and context. */
export function rememberPlace(area) {
  const name = String(area || '').trim().slice(0, 80);
  if (!name || /^current\b/i.test(name)) return;
  try { globalThis.localStorage?.setItem(STORAGE_LAST_PLACE, JSON.stringify({ area: name, at: Date.now() })); } catch { /* storage blocked */ }
}

/* ---------------- document topics ---------------- */

const NOISE = /^(final|draft|copy|new|old|v\d+|rev\d*|edit(ed)?|scan(ned)?|untitled|document|doc|file|img|image|dsc|pxl|screenshot|screen shot|export|download(ed)?|\d{1,4}|\(\d+\))$/i;

/** "Lease_Agreement-2025 (final).pdf" → "lease agreement 2025"; null for camera rolls and "Untitled". */
export function topicFromName(name) {
  const base = String(name || '').replace(/\.[a-z0-9]{1,5}$/i, '');
  if (/^(img|dsc|pxl|screenshot|screen shot|whatsapp image|untitled)\b/i.test(base)) return null;
  const words = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-.()[\],]+/).filter(Boolean);
  const kept = words.filter((w, i) => !NOISE.test(w) || (/^\d{4}$/.test(w) && i > 0));
  if (!kept.length || !kept.some(w => /[a-z]{3,}/i.test(w))) return null;
  return kept.slice(0, 4).map(w => (/^[A-Z0-9]{2,5}$/.test(w) ? w : w.toLowerCase())).join(' ');
}

const DOC_EXT = /\.(pdf|docx?|odt|rtf|txt|md|csv|xlsx?|ods|pptx?|odp|json|epub)$/i;

async function documentTopics(fsImpl, artifacts) {
  let metas = [];
  try {
    const fs = fsImpl || (await import('../filesystem.js')).fs;
    metas = (await fs.listAllMeta()).filter(m => !m.isDirectory && DOC_EXT.test(m.name || ''));
  } catch { metas = []; }
  let saved = artifacts;
  if (!saved) { try { saved = (await import('../artifacts.js')).list() || []; } catch { saved = []; } }
  const all = [
    ...metas.map(m => ({ name: m.name, at: m.updatedAt || m.createdAt || 0 })),
    ...saved.map(a => ({ name: a.name, at: a.updatedAt || a.createdAt || 0 })),
  ].sort((a, b) => b.at - a.at);
  const topics = [];
  for (const f of all) {
    const t = topicFromName(f.name);
    if (t && !topics.some(x => x === t || x.includes(t) || t.includes(x))) topics.push(t);
    if (topics.length >= 3) break;
  }
  return { topics, fileCount: all.length };
}

/* ---------------- place ---------------- */

function placeFrom(memory) {
  const last = read(STORAGE_LAST_PLACE, null);
  if (last?.area) return last.area;
  for (const f of memory) {
    const m = String(f.text || '').match(/\b(?:live|living|lives|based|stay|staying|stays|reside|resides|home is)\s+(?:in|at|around)\s+([A-Z][\w'-]*(?:[\s,]+[A-Z][\w'-]*){0,3})/);
    if (m) return m[1].replace(/[\s,]+$/, '');
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const city = tz.split('/').pop().replace(/_/g, ' ');
    return tz.includes('/') && !/^(UTC|GMT|Etc)/.test(tz) ? city : null;
  } catch { return null; }
}

/* ---------------- calendar ---------------- */

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function nextEvents(now, events, count = 3) {
  const nowKey = dayKey(now);
  const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return events
    .filter(e => e.date > nowKey || (e.date === nowKey && (e.isAllDay || !e.endTime || e.endTime > nowTime)))
    .sort((a, b) => `${a.date}${a.startTime || ''}`.localeCompare(`${b.date}${b.startTime || ''}`))
    .slice(0, count);
}

/** "today", "tomorrow", "on Friday", "on 12 Oct". */
export function relativeDay(dateStr, now = new Date()) {
  const d = new Date(`${dateStr}T12:00`);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const diff = Math.round((d - base) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff < 7) return `on ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`;
  return `on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

/* ---------------- snapshot ---------------- */

/** What the Assistant can see right now. Every field is optional; missing data just drops out. */
export async function gatherLifeContext({ now = new Date(), fsImpl, artifacts, events, memory } = {}) {
  const facts = memory || read(MEMORY_KEY, []);
  const { topics, fileCount } = await documentTopics(fsImpl, artifacts);
  let evs = events;
  if (!evs) { try { evs = loadEvents(); } catch { evs = []; } }
  let reminders = [];
  try { reminders = upcomingReminders(now.getTime()); } catch { reminders = []; }
  return {
    topics,
    fileCount,
    next: nextEvents(now, evs),
    reminderCount: reminders.length,
    place: placeFrom(Array.isArray(facts) ? facts : []),
    memoryCount: Array.isArray(facts) ? facts.length : 0,
    now,
  };
}

const quoteList = (items) => {
  const q = items.map(t => `“${t}”`);
  return q.length > 1 ? `${q.slice(0, -1).join(', ')} or ${q.at(-1)}` : q[0];
};

/** The empty-chat intro, in the person's preferred casual voice, from what is actually there. */
export function introText(ctx) {
  const now = ctx.now || new Date();
  const clauses = [];
  if (ctx.topics?.length) clauses.push(`sniff through your documents on ${quoteList(ctx.topics)}`);
  else if (ctx.fileCount) clauses.push(`sniff through the ${ctx.fileCount} file${ctx.fileCount === 1 ? '' : 's'} you've got in here`);
  else clauses.push('read through any document you throw at me');
  const ev = ctx.next?.[0];
  if (ev) clauses.push(`remind you that “${ev.title}” is ${relativeDay(ev.date, now)}${ev.isAllDay || !ev.startTime ? '' : ` at ${ev.startTime}`} (or move it if that's not happening)`);
  else clauses.push('sort out your calendar and nag you about things');
  clauses.push("do some math if you're into that");
  clauses.push(ctx.place ? `tell you where the nearest fuel station or whatever is around ${ctx.place}` : 'tell you where the nearest gas station or whatever is');
  const openers = ['Alright,', 'Okay so,', 'Right,'];
  const opener = openers[(now.getDate() + now.getMonth()) % openers.length];
  const body = `${clauses.slice(0, -1).map(c => `I could ${c}`).join(', ')}, I could ${clauses.at(-1)}`;
  const memory = ctx.memoryCount ? ` I also remember the ${ctx.memoryCount === 1 ? 'one thing' : `${ctx.memoryCount} things`} you've told me, so no need to repeat yourself.` : '';
  return `${opener} ${body}, and I could go on, but you probably don't want me to do that.${memory} Tokens cost money, so just let me know exactly what you want to do.`;
}

/** Starter chips pointing at the person's own things (fill the composer; nothing is sent). */
export function lifeSuggestions(ctx) {
  const out = [];
  if (ctx.next?.length) out.push({ icon: 'calendar', title: "What's on this week?", sub: `Next: ${ctx.next[0].title}`, prompt: "What's on my calendar this week?" });
  else out.push({ icon: 'calendar', title: 'Plan something', sub: 'Add it and set a reminder', prompt: 'Add ' });
  if (ctx.topics?.[0]) out.push({ icon: 'file', title: `Summarise my ${ctx.topics[0]}`, sub: 'From your Files', prompt: `Find my ${ctx.topics[0]} document in Files and summarise it.` });
  out.push({ icon: 'pin', title: 'Nearest fuel station', sub: ctx.place ? `Around ${ctx.place}` : 'Near you', prompt: 'Where is the nearest fuel station to me?' });
  return out;
}

/** Compact facts for the model; only sent when someone greets it or asks what it can do. */
export function contextBlock(ctx) {
  const now = ctx.now || new Date();
  const lines = [];
  if (ctx.topics?.length) lines.push(`- Their documents include: ${ctx.topics.join('; ')} (${ctx.fileCount} files in all)`);
  else lines.push(`- Files: ${ctx.fileCount ? `${ctx.fileCount} files, no clear topics` : 'nothing saved yet'}`);
  if (ctx.next?.length) lines.push(`- Coming up: ${ctx.next.map(e => `${e.title} ${relativeDay(e.date, now)}${e.startTime && !e.isAllDay ? ` ${e.startTime}` : ''}`).join('; ')}`);
  else lines.push('- Calendar: nothing coming up');
  if (ctx.reminderCount) lines.push(`- ${ctx.reminderCount} reminder(s) set`);
  if (ctx.place) lines.push(`- Area: ${ctx.place}`);
  return `Their things right now:\n${lines.join('\n')}`;
}

export const INTRO_PATTERN = /^\s*(hi|hello|hey|yo|hiya|sup|good (morning|afternoon|evening))\b[\s!.?]*$|\b(what (else )?can you do|what do you do|what are you (able|good) (to|at)|who are you|how can you help|what can i (ask|use you for)|introduce yourself)/i;

export const INTRO_VOICE = `When they greet you or ask what you can do: answer in two to four casual first-person sentences, like a friend who can actually help, built from their things above (name what their documents are about, their next event, their area), mention maths and finding places in passing, then say you could go on but tokens cost money, so they should tell you exactly what they want. No lists, headings or tool names.`;
