import test from 'node:test';
import assert from 'node:assert/strict';
import { saveArtifactFile, list, get } from '../../js/lib/artifacts.js';
import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import {
  selectRenderer,
  FileListResultRenderer,
  FileDownloadCardRenderer,
  FileSavedResultRenderer,
  IllustrationResultRenderer,
  DiseaseResultRenderer
} from '../../js/lib/assistant-result-renderer.js';
import { ConversationIntegrationManager } from '../../js/lib/assistant-integration.js';
import { resolveAnatomyQuery } from '../../js/lib/anatomy-data.js';
import { searchDiseases } from '../../js/lib/diseases-data.js';

// Setup minimal localStorage mock for testing
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { hash: '' },
    open: () => {}
  };
}

// DOM Mock for Node testing
class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.className = '';
    this.style = {};
    this.attributes = new Map();
    this._textContent = '';
    this.clicked = false;
  }

  get textContent() {
    return this._textContent || this.children.map(c => c.textContent).join(' ');
  }

  set textContent(val) {
    this._textContent = String(val);
  }

  get innerHTML() {
    return this._innerHTML || this.textContent;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this._textContent = String(val).replace(/<[^>]*>/g, '');
  }

  appendChild(c) {
    this.children.push(c);
    return c;
  }

  append(...children) {
    for (const c of children) {
      if (typeof c === 'string') {
        const textNode = new MockElement('span');
        textNode.textContent = c;
        this.children.push(textNode);
      } else if (c) {
        this.children.push(c);
      }
    }
  }

  addEventListener() {}

  click() {
    this.clicked = true;
  }
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => new MockElement(tag),
    body: new MockElement('body')
  };
}

test('Assistant Tool list_files: returns structured file-list payload with folder metadata', async () => {
  await saveArtifactFile({ name: 'summary_notes.txt', content: 'Notes text', kind: 'text' });
  await saveArtifactFile({ name: 'sales_2026.csv', content: 'id,val\n1,100', kind: 'csv' });

  const res = await executeAssistantTool('list_files', {});

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'file-list');
  assert.equal(res.renderer, 'file-list');
  assert.ok(res.count >= 2);
  assert.ok(Array.isArray(res.files));
  assert.ok(res.files.some(f => f.name === 'sales_2026.csv'));
  assert.ok(res.files.some(f => f.name === 'summary_notes.txt'));
});

test('Assistant Tool download_file: prepares download card by default', async () => {
  await saveArtifactFile({ name: 'example.txt', content: 'Hello world', kind: 'text' });

  const res = await executeAssistantTool('download_file', {
    filename: 'example.txt',
    autoDownload: false
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'file');
  assert.equal(res.renderer, 'file');
  assert.equal(res.filename, 'example.txt');
  assert.equal(res.autoDownload, false);
  assert.ok(res.dataUrl);
});

test('Assistant Tool download_file: sets autoDownload=true when direct download requested', async () => {
  await saveArtifactFile({ name: 'dataset.json', content: '{"status":"ok"}', kind: 'json' });

  const res = await executeAssistantTool('download_file', {
    filename: 'dataset.json',
    autoDownload: true
  });

  assert.equal(res.status, 'success');
  assert.equal(res.autoDownload, true);
  assert.equal(res.filename, 'dataset.json');
});

test('Assistant Result Renderer: selects file-list renderer for file listing payloads', () => {
  const mgr = new ConversationIntegrationManager();
  const normalized = mgr.normalizeToolResult({
    status: 'success',
    type: 'file-list',
    count: 1,
    files: [{ id: '1', name: 'sample.txt', kind: 'text', bytes: 120 }]
  });

  assert.equal(selectRenderer(normalized).id, 'file-list');
});

test('FileListResultRenderer: renders visual card with folder icon, metadata, no emojis and pill buttons', () => {
  const container = new MockElement('div');
  const card = FileListResultRenderer.render({
    data: {
      count: 2,
      files: [
        { id: '1', name: 'financial_model.xlsx', kind: 'xlsx', bytes: 45000, isCloudSynced: true },
        { id: '2', name: 'meeting_minutes.docx', kind: 'docx', bytes: 12000, isCloudSynced: false }
      ]
    }
  }, container);

  assert.ok(card);
  assert.ok(card.className.includes('assistant-result-file-list'));
  assert.ok(card.textContent.includes('Saved Files & Documents'));
  assert.ok(card.textContent.includes('financial_model.xlsx'));
  assert.ok(card.textContent.includes('meeting_minutes.docx'));
  assert.ok(card.textContent.includes('Download'));
  assert.ok(card.textContent.includes('Open in Saved Work'));
});

test('FileSavedResultRenderer: renders minimal pill-style card without cluttered text badges or emojis', () => {
  const container = new MockElement('div');
  const card = FileSavedResultRenderer.render({
    data: {
      artifactId: 'art_123',
      filename: 'financial_projections.csv',
      destination: 'cloud',
      isCloudSynced: true
    }
  }, container);

  assert.ok(card);
  assert.ok(card.className.includes('assistant-result-saved-card'));
  assert.ok(card.textContent.includes('financial_projections.csv'));
  assert.ok(card.textContent.includes('View in Saved Work'));
});

test('Assistant Tool illustrator: generates visual diagram with pedagogical steps and summary', async () => {
  const res = await executeAssistantTool('illustrator', {
    diagramType: 'sequence',
    title: 'Chain of Distribution',
    steps: [
      { label: 'Producer', description: 'Manufactures raw materials into finished goods', badge: 'Source' },
      { label: 'Wholesaler', description: 'Purchases bulk quantities from producer', badge: 'Intermediary' },
      { label: 'Retailer', description: 'Merchandises products to general public', badge: 'Point of Sale' },
      { label: 'Consumer', description: 'End user utilizing final good', badge: 'Destination' }
    ],
    summary: 'The chain of distribution describes the sequential path goods take from initial production to final consumption.'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'illustration');
  assert.equal(res.renderer, 'illustration');
  assert.equal(res.diagramType, 'sequence');
  assert.equal(res.steps.length, 4);

  const container = new MockElement('div');
  const card = IllustrationResultRenderer.render({ data: res }, container);

  assert.ok(card);
  assert.ok(card.textContent.includes('Chain of Distribution'));
  assert.ok(card.textContent.includes('Producer'));
  assert.ok(card.textContent.includes('Wholesaler'));
  assert.ok(card.textContent.includes('Retailer'));
  assert.ok(card.textContent.includes('Consumer'));
  assert.ok(card.textContent.includes('Save PNG'));
  assert.ok(card.textContent.includes('Save SVG'));
});

test('Assistant Tool search_diseases: searches 80,000+ diseases ontology ordered by commodity', async () => {
  const res = await executeAssistantTool('search_diseases', {
    query: 'hypertension'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'disease-list');
  assert.equal(res.renderer, 'disease-list');
  assert.ok(res.diseases.length > 0);
  assert.equal(res.diseases[0].icd11, 'BA00');
  assert.equal(res.diseases[0].commodity, 99);
  assert.ok(res.diseases[0].pathophysiology);
  assert.ok(res.diseases[0].diagnosticCriteria);

  const container = new MockElement('div');
  const card = DiseaseResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Essential (Primary) Hypertension'));
  assert.ok(card.textContent.includes('BA00'));
  assert.ok(card.textContent.includes('Commodity 99/100'));
});

test('Anatomy Appendicular Skeleton: resolves carpals, metacarpals, and tarsals', async () => {
  const wristRes = await resolveAnatomyQuery('carpals and metacarpals');
  assert.ok(wristRes.structures.length >= 8);
  assert.ok(wristRes.structures.some(s => s.name.toLowerCase().includes('scaphoideum') || s.commonName?.toLowerCase().includes('scaphoid')));
  assert.ok(wristRes.structures.some(s => s.name.toLowerCase().includes('metacarpalia') || s.commonName?.toLowerCase().includes('metacarpal')));

  const scaphoidRes = await resolveAnatomyQuery('scaphoid bone');
  assert.ok(scaphoidRes.structures.some(s => s.fma === '23711' || s.commonName.includes('Scaphoid')));
  assert.ok(scaphoidRes.details[0].clinicalNotes.includes('FOOSH'));

  const footRes = await resolveAnatomyQuery('calcaneus and talus');
  assert.ok(footRes.structures.some(s => s.commonName.includes('Heel Bone') || s.fma === '24483'));
  assert.ok(footRes.structures.some(s => s.commonName.includes('Ankle Bone') || s.fma === '24482'));

  const phalangesRes = await resolveAnatomyQuery('phalanges');
  assert.ok(phalangesRes.structures.length > 0);
  assert.ok(phalangesRes.structures.some(s => s.name.toLowerCase().includes('phalanges') || s.commonName?.toLowerCase().includes('phalanges')));

  const collarboneRes = await resolveAnatomyQuery('collarbone and ribs');
  assert.ok(collarboneRes.structures.some(s => s.commonName?.toLowerCase().includes('collarbone') || s.name.toLowerCase().includes('clavicula')));
  assert.ok(collarboneRes.structures.some(s => s.name.toLowerCase().includes('costae') || s.commonName?.toLowerCase().includes('ribs')));
});

test('Diseases Database Search: resolves cephalitis and hay fever queries', async () => {
  const cephRes = searchDiseases('cephalitis');
  assert.ok(cephRes.length > 0);
  assert.equal(cephRes[0].icd11, '1C60');
  assert.ok(cephRes[0].name.toLowerCase().includes('encephalitis'));
  assert.ok(cephRes[0].management.some(m => m.includes('Acyclovir')));

  const hayRes = searchDiseases('hay fever');
  assert.ok(hayRes.length > 0);
  assert.equal(hayRes[0].icd11, 'CA08');
  assert.ok(hayRes[0].name.toLowerCase().includes('allergic rhinitis'));
  assert.ok(hayRes[0].symptoms.some(s => s.includes('sneezing') || s.includes('rhinorrhea')));

  const otitisRes = searchDiseases('ear infection');
  assert.ok(otitisRes.length > 0);
  assert.equal(otitisRes[0].icd11, 'AA00');
});
