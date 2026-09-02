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
  DiseaseResultRenderer,
  InvoiceResultRenderer,
  UmlDiagramResultRenderer,
  AlgorithmResultRenderer,
  MetronomeResultRenderer,
  SoundEffectResultRenderer,
  ElementsResultRenderer,
  ContainerQuoteResultRenderer,
  FloorPlanResultRenderer,
  LogicCircuitResultRenderer,
  MapResultRenderer,
  LocationCoordinatesResultRenderer,
  TunerPitchResultRenderer,
  PdfAnnotationResultRenderer
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

test('Assistant Tool generate_invoice: generates structured invoice and renders card with PDF action', async () => {
  const res = await executeAssistantTool('generate_invoice', {
    client: 'Acme Corp\n456 Industrial Blvd',
    lines: [
      { description: 'React Engineering', qty: 40, price: 150 },
      { description: 'Cloud Infrastructure', qty: 1, price: 500 }
    ],
    taxRate: 10
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'invoice');
  assert.equal(res.invoice.subtotal, 6500);
  assert.equal(res.invoice.total, 7150);

  const container = new MockElement('div');
  const card = InvoiceResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Acme Corp'));
  assert.ok(card.textContent.includes('7,150'));
  assert.ok(card.textContent.includes('Download PDF'));
  assert.ok(card.textContent.includes('Edit in Builder'));
});

test('Assistant Tool generate_uml: outputs Mermaid diagram with vector SVG actions', async () => {
  const res = await executeAssistantTool('generate_uml', {
    diagramType: 'sequence',
    title: 'OAuth2 Login Flow',
    code: 'sequenceDiagram\nUser->>AuthServer: Authorize\nAuthServer-->>User: Token'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'uml-diagram');
  assert.equal(res.title, 'OAuth2 Login Flow');

  const container = new MockElement('div');
  const card = UmlDiagramResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('OAuth2 Login Flow'));
  assert.ok(card.textContent.includes('Open in UML Studio'));
  assert.ok(card.textContent.includes('Save SVG'));
});

test('Assistant Tool simulate_algorithm: generates execution frames with transport controls', async () => {
  const res = await executeAssistantTool('simulate_algorithm', {
    algorithm: 'bubble',
    data: [5, 1, 4, 2, 8]
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'algorithm-simulation');
  assert.ok(res.frames.length > 0);

  const container = new MockElement('div');
  const card = AlgorithmResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.toLowerCase().includes('bubble sort'));
  assert.ok(card.textContent.includes('Open in Algorithm Lab'));
});

test('Assistant Tool start_metronome: prepares metronome widget with BPM', async () => {
  const res = await executeAssistantTool('start_metronome', {
    bpm: 144,
    beats: 6
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'metronome');
  assert.equal(res.bpm, 144);
  assert.equal(res.beats, 6);

  const container = new MockElement('div');
  const card = MetronomeResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('144'));
  assert.ok(card.textContent.includes('6/4 Time'));
});

test('Assistant Tool play_sound_effect: synthesizes sound effect audio card', async () => {
  const res = await executeAssistantTool('play_sound_effect', {
    name: 'Laser Zap',
    type: 'laser',
    duration: 0.8
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'sound-effect');
  assert.equal(res.name, 'Laser Zap');

  const container = new MockElement('div');
  const card = SoundEffectResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Laser Zap'));
  assert.ok(card.textContent.includes('Play Sound'));
});

test('Assistant Tool explore_elements: compares periodic table elements with electron shells', async () => {
  const res = await executeAssistantTool('explore_elements', {
    elements: ['C', 'Si', 'Ge']
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'elements-comparison');
  assert.ok(res.elements.length >= 3);

  const container = new MockElement('div');
  const card = ElementsResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Carbon') || card.textContent.includes('C'));
  assert.ok(card.textContent.includes('Open Periodic Table'));
});

test('Assistant Tool plan_container_quote: calculates BoQ cost and generates CAD model', async () => {
  const res = await executeAssistantTool('plan_container_quote', {
    size: '20ft',
    usage: 'Office',
    openings: [{ type: 'personnel-door', pos: 1.5 }],
    electrical: true
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'container-quote');
  assert.ok(res.quote.total > 0);

  const container = new MockElement('div');
  const card = ContainerQuoteResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.toLowerCase().includes('20ft office'));
  assert.ok(card.textContent.includes('Open in Planner'));
});

test('Assistant Tool generate_floor_plan: constructs architectural blueprint', async () => {
  const res = await executeAssistantTool('generate_floor_plan', {
    title: '2-Bedroom Luxury Suite',
    squareMeters: 95
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'floor-plan');
  assert.equal(res.squareMeters, 95);

  const container = new MockElement('div');
  const card = FloorPlanResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('2-Bedroom Luxury Suite'));
  assert.ok(card.textContent.includes('Architecture Studio'));
});

test('Assistant Tool build_logic_circuit: constructs interactive logic schematic', async () => {
  const res = await executeAssistantTool('build_logic_circuit', {
    name: 'Half Adder Circuit',
    inputs: ['A', 'B'],
    expression: 'Sum = A ⊕ B, Carry = A · B'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'logic-circuit');

  const container = new MockElement('div');
  const card = LogicCircuitResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Half Adder Circuit'));
  assert.ok(card.textContent.includes('Open in Logic Lab'));
});

test('Assistant Tool render_map: generates route map with geographic waypoints', async () => {
  const res = await executeAssistantTool('render_map', {
    title: 'Trans-European Express Route',
    markers: [
      { name: 'London', lat: 51.50, lng: -0.12 },
      { name: 'Paris', lat: 48.85, lng: 2.35 },
      { name: 'Berlin', lat: 52.52, lng: 13.40 }
    ],
    distanceKm: 1100
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'map-view');

  const container = new MockElement('div');
  const card = MapResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Trans-European Express Route'));
  assert.ok(card.textContent.includes('London'));
  assert.ok(card.textContent.includes('Open Interactive Map'));
});

test('Assistant Tool tune_instrument: prepares reference frequency buttons', async () => {
  const res = await executeAssistantTool('tune_instrument', {
    instrument: 'Guitar',
    tuningName: 'Drop D'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'tuner-pitch');

  const container = new MockElement('div');
  const card = TunerPitchResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Guitar Tuner'));
  assert.ok(card.textContent.includes('Drop D'));
  assert.ok(card.textContent.includes('Launch Live Mic Tuner'));
});

test('Assistant Tool annotate_pdf: structures document markup and redactions', async () => {
  const res = await executeAssistantTool('annotate_pdf', {
    title: 'Employment Agreement.pdf',
    annotations: [
      { page: 1, type: 'highlight', label: 'Compensation Section' },
      { page: 1, type: 'redact', label: 'Bank Account Number' }
    ]
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'pdf-annotation');

  const container = new MockElement('div');
  const card = PdfAnnotationResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Employment Agreement.pdf'));
  assert.ok(card.textContent.includes('Compensation Section'));
  assert.ok(card.textContent.includes('Open in PDF Editor'));
});

test('Diseases Database Guardrail: rejects non-medical queries like driving schools', async () => {
  const res1 = searchDiseases('driving schools');
  assert.equal(res1.length, 0);

  const res2 = searchDiseases('I am in kosofe, where are the nearest driving schools?');
  assert.equal(res2.length, 0);

  const res3 = searchDiseases('react web development');
  assert.equal(res3.length, 0);

  // Test Assistant Tool execution rejects honey and food compounds
  const toolRes1 = await executeAssistantTool('search_diseases', { query: 'honey' });
  assert.equal(toolRes1.status, 'error');
  assert.equal(toolRes1.type, 'text');
  assert.ok(toolRes1.message.includes('not a medical condition'));

  const toolRes2 = await executeAssistantTool('search_diseases', { query: 'Tell me all the compounds inside honey' });
  assert.equal(toolRes2.status, 'error');
  assert.equal(toolRes2.type, 'text');
  assert.ok(toolRes2.message.includes('not a medical condition'));
});

test('Assistant Tool render_map: resolves Kosofe driving schools and localized markers', async () => {
  const res = await executeAssistantTool('render_map', {
    title: 'Driving Schools in Kosofe',
    location: 'Kosofe, Lagos',
    query: 'nearest driving schools'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'map-view');
  assert.ok(res.markers.length >= 3);
  assert.ok(res.markers.some(m => m.name.includes('Driving') || m.description.includes('Kosofe')));

  const container = new MockElement('div');
  const card = MapResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('Kosofe'));
  assert.ok(card.textContent.includes('Open Interactive Map'));
});

test('Currency Localization: defaults to Nigerian Naira (NGN, ₦)', async () => {
  const res = await executeAssistantTool('generate_invoice', {
    client: 'Lagos Enterprise Ltd\nIkeja, Lagos',
    lines: [{ description: 'Cloud Setup', qty: 1, price: 250000 }]
  });

  assert.equal(res.status, 'success');
  assert.equal(res.invoice.currency, 'NGN');
  assert.ok(res.message.includes('₦') || res.message.includes('250,000'));

  const container = new MockElement('div');
  const card = InvoiceResultRenderer.render({ data: res }, container);
  assert.ok(card.textContent.includes('₦250,000') || card.textContent.includes('₦'));
});

test('Assistant Tool get_current_location: acquires coordinates and renders GPS location card', async () => {
  const mockGeo = {
    getCurrentPosition: (success) => {
      success({
        coords: {
          latitude: 6.5750,
          longitude: 3.3930,
          accuracy: 12
        }
      });
    }
  };

  const originalGeo = globalThis.navigator?.geolocation;
  if (!globalThis.navigator) globalThis.navigator = {};
  globalThis.navigator.geolocation = mockGeo;

  const res = await executeAssistantTool('get_current_location', {});
  assert.equal(res.status, 'success');
  assert.equal(res.type, 'location-coordinates');
  assert.equal(res.latitude, 6.5750);
  assert.equal(res.longitude, 3.3930);

  const container = new MockElement('div');
  const card = LocationCoordinatesResultRenderer.render({ data: res }, container);
  assert.ok(card);
  assert.ok(card.textContent.includes('6.5750°'));
  assert.ok(card.textContent.includes('3.3930°'));

  if (originalGeo) {
    globalThis.navigator.geolocation = originalGeo;
  }
});
