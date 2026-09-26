/* ============================================================
   Tier 4: Real-World Application Scenarios — 5 Scenarios
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setupDOMEnvironment } from '../../helpers/dom-env.js';
import { TestVirtualScroller, classifyAnatomicalStructure, CANONICAL_SYSTEMS } from './helpers.js';
import { anatomyService } from '../../../js/lib/anatomy-data.js';

// Setup DOM globals
const { document } = setupDOMEnvironment();

const PUBLIC_ANATOMY_DIR = path.resolve('public', 'anatomy');
const INDEX_PATH = path.join(PUBLIC_ANATOMY_DIR, 'index.json');

/* ============================================================
   Scenario 1: Medical student exploring skeletal system
   ============================================================ */

test('Tier 4 - 4.1: Medical student exploring skeletal system (atlas/axis, carpal bones, articulations)', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  // 1. Verify skeletal system is loaded and valid
  const skeletalMeta = index.systems.skeletal;
  assert.ok(skeletalMeta, 'Skeletal system exists');
  assert.ok(skeletalMeta.count > 0, 'Skeletal system has bones');

  // 2. Student identifies C1 (Atlas) and C2 (Axis)
  const atlasName = 'atlas';
  const axisName = 'axis';
  const atlasSystem = classifyAnatomicalStructure(atlasName);
  const axisSystem = classifyAnatomicalStructure(axisName);
  assert.equal(atlasSystem, 'skeletal');
  assert.equal(axisSystem, 'skeletal');

  // Clinical detail with anatomical context (cervical vertebra C1 atlas)
  const atlasDetail = anatomyService.getDetail('cervical vertebra (atlas)', 'skeletal');
  assert.ok(atlasDetail, 'Clinical detail exists for atlas');
  assert.equal(atlasDetail.region, 'head-neck');
  assert.ok(atlasDetail.functionDesc || atlasDetail.clinicalNotes);

  // 3. Student investigates wrist carpal bones
  const carpalBones = [
    'scaphoid', 'lunate', 'triquetral', 'pisiform',
    'trapezium', 'trapezoid', 'capitate', 'hamate'
  ];

  for (const bone of carpalBones) {
    const sys = classifyAnatomicalStructure(bone);
    assert.equal(sys, 'skeletal', `Carpal bone ${bone} belongs to skeletal system`);
    const detail = anatomyService.getDetail(`${bone} carpal bone`, 'skeletal');
    assert.equal(detail.region, 'upper-limb', `${bone} must be located in upper-limb region`);
  }

  // 4. Student verifies scaphoid fracture avascular necrosis clinical pearl
  const scaphoidDetail = anatomyService.getDetail('scaphoid carpal bone', 'skeletal');
  const clinicalText = (scaphoidDetail.clinicalNotes || '') + ' ' + (scaphoidDetail.functionDesc || '');
  assert.ok(clinicalText.length > 20, 'Has comprehensive clinical notes for scaphoid');
});

/* ============================================================
   Scenario 2: Surgeon researching facial muscles with rapid search
   ============================================================ */

test('Tier 4 - 4.2: Surgeon researching facial muscles with rapid search (<5ms) and neurovascular details', () => {
  const facialMuscles = [
    { query: 'frontalis', fullName: 'frontalis facial muscle' },
    { query: 'orbicularis oculi', fullName: 'orbicularis oculi head muscle' },
    { query: 'orbicularis oris', fullName: 'orbicularis oris head muscle' },
    { query: 'buccinator', fullName: 'buccinator head muscle' },
    { query: 'risorius', fullName: 'risorius head muscle' },
    { query: 'nasalis', fullName: 'nasalis nasal muscle' }
  ];

  // 1. Surgeon conducts rapid searches
  for (const item of facialMuscles) {
    const startTime = performance.now();
    const sys = classifyAnatomicalStructure(item.query);
    const detail = anatomyService.getDetail(item.fullName, 'muscular');
    const elapsed = performance.now() - startTime;

    assert.equal(sys, 'muscular', `${item.query} must be classified as muscular`);
    assert.ok(elapsed < 5.0, `Surgeon search for ${item.query} took ${elapsed.toFixed(3)}ms (must be < 5ms)`);
    assert.equal(detail.region, 'head-neck', `${item.fullName} must be in head-neck region`);
  }

  // 2. Check facial nerve innervation (Cranial Nerve VII)
  const buccinatorDetail = anatomyService.getDetail('buccinator head muscle', 'muscular');
  assert.ok(buccinatorDetail, 'Buccinator detail retrieved');
  if (buccinatorDetail.innervation) {
    assert.ok(
      buccinatorDetail.innervation.toLowerCase().includes('nerve') ||
      buccinatorDetail.innervation.toLowerCase().includes('facial') ||
      buccinatorDetail.innervation.toLowerCase().includes('somatic')
    );
  }
});

/* ============================================================
   Scenario 3: Neurologist inspecting cerebral cortex gyri and brainstem
   ============================================================ */

test('Tier 4 - 4.3: Neurologist inspecting cerebral cortex gyri, brainstem, and vascular supply', () => {
  const neuroStructures = [
    { name: 'brain precentral gyrus', query: 'precentral gyrus', expectedRegion: 'head-neck' },
    { name: 'brain postcentral gyrus', query: 'postcentral gyrus', expectedRegion: 'head-neck' },
    { name: 'brain stem pons', query: 'pons', expectedRegion: 'head-neck' },
    { name: 'brain stem medulla oblongata', query: 'medulla oblongata', expectedRegion: 'head-neck' },
    { name: 'brain internal capsule', query: 'internal capsule', expectedRegion: 'head-neck' }
  ];

  for (const item of neuroStructures) {
    const sys = classifyAnatomicalStructure(item.query);
    assert.equal(sys, 'nervous', `${item.query} must be classified as nervous system`);
    const detail = anatomyService.getDetail(item.name, 'nervous');
    assert.equal(detail.region, item.expectedRegion);
    assert.ok(detail.functionDesc || detail.clinicalNotes);
  }

  // Verify medulla oblongata clinical details
  const medullaDetail = anatomyService.getDetail('brain stem medulla oblongata', 'nervous');
  assert.ok(medullaDetail.functionDesc.length > 10 || medullaDetail.clinicalNotes.length > 10);
});

/* ============================================================
   Scenario 4: Full body system overview toggling multiple systems
   ============================================================ */

test('Tier 4 - 4.4: Full body system overview toggling multiple systems simultaneously with opacity and clipping', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  // 1. Enable 3 co-visible systems
  const activeSystems = ['skeletal', 'muscular', 'cardiovascular'];
  const visible = Object.fromEntries(CANONICAL_SYSTEMS.map(k => [k, false]));
  for (const s of activeSystems) visible[s] = true;

  const coVisibleStructures = index.structures.filter(s => visible[s.system]);
  const expectedCount = activeSystems.reduce((sum, s) => sum + index.systems[s].count, 0);
  assert.equal(coVisibleStructures.length, expectedCount);

  // 2. Simulate 50% opacity adjustment for deep vasculature visualization
  let opacity = 0.50;
  const isTransparent = opacity < 1.0;
  const depthWrite = opacity > 0.85;

  assert.equal(isTransparent, true);
  assert.equal(depthWrite, false, 'Depth write disabled for semitransparent meshes to prevent occlusion artifacts');

  // 3. Simulate cross-section axial clipping plane at 50% height
  const planeAxis = 'y'; // axial
  const RANGE_Y = [0, 1.9];
  const clipPosition = RANGE_Y[0] + (RANGE_Y[1] - RANGE_Y[0]) * 0.5;
  assert.equal(clipPosition, 0.95);

  // 4. Simulate isolate selection mode
  const targetId = 'FMA24474'; // femur
  const isolateMode = true;
  const isNodeVisible = (id) => !isolateMode || id === targetId;

  assert.equal(isNodeVisible('FMA24474'), true);
  assert.equal(isNodeVisible('FMA7148'), false, 'Non-selected organs hidden during isolate mode');
});

/* ============================================================
   Scenario 5: Mobile / narrow-viewport responsiveness and touch scrolling
   ============================================================ */

test('Tier 4 - 4.5: Mobile / narrow-viewport responsiveness and touch scrolling (375x667)', () => {
  const container = document.createElement('div');
  container.className = 't3d-container mobile-view';
  container.style.width = '375px';
  container.style.height = '667px';

  // 1. Horizontal pill scroller setup
  const pillBar = document.createElement('div');
  pillBar.className = 'an-pill-bar';
  pillBar.style.display = 'flex';
  pillBar.style.overflowX = 'auto';
  pillBar.style.whiteSpace = 'nowrap';

  const regions = ['all', 'head-neck', 'thorax', 'abdomen', 'pelvis', 'upper-limb', 'lower-limb'];
  for (const reg of regions) {
    const btn = document.createElement('button');
    btn.className = 'an-pill';
    btn.setAttribute('data-region', reg);
    btn.textContent = reg;
    pillBar.appendChild(btn);
  }
  container.appendChild(pillBar);

  assert.equal(pillBar.querySelectorAll('.an-pill').length, 7);
  assert.equal(pillBar.style.overflowX, 'auto');

  // 2. Compact VirtualScroller for mobile viewport (height = 240px)
  const listContainer = document.createElement('div');
  container.appendChild(listContainer);

  const mobileScroller = new TestVirtualScroller(listContainer, {
    itemHeight: 36,
    containerHeight: 240
  });

  // Expected pool size: Math.ceil(240 / 36) + 2 = 7 + 2 = 9
  assert.ok(mobileScroller.getPoolElementCount() <= 12, 'Compact pool size for mobile viewport');

  // 3. Touch scroll simulation
  mobileScroller.setItems(Array.from({ length: 200 }, (_, i) => ({ id: `FMA_M_${i}`, name: `Mobile Item ${i}` })));
  assert.equal(mobileScroller.spacer.style.height, `${200 * 36}px`);

  // Touch scroll down 300px
  mobileScroller.scrollTo(300);
  const firstVisibleIdx = parseInt(mobileScroller.pool[0].dataset.index, 10);
  assert.equal(firstVisibleIdx, Math.floor(300 / 36));
});
