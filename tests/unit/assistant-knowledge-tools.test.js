/* Assistant knowledge and document tools: lookups, routing hints, domain tools, clean documents. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { entityHints, executeKnowledgeTool, cleanDocText, markdownToBlocks, buildDocument, KNOWLEDGE_TOOL_DECLARATIONS } from '../../js/lib/assistant/knowledge-tools.js';
import { selectGroups, TOOL_GROUPS } from '../../js/lib/assistant/tool-groups.js';
import { executeAssistantTool } from '../../js/lib/assistant-tools.js';

const groupsFor = (text) => selectGroups({ history: [{ role: 'user', content: text }] });

test('a misspelt element is recognised and looked up as the element', async () => {
  const h = await entityHints('Tell me about the element, Mendelium');
  assert.deepEqual(h.elements.map(e => e.name), ['Mendelevium']);
  assert.match(h.hint, /lookup_element/);
  const r = await executeKnowledgeTool('lookup_element', { elements: ['Mendelium'] });
  assert.equal(r.status, 'success');
  assert.equal(r.elements[0].name, 'Mendelevium');
  assert.equal(r.elements[0].correctedTo, 'Mendelevium');
});

test('drug names reach the compound table, not the disease database', async () => {
  const h = await entityHints('Look up Albendazole and tell me about it');
  assert.deepEqual(h.compounds.map(c => c.name), ['Albendazole']);
  assert.match(h.hint, /lookup_compound/);
  assert.ok(groupsFor('what is ciprofloxacin for').has('science'));
  const r = await executeKnowledgeTool('lookup_compound', { query: 'albendazol' }, { fetchImpl: null });
  assert.equal(r.compound.name, 'Albendazole');
  assert.equal(r.compound.formula, 'C12H15N3O2S');
  const d = await executeAssistantTool('search_diseases', { query: 'Albendazole' });
  assert.equal(d.status, 'error');
  assert.match(d.message, /lookup_compound/);
});

test('ordinary words do not trigger chemistry hints', async () => {
  const h = await entityHints('I need to lead the team to the office and summarise something important');
  assert.equal(h.hint, '');
});

test('unknown elements are reported, not swapped for others', async () => {
  const r = await executeAssistantTool('explore_elements', { elements: ['Unobtainium'] });
  assert.equal(r.status, 'not_found');
  const ok = await executeAssistantTool('explore_elements', { elements: ['Mendelium', 'Fe'] });
  assert.deepEqual(ok.elements.map(e => e.name), ['Mendelevium', 'Iron']);
});

test('calculate_chemistry search delegates to the compound lookup', async () => {
  const r = await executeAssistantTool('calculate_chemistry', { action: 'search_compound', formulaOrQuery: 'Albendazole' });
  assert.equal(r.compound.name, 'Albendazole');
});

test('wiper complaints produce a ranked fault tree', async () => {
  assert.ok(groupsFor("my windshield wipers don't work").has('vehicles'));
  const r = await executeKnowledgeTool('diagnose_vehicle', { symptom: "My wipers don't work at all" });
  assert.equal(r.status, 'success');
  assert.match(r.faults[0].symptom, /wipers/i);
  assert.match(r.faults[0].likelyCauses[0].cause, /fuse/i);
  assert.ok(r.faults[0].likelyCauses.every(c => c.check && c.fix));
  const none = await executeKnowledgeTool('diagnose_vehicle', { symptom: 'it feels odd' });
  assert.equal(none.status, 'no_match');
});

test('architecture advisor covers containers, software and sizing', async () => {
  assert.ok(groupsFor('should I use microservices or a monolith').has('building'));
  const c = await executeKnowledgeTool('architecture_advisor', { question: 'how do I join two 40ft containers' });
  assert.equal(c.topics[0].id, 'container-structure');
  const k = await executeKnowledgeTool('architecture_advisor', { question: 'deploy on kubernetes with docker', domain: 'software' });
  assert.ok(k.topics.some(t => t.id === 'containers-software'));
  const s = await executeKnowledgeTool('architecture_advisor', { mode: 'calc', calc: 'stairs', params: { floorToFloorMm: 3000 } });
  assert.equal(s.result.risers, 17);
  const chk = await executeKnowledgeTool('architecture_advisor', { mode: 'check', design: 'A Node API behind a load balancer with Postgres' });
  assert.equal(chk.domain, 'software');
  assert.ok(chk.gaps.some(g => g.area === 'Security'));
});

test('anatomy lookup gives the nervous system overview and structures', async () => {
  const r = await executeKnowledgeTool('anatomy_lookup', { query: 'nervous system' });
  assert.equal(r.status, 'success');
  assert.equal(r.system, 'nervous');
  assert.ok(r.structureCount > 20);
  assert.ok(r.details.length > 0);
});

test('cleanDocText strips invisible and look-alike characters', () => {
  const dirty = '\u201CQuote\u201D\u200B and \u2018it\u2019s\u2019 \u2014 fine\u00A0now\u2026\u202E\uFEFF\u{E0041}';
  const clean = cleanDocText(dirty);
  assert.equal(clean, '"Quote" and \'it\'s\' - fine now...');
  assert.doesNotMatch(clean, /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00A0]/);
});

test('markdown becomes headings, lists and tables', () => {
  const blocks = markdownToBlocks('# Title\n\nSome **bold** text.\n\n- one\n  - two\n\n| A | B |\n|---|---|\n| 1 | 2 |');
  assert.deepEqual(blocks.map(b => b.style || b.type), ['h1', 'p', 'p', 'p', 'table']);
  assert.equal(blocks[1].runs[1].bold, true);
  assert.equal(blocks[3].list.level, 1);
  assert.equal(blocks[4].rows.length, 2);
});

test('generate_document builds real Word, spreadsheet and slide files', async () => {
  const docx = await buildDocument({ format: 'docx', title: 'Report', content: 'Hello \u201Cworld\u201D\u200B' });
  assert.equal(docx.filename, 'Report.docx');
  const JSZip = (await import('jszip')).default;
  const xml = await (await JSZip.loadAsync(await docx.blob.arrayBuffer())).file('word/document.xml').async('string');
  assert.match(xml, /Hello &quot;world&quot;|Hello "world"/);
  assert.doesNotMatch(xml, /\u200B|\u201C/);
  const xlsx = await buildDocument({ format: 'xlsx', filename: 'Costs', content: '| Item | Cost |\n|---|---|\n| Tea | 5 |' });
  assert.equal(xlsx.filename, 'Costs.xlsx');
  assert.ok(xlsx.blob.size > 1000);
  const pptx = await buildDocument({ format: 'pptx', title: 'Deck', slides: [{ title: 'Deck' }, { title: 'Point', bullets: ['a', 'b'] }] });
  assert.match(pptx.blob.type, /presentationml/);
});

test('new tools are declared, grouped and valid', () => {
  const grouped = new Set(Object.values(TOOL_GROUPS).flatMap(g => g.tools));
  for (const d of KNOWLEDGE_TOOL_DECLARATIONS) {
    assert.ok(grouped.has(d.name), `${d.name} is in a tool group`);
    assert.equal(d.parameters.type, 'object');
  }
});
