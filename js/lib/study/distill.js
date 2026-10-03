/* ============================================================
   Study — telling the subject from the paperwork

   A lecture note opens with a school name, a programme, a course
   code, a week number, learning objectives. None of that is the
   subject, and none of it is worth a question. Handing it to the
   Assistant as if it were content made it quiz people on the
   university's name and teach them their own learning objectives.

   distill() reads a note the way a student would, and returns just
   what is to be learned:
     - the topic ("Week 1 : Foundations of AI" → "Foundations of AI"),
       kept as the heading of the note;
     - the body, without the institution / programme / course-code
       header, learning objectives and outcomes, agendas, running
       headers and footers, page and slide numbers, and the
       references and thank-you at the end.

   It is cautious: a line is dropped only where paperwork lives (the
   top of the note, the top of a page or slide, a labelled section),
   and if nearly everything would go, the note is returned as it was.
   Pure and tested; no model is involved.
   ============================================================ */

const MARKER = /^\[(?:Page|Slide) \d+\]$/;
const BULLET = /^\s*(?:[-*•▪●○◦‣–—]|\d{1,2}[.)]|[a-z][.)]|\(\w{1,2}\))\s+/;
const TOPIC_LINE = /^\s*(?:week|lecture|module|unit|chapter|topic|lesson|session|part|class)\s*#?\s*(\d+|[ivx]+)\s*(?:[:\-–—.|]|\s)\s*(.{3,120})$/i;
const LABELLED_TOPIC = /^\s*(?:topic|title|subject|lecture title)\s*[:\-–—]\s*(.{3,120})$/i;
const COURSE_CODE = /\b[A-Z]{2,5}[- ]?[A-Z]{0,4}[- ]?\d{3,4}[A-Z]?\b/;
const COURSE_TITLE = /\b[A-Z]{2,5}[- ]?[A-Z]{0,4}[- ]?\d{3,4}[A-Z]?\s*[:\-–—]\s*(.{3,100}?)\.?\s*$/;
// Institution, programme and people: only ever dropped where paperwork lives.
const ADMIN = /\b(?:universit(?:y|é)|college of|polytechnic|institute of technology|department of|faculty of|school of|b\.?\s?sc\b|m\.?\s?sc\b|b\.?\s?eng\b|b\.?\s?tech\b|ph\.?\s?d\b|undergraduate|postgraduate|programme|semester|trimester|academic (?:year|session)|\d{4}\s*[/-]\s*\d{2,4}\s*session|lecturers?|instructors?|course (?:code|title|outline|description|credit|coordinator)|credit (?:units?|hours?)|office hours|all rights reserved|confidential|do not distribute|copyright|©)\b|©/i;
const OBJECTIVES = /^\s*(?:#+\s*)?(?:(?:student|course|module|lesson|lecture|session|weekly|unit|chapter|key|main)\s+)?(?:learning\s+)?(?:objectives?|outcomes?|goals?|aims?|competenc(?:y|ies)|slos?|ilos?|targets?)\s*(?:\(s\))?\s*[:\-–—]?\s*$/i;
const LEAD_IN = /^\s*(?:by the end of (?:this|the|today'?s)|at the end of (?:this|the|today'?s)|after (?:this|completing this|today'?s) (?:lecture|week|session|class|module|unit|chapter|lesson)|upon completion|on completion|students? (?:will|should|are expected to) be able to|you (?:will|should) be able to|in this (?:lecture|week|session|module|class), (?:we|you) will)\b/i;
const FRAMING = /^\s*(?:#+\s*)?(?:today'?s\s+agenda|agenda|(?:lecture|course|class|session)\s+outline|today'?s\s+plan|roadmap|housekeeping|announcements?|assessment|grading|prerequisites?|questions\??|q\s*&\s*a|thank you[!.]*|thanks[!.]*|the end)\s*[:\-–—]?\s*$/i;
const TAIL = /^\s*(?:#+\s*)?(?:references?|bibliography|further reading|reading list|recommended (?:reading|texts?|books?)|sources|acknowledg(?:e)?ments?)\s*[:\-–—]?\s*$/i;
const PAGE_NUMBER = /^\s*(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?\s*$/i;

const norm = (line) => line.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
const words = (s) => (s.match(/\S+/g) || []).length;

function splitPages(lines) {
  const pages = [];
  let cur = { marker: null, lines: [] };
  for (const line of lines) {
    if (MARKER.test(line.trim())) { pages.push(cur); cur = { marker: line.trim(), lines: [] }; } else cur.lines.push(line);
  }
  pages.push(cur);
  return pages;
}

/** Lines that repeat on many pages or slides are the running header or footer, not content. */
function runningLines(pages) {
  if (pages.length < 5) return new Set();
  const seen = new Map();
  for (const p of pages) {
    const here = new Set(p.lines.map(l => norm(l)).filter(l => l && l.length < 110));
    for (const l of here) seen.set(l, (seen.get(l) || 0) + 1);
  }
  const need = Math.max(3, Math.ceil(pages.length * 0.4));
  return new Set([...seen].filter(([, n]) => n >= need).map(([l]) => l));
}

export function distill(input) {
  const original = String(input ?? '');
  const result = { text: original, topic: '', course: '', brief: '', removed: { header: 0, objectives: 0, framing: 0, tail: 0, repeated: 0 } };
  if (!original.trim()) return result;

  const lines = original.replace(/\r\n?/g, '\n').split('\n');
  const pages = splitPages(lines);
  const running = runningLines(pages);
  const firstContent = pages.findIndex(p => p.lines.some(l => l.trim()));
  const out = [];
  const removed = result.removed;
  let topic = '';
  let course = '';
  let emitted = 0;                       // non-empty lines kept so far

  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    if (page.marker) out.push('', page.marker);
    const pl = page.lines;
    const first = pi === firstContent;
    // A list that follows "Learning objectives" or "By the end of this week…" belongs to it.
    let skipping = false;
    let items = 0;
    let prevItem = false;
    let tailCut = false;

    for (let i = 0; i < pl.length && !tailCut; i++) {
      const line = pl[i];
      const t = line.trim();

      if (skipping) {
        if (!t) { prevItem = false; if (items > 0) skipping = false; removed.objectives++; continue; }
        const isItem = BULLET.test(line) || /^\s{2,}\S/.test(line);
        const prose = !isItem && words(t) > 10 && /[.!?]["')\]]?$/.test(t);
        if (isItem || (!prose && items === 0 && words(t) <= 20) || (!prose && prevItem && !/[.!?]$/.test(t) && words(t) <= 14)) {
          items++; prevItem = true; removed.objectives++; continue;
        }
        skipping = false;
      }

      if (!t) { out.push(line); continue; }
      if (PAGE_NUMBER.test(t)) { removed.repeated++; continue; }
      if (running.has(norm(t))) { removed.repeated++; continue; }

      // Reference lists and thank-yous close the note.
      if (TAIL.test(t) && (pi >= pages.length * 0.6 || pages.length === 1)) { removed.tail += pl.length - i; tailCut = true; continue; }

      if (OBJECTIVES.test(t) || LEAD_IN.test(t) || FRAMING.test(t)) {
        if (FRAMING.test(t) && !OBJECTIVES.test(t) && !LEAD_IN.test(t)) removed.framing++; else removed.objectives++;
        skipping = true; items = 0; prevItem = false;
        continue;
      }

      // The topic: "Week 1 : Foundations of AI" becomes the heading of the note.
      const tm = !topic && (first || i < 3) ? (TOPIC_LINE.exec(t) || LABELLED_TOPIC.exec(t)) : null;
      if (tm) {
        topic = (tm[2] || tm[1]).replace(/\s+/g, ' ').replace(/[.:]+$/, '').trim();
        out.push(`# ${topic}`); emitted++;
        continue;
      }

      // The head of the note (and the head and foot of each page or slide): institution, programme, course code.
      const inZone = first ? emitted < 14 : (i < 3 || i >= pl.length - 2);
      if (inZone && t.length <= 140 && !/^\s*#\s/.test(t) && (ADMIN.test(t) || (first && emitted < 3 && COURSE_TITLE.test(t) && t.length <= 110))) {
        if (!course) { const cm = COURSE_TITLE.exec(t); if (cm) course = cm[1].trim(); }
        removed.header++;
        continue;
      }
      if (first && emitted < 3 && t.length <= 90 && /^\s*(?:course|programme|department|faculty|lecturer|instructor|semester|session)\b.{0,80}$/i.test(t)) { removed.header++; continue; }

      out.push(line); emitted++;
    }
  }

  let text = out.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  // A page marker with nothing after it means nothing.
  text = text.replace(/(?:^|\n)\[(?:Page|Slide) \d+\][ \t]*(?=\n+\[(?:Page|Slide) \d+\]|\s*$)/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Careful: if almost everything went, the note was not what this assumed. Keep it whole.
  const originalWords = words(original);
  if (originalWords > 80 && words(text) < originalWords * 0.35) {
    return { ...result, removed: { header: 0, objectives: 0, framing: 0, tail: 0, repeated: 0 } };
  }

  result.text = text;
  result.topic = topic;
  result.course = course;
  result.brief = [topic && `Subject of this note: ${topic}`, course && `from the course "${course}"`].filter(Boolean).join(' ');
  return result;
}

/** The note's text ready for the Assistant: paperwork removed, the topic leading. */
export const forStudy = (text) => distill(text).text;

/** What the Assistant is told about the paperwork it will not see, and about what to do with the rest. */
export const SUBJECT_RULES = [
  'The material is a student\'s note. Learn and teach its SUBJECT MATTER: the concepts, definitions, mechanisms, examples, arguments and results in its body.',
  'Ignore the paperwork around it completely: school, programme, course codes, week or lecture numbers, lecturers, dates, learning objectives and outcomes, agendas, assessment details, references, slide or page numbers. Never write a question about them, never explain them, never mention them.',
  'Learning objectives only hint at what matters; use that to choose emphasis, but teach the content that meets them rather than repeating them.',
].join(' ');
