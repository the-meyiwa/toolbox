import { statGrid, dataTable, num, parseNum } from '../lib/biz.js';

/* Weekend and holiday aware date maths. All calculations use UTC to
   avoid a daylight-saving shift silently changing a day count. */

const DAY_MS = 86400000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toUTC(input) {
  if (!input) return null;
  const [y, m, d] = input.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(date) { return date.toISOString().slice(0, 10); }

function fmt(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default {
  render(container) {
    const today = new Date();
    const start = iso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
    const end   = iso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) + 30 * DAY_MS));

    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-seg-field">
            <label class="tool-label">What do you need?</label>
            <div class="btn-group t3d-seg" id="bd-mode">
              <button class="btn btn-sm is-active" data-mode="between">Days between two dates</button>
              <button class="btn btn-sm" data-mode="add">A deadline N days out</button>
            </div>
          </div>

          <div class="biz-field">
            <label class="tool-label" for="bd-start">Start date</label>
            <input type="date" class="tool-input" id="bd-start" value="${start}">
          </div>

          <div class="biz-field" id="bd-end-f">
            <label class="tool-label" for="bd-end">End date</label>
            <input type="date" class="tool-input" id="bd-end" value="${end}">
          </div>

          <div class="biz-field" id="bd-count-f" hidden>
            <label class="tool-label" for="bd-count">Working days to add</label>
            <input type="number" class="tool-input" id="bd-count" value="10" step="1">
          </div>

          <label class="tool-label" style="margin-top:18px;">Which days are weekends?</label>
          <div class="bd-weekdays" id="bd-weekend">
            ${DAY_NAMES.map((d, i) => `
              <label class="bd-day">
                <input type="checkbox" data-day="${i}" ${i === 0 || i === 6 ? 'checked' : ''}>
                <span>${d.slice(0, 3)}</span>
              </label>`).join('')}
          </div>

          <div class="biz-field" style="margin-top:18px;">
            <label class="tool-label" for="bd-holidays">Public holidays &amp; closures</label>
            <textarea class="tool-textarea" id="bd-holidays" rows="4" spellcheck="false"
              placeholder="One date per line, as 2026-12-25"></textarea>
            <p class="biz-hint">Any date listed here is skipped, unless it already falls on a weekend.</p>
          </div>
        </div>

        <div class="tool-section">
          <div id="bd-out"></div>
          <div id="bd-detail"></div>
        </div>
      </div>`;

    let mode = 'between';
    const out = container.querySelector('#bd-out');

    function weekendSet() {
      const set = new Set();
      for (const cb of container.querySelectorAll('#bd-weekend input')) {
        if (cb.checked) set.add(Number(cb.dataset.day));
      }
      return set;
    }

    function holidaySet() {
      const set = new Set();
      for (const line of container.querySelector('#bd-holidays').value.split('\n')) {
        const t = line.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) set.add(t);
      }
      return set;
    }

    function compute() {
      const weekend  = weekendSet();
      const holidays = holidaySet();
      const startD   = toUTC(container.querySelector('#bd-start').value);

      container.querySelector('#bd-end-f').hidden   = mode !== 'between';
      container.querySelector('#bd-count-f').hidden = mode !== 'add';

      if (!startD) { out.innerHTML = '<div class="tool-output biz-warn">Pick a start date.</div>'; return; }

      const isWorking = (d) => !weekend.has(d.getUTCDay()) && !holidays.has(iso(d));

      if (mode === 'between') {
        const endD = toUTC(container.querySelector('#bd-end').value);
        if (!endD) { out.innerHTML = '<div class="tool-output biz-warn">Pick an end date.</div>'; return; }

        const forward = endD >= startD;
        const from = forward ? startD : endD;
        const to   = forward ? endD : startD;

        let working = 0, weekendDays = 0, holidayDays = 0, total = 0;
        // Counted exclusive of the start date and inclusive of the end,
        // which is how a "days until" question is normally meant.
        for (let t = from.getTime() + DAY_MS; t <= to.getTime(); t += DAY_MS) {
          const d = new Date(t);
          total++;
          if (weekend.has(d.getUTCDay())) weekendDays++;
          else if (holidays.has(iso(d))) holidayDays++;
          else working++;
        }

        out.innerHTML = statGrid([
          { value: num(working), label: 'Working days', tone: 'hero' },
          { value: num(total), label: 'Calendar days' },
          { value: num(weekendDays), label: 'Weekend days' },
          { value: num(holidayDays), label: 'Holidays skipped' },
          { value: `${(total / 7).toFixed(1)}`, label: 'Weeks' },
        ]);

        container.querySelector('#bd-detail').innerHTML = `
          <div class="tool-output biz-explain">
            From <strong>${fmt(from)}</strong> to <strong>${fmt(to)}</strong>
            there are <strong>${num(working)} working days</strong>.
            ${!forward ? '<br><em>Your end date is before your start date, so the range was reversed.</em>' : ''}
            <br><br>The start date is not counted; the end date is.
          </div>`;
      } else {
        const count = Math.round(parseNum(container.querySelector('#bd-count')));
        if (weekend.size >= 7) {
          out.innerHTML = '<div class="tool-output biz-warn">Every day is marked as a weekend, so no working day will ever arrive.</div>';
          return;
        }

        const step = count >= 0 ? DAY_MS : -DAY_MS;
        let remaining = Math.abs(count);
        let cursor = new Date(startD.getTime());
        const landed = [];

        while (remaining > 0 && landed.length < 4000) {
          cursor = new Date(cursor.getTime() + step);
          if (isWorking(cursor)) { remaining--; landed.push(new Date(cursor.getTime())); }
        }

        const totalCalendar = Math.abs(Math.round((cursor - startD) / DAY_MS));

        out.innerHTML = statGrid([
          { value: fmt(cursor), label: `${Math.abs(count)} working day${Math.abs(count) === 1 ? '' : 's'} ${count >= 0 ? 'after' : 'before'}`, tone: 'hero' },
          { value: num(totalCalendar), label: 'Calendar days away' },
          { value: DAY_NAMES[cursor.getUTCDay()], label: 'Lands on a' },
        ]);

        const preview = count >= 0 ? landed.slice(0, 12) : landed.slice(0, 12);
        container.querySelector('#bd-detail').innerHTML = dataTable(
          ['#', 'Date', 'Day'],
          preview.map((d, i) => ({
            emphasis: i === preview.length - 1 && preview.length === landed.length,
            cells: [num(i + 1), fmt(d), DAY_NAMES[d.getUTCDay()]],
          })),
          { caption: landed.length > 12 ? `First 12 of ${landed.length} working days` : 'Working days counted', maxHeight: '300px' }
        );
      }
    }

    container.querySelector('#bd-mode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      for (const x of container.querySelectorAll('#bd-mode .btn')) x.classList.toggle('is-active', x === b);
      mode = b.dataset.mode;
      compute();
    });

    container.addEventListener('input', compute);
    container.addEventListener('change', compute);
    compute();
  },
  destroy() {},
};
