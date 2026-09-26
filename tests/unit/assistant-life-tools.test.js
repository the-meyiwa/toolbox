/* Assistant everyday-life tools: calendar moves, reminders, file search, the live intro and tool packs. */

import test from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const { addEvent, loadEvents, deleteEvent, saveEvents } = await import('../../js/lib/calendar-store.js');
const { loadReminders, fireDue, parseOffset, eventStart } = await import('../../js/lib/reminders.js');
const { executeLifeTool, searchFiles } = await import('../../js/lib/assistant/life-tools.js');
const { introText, topicFromName, gatherLifeContext, contextBlock, INTRO_PATTERN } = await import('../../js/lib/assistant/life-context.js');
const { registerToolPack, isPackTool, executePackTool } = await import('../../js/lib/assistant/tool-packs.js');
const { TOOL_GROUPS, selectGroups, groupOfTool, LOAD_TOOLS_DECLARATION } = await import('../../js/lib/assistant/tool-groups.js');

const reset = () => { localStorage.removeItem('toolbox_reminders_v1'); saveEvents([]); };

test('moving an event keeps its length and drags its reminder along', async () => {
  reset();
  const ev = addEvent({ title: 'Dentist appointment', date: '2030-03-04', startTime: '10:00', endTime: '10:45', category: 'health' });
  const r = await executeLifeTool('set_reminder', { eventTitle: 'dentist', before: '1 day' });
  assert.equal(r.status, 'success');
  assert.equal(r.reminder.at, eventStart(ev).getTime() - 86_400_000);

  const moved = await executeLifeTool('calendar_update_event', { title: 'Dentist', newDate: '2030-03-08', newStartTime: '14:00' });
  assert.equal(moved.status, 'success');
  assert.equal(moved.event.date, '2030-03-08');
  assert.equal(moved.event.endTime, '14:45');
  assert.match(moved.message, /Moved "Dentist appointment"/);
  const [rem] = loadReminders();
  assert.equal(rem.at, new Date('2030-03-07T14:00').getTime());
});

test('updating an unknown event says so instead of guessing', async () => {
  reset();
  const r = await executeLifeTool('calendar_update_event', { title: 'Nope', newDate: '2030-01-01' });
  assert.equal(r.status, 'error');
  const bad = await executeLifeTool('calendar_update_event', { title: 'x' });
  assert.equal(bad.status, 'error');
});

test('reminders fire once through the bell, and not for deleted events', async () => {
  reset();
  const ev = addEvent({ title: 'Gone', date: '2020-01-01', startTime: '09:00', endTime: '10:00' });
  await executeLifeTool('set_reminder', { eventId: ev.id, before: '30 min' });
  await executeLifeTool('set_reminder', { text: 'Pay NEPA bill', at: '2020-01-01T08:00' });
  deleteEvent(ev.id);
  const sent = [];
  const due = await fireDue({ notify: async (r) => sent.push(r.text) });
  assert.deepEqual(due.map(r => r.text), ['Pay NEPA bill']);
  assert.deepEqual(sent, ['Pay NEPA bill']);
  assert.equal((await fireDue({ notify: async (r) => sent.push(r.text) })).length, 0);
  const list = await executeLifeTool('list_reminders', {});
  assert.equal(list.reminders.length, 0);
});

test('reminder offsets parse the way people write them', () => {
  assert.equal(parseOffset('1 day'), 86_400_000);
  assert.equal(parseOffset('2 hours'), 7_200_000);
  assert.equal(parseOffset('15 min'), 900_000);
  assert.equal(parseOffset('soonish'), null);
});

const memFs = (files) => ({
  listAllMeta: async () => files.map(f => ({ path: f.path, name: f.path.split('/').pop(), size: f.content.length, updatedAt: f.at || 0, isDirectory: false, mimeType: '' })),
  readFile: async (p) => files.find(f => f.path === p).content,
});

test('file search matches contents, not only names, and read_document returns the text', async () => {
  const fsImpl = memFs([
    { path: '/Documents/Flat.md', content: 'Tenancy agreement. The lease renews on 1 March 2027 at N2,400,000 a year.', at: 2 },
    { path: '/Documents/Receipts.csv', content: 'date,amount\n2026-09-01,4500', at: 1 },
  ]);
  const found = await executeLifeTool('search_files', { query: 'when does the lease renew' }, { fsImpl, artifacts: [] });
  assert.equal(found.results[0].path, '/Documents/Flat.md');
  assert.match(found.results[0].snippet, /renews on 1 March 2027/);
  const read = await executeLifeTool('read_document', { path: 'Flat.md' }, { fsImpl, artifacts: [] });
  assert.equal(read.status, 'success');
  assert.match(read.content, /N2,400,000/);
  const none = await searchFiles('zebra', { fsImpl, artifacts: [] });
  assert.equal(none.length, 0);
});

test('document topics come from real file names and skip camera-roll noise', () => {
  assert.equal(topicFromName('Lease_Agreement-2025 (final).pdf'), 'lease agreement 2025');
  assert.equal(topicFromName('IMG_2034.jpg'), null);
  assert.equal(topicFromName('Untitled.docx'), null);
  assert.equal(topicFromName('Q3BudgetPlan.xlsx'), 'Q3 budget plan');
});

test('the intro is built from what is actually there', async () => {
  reset();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const d = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  addEvent({ title: 'AA Rescue driving lesson', date: d, startTime: '08:30', endTime: '10:00' });
  localStorage.setItem('toolbox_assistant_last_place_v1', JSON.stringify({ area: 'Ketu' }));
  const fsImpl = memFs([{ path: '/Documents/Tenancy_Agreement.pdf', content: '', at: 5 }, { path: '/Documents/Car-Insurance.docx', content: '', at: 4 }]);
  const ctx = await gatherLifeContext({ fsImpl, artifacts: [], memory: [{ text: 'My car is a 2014 Corolla' }] });
  const intro = introText(ctx);
  assert.match(intro, /tenancy agreement/);
  assert.match(intro, /car insurance/);
  assert.match(intro, /“AA Rescue driving lesson” is tomorrow at 08:30/);
  assert.match(intro, /around Ketu/);
  assert.match(intro, /math/);
  assert.match(intro, /Tokens cost money/);
  assert.match(contextBlock(ctx), /Area: Ketu/);

  saveEvents([]);
  localStorage.removeItem('toolbox_assistant_last_place_v1');
  const bare = introText(await gatherLifeContext({ fsImpl: memFs([]), artifacts: [], memory: [] }));
  assert.doesNotMatch(bare, /tenancy|AA Rescue|Ketu/);
  assert.match(bare, /any document you throw at me/);
});

test('greetings and "what can you do" trigger the personal context, other asks do not', () => {
  assert.ok(INTRO_PATTERN.test('hey'));
  assert.ok(INTRO_PATTERN.test('So what can you do?'));
  assert.ok(!INTRO_PATTERN.test('hey, move my dentist appointment to Friday'));
  assert.ok(!INTRO_PATTERN.test('Solve x^2 = 4'));
});

test('life tools load with the calendar and files groups', () => {
  assert.ok(TOOL_GROUPS.calendar.tools.includes('calendar_update_event'));
  assert.ok(TOOL_GROUPS.calendar.tools.includes('set_reminder'));
  assert.ok(TOOL_GROUPS.files.tools.includes('search_files'));
  const g = selectGroups({ history: [{ role: 'user', content: 'Push my dentist appointment to Friday and remind me the day before' }] });
  assert.ok(g.has('calendar'));
  assert.ok(selectGroups({ history: [{ role: 'user', content: 'Find the lease I uploaded' }] }).has('files'));
});

test('a new tool pack plugs in without touching the engine', async () => {
  registerToolPack({
    id: 'test-maps',
    declarations: [{ name: 'test_directions', description: 'x', parameters: { type: 'object', properties: {} } }],
    execute: async (name, args) => ({ status: 'success', message: `route to ${args.to}` }),
    groups: { testmaps: { label: 'Test maps', tools: ['test_directions'], match: /\bdirections\b/i } },
  });
  assert.ok(isPackTool('test_directions'));
  assert.equal(groupOfTool('test_directions'), 'testmaps');
  assert.equal((await executePackTool('test_directions', { to: 'CMD road' })).message, 'route to CMD road');
  assert.ok(selectGroups({ history: [{ role: 'user', content: 'directions please' }] }).has('testmaps'));
  assert.ok(LOAD_TOOLS_DECLARATION.parameters.properties.groups.items.enum.includes('testmaps'));
  delete TOOL_GROUPS.testmaps;
});

test('the engine exposes pack tools in its tool list', async () => {
  const src = await import('node:fs').then(m => m.readFileSync(new URL('../../js/lib/ai-provider.js', import.meta.url), 'utf8'));
  assert.match(src, /\.\.\.packDeclarations\(\)/);
  assert.match(src, /executePackTool\(name, args/);
  assert.ok(loadEvents);
});
