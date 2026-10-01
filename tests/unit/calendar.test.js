import test from 'node:test';
import assert from 'node:assert/strict';

// Polyfill localStorage in Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

import {
  STORAGE_KEY_CALENDAR,
  loadEvents,
  saveEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  getEventsForDate,
  getEventsInRange,
  searchEvents,
  exportToICS,
  importFromICS
} from '../../js/lib/calendar-store.js';

test.beforeEach(() => {
  localStorage.clear();
});

test('calendar-store: addEvent creates and persists event with generated id', () => {
  const evt = addEvent({
    title: 'Product Review',
    date: '2026-09-15',
    startTime: '11:00',
    endTime: '12:00',
    category: 'work',
    description: 'Quarterly feature demo'
  });

  assert.ok(evt.id, 'Event must have an ID');
  assert.equal(evt.title, 'Product Review');
  assert.equal(evt.date, '2026-09-15');
  assert.equal(evt.category, 'work');

  const loaded = loadEvents();
  assert.ok(loaded.some(e => e.id === evt.id));
});

test('calendar-store: getEventsForDate retrieves matching and recurring events', () => {
  addEvent({
    title: 'Daily Standup',
    date: '2026-09-01',
    startTime: '09:00',
    endTime: '09:30',
    category: 'work',
    recurrence: 'daily'
  });

  addEvent({
    title: 'One-off Doctor Visit',
    date: '2026-09-10',
    startTime: '14:00',
    endTime: '15:00',
    category: 'health'
  });

  const sep10Events = getEventsForDate('2026-09-10');
  assert.equal(sep10Events.length, 2, 'Should include both the daily standup and the doctor visit');

  const sep11Events = getEventsForDate('2026-09-11');
  assert.equal(sep11Events.length, 1, 'Should include the daily standup only');
  assert.equal(sep11Events[0].title, 'Daily Standup');
});

test('calendar-store: range returns actual recurring occurrences within the requested dates', () => {
  addEvent({ title: 'Weekly review', date: '2026-09-01', recurrence: 'weekly' });
  addEvent({ title: 'One-time call', date: '2026-09-09' });
  const events = getEventsInRange('2026-09-08', '2026-09-10');
  assert.deepEqual(events.map(e => [e.title, e.date]), [
    ['Weekly review', '2026-09-08'],
    ['One-time call', '2026-09-09']
  ]);
  assert.deepEqual(getEventsInRange('2026-09-10', '2026-09-08'), []);
});

test('calendar-store: updateEvent and deleteEvent mutate persisted state', () => {
  const evt = addEvent({
    title: 'Initial Title',
    date: '2026-09-20'
  });

  const updated = updateEvent(evt.id, { title: 'Updated Meeting Title', category: 'meeting' });
  assert.equal(updated.title, 'Updated Meeting Title');
  assert.equal(updated.category, 'meeting');

  const deleted = deleteEvent(evt.id);
  assert.equal(deleted, true);

  const found = loadEvents().find(e => e.id === evt.id);
  assert.equal(found, undefined);
});

test('calendar-store: searchEvents matches title, description, or category', () => {
  addEvent({
    title: 'Dentist Checkup',
    date: '2026-09-22',
    category: 'health',
    description: 'Dr. Johnson clinic'
  });
  addEvent({
    title: 'Budget Review',
    date: '2026-09-25',
    category: 'work',
    description: 'Financial forecasting'
  });

  const results = searchEvents('dentist');
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Dentist Checkup');

  const descResults = searchEvents('forecasting');
  assert.equal(descResults.length, 1);
  assert.equal(descResults[0].title, 'Budget Review');
});

test('calendar-store: exportToICS and importFromICS roundtrip events correctly', () => {
  const evt = addEvent({
    title: 'Team Offsite',
    date: '2026-10-05',
    startTime: '09:00',
    endTime: '17:00',
    description: 'Annual planning session',
    location: 'Lagoon Retreat'
  });

  const ics = exportToICS([evt]);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:Team Offsite'));
  assert.ok(ics.includes('LOCATION:Lagoon Retreat'));

  // Import into empty store
  localStorage.clear();
  const imported = importFromICS(ics);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].title, 'Team Offsite');
  assert.equal(imported[0].date, '2026-10-05');
  assert.equal(imported[0].location, 'Lagoon Retreat');
});

test('calendar-store: rejects invalid time order and keeps event IDs stable', () => {
  assert.throws(() => addEvent({ title: 'Invalid', date: '2026-09-20', startTime: '14:00', endTime: '13:00' }), /end time/);
  assert.throws(() => addEvent({ title: 'Invalid', date: '2026-09-20', startTime: '13pm' }), /not a time/);
  const event = addEvent({ title: 'Valid', date: '2026-09-20', startTime: '14:00', endTime: '15:00' });
  assert.throws(() => updateEvent(event.id, { endTime: '13:00' }), /end time/);
  const updated = updateEvent(event.id, { id: 'replacement-id', title: 'Still valid' });
  assert.equal(updated.id, event.id);
  assert.equal(loadEvents().length, 1);
});

test('calendar-store: all-day export uses exclusive next-day end including month boundaries', () => {
  const event = addEvent({ title: 'All day', date: '2026-09-30', isAllDay: true });
  const ics = exportToICS([event]);
  assert.match(ics, /DTSTART;VALUE=DATE:20260930/);
  assert.match(ics, /DTEND;VALUE=DATE:20261001/);
});

test('calendar-store: import unfolds lines and does not duplicate the same UID', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:unique-event@example.com\r\nSUMMARY:Planning\r\nDESCRIPTION:First part \r\n continued\\nNext line\r\nDTSTART;VALUE=DATE:20261012\r\nEND:VEVENT\r\nEND:VCALENDAR';
  assert.equal(importFromICS(ics).length, 1);
  assert.equal(importFromICS(ics).length, 0);
  const [event] = loadEvents();
  assert.equal(event.description, 'First part continued\nNext line');
  assert.equal(event.date, '2026-10-12');
});

test('calendar-store: importing an export of an existing event does not duplicate it', () => {
  const event = addEvent({ title: 'Existing', date: '2026-10-12' });
  assert.equal(importFromICS(exportToICS([event])).length, 0);
  assert.equal(loadEvents().length, 1);
});
