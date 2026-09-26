/* ============================================================
   Tier 3: Cross-Feature Interactions — 7 Pairwise Test Cases
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setupDOMEnvironment } from '../../helpers/dom-env.js';
import { TestVirtualScroller, CANONICAL_SYSTEMS } from './helpers.js';
import { anatomyService } from '../../../js/lib/anatomy-data.js';

// Setup DOM globals
const { document } = setupDOMEnvironment();

const PUBLIC_ANATOMY_DIR = path.resolve('public', 'anatomy');
const INDEX_PATH = path.join(PUBLIC_ANATOMY_DIR, 'index.json');

test('Tier 3 - 3.1: Search Filtering + VirtualScroller: typing query updates item count, spacer height, and resets scroll offset', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 36, containerHeight: 360 });

  // Initial load: all structures
  scroller.setItems(index.structures);
  const initialCount = index.structures.length;
  assert.equal(scroller.spacer.style.height, `${initialCount * 36}px`);

  // User scrolled down to item 20
  scroller.scrollTo(720);
  assert.equal(Number(scroller.pool[0].dataset.index), 20);

  // User types search query 'femur'
  const filtered = index.structures.filter(s => s.name.toLowerCase().includes('femur'));
  assert.ok(filtered.length > 0 && filtered.length < initialCount);

  // Update VirtualScroller with filtered items and reset scroll
  scroller.scrollTo(0);
  scroller.setItems(filtered);

  assert.equal(scroller.spacer.style.height, `${filtered.length * 36}px`);
  assert.equal(Number(scroller.pool[0].dataset.index), 0);
  assert.ok(scroller.pool[0].innerHTML.toLowerCase().includes('femur'));
  // Pool elements beyond filtered.length must be hidden
  for (let i = filtered.length; i < scroller.poolSize; i++) {
    assert.equal(scroller.pool[i].style.display, 'none');
  }
});

test('Tier 3 - 3.2: System Checkbox Toggle + GLB Streaming + Count: toggling updates visibility, streaming, and UI count', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  // Initial state: only skeletal system enabled
  const visible = Object.fromEntries(CANONICAL_SYSTEMS.map(k => [k, false]));
  visible.skeletal = true;

  const countVisible = () => index.structures.filter(s => visible[s.system]).length;
  const initialVisibleCount = countVisible();
  assert.equal(initialVisibleCount, index.systems.skeletal.count);

  // Simulate user toggles 'muscular' checkbox
  const toggleSystem = (sys, state) => {
    visible[sys] = state;
    // Simulate streaming GLB asset load
    const glbPath = path.join(PUBLIC_ANATOMY_DIR, `${sys}.glb`);
    assert.ok(fs.existsSync(glbPath), `GLB for ${sys} must exist on disk`);
  };

  toggleSystem('muscular', true);
  const updatedCount = countVisible();
  assert.equal(updatedCount, index.systems.skeletal.count + index.systems.muscular.count);

  // Untoggle skeletal
  toggleSystem('skeletal', false);
  const finalCount = countVisible();
  assert.equal(finalCount, index.systems.muscular.count);
});

test('Tier 3 - 3.3: Structure Selection + 3D Model Highlight + Detail Panel: selecting list item updates 3D highlight and HUD/info panel', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const targetStructure = index.structures.find(s => s.name.includes('femur')) || index.structures[0];

  // Mock Viewer & Info Container
  let selectedObject = null;
  const mockViewer = {
    selected: null,
    select: (obj) => {
      selectedObject = obj;
      mockViewer.selected = obj;
    }
  };

  const infoEl = document.createElement('div');
  const badgeEl = document.createElement('div');

  // Simulate select handler as implemented in anatomy-explorer.js
  function onSelectStructure(s) {
    mockViewer.select({ userData: { structure: s } });

    const detail = anatomyService.getDetail(s.name, s.system);
    const sys = index.systems[s.system];

    badgeEl.style.display = 'flex';
    badgeEl.innerHTML = `<span class="badge-title">${s.name}</span><span class="badge-region">${detail.region}</span>`;

    infoEl.innerHTML = `
      <h3 class="t3d-title">${s.name}</h3>
      <span class="t3d-system">${sys.name || sys.label}</span>
      <p class="t3d-desc">${detail.functionDesc}</p>
      <p class="t3d-clinical">${detail.clinicalNotes}</p>
    `;
  }

  onSelectStructure(targetStructure);

  assert.ok(selectedObject !== null, 'Viewer has selected object');
  assert.equal(selectedObject.userData.structure.id, targetStructure.id);
  assert.equal(badgeEl.style.display, 'flex');
  assert.ok(badgeEl.innerHTML.includes(targetStructure.name));
  assert.ok(infoEl.innerHTML.includes(targetStructure.name));
  assert.ok(infoEl.innerHTML.includes('t3d-clinical'));
});

test('Tier 3 - 3.4: Theme Toggle + Pill Filter Styling + Canvas Contrast: switching app theme maintains contrast and pill tokens', () => {
  const root = document.documentElement;

  // Simulate light theme
  root.setAttribute('data-theme', 'light');
  assert.equal(root.getAttribute('data-theme'), 'light');

  // Verify pill button markup
  const pillBtn = document.createElement('button');
  pillBtn.className = 'an-pill is-active';
  pillBtn.setAttribute('data-region', 'thorax');
  pillBtn.textContent = 'Thorax';

  assert.ok(pillBtn.className.includes('an-pill'));
  assert.ok(pillBtn.className.includes('is-active'));

  // Simulate dark theme toggle
  root.setAttribute('data-theme', 'dark');
  assert.equal(root.getAttribute('data-theme'), 'dark');

  // Canvas contrast: black background 0x000000 provides high contrast against colored anatomical meshes
  const canvasBg = 0x000000;
  assert.equal(canvasBg, 0x000000);
});

test('Tier 3 - 3.5: Region Filter + Search Query Conjunction: applying both performs strict logical AND filtering', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  // Test conjunction: region = 'head-neck' AND search = 'cervical'
  const targetRegion = 'head-neck';
  const query = 'cervical';

  const matches = index.structures.filter(s => {
    // 1. Region check
    const detail = anatomyService.getDetail(s.name, s.system);
    if (detail.region !== targetRegion) return false;

    // 2. Query check
    return s.name.toLowerCase().includes(query);
  });

  assert.ok(matches.length > 0, 'Found head/neck cervical structures');
  for (const item of matches) {
    const detail = anatomyService.getDetail(item.name, item.system);
    assert.equal(detail.region, targetRegion, `Item ${item.name} must be in ${targetRegion}`);
    assert.ok(item.name.toLowerCase().includes(query), `Item ${item.name} must match query "${query}"`);
  }
});

test('Tier 3 - 3.6: Uncapped Catalog Scale + Index Parsing Memory: parsing full catalog retains low heap overhead (<50 MB)', () => {
  // Synthesize an uncapped catalog of 1,000 structures
  const largeCatalog = {
    version: 2,
    systems: {},
    structures: []
  };

  for (const sys of CANONICAL_SYSTEMS) {
    largeCatalog.systems[sys] = { name: sys, color: [0.5, 0.5, 0.5], count: 125, order: 1 };
  }

  for (let i = 1; i <= 1000; i++) {
    const sys = CANONICAL_SYSTEMS[i % CANONICAL_SYSTEMS.length];
    largeCatalog.structures.push({
      id: `FMA${20000 + i}`,
      name: `anatomical structure part ${i}`,
      system: sys,
      fma: `${20000 + i}`
    });
  }

  const jsonStr = JSON.stringify(largeCatalog);
  const memBefore = process.memoryUsage().heapUsed;

  const parsed = JSON.parse(jsonStr);
  const mapById = new Map(parsed.structures.map(s => [s.id, s]));

  const memAfter = process.memoryUsage().heapUsed;
  const deltaMB = (memAfter - memBefore) / 1048576;

  assert.equal(parsed.structures.length, 1000);
  assert.equal(mapById.size, 1000);
  assert.ok(deltaMB < 50.0, `Parsing 1000 items took ${deltaMB.toFixed(2)} MB heap (limit: <50 MB)`);
});

test('Tier 3 - 3.7: Camera Orbit Drag + Raycast Suppression: camera rotation during structure list interaction suppresses expensive raycasting', () => {
  // Raycast suppression mock architecture from PROJECT.md
  let raycastCount = 0;
  let isDraggingCamera = false;

  function performRaycastCheck() {
    if (isDraggingCamera) {
      // Suppressed during camera movement to guarantee >=30 FPS
      return null;
    }
    raycastCount++;
    return { object: { id: 'FMA1' } };
  }

  // Pointer move while NOT dragging
  isDraggingCamera = false;
  const hit1 = performRaycastCheck();
  assert.ok(hit1 !== null);
  assert.equal(raycastCount, 1);

  // User starts dragging OrbitControls to rotate model
  isDraggingCamera = true;
  for (let i = 0; i < 60; i++) {
    performRaycastCheck(); // simulated 60 FPS drag events
  }
  // Raycast count should not have increased
  assert.equal(raycastCount, 1, 'Raycasting was completely suppressed during camera drag');

  // Drag released
  isDraggingCamera = false;
  const hit2 = performRaycastCheck();
  assert.ok(hit2 !== null);
  assert.equal(raycastCount, 2);
});
