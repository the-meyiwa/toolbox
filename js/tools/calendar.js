/* ============================================================
   TOOLBOX — Calendar Tool
   Full offline interactive calendar with month, week, day, and agenda views,
   event scheduling, recurrence, category filters, and .ics export/import.
   ============================================================ */

import {
  loadEvents,
  saveEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  getEventsForDate,
  getEventsInRange,
  searchEvents,
  exportToICS,
  importFromICS,
  CATEGORIES
} from '../lib/calendar-store.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default {
  render(container) {
    let currentDate = new Date();
    let currentView = 'month'; // 'month' | 'week' | 'day' | 'agenda'
    let selectedCategory = 'all';
    let searchQuery = '';
    let selectedDateStr = formatDateKey(new Date());

    container.innerHTML = `
      <div class="calendar-app-wrapper" style="display:flex; flex-direction:column; gap:20px; max-width:1200px; margin:0 auto; font-family:var(--sans);">
        
        <!-- TOP CONTROLS & HEADER -->
        <div class="calendar-header-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:18px; padding:18px 24px; box-shadow:0 6px 24px rgba(0,0,0,0.03); display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            
            <!-- Month/Year Navigation -->
            <div style="display:flex; align-items:center; gap:12px;">
              <button type="button" class="btn btn-secondary btn-sm" id="cal-prev-btn" aria-label="Previous Month" style="padding:6px 10px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <h2 id="cal-month-title" style="margin:0; font-size:1.45rem; font-weight:700; color:var(--text); min-width:180px; letter-spacing:-0.02em;"></h2>
              <button type="button" class="btn btn-secondary btn-sm" id="cal-next-btn" aria-label="Next Month" style="padding:6px 10px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="cal-today-btn" style="font-weight:600;">Today</button>
            </div>

            <!-- View Switcher -->
            <div class="cal-view-switcher" style="display:flex; background:var(--bg-subtle); padding:3px; border-radius:12px; border:1px solid var(--border);">
              <button type="button" class="cal-view-btn active" data-view="month">Month</button>
              <button type="button" class="cal-view-btn" data-view="week">Week</button>
              <button type="button" class="cal-view-btn" data-view="day">Day</button>
              <button type="button" class="cal-view-btn" data-view="agenda">Agenda</button>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" id="cal-add-event-btn" style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>New Event</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="cal-export-btn" title="Export to standard .ics iCalendar file">Export .ics</button>
              <label class="btn btn-secondary btn-sm" style="margin:0; cursor:pointer;" title="Import from standard .ics file">
                <span>Import</span>
                <input type="file" id="cal-import-file" accept=".ics,text/calendar" style="display:none;">
              </label>
            </div>
          </div>

          <!-- Secondary Filter & Search Strip -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid var(--border-subtle); padding-top:14px;">
            <!-- Category Filter Pills -->
            <div class="cal-category-pills" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <button type="button" class="cal-cat-pill active" data-cat="all">All</button>
              ${Object.values(CATEGORIES).map(c => `
                <button type="button" class="cal-cat-pill" data-cat="${c.id}" style="--cat-color:${c.color};">
                  <span class="cal-cat-dot" style="background:${c.color};"></span>
                  ${c.label}
                </button>
              `).join('')}
            </div>

            <!-- Search Input -->
            <div style="position:relative; min-width:200px; max-width:280px;">
              <input type="text" id="cal-search-input" class="tool-input" placeholder="Search events…" style="width:100%; height:34px; font-size:0.8rem; padding:0 10px 0 30px; border-radius:8px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:10px; top:11px; color:var(--text-muted); pointer-events:none;">
                <circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>
        </div>

        <!-- TODAY AT A GLANCE BANNER -->
        <div class="cal-today-banner" style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="cal-date-badge" style="background:var(--black); color:var(--white); width:48px; height:48px; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <span id="cal-today-day-num" style="font-size:1.15rem; font-weight:800; line-height:1; font-family:var(--mono);"></span>
              <span id="cal-today-month-abbr" style="font-size:0.65rem; text-transform:uppercase; font-weight:700; margin-top:2px;"></span>
            </div>
            <div>
              <div id="cal-today-full-text" style="font-weight:700; font-size:1rem; color:var(--text);"></div>
              <div id="cal-today-sub-text" style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;"></div>
            </div>
          </div>
          <div id="cal-today-count-badge" style="font-size:0.8rem; font-weight:600; padding:4px 12px; border-radius:999px; background:var(--bg-subtle); border:1px solid var(--border); color:var(--text);"></div>
        </div>

        <!-- MAIN CALENDAR VIEW CONTAINER -->
        <div id="cal-view-container" style="min-height:540px;"></div>
      </div>

      <!-- EVENT CREATION / EDIT MODAL -->
      <div id="cal-event-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(6px); z-index:1100; align-items:center; justify-content:center; padding:16px;">
        <div class="cal-modal-window" style="background:var(--bg-card); color:var(--text); width:100%; max-width:480px; border-radius:18px; border:1px solid var(--border); box-shadow:0 24px 60px rgba(0,0,0,0.25); overflow:hidden; display:flex; flex-direction:column;">
          
          <!-- Modal Header -->
          <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:var(--bg-subtle);">
            <h3 id="cal-modal-title" style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text);">New Event</h3>
            <button type="button" id="cal-modal-close-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <!-- Modal Body -->
          <form id="cal-modal-form" style="padding:20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; max-height:75vh;">
            <input type="hidden" id="cal-event-id">
            
            <div>
              <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:4px; color:var(--text-secondary);">Event Title *</label>
              <input type="text" id="cal-input-title" class="tool-input" placeholder="e.g. Project Sprint Review" required style="width:100%; font-size:0.9rem;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:4px; color:var(--text-secondary);">Date *</label>
                <input type="date" id="cal-input-date" class="tool-input" required style="width:100%; font-size:0.85rem;">
              </div>
              <div>
                <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:4px; color:var(--text-secondary);">Category</label>
                <select id="cal-input-category" class="tool-select" style="width:100%; font-size:0.85rem;">
                  ${Object.values(CATEGORIES).map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Time Row -->
            <div style="display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="cal-input-allday" style="width:15px; height:15px; cursor:pointer;">
                <label for="cal-input-allday" style="font-size:0.82rem; font-weight:600; cursor:pointer; color:var(--text);">All-day event</label>
              </div>
              <div id="cal-time-inputs-wrap" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:4px;">
                <div>
                  <label style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:2px;">Start Time</label>
                  <input type="time" id="cal-input-start" class="tool-input" value="09:00" style="width:100%;">
                </div>
                <div>
                  <label style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:2px;">End Time</label>
                  <input type="time" id="cal-input-end" class="tool-input" value="10:00" style="width:100%;">
                </div>
              </div>
            </div>

            <!-- Recurrence & Location -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:4px; color:var(--text-secondary);">Repeat</label>
                <select id="cal-input-recurrence" class="tool-select" style="width:100%; font-size:0.85rem;">
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:4px; color:var(--text-secondary);">Location</label>
                <input type="text" id="cal-input-location" class="tool-input" placeholder="e.g. Office / Zoom" style="width:100%; font-size:0.85rem;">
              </div>
            </div>

            <!-- Description -->
            <div>
              <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:4px; color:var(--text-secondary);">Description / Notes</label>
              <textarea id="cal-input-desc" class="tool-textarea" rows="3" placeholder="Add details or agenda items…" style="width:100%; font-size:0.85rem;"></textarea>
            </div>

            <!-- Modal Actions -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; border-top:1px solid var(--border); padding-top:14px;">
              <button type="button" id="cal-btn-delete-event" class="btn btn-secondary btn-sm" style="color:#ef4444; display:none;">Delete</button>
              <div style="display:flex; gap:8px; margin-left:auto;">
                <button type="button" id="cal-btn-cancel-event" class="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm">Save Event</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    injectCalendarStyles();

    // DOM Elements
    const monthTitle = container.querySelector('#cal-month-title');
    const prevBtn = container.querySelector('#cal-prev-btn');
    const nextBtn = container.querySelector('#cal-next-btn');
    const todayBtn = container.querySelector('#cal-today-btn');
    const viewContainer = container.querySelector('#cal-view-container');
    const viewBtns = container.querySelectorAll('.cal-view-btn');
    const catPills = container.querySelectorAll('.cal-cat-pill');
    const searchInput = container.querySelector('#cal-search-input');
    const addEventBtn = container.querySelector('#cal-add-event-btn');
    const exportBtn = container.querySelector('#cal-export-btn');
    const importFileInput = container.querySelector('#cal-import-file');

    // Today banner elements
    const todayDayNum = container.querySelector('#cal-today-day-num');
    const todayMonthAbbr = container.querySelector('#cal-today-month-abbr');
    const todayFullText = container.querySelector('#cal-today-full-text');
    const todaySubText = container.querySelector('#cal-today-sub-text');
    const todayCountBadge = container.querySelector('#cal-today-count-badge');

    // Modal elements
    const modal = container.querySelector('#cal-event-modal');
    const modalTitle = container.querySelector('#cal-modal-title');
    const modalCloseBtn = container.querySelector('#cal-modal-close-btn');
    const modalCancelBtn = container.querySelector('#cal-btn-cancel-event');
    const modalDeleteBtn = container.querySelector('#cal-btn-delete-event');
    const modalForm = container.querySelector('#cal-modal-form');
    const eventIdInput = container.querySelector('#cal-event-id');
    const titleInput = container.querySelector('#cal-input-title');
    const dateInput = container.querySelector('#cal-input-date');
    const categorySelect = container.querySelector('#cal-input-category');
    const allDayCheckbox = container.querySelector('#cal-input-allday');
    const timeInputsWrap = container.querySelector('#cal-time-inputs-wrap');
    const startInput = container.querySelector('#cal-input-start');
    const endInput = container.querySelector('#cal-input-end');
    const recurrenceSelect = container.querySelector('#cal-input-recurrence');
    const locationInput = container.querySelector('#cal-input-location');
    const descInput = container.querySelector('#cal-input-desc');

    function updateTodayBanner() {
      const now = new Date();
      if (todayDayNum) todayDayNum.textContent = now.getDate();
      if (todayMonthAbbr) todayMonthAbbr.textContent = MONTH_NAMES[now.getMonth()].substring(0, 3);
      if (todayFullText) {
        todayFullText.textContent = now.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }
      if (todaySubText) {
        const weekNum = getWeekNumber(now);
        todaySubText.textContent = `Week ${weekNum} · Toolbox Local Time`;
      }
      const todayKey = formatDateKey(now);
      const todaysEvents = getEventsForDate(todayKey);
      if (todayCountBadge) {
        todayCountBadge.textContent = `${todaysEvents.length} event${todaysEvents.length === 1 ? '' : 's'} today`;
      }
    }

    function renderCurrentView() {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      monthTitle.textContent = `${MONTH_NAMES[month]} ${year}`;

      updateTodayBanner();

      if (currentView === 'month') {
        renderMonthGrid();
      } else if (currentView === 'week') {
        renderWeekView();
      } else if (currentView === 'day') {
        renderDayView();
      } else if (currentView === 'agenda') {
        renderAgendaView();
      }
    }

    // --- MONTH GRID ---
    function renderMonthGrid() {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);

      const daysInMonth = lastDayOfMonth.getDate();
      const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun

      // Prev month filler
      const prevMonthLastDay = new Date(year, month, 0).getDate();

      const todayStr = formatDateKey(new Date());

      let html = `
        <div class="cal-month-table" style="background:var(--bg-card); border:1px solid var(--border); border-radius:18px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,0.03);">
          <div class="cal-weekday-header" style="display:grid; grid-template-columns:repeat(7, 1fr); border-bottom:1px solid var(--border); background:var(--bg-subtle);">
            ${WEEKDAY_NAMES.map(w => `<div style="padding:10px 8px; text-align:center; font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.05em;">${w}</div>`).join('')}
          </div>
          <div class="cal-days-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:1px; background:var(--border-subtle);">
      `;

      // Fill preceding days
      for (let i = 0; i < startingDayOfWeek; i++) {
        const dayNum = prevMonthLastDay - startingDayOfWeek + i + 1;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const dateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        html += renderDayCell(dateKey, dayNum, false, false);
      }

      // Fill current month days
      for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateKey === todayStr;
        const isSelected = dateKey === selectedDateStr;
        html += renderDayCell(dateKey, d, true, isToday, isSelected);
      }

      // Fill trailing days to complete grid
      const totalCells = startingDayOfWeek + daysInMonth;
      const trailingDays = (7 - (totalCells % 7)) % 7;
      for (let j = 1; j <= trailingDays; j++) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const dateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
        html += renderDayCell(dateKey, j, false, false);
      }

      html += `
          </div>
        </div>
      `;

      viewContainer.innerHTML = html;
      bindCellEvents();
    }

    function renderDayCell(dateKey, dayNum, isCurrentMonth, isToday, isSelected = false) {
      let events = getEventsForDate(dateKey);
      if (selectedCategory !== 'all') {
        events = events.filter(e => e.category === selectedCategory);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        events = events.filter(e => e.title.toLowerCase().includes(q) || (e.description && e.description.toLowerCase().includes(q)));
      }

      const displayEvents = events.slice(0, 3);
      const moreCount = events.length - 3;

      return `
        <div class="cal-day-cell ${isCurrentMonth ? '' : 'cal-day-faded'} ${isToday ? 'cal-day-today' : ''} ${isSelected ? 'cal-day-selected' : ''}" data-date="${dateKey}">
          <div class="cal-day-top">
            <span class="cal-day-number ${isToday ? 'cal-today-circle' : ''}">${dayNum}</span>
            ${isToday ? '<span class="cal-today-tag">TODAY</span>' : ''}
          </div>
          <div class="cal-day-events-list">
            ${displayEvents.map(e => {
              const cat = CATEGORIES[e.category] || CATEGORIES.personal;
              return `
                <div class="cal-event-pill" data-id="${e.id}" style="--evt-color:${cat.color}; --evt-bg:${cat.bg};">
                  <span class="cal-event-dot"></span>
                  <span class="cal-event-time">${e.isAllDay ? 'All day' : e.startTime}</span>
                  <span class="cal-event-title">${escapeHtml(e.title)}</span>
                </div>
              `;
            }).join('')}
            ${moreCount > 0 ? `<div class="cal-more-tag">+${moreCount} more</div>` : ''}
          </div>
        </div>
      `;
    }

    // --- WEEK VIEW ---
    function renderWeekView() {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDates.push(d);
      }

      const todayStr = formatDateKey(new Date());

      let html = `
        <div class="cal-week-grid" style="background:var(--bg-card); border:1px solid var(--border); border-radius:18px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,0.03);">
          <div style="display:grid; grid-template-columns:repeat(7, 1fr); border-bottom:1px solid var(--border); background:var(--bg-subtle);">
            ${weekDates.map(d => {
              const dateKey = formatDateKey(d);
              const isToday = dateKey === todayStr;
              return `
                <div style="padding:12px 6px; text-align:center; border-right:1px solid var(--border-subtle); ${isToday ? 'background:rgba(59,130,246,0.06);' : ''}">
                  <div style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">${WEEKDAY_NAMES[d.getDay()]}</div>
                  <div style="font-size:1.1rem; font-weight:700; margin-top:2px; color:${isToday ? '#3b82f6' : 'var(--text)'}; font-family:var(--mono);">${d.getDate()}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div style="display:grid; grid-template-columns:repeat(7, 1fr); min-height:480px; gap:1px; background:var(--border-subtle);">
            ${weekDates.map(d => {
              const dateKey = formatDateKey(d);
              let events = getEventsForDate(dateKey);
              if (selectedCategory !== 'all') events = events.filter(e => e.category === selectedCategory);
              return `
                <div class="cal-week-col" data-date="${dateKey}" style="background:var(--bg-card); padding:10px 8px; display:flex; flex-direction:column; gap:6px; min-height:440px;">
                  ${events.map(e => {
                    const cat = CATEGORIES[e.category] || CATEGORIES.personal;
                    return `
                      <div class="cal-event-card-item" data-id="${e.id}" style="border-left:3px solid ${cat.color}; background:var(--bg-subtle); padding:6px 8px; border-radius:6px; font-size:0.78rem; cursor:pointer;">
                        <div style="font-weight:600; color:var(--text);">${escapeHtml(e.title)}</div>
                        <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">${e.isAllDay ? 'All day' : `${e.startTime} - ${e.endTime}`}</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      viewContainer.innerHTML = html;
      bindCellEvents();
    }

    // --- DAY VIEW ---
    function renderDayView() {
      const dateKey = formatDateKey(currentDate);
      let events = getEventsForDate(dateKey);
      if (selectedCategory !== 'all') events = events.filter(e => e.category === selectedCategory);

      let html = `
        <div class="cal-day-view-wrap" style="background:var(--bg-card); border:1px solid var(--border); border-radius:18px; padding:24px; box-shadow:0 6px 24px rgba(0,0,0,0.03); max-width:700px; margin:0 auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:14px;">
            <div>
              <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text);">${currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
              <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-secondary);">${events.length} event${events.length === 1 ? '' : 's'} scheduled</p>
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="cal-day-add-btn">+ Add Event</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${events.length === 0 ? `
              <div style="padding:48px 16px; text-align:center; color:var(--text-muted); font-size:0.9rem;">
                No events scheduled for this day. Click "+ Add Event" to create one.
              </div>
            ` : events.map(e => {
              const cat = CATEGORIES[e.category] || CATEGORIES.personal;
              return `
                <div class="cal-day-event-row" data-id="${e.id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-radius:12px; background:var(--bg-subtle); border:1px solid var(--border-subtle); cursor:pointer;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="width:10px; height:10px; border-radius:50%; background:${cat.color}; flex-shrink:0;"></span>
                    <div>
                      <div style="font-weight:600; font-size:0.92rem; color:var(--text);">${escapeHtml(e.title)}</div>
                      <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                        ${e.isAllDay ? 'All-day' : `${e.startTime} – ${e.endTime}`}
                        ${e.location ? ` · ${escapeHtml(e.location)}` : ''}
                      </div>
                    </div>
                  </div>
                  <span style="font-size:0.72rem; font-weight:700; color:${cat.color}; background:${cat.bg}; padding:2px 8px; border-radius:999px;">${cat.label}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      viewContainer.innerHTML = html;
      container.querySelector('#cal-day-add-btn')?.addEventListener('click', () => openModalForDate(dateKey));
      bindCellEvents();
    }

    // --- AGENDA VIEW ---
    function renderAgendaView() {
      let events = searchEvents(searchQuery);
      if (selectedCategory !== 'all') {
        events = events.filter(e => e.category === selectedCategory);
      }

      events.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

      let html = `
        <div class="cal-agenda-view-wrap" style="background:var(--bg-card); border:1px solid var(--border); border-radius:18px; padding:24px; box-shadow:0 6px 24px rgba(0,0,0,0.03); max-width:800px; margin:0 auto;">
          <h3 style="margin:0 0 16px; font-size:1.2rem; font-weight:700; color:var(--text);">Upcoming Events Agenda</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${events.length === 0 ? `
              <div style="padding:48px 16px; text-align:center; color:var(--text-muted); font-size:0.9rem;">
                No matching events found.
              </div>
            ` : events.map(e => {
              const cat = CATEGORIES[e.category] || CATEGORIES.personal;
              return `
                <div class="cal-agenda-item" data-id="${e.id}" style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-radius:12px; background:var(--bg-subtle); border:1px solid var(--border-subtle); cursor:pointer;">
                  <div style="display:flex; align-items:center; gap:14px;">
                    <div style="text-align:center; min-width:44px; padding:6px; border-radius:8px; background:var(--bg-card); border:1px solid var(--border);">
                      <div style="font-size:0.65rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">${new Date(e.date + 'T00:00:00').toLocaleDateString([], { month: 'short' })}</div>
                      <div style="font-size:1.05rem; font-weight:800; font-family:var(--mono); color:var(--text);">${new Date(e.date + 'T00:00:00').getDate()}</div>
                    </div>
                    <div>
                      <div style="font-weight:700; font-size:0.92rem; color:var(--text);">${escapeHtml(e.title)}</div>
                      <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px;">
                        ${e.isAllDay ? 'All day' : `${e.startTime} – ${e.endTime}`}
                        ${e.location ? ` · 📍 ${escapeHtml(e.location)}` : ''}
                        ${e.recurrence && e.recurrence !== 'none' ? ` · 🔁 ${e.recurrence}` : ''}
                      </div>
                      ${e.description ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${escapeHtml(e.description)}</div>` : ''}
                    </div>
                  </div>
                  <span style="font-size:0.72rem; font-weight:700; color:${cat.color}; background:${cat.bg}; padding:3px 10px; border-radius:999px;">${cat.label}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      viewContainer.innerHTML = html;
      bindCellEvents();
    }

    function bindCellEvents() {
      // Clicking a day cell opens event creation for that date
      viewContainer.querySelectorAll('.cal-day-cell, .cal-week-col').forEach(cell => {
        cell.addEventListener('click', (e) => {
          if (e.target.closest('.cal-event-pill, .cal-event-card-item')) return;
          const date = cell.dataset.date;
          if (date) openModalForDate(date);
        });
      });

      // Clicking an event pill or row opens editor
      viewContainer.querySelectorAll('.cal-event-pill, .cal-event-card-item, .cal-day-event-row, .cal-agenda-item').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const eventId = el.dataset.id;
          if (eventId) openModalForEvent(eventId);
        });
      });
    }

    function openModalForDate(dateStr) {
      modalTitle.textContent = 'New Event';
      eventIdInput.value = '';
      titleInput.value = '';
      dateInput.value = dateStr || formatDateKey(new Date());
      categorySelect.value = 'personal';
      allDayCheckbox.checked = false;
      timeInputsWrap.style.display = 'grid';
      startInput.value = '09:00';
      endInput.value = '10:00';
      recurrenceSelect.value = 'none';
      locationInput.value = '';
      descInput.value = '';
      modalDeleteBtn.style.display = 'none';
      modal.style.display = 'flex';
      titleInput.focus();
    }

    function openModalForEvent(id) {
      const all = loadEvents();
      const evt = all.find(e => e.id === id);
      if (!evt) return;

      modalTitle.textContent = 'Edit Event';
      eventIdInput.value = evt.id;
      titleInput.value = evt.title;
      dateInput.value = evt.date;
      categorySelect.value = evt.category || 'personal';
      allDayCheckbox.checked = Boolean(evt.isAllDay);
      timeInputsWrap.style.display = evt.isAllDay ? 'none' : 'grid';
      startInput.value = evt.startTime || '09:00';
      endInput.value = evt.endTime || '10:00';
      recurrenceSelect.value = evt.recurrence || 'none';
      locationInput.value = evt.location || '';
      descInput.value = evt.description || '';
      modalDeleteBtn.style.display = 'inline-block';
      modal.style.display = 'flex';
      titleInput.focus();
    }

    function closeModal() {
      modal.style.display = 'none';
    }

    // Modal Events
    modalCloseBtn.addEventListener('click', closeModal);
    modalCancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    allDayCheckbox.addEventListener('change', () => {
      timeInputsWrap.style.display = allDayCheckbox.checked ? 'none' : 'grid';
    });

    modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = eventIdInput.value;
      const title = titleInput.value.trim();
      const date = dateInput.value;
      const category = categorySelect.value;
      const isAllDay = allDayCheckbox.checked;
      const startTime = isAllDay ? '' : startInput.value;
      const endTime = isAllDay ? '' : endInput.value;
      const recurrence = recurrenceSelect.value;
      const location = locationInput.value.trim();
      const description = descInput.value.trim();

      if (!title) return;

      if (id) {
        updateEvent(id, {
          title,
          date,
          category,
          isAllDay,
          startTime,
          endTime,
          recurrence,
          location,
          description
        });
      } else {
        addEvent({
          title,
          date,
          category,
          isAllDay,
          startTime,
          endTime,
          recurrence,
          location,
          description
        });
      }

      closeModal();
      renderCurrentView();
    });

    modalDeleteBtn.addEventListener('click', () => {
      const id = eventIdInput.value;
      if (id && confirm('Are you sure you want to delete this event?')) {
        deleteEvent(id);
        closeModal();
        renderCurrentView();
      }
    });

    // Navigation Events
    prevBtn.addEventListener('click', () => {
      if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() - 1);
      } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() - 7);
      } else if (currentView === 'day') {
        currentDate.setDate(currentDate.getDate() - 1);
      }
      renderCurrentView();
    });

    nextBtn.addEventListener('click', () => {
      if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (currentView === 'day') {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      renderCurrentView();
    });

    todayBtn.addEventListener('click', () => {
      currentDate = new Date();
      selectedDateStr = formatDateKey(currentDate);
      renderCurrentView();
    });

    // View Switching
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderCurrentView();
      });
    });

    // Category Filtering
    catPills.forEach(pill => {
      pill.addEventListener('click', () => {
        catPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedCategory = pill.dataset.cat;
        renderCurrentView();
      });
    });

    // Search Filtering
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim();
      renderCurrentView();
    });

    // Add Event Button
    addEventBtn.addEventListener('click', () => {
      openModalForDate(selectedDateStr || formatDateKey(new Date()));
    });

    // Export to ICS
    exportBtn.addEventListener('click', () => {
      const ics = exportToICS();
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `toolbox_calendar_${Date.now()}.ics`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // Import from ICS
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const imported = importFromICS(reader.result);
        alert(`Successfully imported ${imported.length} event(s)!`);
        renderCurrentView();
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });

    renderCurrentView();
  }
};

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

function injectCalendarStyles() {
  if (document.getElementById('calendar-tool-injected-styles')) return;
  const style = document.createElement('style');
  style.id = 'calendar-tool-injected-styles';
  style.textContent = `
    .cal-view-btn {
      padding: 5px 12px;
      font-size: 0.8rem;
      font-weight: 500;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .cal-view-btn:hover { color: var(--text); }
    .cal-view-btn.active {
      background: var(--bg-card);
      color: var(--text);
      font-weight: 700;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    .cal-cat-pill {
      padding: 4px 10px;
      font-size: 0.76rem;
      font-weight: 500;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .cal-cat-pill:hover {
      background: var(--bg-hover);
      color: var(--text);
    }
    .cal-cat-pill.active {
      background: var(--black) !important;
      color: var(--white) !important;
      border-color: var(--black) !important;
      font-weight: 600;
    }
    .cal-cat-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .cal-day-cell {
      background: var(--bg-card);
      min-height: 104px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      cursor: pointer;
      transition: background 0.15s ease;
      position: relative;
    }
    .cal-day-cell:hover {
      background: var(--bg-hover);
    }
    .cal-day-faded {
      opacity: 0.4;
    }
    .cal-day-today {
      background: rgba(59, 130, 246, 0.05) !important;
    }
    .cal-day-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }
    .cal-day-number {
      font-size: 0.84rem;
      font-weight: 600;
      font-family: var(--mono);
      color: var(--text);
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    .cal-today-circle {
      background: #3b82f6 !important;
      color: #ffffff !important;
    }
    .cal-today-tag {
      font-size: 0.6rem;
      font-weight: 800;
      color: #3b82f6;
      letter-spacing: 0.04em;
    }

    .cal-day-events-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      overflow: hidden;
    }
    .cal-event-pill {
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--evt-bg);
      border-left: 2px solid var(--evt-color);
      font-size: 0.72rem;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    .cal-event-pill:hover {
      transform: translateX(1px);
    }
    .cal-event-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--evt-color);
      flex-shrink: 0;
    }
    .cal-event-time {
      font-size: 0.68rem;
      color: var(--text-muted);
      font-family: var(--mono);
      flex-shrink: 0;
    }
    .cal-event-title {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cal-more-tag {
      font-size: 0.68rem;
      color: var(--text-muted);
      font-weight: 600;
      padding-left: 2px;
    }

    @media (max-width: 768px) {
      .cal-day-cell {
        min-height: 70px;
        padding: 4px;
      }
      .cal-event-time {
        display: none;
      }
    }
  `;
  document.head.appendChild(style);
}
