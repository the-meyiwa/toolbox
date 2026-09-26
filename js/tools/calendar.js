/* ============================================================
   TOOLBOX — Calendar Tool
   One app window: a sidebar (mini month, calendars, up next) beside
   month, week, day and agenda views. Desktop-grade interactions:
   select with a click, create with a double-click, drag events to
   move them, right-click for actions, and full keyboard control.
   Styles live in css/calendar.css.
   ============================================================ */

import { tbConfirm, tbAlert } from '../lib/dialog.js';
import {
  loadEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  getEventsForDate,
  exportToICS,
  importFromICS,
  CATEGORIES
} from '../lib/calendar-store.js';
import { attachSegmentedSlider } from '../lib/segmented-slider.js';
import { openContextMenu, closeContextMenu } from '../lib/context-menu.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VIEWS = ['month', 'week', 'day', 'agenda'];
const VIEW_KEYS = { m: 'month', w: 'week', d: 'day', a: 'agenda' };
const HOUR_PX = 48;
const AGENDA_DAYS = 90;
const HIDDEN_KEY = 'toolbox_calendar_hidden_v1';
const REPEAT_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

const ICON = {
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  side: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  day: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
};

export default {
  render(container) {
    let cursor = formatDateKey(new Date()); // the selected day; every view is anchored on it
    let currentView = 'month';
    let searchQuery = '';
    let hidden = loadHidden();
    let editing = null; // { id, occurrence } while the sheet is open
    let lastFocus = null;
    let memo = new Map();

    container.innerHTML = `
      <div class="cal" data-view="month" data-side="open" tabindex="-1">
        <aside class="cal-side" aria-label="Calendar sidebar">
          <button type="button" class="btn btn-primary cal-new" id="cal-add-event-btn">${ICON.plus}<span>New event</span><kbd>N</kbd></button>
          <div class="cal-mini" id="cal-mini" aria-label="Month picker"></div>
          <section class="cal-side-sec">
            <h3 class="cal-side-h">Calendars</h3>
            <div class="cal-cats" id="cal-cats"></div>
          </section>
          <section class="cal-side-sec">
            <h3 class="cal-side-h">Up next</h3>
            <div class="cal-upnext" id="cal-upnext"></div>
          </section>
          <div class="cal-side-foot">
            <button type="button" class="btn btn-secondary btn-sm" id="cal-export-btn" title="Download every event as an .ics file">Export .ics</button>
            <label class="btn btn-secondary btn-sm" title="Add events from an .ics file">Import<input type="file" id="cal-import-file" accept=".ics,text/calendar" hidden></label>
          </div>
        </aside>
        <div class="cal-scrim" data-close-side></div>

        <section class="cal-main">
          <header class="cal-bar">
            <button type="button" class="cal-icon-btn cal-side-toggle" id="cal-side-toggle" aria-label="Toggle sidebar" title="Toggle sidebar">${ICON.side}</button>
            <div class="cal-nav">
              <button type="button" class="cal-icon-btn" id="cal-prev-btn" aria-label="Previous" title="Previous (K)">${ICON.prev}</button>
              <button type="button" class="cal-icon-btn" id="cal-next-btn" aria-label="Next" title="Next (J)">${ICON.next}</button>
              <button type="button" class="btn btn-secondary btn-sm" id="cal-today-btn" title="Go to today (T)">Today</button>
            </div>
            <h2 class="cal-title" id="cal-month-title" aria-live="polite"></h2>
            <div class="cal-search">
              ${ICON.search}
              <input type="search" id="cal-search-input" placeholder="Search events" aria-label="Search events" autocomplete="off">
              <kbd>/</kbd>
            </div>
            <div class="cal-view-switcher" role="tablist" aria-label="Calendar view">
              ${VIEWS.map(v => `<button type="button" role="tab" class="cal-view-btn${v === 'month' ? ' active' : ''}" data-view="${v}" title="${cap(v)} (${v[0].toUpperCase()})">${cap(v)}</button>`).join('')}
            </div>
          </header>
          <div class="cal-body" id="cal-view-container"></div>
          <footer class="cal-status">
            <span id="cal-status-text"></span>
            <span class="cal-keys" aria-hidden="true">
              <span><kbd>←</kbd><kbd>→</kbd> move</span>
              <span><kbd>↵</kbd> open day</span>
              <span><kbd>N</kbd> new</span>
              <span><kbd>T</kbd> today</span>
              <span><kbd>M</kbd><kbd>W</kbd><kbd>D</kbd><kbd>A</kbd> views</span>
            </span>
          </footer>
        </section>

        <div class="cal-sheet-scrim" id="cal-event-modal" hidden>
          <form class="cal-sheet" id="cal-modal-form" role="dialog" aria-modal="true" aria-labelledby="cal-modal-title" novalidate>
            <header class="cal-sheet-head">
              <h3 id="cal-modal-title">New event</h3>
              <button type="button" class="cal-icon-btn" id="cal-modal-close-btn" aria-label="Close">${ICON.close}</button>
            </header>
            <div class="cal-sheet-body">
              <input type="text" id="cal-input-title" class="cal-title-input" placeholder="Add a title" aria-label="Title" required maxlength="200">
              <div class="cal-field-row">
                <label class="cal-field"><span>Date</span><input type="date" id="cal-input-date" required></label>
                <label class="cal-switch"><input type="checkbox" id="cal-input-allday"><span class="cal-switch-track"></span><span>All day</span></label>
              </div>
              <div class="cal-field-row" id="cal-time-inputs-wrap">
                <label class="cal-field"><span>Starts</span><input type="time" id="cal-input-start" value="09:00" step="900"></label>
                <label class="cal-field"><span>Ends</span><input type="time" id="cal-input-end" value="10:00" step="900"></label>
              </div>
              <fieldset class="cal-field cal-cat-pick">
                <legend>Calendar</legend>
                <div class="cal-cat-radios">
                  ${Object.values(CATEGORIES).map(c => `
                    <label class="cal-cat-radio" style="--c:${c.color}">
                      <input type="radio" name="cal-category" value="${c.id}"><span><i></i>${c.label}</span>
                    </label>`).join('')}
                </div>
              </fieldset>
              <div class="cal-field-row">
                <label class="cal-field"><span>Repeat</span>
                  <select id="cal-input-recurrence">
                    <option value="none">Does not repeat</option>
                    <option value="daily">Every day</option>
                    <option value="weekly">Every week</option>
                    <option value="monthly">Every month</option>
                    <option value="yearly">Every year</option>
                  </select>
                </label>
                <label class="cal-field"><span>Location</span><input type="text" id="cal-input-location" placeholder="Add a place" maxlength="200"></label>
              </div>
              <label class="cal-field"><span>Notes</span><textarea id="cal-input-desc" rows="3" placeholder="Add details"></textarea></label>
              <p class="cal-sheet-error" id="cal-sheet-error" role="alert" hidden></p>
            </div>
            <footer class="cal-sheet-foot">
              <button type="button" class="btn btn-secondary btn-sm cal-danger" id="cal-btn-delete-event" hidden>Delete</button>
              <span class="cal-sheet-hint"><kbd>Ctrl</kbd><kbd>↵</kbd> to save</span>
              <button type="button" class="btn btn-secondary btn-sm" id="cal-btn-cancel-event">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">Save</button>
            </footer>
          </form>
        </div>
      </div>
    `;

    const $ = (sel) => container.querySelector(sel);
    const root = $('.cal');
    const monthTitle = $('#cal-month-title');
    const viewContainer = $('#cal-view-container');
    const viewBtns = container.querySelectorAll('.cal-view-btn');
    const searchInput = $('#cal-search-input');
    const statusText = $('#cal-status-text');
    const mini = $('#cal-mini');
    const catsEl = $('#cal-cats');
    const upnextEl = $('#cal-upnext');

    const modal = $('#cal-event-modal');
    const modalForm = $('#cal-modal-form');
    const modalTitle = $('#cal-modal-title');
    const modalDeleteBtn = $('#cal-btn-delete-event');
    const sheetError = $('#cal-sheet-error');
    const titleInput = $('#cal-input-title');
    const dateInput = $('#cal-input-date');
    const allDayCheckbox = $('#cal-input-allday');
    const timeInputsWrap = $('#cal-time-inputs-wrap');
    const startInput = $('#cal-input-start');
    const endInput = $('#cal-input-end');
    const recurrenceSelect = $('#cal-input-recurrence');
    const locationInput = $('#cal-input-location');
    const descInput = $('#cal-input-desc');

    const updateCalSlider = attachSegmentedSlider($('.cal-view-switcher'), '.cal-view-btn');

    /* ---------- data ---------- */

    function eventsOn(dateKey) {
      if (!memo.has(dateKey)) memo.set(dateKey, getEventsForDate(dateKey));
      const q = searchQuery.toLowerCase();
      return memo.get(dateKey).filter(e => !hidden.has(e.category) && (!q || matches(e, q)));
    }

    function findEvent(id) {
      return loadEvents().find(e => e.id === id) || null;
    }

    /* ---------- rendering ---------- */

    function renderCurrentView(animDir = null) {
      memo = new Map();
      root.dataset.view = currentView;
      monthTitle.textContent = titleFor();
      if (animDir === 'prev' || animDir === 'next') {
        monthTitle.classList.remove('cal-anim-slide-left', 'cal-anim-slide-right');
        void monthTitle.offsetWidth;
        monthTitle.classList.add(animDir === 'next' ? 'cal-anim-slide-left' : 'cal-anim-slide-right');
      }

      if (currentView === 'month') renderMonthGrid();
      else if (currentView === 'week') renderTimeGrid(weekDays(cursor));
      else if (currentView === 'day') renderTimeGrid([cursor]);
      else renderAgendaView();

      renderMini();
      renderCats();
      renderUpNext();
      renderStatus();
    }

    function titleFor() {
      const d = parseKey(cursor);
      if (currentView === 'month') return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (currentView === 'day') return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      if (currentView === 'agenda') return searchQuery ? `Results for “${searchQuery}”` : `From ${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
      const days = weekDays(cursor).map(parseKey);
      const a = days[0], b = days[6];
      const left = `${MONTH_NAMES[a.getMonth()].slice(0, 3)} ${a.getDate()}`;
      const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${MONTH_NAMES[b.getMonth()].slice(0, 3)} ${b.getDate()}`;
      return `${left} – ${right}, ${b.getFullYear()}`;
    }

    function chip(e, dateKey) {
      const cat = CATEGORIES[e.category] || CATEGORIES.personal;
      const time = e.isAllDay ? '' : `<span class="cal-ev-time">${fmtTime(e.startTime)}</span>`;
      return `<button type="button" class="cal-ev${e.isAllDay ? ' is-allday' : ''}" data-id="${e.id}" data-date="${dateKey}" draggable="true" style="--c:${cat.color}" title="${escapeHtml(tooltip(e))}"><i></i>${time}<span class="cal-ev-title">${escapeHtml(e.title)}</span></button>`;
    }

    // --- MONTH ---
    function renderMonthGrid() {
      const d = parseKey(cursor);
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const start = addDays(formatDateKey(first), -first.getDay());
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
      const today = formatDateKey(new Date());
      let cells = '';
      for (let i = 0; i < weeks * 7; i++) {
        const key = addDays(start, i);
        const day = parseKey(key);
        const events = eventsOn(key);
        const shown = events.slice(0, 3);
        const more = events.length - shown.length;
        const cls = [
          'cal-cell',
          day.getMonth() !== d.getMonth() && 'is-outside',
          key === today && 'is-today',
          key === cursor && 'is-selected',
          (i % 7 === 0 || i % 7 === 6) && 'is-weekend'
        ].filter(Boolean).join(' ');
        cells += `
          <div class="${cls}" role="gridcell" data-date="${key}" aria-selected="${key === cursor}" aria-label="${day.toDateString()}, ${events.length} event${events.length === 1 ? '' : 's'}">
            <span class="cal-cell-num">${day.getDate() === 1 ? `${MONTH_NAMES[day.getMonth()].slice(0, 3)} 1` : day.getDate()}</span>
            <div class="cal-cell-events">${shown.map(e => chip(e, key)).join('')}${more > 0 ? `<button type="button" class="cal-more" data-goto="${key}">${more} more</button>` : ''}</div>
            <div class="cal-cell-dots" aria-hidden="true">${events.slice(0, 4).map(e => `<i style="--c:${(CATEGORIES[e.category] || CATEGORIES.personal).color}"></i>`).join('')}</div>
          </div>`;
      }
      viewContainer.innerHTML = `
        <div class="cal-month" role="grid" aria-label="${titleFor()}" style="--weeks:${weeks}">
          <div class="cal-weekdays" role="row">${WEEKDAY_NAMES.map(w => `<span role="columnheader">${w}</span>`).join('')}</div>
          <div class="cal-mgrid">${cells}</div>
        </div>`;
    }

    // --- WEEK / DAY ---
    function renderTimeGrid(days) {
      const today = formatDateKey(new Date());
      const prevScroll = viewContainer.querySelector('.cal-tg-scroll')?.scrollTop;
      const cols = days.length;
      const head = days.map(key => {
        const d = parseKey(key);
        return `<button type="button" class="cal-tg-dayhead${key === today ? ' is-today' : ''}${key === cursor && cols > 1 ? ' is-selected' : ''}" data-goto="${key}">
          <span>${WEEKDAY_NAMES[d.getDay()]}</span><b>${d.getDate()}</b></button>`;
      }).join('');
      const allday = days.map(key => `<div class="cal-tg-allday-col" data-date="${key}">${eventsOn(key).filter(e => e.isAllDay).map(e => chip(e, key)).join('')}</div>`).join('');
      const hours = Array.from({ length: 24 }, (_, h) => `<span class="cal-tg-hour" style="top:${h * HOUR_PX}px">${h === 0 ? '' : fmtTime(`${String(h).padStart(2, '0')}:00`)}</span>`).join('');
      const columns = days.map(key => {
        const timed = layoutDay(eventsOn(key).filter(e => !e.isAllDay));
        const blocks = timed.map(({ e, s, en, lane, lanes }) => {
          const cat = CATEGORIES[e.category] || CATEGORIES.personal;
          const h = Math.max((en - s) / 60 * HOUR_PX, 20);
          return `<button type="button" class="cal-block${h < 36 ? ' is-short' : ''}" data-id="${e.id}" data-date="${key}" draggable="true"
            style="--c:${cat.color}; top:${s / 60 * HOUR_PX}px; height:${h - 2}px; left:calc(${lane / lanes * 100}% + 2px); width:calc(${100 / lanes}% - 4px)" title="${escapeHtml(tooltip(e))}">
            <span class="cal-block-title">${escapeHtml(e.title)}</span>
            <span class="cal-block-time">${fmtTime(e.startTime)} – ${fmtTime(e.endTime)}${e.location ? ` · ${escapeHtml(e.location)}` : ''}</span>
          </button>`;
        }).join('');
        return `<div class="cal-tg-col${key === today ? ' is-today' : ''}${key === cursor && cols > 1 ? ' is-selected' : ''}" data-date="${key}">${blocks}${key === today ? '<div class="cal-now"></div>' : ''}</div>`;
      }).join('');

      viewContainer.innerHTML = `
        <div class="cal-tg" style="--cols:${cols}; --hour:${HOUR_PX}px">
          <div class="cal-tg-head"><span class="cal-tg-gutter"></span>${head}</div>
          <div class="cal-tg-allday"><span class="cal-tg-gutter">all day</span>${allday}</div>
          <div class="cal-tg-scroll">
            <div class="cal-tg-grid">
              <div class="cal-tg-hours">${hours}</div>
              ${columns}
            </div>
          </div>
        </div>`;
      placeNowLine();
      const scroller = viewContainer.querySelector('.cal-tg-scroll');
      const now = new Date();
      scroller.scrollTop = prevScroll ?? Math.max(0, (days.includes(today) ? now.getHours() - 1.5 : 7.5) * HOUR_PX);
    }

    function placeNowLine() {
      const line = viewContainer.querySelector('.cal-now');
      if (!line) return;
      const now = new Date();
      line.style.top = `${(now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_PX}px`;
    }

    // --- AGENDA ---
    function renderAgendaView() {
      const groups = [];
      let total = 0;
      const span = searchQuery ? 366 : AGENDA_DAYS;
      for (let i = 0; i < span; i++) {
        const key = addDays(cursor, i);
        const events = eventsOn(key);
        if (events.length) { groups.push([key, events]); total += events.length; }
      }
      const today = formatDateKey(new Date());
      viewContainer.innerHTML = total === 0 ? `
        <div class="cal-empty">
          ${ICON.day}
          <p>${searchQuery ? `No events match “${escapeHtml(searchQuery)}” in the next year.` : `Nothing scheduled in the next ${AGENDA_DAYS} days.`}</p>
          ${searchQuery ? '' : '<button type="button" class="btn btn-secondary btn-sm" data-new>New event</button>'}
        </div>` : `
        <div class="cal-agenda">
          ${groups.map(([key, events]) => {
            const d = parseKey(key);
            return `<section class="cal-ag-day${key === today ? ' is-today' : ''}">
              <button type="button" class="cal-ag-date" data-goto="${key}"><b>${d.getDate()}</b><span>${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()].slice(0, 3)}</span></button>
              <div class="cal-ag-list">${events.map(e => {
                const cat = CATEGORIES[e.category] || CATEGORIES.personal;
                return `<button type="button" class="cal-ag-item" data-id="${e.id}" data-date="${key}" style="--c:${cat.color}">
                  <span class="cal-ag-time">${e.isAllDay ? 'All day' : `${fmtTime(e.startTime)}<small>${fmtTime(e.endTime)}</small>`}</span>
                  <i></i>
                  <span class="cal-ag-main">
                    <span class="cal-ag-title">${escapeHtml(e.title)}</span>
                    <span class="cal-ag-meta">${[
                      e.location ? `${ICON.pin}${escapeHtml(e.location)}` : '',
                      e.recurrence && e.recurrence !== 'none' ? `${ICON.repeat}${REPEAT_LABELS[e.recurrence] || ''}` : '',
                      e.description ? `<span class="cal-ag-desc">${escapeHtml(e.description)}</span>` : ''
                    ].filter(Boolean).map(x => `<span>${x}</span>`).join('')}</span>
                  </span>
                  <span class="cal-ag-cat">${cat.label}</span>
                </button>`;
              }).join('')}</div>
            </section>`;
          }).join('')}
        </div>`;
    }

    // --- SIDEBAR ---
    function renderMini() {
      const d = parseKey(cursor);
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const start = addDays(formatDateKey(first), -first.getDay());
      const today = formatDateKey(new Date());
      let cells = '';
      for (let i = 0; i < 42; i++) {
        const key = addDays(start, i);
        const day = parseKey(key);
        const busy = eventsOn(key).length > 0;
        cells += `<button type="button" tabindex="-1" class="cal-mini-day${day.getMonth() !== d.getMonth() ? ' is-outside' : ''}${key === today ? ' is-today' : ''}${key === cursor ? ' is-selected' : ''}${busy ? ' is-busy' : ''}" data-pick="${key}" aria-label="${day.toDateString()}">${day.getDate()}</button>`;
      }
      mini.innerHTML = `
        <div class="cal-mini-head">
          <span>${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}</span>
          <button type="button" class="cal-icon-btn" data-mini="-1" aria-label="Previous month">${ICON.prev}</button>
          <button type="button" class="cal-icon-btn" data-mini="1" aria-label="Next month">${ICON.next}</button>
        </div>
        <div class="cal-mini-grid">${WEEKDAY_NAMES.map(w => `<span>${w[0]}</span>`).join('')}${cells}</div>`;
    }

    function renderCats() {
      const all = loadEvents();
      catsEl.innerHTML = Object.values(CATEGORIES).map(c => {
        const count = all.filter(e => e.category === c.id).length;
        return `<label class="cal-cat" style="--c:${c.color}">
          <input type="checkbox" data-cat="${c.id}" ${hidden.has(c.id) ? '' : 'checked'}>
          <span class="cal-cat-box"></span><span class="cal-cat-name">${c.label}</span><span class="cal-cat-count">${count || ''}</span>
        </label>`;
      }).join('');
    }

    function renderUpNext() {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const today = formatDateKey(now);
      const items = [];
      for (let i = 0; i < 30 && items.length < 5; i++) {
        const key = addDays(today, i);
        for (const e of eventsOn(key)) {
          if (i === 0 && !e.isAllDay && toMin(e.endTime || e.startTime) < nowMin) continue;
          items.push([key, e]);
          if (items.length >= 5) break;
        }
      }
      upnextEl.innerHTML = items.length ? items.map(([key, e]) => {
        const cat = CATEGORIES[e.category] || CATEGORIES.personal;
        return `<button type="button" class="cal-up" data-id="${e.id}" data-date="${key}" style="--c:${cat.color}">
          <i></i><span class="cal-up-title">${escapeHtml(e.title)}</span>
          <span class="cal-up-when">${relativeDay(key)}${e.isAllDay ? '' : ` · ${fmtTime(e.startTime)}`}</span>
        </button>`;
      }).join('') : '<p class="cal-muted">Nothing in the next 30 days.</p>';
    }

    function renderStatus() {
      let n = 0;
      let label = '';
      if (currentView === 'month') {
        const d = parseKey(cursor);
        const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= dim; i++) n += eventsOn(formatDateKey(new Date(d.getFullYear(), d.getMonth(), i))).length;
        label = 'this month';
      } else if (currentView === 'week') {
        for (const k of weekDays(cursor)) n += eventsOn(k).length;
        label = 'this week';
      } else if (currentView === 'day') {
        n = eventsOn(cursor).length;
        label = 'on this day';
      } else {
        n = viewContainer.querySelectorAll('.cal-ag-item').length;
        label = searchQuery ? 'found' : `in the next ${AGENDA_DAYS} days`;
      }
      const filtered = hidden.size ? ` · ${hidden.size} calendar${hidden.size === 1 ? '' : 's'} hidden` : '';
      statusText.textContent = `${n} event${n === 1 ? '' : 's'} ${label} · Week ${getWeekNumber(parseKey(cursor))}${filtered}`;
    }

    /* ---------- navigation ---------- */

    function setView(view, { focus = false } = {}) {
      if (!VIEWS.includes(view)) return;
      currentView = view;
      viewBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.view === view);
        b.setAttribute('aria-selected', String(b.dataset.view === view));
      });
      updateCalSlider?.();
      renderCurrentView();
      if (focus) focusSelection();
    }

    function select(key, { focus = true } = {}) {
      const before = cursor;
      cursor = key;
      const sameFrame = currentView === 'month' ? before.slice(0, 7) === key.slice(0, 7)
        : currentView === 'week' ? weekDays(before)[0] === weekDays(key)[0]
          : false;
      if (sameFrame) {
        // Stay put: only move the selection highlight.
        viewContainer.querySelectorAll('.is-selected[data-date], .is-selected[data-goto]').forEach(el => { el.classList.remove('is-selected'); el.setAttribute('aria-selected', 'false'); });
        viewContainer.querySelectorAll(`[data-date="${key}"].cal-cell, [data-date="${key}"].cal-tg-col, [data-goto="${key}"].cal-tg-dayhead`).forEach(el => { el.classList.add('is-selected'); el.setAttribute('aria-selected', 'true'); });
        renderMini();
        renderStatus();
      } else {
        renderCurrentView(key > before ? 'next' : 'prev');
      }
      if (focus) focusSelection();
    }

    function step(dir) {
      const d = parseKey(cursor);
      if (currentView === 'month') {
        const target = new Date(d.getFullYear(), d.getMonth() + dir, 1);
        const dim = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        target.setDate(Math.min(d.getDate(), dim));
        cursor = formatDateKey(target);
      } else {
        cursor = addDays(cursor, dir * (currentView === 'week' ? 7 : currentView === 'day' ? 1 : AGENDA_DAYS));
      }
      if (dir > 0) renderCurrentView('next');
      else renderCurrentView('prev');
    }

    function focusSelection() {
      const el = viewContainer.querySelector(`.cal-cell[data-date="${cursor}"]`);
      if (el) { el.tabIndex = -1; el.focus({ preventScroll: false }); }
      else root.focus({ preventScroll: true });
    }

    $('#cal-prev-btn').addEventListener('click', () => step(-1));
    $('#cal-next-btn').addEventListener('click', () => step(1));
    $('#cal-today-btn').addEventListener('click', () => select(formatDateKey(new Date()), { focus: false }));
    viewBtns.forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
    $('#cal-side-toggle').addEventListener('click', () => {
      root.dataset.side = root.dataset.side === 'open' ? 'closed' : 'open';
      requestAnimationFrame(() => updateCalSlider?.());
    });
    root.querySelector('[data-close-side]').addEventListener('click', () => { root.dataset.side = 'closed'; });

    /* ---------- sidebar interactions ---------- */

    mini.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-mini]');
      if (nav) {
        const d = parseKey(cursor);
        const t = new Date(d.getFullYear(), d.getMonth() + Number(nav.dataset.mini), 1);
        cursor = formatDateKey(t);
        renderCurrentView(Number(nav.dataset.mini) > 0 ? 'next' : 'prev');
        return;
      }
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        select(pick.dataset.pick, { focus: false });
        if (isNarrow()) root.dataset.side = 'closed';
      }
    });

    catsEl.addEventListener('change', (e) => {
      const id = e.target.dataset.cat;
      if (!id) return;
      if (e.target.checked) hidden.delete(id); else hidden.add(id);
      saveHidden(hidden);
      renderCurrentView();
    });
    // Alt-click (or double-click) a calendar to show only that one.
    catsEl.addEventListener('dblclick', (e) => {
      const input = e.target.closest('.cal-cat')?.querySelector('input');
      if (!input) return;
      e.preventDefault();
      const only = input.dataset.cat;
      const isSolo = hidden.size === Object.keys(CATEGORIES).length - 1 && !hidden.has(only);
      hidden = new Set(isSolo ? [] : Object.keys(CATEGORIES).filter(k => k !== only));
      saveHidden(hidden);
      renderCurrentView();
    });

    upnextEl.addEventListener('click', (e) => {
      const it = e.target.closest('[data-id]');
      if (it) openEditor(it.dataset.id, it.dataset.date);
    });

    $('#cal-add-event-btn').addEventListener('click', () => openEditor(null, cursor));

    /* ---------- view interactions ---------- */

    viewContainer.addEventListener('click', (e) => {
      if (e.target.closest('[data-new]')) { openEditor(null, cursor); return; }
      const ev = e.target.closest('[data-id]');
      if (ev) { openEditor(ev.dataset.id, ev.dataset.date); return; }
      const go = e.target.closest('[data-goto]');
      if (go) { cursor = go.dataset.goto; setView('day'); return; }
      const cell = e.target.closest('.cal-cell, .cal-tg-col, .cal-tg-allday-col');
      if (!cell) return;
      if (cell.dataset.date !== cursor) select(cell.dataset.date, { focus: cell.classList.contains('cal-cell') });
      // On a phone the month shows dots only, so a second tap opens the day.
      else if (isNarrow() && cell.classList.contains('cal-cell')) setView('day');
    });

    viewContainer.addEventListener('dblclick', (e) => {
      if (e.target.closest('[data-id], [data-goto]')) return;
      const col = e.target.closest('.cal-tg-col');
      if (col) {
        const min = snap(yToMin(col, e.clientY), 30);
        openEditor(null, col.dataset.date, { start: minToTime(min), end: minToTime(Math.min(min + 60, 24 * 60 - 1)) });
        return;
      }
      const cell = e.target.closest('.cal-cell, .cal-tg-allday-col');
      if (cell) openEditor(null, cell.dataset.date, { allDay: cell.classList.contains('cal-tg-allday-col') });
    });

    viewContainer.addEventListener('contextmenu', (e) => {
      const ev = e.target.closest('[data-id]');
      const cell = e.target.closest('[data-date]');
      if (!ev && !cell) return;
      e.preventDefault();
      if (ev) {
        const evt = findEvent(ev.dataset.id);
        if (!evt) return;
        const occ = ev.dataset.date;
        openContextMenu({
          x: e.clientX, y: e.clientY, title: evt.title, label: 'Event actions',
          items: [
            { label: 'Open', icon: ICON.edit, shortcut: '↵', action: () => openEditor(evt.id, occ) },
            { label: 'Duplicate', icon: ICON.copy, action: () => duplicate(evt, occ) },
            { label: 'Go to day', icon: ICON.day, action: () => { cursor = occ; setView('day'); } },
            { separator: true },
            { label: 'Delete', icon: ICON.trash, shortcut: 'Del', destructive: true, action: () => remove(evt.id) }
          ]
        });
      } else {
        const key = cell.dataset.date;
        const col = e.target.closest('.cal-tg-col');
        const min = col ? snap(yToMin(col, e.clientY), 30) : null;
        const when = parseKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        openContextMenu({
          x: e.clientX, y: e.clientY, title: min === null ? when : `${when}, ${fmtTime(minToTime(min))}`, label: 'Day actions',
          items: [
            { label: 'New event here', icon: ICON.plus, shortcut: 'N', action: () => openEditor(null, key, min === null ? {} : { start: minToTime(min), end: minToTime(Math.min(min + 60, 24 * 60 - 1)) }) },
            { label: 'New all-day event', icon: ICON.plus, action: () => openEditor(null, key, { allDay: true }) },
            ...(currentView === 'day' ? [] : [{ label: 'Open day', icon: ICON.day, shortcut: '↵', action: () => { cursor = key; setView('day'); } }])
          ]
        });
      }
    });

    // Drag an event to another day (month, all-day row) or time (week, day).
    let drag = null;
    viewContainer.addEventListener('dragstart', (e) => {
      const ev = e.target.closest('[data-id][draggable]');
      if (!ev) return;
      const rect = ev.getBoundingClientRect();
      drag = { id: ev.dataset.id, from: ev.dataset.date, grabY: e.clientY - rect.top };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ev.textContent.trim());
      requestAnimationFrame(() => ev.classList.add('is-dragging'));
    });
    viewContainer.addEventListener('dragend', () => {
      drag = null;
      viewContainer.querySelectorAll('.is-dragging, .is-drop').forEach(el => el.classList.remove('is-dragging', 'is-drop'));
    });
    viewContainer.addEventListener('dragover', (e) => {
      if (!drag) return;
      const target = e.target.closest('.cal-cell, .cal-tg-col, .cal-tg-allday-col');
      if (!target) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      viewContainer.querySelectorAll('.is-drop').forEach(el => el !== target && el.classList.remove('is-drop'));
      target.classList.add('is-drop');
    });
    viewContainer.addEventListener('drop', (e) => {
      if (!drag) return;
      const target = e.target.closest('.cal-cell, .cal-tg-col, .cal-tg-allday-col');
      if (!target) return;
      e.preventDefault();
      const evt = findEvent(drag.id);
      if (!evt) return;
      const shift = daysBetween(drag.from, target.dataset.date);
      const updates = { date: addDays(evt.date, shift) };
      if (target.classList.contains('cal-tg-col')) {
        const dur = evt.isAllDay ? 60 : Math.max(durationOf(evt), 15);
        const start = Math.min(snap(yToMin(target, e.clientY - drag.grabY), 15), 24 * 60 - dur);
        Object.assign(updates, { isAllDay: false, startTime: minToTime(Math.max(0, start)), endTime: minToTime(Math.min(Math.max(0, start) + dur, 24 * 60 - 1)) });
      } else if (target.classList.contains('cal-tg-allday-col')) {
        Object.assign(updates, { isAllDay: true, startTime: '', endTime: '' });
      }
      updateEvent(evt.id, updates);
      cursor = target.dataset.date;
      renderCurrentView();
    });

    /* ---------- search ---------- */

    let searchTimer = 0;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = searchInput.value.trim();
        renderCurrentView();
      }, 120);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); searchQuery = searchInput.value.trim(); setView('agenda'); }
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (searchInput.value) { searchInput.value = ''; searchQuery = ''; renderCurrentView(); }
        else searchInput.blur();
      }
    });

    /* ---------- keyboard ---------- */

    function onKey(e) {
      if (!root.isConnected) { window.removeEventListener('keydown', onKey, true); clearInterval(clock); return; }
      // Escape closes what is open here; it must not also reach the app, which leaves the tool on Escape.
      if (e.key === 'Escape' && (!modal.hidden || document.querySelector('#toolbox-context-menu'))) e.stopPropagation();
      if (!modal.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); modalForm.requestSubmit(); }
        return;
      }
      if (e.defaultPrevented || e.altKey || document.querySelector('#toolbox-context-menu, .custom-dialog-backdrop')) return;
      const t = e.target;
      if (t !== root && !root.contains(t) && t !== document.body) return;
      if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.ctrlKey || e.metaKey) return;

      const key = e.key;
      const onEvent = t.closest?.('[data-id]');
      if ((key === 'Delete' || key === 'Backspace') && onEvent) { e.preventDefault(); remove(onEvent.dataset.id); return; }
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: currentView === 'day' ? -1 : -7, ArrowDown: currentView === 'day' ? 1 : 7 };
      if (key in moves) {
        e.preventDefault();
        select(addDays(cursor, moves[key]));
        return;
      }
      if (key === 'Home' || key === 'End') {
        e.preventDefault();
        const d = parseKey(cursor);
        select(formatDateKey(currentView === 'month'
          ? new Date(d.getFullYear(), d.getMonth() + (key === 'End' ? 1 : 0), key === 'End' ? 0 : 1)
          : parseKey(weekDays(cursor)[key === 'End' ? 6 : 0])));
        return;
      }
      if (key === 'Enter' && !onEvent && t.tagName !== 'BUTTON') {
        e.preventDefault();
        if (currentView === 'day') openEditor(null, cursor);
        else setView('day');
        return;
      }
      const lower = key.toLowerCase();
      if (VIEW_KEYS[lower] && key.length === 1) { e.preventDefault(); setView(VIEW_KEYS[lower], { focus: true }); return; }
      if (lower === 'n') { e.preventDefault(); openEditor(null, cursor); return; }
      if (lower === 't') { e.preventDefault(); select(formatDateKey(new Date())); return; }
      if (lower === 'j' || key === 'PageDown') { e.preventDefault(); step(1); focusSelection(); return; }
      if (lower === 'k' || key === 'PageUp') { e.preventDefault(); step(-1); focusSelection(); return; }
      if (key === '/') { e.preventDefault(); e.stopPropagation(); searchInput.focus(); searchInput.select(); }
    }
    // Capture phase, so the calendar's own "/" wins over the global tool palette.
    window.addEventListener('keydown', onKey, true);

    // Keep the "now" line and Up next honest while the tool stays open.
    const clock = setInterval(() => {
      if (!root.isConnected) { clearInterval(clock); window.removeEventListener('keydown', onKey, true); return; }
      placeNowLine();
      memo = new Map();
      renderUpNext();
    }, 60000);

    /* ---------- editor sheet ---------- */

    function openEditor(id, occurrence, preset = {}) {
      closeContextMenu();
      const evt = id ? findEvent(id) : null;
      if (id && !evt) return;
      editing = { id: evt?.id || null, occurrence };
      lastFocus = document.activeElement;
      modalTitle.textContent = evt ? 'Edit event' : 'New event';
      titleInput.value = evt?.title || '';
      dateInput.value = evt ? evt.date : (occurrence || cursor);
      allDayCheckbox.checked = evt ? Boolean(evt.isAllDay) : Boolean(preset.allDay);
      startInput.value = evt?.startTime || preset.start || '09:00';
      endInput.value = evt?.endTime || preset.end || '10:00';
      recurrenceSelect.value = evt?.recurrence || 'none';
      locationInput.value = evt?.location || '';
      descInput.value = evt?.description || '';
      const cat = evt?.category || (hidden.has('personal') ? Object.keys(CATEGORIES).find(k => !hidden.has(k)) : 'personal') || 'personal';
      modalForm.querySelectorAll('input[name="cal-category"]').forEach(r => { r.checked = r.value === cat; });
      modalDeleteBtn.hidden = !evt;
      sheetError.hidden = true;
      syncAllDay();
      modal.hidden = false;
      requestAnimationFrame(() => { titleInput.focus(); if (evt) titleInput.select(); });
    }

    function closeEditor() {
      modal.hidden = true;
      editing = null;
      if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
      else focusSelection();
    }

    function syncAllDay() {
      timeInputsWrap.hidden = allDayCheckbox.checked;
    }

    allDayCheckbox.addEventListener('change', syncAllDay);
    // Keep the end after the start, preserving the duration when the start moves.
    let lastStart = startInput.value;
    startInput.addEventListener('focus', () => { lastStart = startInput.value; });
    startInput.addEventListener('change', () => {
      const dur = toMin(endInput.value) - toMin(lastStart);
      const start = toMin(startInput.value);
      endInput.value = minToTime(Math.min(start + (dur > 0 ? dur : 60), 24 * 60 - 1));
      lastStart = startInput.value;
    });

    $('#cal-modal-close-btn').addEventListener('click', closeEditor);
    $('#cal-btn-cancel-event').addEventListener('click', closeEditor);
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeEditor(); });
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...modalForm.querySelectorAll('input:not([type=hidden]), select, textarea, button')].filter(el => !el.disabled && el.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const isAllDay = allDayCheckbox.checked;
      const fail = (msg, el) => { sheetError.textContent = msg; sheetError.hidden = false; el?.focus(); };
      if (!title) return fail('Give the event a title.', titleInput);
      if (!dateInput.value) return fail('Pick a date.', dateInput);
      if (!isAllDay && toMin(endInput.value) <= toMin(startInput.value)) return fail('The event has to end after it starts.', endInput);
      const data = {
        title,
        date: dateInput.value,
        category: modalForm.querySelector('input[name="cal-category"]:checked')?.value || 'personal',
        isAllDay,
        startTime: isAllDay ? '' : startInput.value,
        endTime: isAllDay ? '' : endInput.value,
        recurrence: recurrenceSelect.value,
        location: locationInput.value.trim(),
        description: descInput.value.trim()
      };
      if (editing?.id) updateEvent(editing.id, data);
      else addEvent(data);
      if (hidden.has(data.category)) { hidden.delete(data.category); saveHidden(hidden); }
      const savedOn = editing?.id ? (editing.occurrence || data.date) : data.date;
      cursor = data.recurrence === 'none' ? data.date : savedOn;
      closeEditor();
      renderCurrentView();
    });

    modalDeleteBtn.addEventListener('click', () => {
      if (editing?.id) remove(editing.id, { fromSheet: true });
    });

    function duplicate(evt, occurrence) {
      const { id, createdAt, updatedAt, ...rest } = evt;
      addEvent({ ...rest, date: evt.recurrence === 'none' ? evt.date : occurrence, title: `${evt.title} (copy)`, recurrence: 'none' });
      renderCurrentView();
    }

    async function remove(id, { fromSheet = false } = {}) {
      const evt = findEvent(id);
      if (!evt) return;
      const repeats = evt.recurrence && evt.recurrence !== 'none';
      const ok = await tbConfirm(
        repeats ? `“${evt.title}” repeats. Deleting it removes every occurrence.` : `Delete “${evt.title}”?`,
        { title: 'Delete event', destructive: true, confirmText: 'Delete' }
      );
      if (!ok) return;
      deleteEvent(id);
      if (fromSheet) closeEditor();
      renderCurrentView();
      focusSelection();
    }

    /* ---------- import / export ---------- */

    $('#cal-export-btn').addEventListener('click', () => {
      const ics = exportToICS();
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `toolbox-calendar-${formatDateKey(new Date())}.ics`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    });

    const importFileInput = $('#cal-import-file');
    importFileInput.addEventListener('change', () => {
      const file = importFileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const imported = importFromICS(reader.result);
        tbAlert(imported.length ? `Imported ${imported.length} event${imported.length === 1 ? '' : 's'}.` : 'No events were found in that file.', 'Import');
        renderCurrentView();
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });

    /* ---------- layout ---------- */

    function isNarrow() { return root.clientWidth < 760; }
    if (typeof ResizeObserver !== 'undefined') {
      let wasNarrow = null;
      new ResizeObserver(() => {
        const narrow = isNarrow();
        if (narrow !== wasNarrow) {
          root.dataset.narrow = String(narrow);
          if (narrow) root.dataset.side = 'closed';
          else root.dataset.side = 'open';
          wasNarrow = narrow;
        }
        updateCalSlider?.();
      }).observe(root);
    }

    renderCurrentView();
  }
};

/* ---------- helpers ---------- */

function cap(s) { return s[0].toUpperCase() + s.slice(1); }

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return formatDateKey(d);
}

function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

function weekDays(key) {
  const start = addDays(key, -parseKey(key).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minToTime(min) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function snap(min, stepMin) { return Math.round(min / stepMin) * stepMin; }

function yToMin(col, clientY) {
  return (clientY - col.getBoundingClientRect().top) / HOUR_PX * 60;
}

function durationOf(e) {
  const d = toMin(e.endTime) - toMin(e.startTime);
  return d > 0 ? d : 60;
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: m ? '2-digit' : undefined });
}

function relativeDay(key) {
  const diff = daysBetween(formatDateKey(new Date()), key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const d = parseKey(key);
  return diff < 7 ? d.toLocaleDateString(undefined, { weekday: 'long' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function tooltip(e) {
  const when = e.isAllDay ? 'All day' : `${fmtTime(e.startTime)} – ${fmtTime(e.endTime)}`;
  return [e.title, when, e.location].filter(Boolean).join('\n');
}

function matches(e, q) {
  return [e.title, e.description, e.location, e.category].some(v => v && String(v).toLowerCase().includes(q));
}

// Place overlapping timed events side by side, one lane each.
function layoutDay(events) {
  const items = events.map(e => {
    const s = toMin(e.startTime);
    const end = toMin(e.endTime);
    return { e, s, en: Math.max(end > s ? end : 24 * 60, s + 20), lane: 0, lanes: 1 };
  }).sort((a, b) => a.s - b.s || b.en - a.en);
  let cluster = [];
  let lanes = [];
  let clusterEnd = -1;
  const flush = () => { cluster.forEach(it => { it.lanes = lanes.length; }); cluster = []; lanes = []; };
  for (const it of items) {
    if (it.s >= clusterEnd) { flush(); clusterEnd = -1; }
    let lane = lanes.findIndex(end => end <= it.s);
    if (lane === -1) { lane = lanes.length; lanes.push(it.en); } else lanes[lane] = it.en;
    it.lane = lane;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.en);
  }
  flush();
  return items;
}

function loadHidden() {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); } catch { return new Set(); }
}

function saveHidden(set) {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set])); } catch { /* storage unavailable */ }
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
