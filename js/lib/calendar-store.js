/* ============================================================
   TOOLBOX — Calendar Store & iCalendar Engine
   Manages client-side event persistence, querying, recurrence,
   and standard .ics (iCalendar) import/export.
   ============================================================ */

export const STORAGE_KEY_CALENDAR = 'toolbox_calendar_events_v1';

export const CATEGORIES = {
  work: { id: 'work', label: 'Work', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  personal: { id: 'personal', label: 'Personal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  meeting: { id: 'meeting', label: 'Meeting', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  deadline: { id: 'deadline', label: 'Deadline', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  holiday: { id: 'holiday', label: 'Holiday', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  health: { id: 'health', label: 'Health', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  family: { id: 'family', label: 'Family', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
};

function getSampleEvents() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  return [
    {
      id: 'evt-welcome-1',
      title: 'Toolbox Calendar Launch',
      date: todayStr,
      startTime: '10:00',
      endTime: '11:00',
      isAllDay: false,
      category: 'work',
      description: 'Explore the new Calendar tool with scheduling, recurrence, and Assistant integration.',
      location: 'Toolbox App',
      recurrence: 'none',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'evt-welcome-2',
      title: 'Review Project Roadmap',
      date: todayStr,
      startTime: '14:30',
      endTime: '15:30',
      isAllDay: false,
      category: 'meeting',
      description: 'Discuss upcoming native cross-platform build plans and offline enhancements.',
      location: 'Virtual',
      recurrence: 'none',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];
}

/**
 * Load all stored calendar events from localStorage
 * @returns {Array<Object>}
 */
export function loadEvents() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_CALENDAR);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[CalendarStore] Failed to load events:', err);
    return [];
  }
}

/**
 * Save events array to localStorage
 * @param {Array<Object>} events 
 */
export function saveEvents(events) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_CALENDAR, JSON.stringify(events));
  } catch (err) {
    console.error('[CalendarStore] Failed to save events:', err);
  }
}

/**
 * Add a new event
 */
export function addEvent({
  title,
  date,
  startTime = '09:00',
  endTime = '10:00',
  category = 'personal',
  description = '',
  location = '',
  isAllDay = false,
  recurrence = 'none'
}) {
  if (!title || !title.trim()) {
    throw new Error('Event title is required.');
  }
  if (!date) {
    const now = new Date();
    date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  const events = loadEvents();
  const newEvent = {
    id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    title: title.trim(),
    date: date.trim(),
    startTime: isAllDay ? '' : startTime,
    endTime: isAllDay ? '' : endTime,
    category: CATEGORIES[category] ? category : 'personal',
    description: (description || '').trim(),
    location: (location || '').trim(),
    isAllDay: Boolean(isAllDay),
    recurrence: ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(recurrence) ? recurrence : 'none',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  events.push(newEvent);
  saveEvents(events);
  return newEvent;
}

/**
 * Update an existing event by ID
 */
export function updateEvent(id, updates) {
  const events = loadEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return null;

  const existing = events[idx];
  const updated = {
    ...existing,
    ...updates,
    updatedAt: Date.now()
  };
  events[idx] = updated;
  saveEvents(events);
  return updated;
}

/**
 * Delete an event by ID
 */
export function deleteEvent(id) {
  let events = loadEvents();
  const initialLen = events.length;
  events = events.filter(e => e.id !== id);
  saveEvents(events);
  return events.length < initialLen;
}

/**
 * Get all events for a given YYYY-MM-DD date string
 */
export function getEventsForDate(dateStr) {
  const events = loadEvents();
  const targetDate = new Date(dateStr + 'T00:00:00');
  
  return events.filter(e => {
    if (e.date === dateStr) return true;
    if (!e.recurrence || e.recurrence === 'none') return false;

    const eventDate = new Date(e.date + 'T00:00:00');
    if (targetDate < eventDate) return false;

    if (e.recurrence === 'daily') return true;
    if (e.recurrence === 'weekly') {
      return targetDate.getDay() === eventDate.getDay();
    }
    if (e.recurrence === 'monthly') {
      return targetDate.getDate() === eventDate.getDate();
    }
    if (e.recurrence === 'yearly') {
      return targetDate.getMonth() === eventDate.getMonth() && targetDate.getDate() === eventDate.getDate();
    }
    return false;
  }).sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
}

/**
 * Get events in a date range [startDateStr, endDateStr]
 */
export function getEventsInRange(startDateStr, endDateStr) {
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T23:59:59');
  const results = [];
  const events = loadEvents();

  for (const e of events) {
    const eDate = new Date(e.date + 'T00:00:00');
    if (eDate >= start && eDate <= end) {
      results.push(e);
      continue;
    }
    // Handle recurring occurrences
    if (e.recurrence && e.recurrence !== 'none' && eDate <= end) {
      results.push(e);
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
}

/**
 * Search events matching query
 */
export function searchEvents(query) {
  if (!query || !query.trim()) return loadEvents();
  const q = query.trim().toLowerCase();
  const events = loadEvents();
  return events.filter(e =>
    e.title.toLowerCase().includes(q) ||
    (e.description && e.description.toLowerCase().includes(q)) ||
    (e.location && e.location.toLowerCase().includes(q)) ||
    (e.category && e.category.toLowerCase().includes(q))
  );
}

/**
 * Export calendar events to standard iCalendar (.ics) format
 */
export function exportToICS(events) {
  const evts = events || loadEvents();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Toolbox//Calendar Tool//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  const pad = (n) => String(n).padStart(2, '0');

  for (const e of evts) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@toolbox.app`);
    lines.push(`SUMMARY:${escapeICS(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeICS(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeICS(e.location)}`);

    const dateParts = e.date.split('-');
    const dt = `${dateParts[0]}${dateParts[1]}${dateParts[2]}`;

    if (e.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
      lines.push(`DTEND;VALUE=DATE:${dt}`);
    } else {
      const sParts = (e.startTime || '09:00').split(':');
      const eParts = (e.endTime || '10:00').split(':');
      lines.push(`DTSTART:${dt}T${pad(sParts[0])}${pad(sParts[1])}00`);
      lines.push(`DTEND:${dt}T${pad(eParts[0])}${pad(eParts[1])}00`);
    }

    if (e.recurrence && e.recurrence !== 'none') {
      const freq = e.recurrence.toUpperCase();
      lines.push(`RRULE:FREQ=${freq}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeICS(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Parse standard iCalendar (.ics) content into events
 */
export function importFromICS(icsContent) {
  const lines = icsContent.split(/\r\n|\n|\r/);
  const events = [];
  let inEvent = false;
  let current = null;

  for (let line of lines) {
    line = line.trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {
        title: 'Imported Event',
        date: '',
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
        category: 'personal',
        description: '',
        location: '',
        recurrence: 'none'
      };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && current.date) {
        events.push(current);
      }
      inEvent = false;
      current = null;
      continue;
    }

    if (!inEvent || !current) continue;

    if (line.startsWith('SUMMARY:')) {
      current.title = line.substring(8).replace(/\\,/g, ',').replace(/\\;/g, ';');
    } else if (line.startsWith('DESCRIPTION:')) {
      current.description = line.substring(12).replace(/\\n/g, '\n').replace(/\\,/g, ',');
    } else if (line.startsWith('LOCATION:')) {
      current.location = line.substring(9).replace(/\\,/g, ',');
    } else if (line.startsWith('DTSTART')) {
      const val = line.split(':')[1] || '';
      if (val.length >= 8) {
        const y = val.substring(0, 4);
        const m = val.substring(4, 6);
        const d = val.substring(6, 8);
        current.date = `${y}-${m}-${d}`;
        if (val.includes('T') && val.length >= 13) {
          const t = val.split('T')[1];
          current.startTime = `${t.substring(0, 2)}:${t.substring(2, 4)}`;
        } else {
          current.isAllDay = true;
        }
      }
    } else if (line.startsWith('DTEND')) {
      const val = line.split(':')[1] || '';
      if (val.includes('T') && val.length >= 13) {
        const t = val.split('T')[1];
        current.endTime = `${t.substring(0, 2)}:${t.substring(2, 4)}`;
      }
    } else if (line.startsWith('RRULE:')) {
      if (line.includes('FREQ=DAILY')) current.recurrence = 'daily';
      else if (line.includes('FREQ=WEEKLY')) current.recurrence = 'weekly';
      else if (line.includes('FREQ=MONTHLY')) current.recurrence = 'monthly';
      else if (line.includes('FREQ=YEARLY')) current.recurrence = 'yearly';
    }
  }

  // Persist imported events
  let existing = loadEvents();
  for (const e of events) {
    existing.push({
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      ...e,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  saveEvents(existing);
  return events;
}
