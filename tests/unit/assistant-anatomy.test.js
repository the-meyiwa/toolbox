import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnatomyQuery, anatomyService } from '../../js/lib/anatomy-data.js';
import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { selectRenderer, Anatomy3DResultRenderer, FileSavedResultRenderer } from '../../js/lib/assistant-result-renderer.js';
import { ConversationIntegrationManager } from '../../js/lib/assistant-integration.js';

// Mock index data for unit testing environment
const MOCK_ANATOMY_INDEX = {
  systems: {
    skeletal: { label: 'Skeletal', file: 'skeletal.glb', count: 2, order: 1 },
    muscular: { label: 'Muscular', file: 'muscular.glb', count: 4, order: 2 },
    digestive: { label: 'Digestive', file: 'digestive.glb', count: 3, order: 3 }
  },
  structures: [
    { id: 'FMA24474', name: 'right femur', system: 'skeletal', fma: '24474' },
    { id: 'FMA24475', name: 'left femur', system: 'skeletal', fma: '24475' },
    { id: 'FMA45875', name: 'abdominal part of left pectoralis major', system: 'muscular', fma: '45875' },
    { id: 'FMA45874', name: 'abdominal part of right pectoralis major', system: 'muscular', fma: '45874' },
    { id: 'FMA33585', name: 'transverse part of left trapezius', system: 'muscular', fma: '33585' },
    { id: 'FMA33584', name: 'transverse part of right trapezius', system: 'muscular', fma: '33584' },
    { id: 'FMA7148', name: 'stomach', system: 'digestive', fma: '7148' },
    { id: 'FMA7197', name: 'liver', system: 'digestive', fma: '7197' },
    { id: 'FMA14543nsn', name: 'colon, nsn', system: 'digestive', fma: '14543nsn' }
  ]
};

// DOM Mock for Node testing
class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.className = '';
    this.style = {};
    this.attributes = new Map();
    this._textContent = '';
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
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => new MockElement(tag)
  };
}

test('resolveAnatomyQuery: resolves Pectoralis Major & Trapezius Muscle multi-part query', async () => {
  const result = await resolveAnatomyQuery('Tell me all about the Pectoralis Major and Trapezius Muscle', MOCK_ANATOMY_INDEX);

  assert.ok(result.systems.includes('muscular'), 'Includes muscular system');
  assert.ok(result.structureIds.includes('FMA45875') || result.structureIds.includes('FMA45874'), 'Contains Pectoralis Major ID');
  assert.ok(result.structureIds.includes('FMA33585') || result.structureIds.includes('FMA33584'), 'Contains Trapezius ID');
  assert.ok(result.details.length >= 2, 'Has clinical details for both muscles');
});

test('resolveAnatomyQuery: resolves "biggest bone in human body and digestive system"', async () => {
  const result = await resolveAnatomyQuery('Tell me about the biggest bone in the human body and the digestive system', MOCK_ANATOMY_INDEX);

  assert.ok(result.systems.includes('skeletal'), 'Includes skeletal system for femur');
  assert.ok(result.systems.includes('digestive'), 'Includes digestive system');
  assert.ok(result.structureIds.includes('FMA24474'), 'Identified femur ID for biggest bone');
  assert.ok(result.structureIds.includes('FMA7148'), 'Identified stomach in digestive system');
});

test('resolveAnatomyQuery: resolves "lungs" query', async () => {
  const MOCK_WITH_LUNGS = {
    systems: {
      respiratory: { label: 'Respiratory', file: 'respiratory.glb', count: 3, order: 4 }
    },
    structures: [
      { id: 'FMA7333', name: 'upper lobe of right lung', system: 'respiratory', fma: '7333' },
      { id: 'FMA7370', name: 'upper lobe of left lung', system: 'respiratory', fma: '7370' },
      { id: 'FMA7394', name: 'trachea', system: 'respiratory', fma: '7394' }
    ]
  };

  const result = await resolveAnatomyQuery('Tell me about the lungs', MOCK_WITH_LUNGS);
  assert.ok(result.systems.includes('respiratory'), 'Identifies respiratory system');
  assert.ok(result.structureIds.includes('FMA7333'), 'Matches upper lobe of right lung');
  assert.ok(result.details.length >= 1, 'Provides clinical details for lungs');
  assert.ok(result.details[0].clinicalNotes.includes('Pneumothorax') || result.details[0].clinicalNotes.includes('Pulmonary embolism') || result.details[0].functionDesc.includes('gas exchange'));
});

test('resolveAnatomyQuery: resolves "heart and brain"', async () => {
  const MOCK_WITH_HEART_BRAIN = {
    systems: {
      cardiovascular: { label: 'Cardiovascular', file: 'cardiovascular.glb', count: 1, order: 5 },
      nervous: { label: 'Nervous', file: 'nervous.glb', count: 1, order: 6 }
    },
    structures: [
      { id: 'FMA7274', name: 'wall of heart', system: 'cardiovascular', fma: '7274' },
      { id: 'FMA61822', name: 'white matter structure of cerebral hemisphere', system: 'nervous', fma: '61822' }
    ]
  };

  const result = await resolveAnatomyQuery('tell me about the heart and brain', MOCK_WITH_HEART_BRAIN);
  assert.ok(result.systems.includes('cardiovascular'), 'Identifies cardiovascular system');
  assert.ok(result.systems.includes('nervous'), 'Identifies nervous system');
  assert.ok(result.structureIds.includes('FMA7274'), 'Matches heart structure');
  assert.ok(result.structureIds.includes('FMA61822'), 'Matches brain structure');
});

test('Assistant Tool explore_anatomy: executes query and returns structured anatomy-3d payload', async () => {
  const toolResult = await executeAssistantTool('explore_anatomy', {
    query: 'pectoralis major and trapezius'
  });

  assert.equal(toolResult.status, 'success');
  assert.equal(toolResult.type, 'anatomy-3d');
  assert.equal(toolResult.renderer, 'anatomy-3d');
  assert.ok(Array.isArray(toolResult.systems));
  assert.ok(Array.isArray(toolResult.structureIds));
  assert.ok(Array.isArray(toolResult.details));
});

test('Assistant Result Renderer: selects anatomy-3d renderer for anatomy payloads', () => {
  const mgr = new ConversationIntegrationManager();
  const normalized = mgr.normalizeToolResult({
    status: 'success',
    type: 'anatomy-3d',
    query: 'femur and digestive system',
    systems: ['skeletal', 'digestive'],
    structureIds: ['FMA24474', 'FMA7148']
  });

  assert.equal(selectRenderer(normalized).id, 'anatomy-3d');
});

test('Anatomy3DResultRenderer: renders preview card with clinical notes section', () => {
  const container = new MockElement('div');
  const card = Anatomy3DResultRenderer.render({
    data: {
      query: 'Pectoralis Major and Trapezius',
      systems: ['muscular'],
      structureIds: ['FMA45875', 'FMA33585'],
      structures: [
        { id: 'FMA45875', name: 'left pectoralis major', system: 'muscular' },
        { id: 'FMA33585', name: 'left trapezius', system: 'muscular' }
      ],
      details: [
        {
          id: 'FMA45875',
          commonName: 'Pectoralis Major',
          name: 'Pectoralis major',
          system: 'muscular',
          functionDesc: 'Adducts and medially rotates the humerus.',
          clinicalNotes: 'Pectoralis major tendon rupture occurs in heavy bench press.'
        }
      ]
    }
  }, container);

  assert.ok(card);
  assert.ok(card.textContent.includes('Pectoralis Major'));
  assert.ok(card.textContent.includes('Adducts and medially rotates'));
  assert.ok(card.textContent.includes('Pectoralis major tendon rupture'));
});

test('FileSavedResultRenderer: renders simplified, clutter-free single-row card', () => {
  const container = new MockElement('div');
  const card = FileSavedResultRenderer.render({
    data: {
      filename: 'financial_summary.csv',
      destination: 'cloud',
      isCloudSynced: true,
      artifactId: 'art_8877'
    }
  }, container);

  assert.ok(card);
  assert.ok(card.className.includes('assistant-result-saved-card'));
  assert.ok(card.textContent.includes('financial_summary.csv'));
  assert.ok(card.textContent.includes('View in Saved Work'));
});
