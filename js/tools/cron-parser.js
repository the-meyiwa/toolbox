/* Cron Parser — read a crontab line back in plain English, and say when it
   actually fires next.

   Standard five-field crontab: minute, hour, day of month, month, day of
   week. Ranges, steps, lists and three-letter names are all understood.
   The one rule people forget is honoured too: when day-of-month and
   day-of-week are both restricted, cron runs on either, not both. */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTH_ALIAS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DAY_ALIAS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/* Named shorthands crontab accepts in place of all five fields. */
const SHORTHANDS = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

const FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of the month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, alias: MONTH_ALIAS },
  { name: 'day of the week', min: 0, max: 7, alias: DAY_ALIAS },
];

/* Expand one field into the sorted set of values it allows. Throws with a
   message worth showing rather than a generic failure. */
function parseField(raw, spec) {
  const values = new Set();

  for (const part of raw.split(',')) {
    const piece = part.trim();
    if (!piece) throw new Error(`Empty value in the ${spec.name} field.`);

    const [rangePart, stepPart] = piece.split('/');
    let step = 1;
    if (stepPart !== undefined) {
      step = Number(stepPart);
      if (!Number.isInteger(step) || step < 1) {
        throw new Error(`"${stepPart}" is not a valid step in the ${spec.name} field.`);
      }
    }

    let from, to;
    if (rangePart === '*') {
      from = spec.min;
      to = spec.max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      from = toNumber(a, spec);
      to = toNumber(b, spec);
      if (from > to) throw new Error(`"${rangePart}" runs backwards in the ${spec.name} field.`);
    } else {
      from = toNumber(rangePart, spec);
      to = stepPart !== undefined ? spec.max : from;
    }

    for (let v = from; v <= to; v += step) values.add(v);
  }

  // Cron lets Sunday be either 0 or 7; normalise so matching is simple.
  if (spec.alias === DAY_ALIAS && values.has(7)) { values.delete(7); values.add(0); }

  return [...values].sort((a, b) => a - b);
}

function toNumber(token, spec) {
  const text = token.trim().toLowerCase();
  if (spec.alias && Object.hasOwn(spec.alias, text.slice(0, 3))) return spec.alias[text.slice(0, 3)];
  const n = Number(text);
  if (!Number.isInteger(n) || n < spec.min || n > spec.max) {
    throw new Error(`"${token.trim()}" is not valid in the ${spec.name} field — expected ${spec.min} to ${spec.max}.`);
  }
  return n;
}

export function parseCron(expression) {
  const trimmed = expression.trim();
  const normalised = SHORTHANDS[trimmed.toLowerCase()] ?? trimmed;

  const parts = normalised.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Expected 5 fields — minute, hour, day of month, month, day of week — but found ${parts.length}.`);
  }

  const [minute, hour, dom, month, dow] = parts.map((raw, i) => parseField(raw, FIELDS[i]));
  return {
    minute, hour, dom, month, dow,
    domRestricted: parts[2] !== '*',
    dowRestricted: parts[4] !== '*',
  };
}

/* ---------------- description ---------------- */

/* "1, 2 and 5" reads better than "1,2,5" in a sentence. */
function list(items) {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/* A contiguous run is worth saying as a range. */
function isRun(values) {
  return values.length > 2 && values.every((v, i) => i === 0 || v === values[i - 1] + 1);
}

function describeTime(schedule, raw) {
  const [minuteRaw, hourRaw] = raw.split(/\s+/);
  const everyMinute = minuteRaw === '*';
  const everyHour = hourRaw === '*';

  if (everyMinute && everyHour) return 'Every minute';

  const stepMinute = /^\*\/(\d+)$/.exec(minuteRaw);
  if (stepMinute && everyHour) return `Every ${plural(Number(stepMinute[1]), 'minute')}`;

  const stepHour = /^\*\/(\d+)$/.exec(hourRaw);
  if (stepHour && schedule.minute.length === 1) {
    return `Every ${plural(Number(stepHour[1]), 'hour')} at ${String(schedule.minute[0]).padStart(2, '0')} minutes past`;
  }

  if (everyMinute) {
    return `Every minute of the ${list(schedule.hour.map(h => `${pad(h)}:00 hour`))}`;
  }

  if (everyHour) {
    return `Every hour at ${list(schedule.minute.map(pad))} minutes past`;
  }

  // A run of hours on the same minute reads as a window, not a list of times.
  if (schedule.minute.length === 1 && isRun(schedule.hour)) {
    const m = pad(schedule.minute[0]);
    return `Every hour from ${pad(schedule.hour[0])}:${m} to ${pad(schedule.hour[schedule.hour.length - 1])}:${m}`;
  }

  const times = [];
  for (const h of schedule.hour) for (const m of schedule.minute) times.push(`${pad(h)}:${pad(m)}`);
  if (times.length > 8) return `${times.length} times a day, from ${times[0]} to ${times[times.length - 1]}`;
  return `At ${list(times)}`;
}

function describeDays(schedule) {
  const bits = [];

  if (schedule.dowRestricted) {
    const days = schedule.dow.map(d => DAY_NAMES[d]);
    bits.push(isRun(schedule.dow) ? `${days[0]} to ${days[days.length - 1]}` : list(days));
  }

  if (schedule.domRestricted) {
    const dates = schedule.dom.map(ordinal);
    bits.push(isRun(schedule.dom) ? `the ${dates[0]} to the ${dates[dates.length - 1]}` : `the ${list(dates)}`);
  }

  // Both restricted means "either", which is the rule people trip over.
  return bits.length === 2 ? `${bits[0]}, or ${bits[1]}` : bits[0] ?? '';
}

function describeMonths(schedule, raw) {
  if (raw.split(/\s+/)[3] === '*') return '';
  const names = schedule.month.map(m => MONTH_NAMES[m - 1]);
  return isRun(schedule.month) ? `${names[0]} to ${names[names.length - 1]}` : list(names);
}

export function describeCron(schedule, raw) {
  const normalised = SHORTHANDS[raw.trim().toLowerCase()] ?? raw.trim();
  const time = describeTime(schedule, normalised);
  const days = describeDays(schedule);
  const months = describeMonths(schedule, normalised);

  let text = time;
  if (days) text += `, ${days}`;
  else if (!schedule.domRestricted && !schedule.dowRestricted) text += ', every day';
  if (months) text += `, in ${months}`;
  return text;
}

/* ---------------- next occurrences ---------------- */

/* Walks forward field by field rather than minute by minute, so a schedule
   that fires once a year is found in a handful of steps, not millions. */
export function nextRuns(schedule, from = new Date(), count = 5) {
  const runs = [];
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  // Five years is further ahead than any real crontab needs to be read.
  const limit = new Date(from.getTime());
  limit.setFullYear(limit.getFullYear() + 5);

  while (runs.length < count && cursor <= limit) {
    if (!schedule.month.includes(cursor.getMonth() + 1)) {
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(schedule, cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!schedule.hour.includes(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!schedule.minute.includes(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
      continue;
    }
    runs.push(new Date(cursor.getTime()));
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }

  return runs;
}

function dayMatches(schedule, date) {
  const domHit = schedule.dom.includes(date.getDate());
  const dowHit = schedule.dow.includes(date.getDay());
  if (schedule.domRestricted && schedule.dowRestricted) return domHit || dowHit;
  if (schedule.domRestricted) return domHit;
  if (schedule.dowRestricted) return dowHit;
  return true;
}

/* ---------------- formatting helpers ---------------- */

const pad = (n) => String(n).padStart(2, '0');

function plural(n, word) {
  return n === 1 ? word : `${n} ${word}s`;
}

function ordinal(n) {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

function until(date, now) {
  const mins = Math.round((date - now) / 60000);
  if (mins < 1) return 'in under a minute';
  if (mins < 60) return `in ${plural(mins, 'minute')}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `in ${plural(hours, 'hour')}`;
  return `in ${plural(Math.round(hours / 24), 'day')}`;
}

const EXAMPLES = [
  { cron: '0 12 * * 1-5', label: 'Weekday lunchtime' },
  { cron: '*/15 * * * *', label: 'Every quarter hour' },
  { cron: '30 3 1 * *', label: 'Monthly, overnight' },
  { cron: '0 0 * * 0', label: 'Sunday midnight' },
];

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label" for="cron-input">Cron expression</label>
        <input type="text" class="tool-input cron-field" id="cron-input" spellcheck="false" autocomplete="off"
               placeholder="minute hour day-of-month month day-of-week" value="0 12 * * 1-5">
        <div class="tool-controls" style="margin-top:12px;">
          ${EXAMPLES.map(e => `<button class="btn btn-secondary btn-sm" data-cron="${e.cron}">${e.label}</button>`).join('')}
        </div>
      </div>

      <div class="tool-section">
        <label class="tool-label">In plain English</label>
        <div class="tool-output cron-desc" id="cron-desc"></div>
      </div>

      <div class="tool-section">
        <label class="tool-label">Next five runs, in your local time</label>
        <div class="tool-output" id="cron-next"></div>
      </div>

      <p class="biz-hint">Fields are minute, hour, day of month, month and day of week.
        <code>*</code> means every, <code>*/5</code> every fifth, <code>1-5</code> a range and
        <code>1,15</code> a list. Names such as <code>Mon</code> or <code>Jan</code> work too.</p>
    `;

    const input = container.querySelector('#cron-input');
    const descEl = container.querySelector('#cron-desc');
    const nextEl = container.querySelector('#cron-next');

    const fmt = new Intl.DateTimeFormat(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    function parse() {
      const raw = input.value.trim();
      if (!raw) {
        descEl.innerHTML = '<span class="cron-muted">Enter a cron expression.</span>';
        nextEl.innerHTML = '';
        return;
      }

      let schedule;
      try {
        schedule = parseCron(raw);
      } catch (err) {
        descEl.innerHTML = `<span class="cron-bad">${err.message}</span>`;
        nextEl.innerHTML = '';
        return;
      }

      descEl.textContent = describeCron(schedule, raw);

      const now = new Date();
      const runs = nextRuns(schedule, now, 5);
      nextEl.innerHTML = runs.length
        ? `<ol class="cron-runs">${runs.map(d =>
            `<li><span>${fmt.format(d)}</span><span class="cron-muted">${until(d, now)}</span></li>`).join('')}</ol>`
        : '<span class="cron-muted">This schedule never comes round — check the day and month together.</span>';
    }

    container.querySelector('.tool-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cron]');
      if (!btn) return;
      input.value = btn.dataset.cron;
      parse();
    });

    this._read = () => {
      const exp = input.value.trim();
      const desc = descEl.textContent;
      if (!exp) return '';
      return `# Cron Schedule: ${exp}\n\n**Description**: ${desc}\n\n### Upcoming Executions\n${nextEl.textContent.trim() || 'None'}\n`;
    };
    this._write = (text) => {
      input.value = text.trim();
      parse();
    };

    input.addEventListener('input', parse);
    parse();
    input.focus();
  },

  getArtifact() {
    return { kind: 'text', text: this._read?.() ?? '', name: 'cron-schedule.txt' };
  },

  setArtifact(incoming) {
    if (incoming?.text) {
      this._write?.(incoming.text);
    }
  },

  destroy() {
    this._read = null;
    this._write = null;
  },
};
