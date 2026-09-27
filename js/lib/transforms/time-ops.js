/* ============================================================
   Date and time arithmetic, done in UTC calendar days so daylight
   saving never shifts an answer by an hour, plus the small
   conversions people look up: decimal hours, Discord timestamps,
   leap years, ISO weeks.
   ============================================================ */

const DAY = 86400000;

/** Parse "YYYY-MM-DD" (or a datetime-local value) as a UTC calendar date. */
export function parseDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
export const fmtDay = (d) => d.toISOString().slice(0, 10);
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Calendar difference: years, months, days, plus totals. */
export function between(a, b) {
  let s = a; let e = b; let sign = 1;
  if (e < s) { [s, e] = [e, s]; sign = -1; }
  // Step whole months (clamping to short months, as addToDate does), then count days.
  let months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + e.getUTCMonth() - s.getUTCMonth();
  if (addToDate(s, { months }) > e) months--;
  const y = Math.floor(months / 12); const m = months % 12;
  const d = Math.round((e - addToDate(s, { months })) / DAY);
  const days = Math.round((e - s) / DAY);
  const full = Math.floor(days / 7);
  let weekdays = full * 5;
  for (let i = full * 7; i < days; i++) { const wd = new Date(s.getTime() + i * DAY).getUTCDay(); if (wd !== 0 && wd !== 6) weekdays++; }
  return { sign, years: y, months: m, days: d, totalDays: days * sign, weeks: Math.floor(days / 7) * sign, weekdays: weekdays * sign, totalMonths: (y * 12 + m) * sign, hours: days * 24 * sign };
}

/** Add years, months, weeks and days, clamping to the end of short months. */
export function addToDate(date, { years = 0, months = 0, weeks = 0, days = 0 } = {}) {
  const y = date.getUTCFullYear() + Number(years || 0);
  const mTotal = date.getUTCMonth() + Number(months || 0);
  const yy = y + Math.floor(mTotal / 12); const mm = ((mTotal % 12) + 12) % 12;
  const dd = Math.min(date.getUTCDate(), daysInMonth(yy, mm));
  return new Date(Date.UTC(yy, mm, dd) + (Number(weeks || 0) * 7 + Number(days || 0)) * DAY);
}

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - y0) / DAY + 1) / 7) };
}

export function dayOfYear(date) { return Math.round((date - Date.UTC(date.getUTCFullYear(), 0, 1)) / DAY) + 1; }

export function describeDay(date) {
  const w = isoWeek(date);
  const y = date.getUTCFullYear();
  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
    long: date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    isoWeek: `${w.year}-W${String(w.week).padStart(2, '0')}`, dayOfYear: dayOfYear(date), daysInYear: isLeap(y) ? 366 : 365,
    leapYear: isLeap(y), quarter: Math.floor(date.getUTCMonth() / 3) + 1, daysInMonth: daysInMonth(y, date.getUTCMonth()),
  };
}

export function leapYearsBetween(a, b) {
  const out = [];
  for (let y = Math.min(a, b); y <= Math.max(a, b) && out.length < 5000; y++) if (isLeap(y)) out.push(y);
  return out;
}

/* ---------------- durations ---------------- */

/** "7:30", "7h 30m", "7.5" or "450m" → decimal hours. */
export function parseDuration(s) {
  const t = String(s).trim().toLowerCase();
  if (!t) return null;
  let m = t.match(/^(-)?(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/);
  if (m) return (m[1] ? -1 : 1) * (Number(m[2]) + Number(m[3]) / 60 + Number(m[4] || 0) / 3600);
  let total = 0; let hit = false;
  for (const [, n, u] of t.matchAll(/(-?\d+(?:\.\d+)?)\s*(d|days?|h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)\b/g)) {
    hit = true; const v = Number(n);
    total += u.startsWith('d') ? v * 24 : u.startsWith('h') ? v : u.startsWith('m') ? v / 60 : v / 3600;
  }
  if (hit) return total;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return null;
}

export function formatDuration(hours) {
  const sign = hours < 0 ? '-' : '';
  let s = Math.round(Math.abs(hours) * 3600);
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return {
    clock: `${sign}${d * 24 + h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    words: sign + ([d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ') || '0s'),
  };
}

/* ---------------- Discord ---------------- */

export const DISCORD_STYLES = [
  ['t', 'Short time', { hour: 'numeric', minute: '2-digit' }],
  ['T', 'Long time', { hour: 'numeric', minute: '2-digit', second: '2-digit' }],
  ['d', 'Short date', { day: '2-digit', month: '2-digit', year: 'numeric' }],
  ['D', 'Long date', { day: 'numeric', month: 'long', year: 'numeric' }],
  ['f', 'Short date/time', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }],
  ['F', 'Long date/time', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }],
  ['R', 'Relative', null],
];

export function relativeTime(date, now = new Date()) {
  const diff = (date - now) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  const [u, s] = units.find(([, secs]) => Math.abs(diff) >= secs) || units[units.length - 1];
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(diff / s), u);
}

export function discordTimestamps(date, now = new Date()) {
  const unix = Math.floor(date.getTime() / 1000);
  return DISCORD_STYLES.map(([code, label, opts]) => ({
    code, label, tag: `<t:${unix}:${code}>`, preview: opts ? date.toLocaleString('en-GB', opts) : relativeTime(date, now),
  }));
}
