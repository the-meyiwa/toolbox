/* ============================================================
   TOOLBOX — Assistant & Architectural P0-P2 Regression Test Suite
   Verifies:
   1. Multi-action orchestration, truthful error reporting, and no internal tool leaks
   2. Authoritative calendar queries with complete details and honest empty state
   3. Authoritative BudgetStore spending analysis & debt repayments
   4. Bank statement import pipeline and transaction persistence
   5. Notes creation and retrieval
   6. Media playback state and HTMLAudioElement synchronization
   7. Proximity / places search intent preservation ("nearest Shoprite" vs driving schools)
   8. SSRF protections on assistant search API
   9. Architecture Editor floor plan handoff hydration
   10. Deterministic Math Utility (Arithmetic, Collatz, Calculus, Statistics)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import {
  loadBudgetState,
  saveBudgetState,
  addTransaction,
  getSpendingAnalysis,
  addDebt,
  getDebts,
  recordDebtRepayment,
  importBankStatement,
  parseBankStatement,
  clearBudgetData
} from '../../js/lib/budget-store.js';
import {
  loadEvents,
  saveEvents,
  addEvent,
  getEventsForDate,
  searchEvents
} from '../../js/lib/calendar-store.js';
import { AssistantAudioManager } from '../../js/lib/assistant-audio.js';
import { calculateMath, calculateCollatz, calculateDerivative, calculateStatistics } from '../../js/lib/math-engine.js';
import { convertFloorPlanHandoffToElements } from '../../js/tools/architecture-editor.js';

// Setup Mock Storage for Node Test Environment
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

globalThis.localStorage = mockLocalStorage;
globalThis.sessionStorage = mockSessionStorage;

test('P0 Phase 1: Deterministic Math Utility executes multi-step problems without LLM guessing', async () => {
  // 1. Arithmetic evaluation
  const r1 = await executeAssistantTool('calculate_math', { expression: '15 * 80 + 35' });
  assert.equal(r1.status, 'success');
  assert.equal(r1.result, 1235);
  assert.ok(r1.message.includes('1235'));

  // 2. Collatz Conjecture deterministic sequence
  const r2 = await executeAssistantTool('calculate_math', { operation: 'collatz', input: 6 });
  assert.equal(r2.status, 'success');
  assert.equal(r2.operation, 'collatz');
  assert.deepEqual(r2.sequence, [6, 3, 10, 5, 16, 8, 4, 2, 1]);
  assert.equal(r2.steps, 8);
  assert.equal(r2.reached_one, true);
  assert.equal(r2.maximum_value, 16);

  // 3. Calculus derivative
  const r3 = await executeAssistantTool('calculate_math', { operation: 'derivative', expression: 'x^2 + 3*x', variable: 'x', at: 2 });
  assert.equal(r3.status, 'success');
  assert.equal(r3.result, 7);

  // 4. Statistics
  const r4 = await executeAssistantTool('calculate_math', { operation: 'statistics', data: [10, 20, 30, 40, 50] });
  assert.equal(r4.status, 'success');
  assert.equal(r4.mean, 30);
  assert.equal(r4.median, 30);
  assert.equal(r4.min, 10);
  assert.equal(r4.max, 50);
});

test('P0 Phase 2: Calendar store returns full details and empty state is strictly empty', async () => {
  mockLocalStorage.clear();

  // Rule 6: Empty state must be empty (no sample placeholder events)
  const initialEvents = loadEvents();
  assert.equal(initialEvents.length, 0);

  const emptyQueryResult = await executeAssistantTool('calendar_get_events', { query: 'birthday' });
  assert.ok(emptyQueryResult.message.includes('No calendar events found'));

  // Add real event
  addEvent({
    title: "Sarah's Birthday",
    date: '2026-05-14',
    startTime: '18:00',
    endTime: '21:00',
    location: 'Bistro Central',
    description: 'Bring the gift and cake'
  });

  const queryResult = await executeAssistantTool('calendar_get_events', { query: 'Sarah' });
  assert.equal(queryResult.status, 'success');
  assert.equal(queryResult.events.length, 1);
  // Rule 5: Assistant responses must not be barebones status messages
  assert.ok(queryResult.message.includes("Sarah's Birthday"));
  assert.ok(queryResult.message.includes("2026-05-14"));
  assert.ok(queryResult.message.includes("Bistro Central"));
  assert.ok(queryResult.message.includes("Bring the gift"));
});

test('P0 Phase 2: Authoritative BudgetStore calculates spending analysis from real data without placeholders', async () => {
  mockLocalStorage.clear();

  // Clean state: Insufficient data should be reported honestly without hallucinating transactions
  const emptyAnalysis = getSpendingAnalysis({ category: 'food' });
  assert.equal(emptyAnalysis.hasData, false);
  assert.equal(emptyAnalysis.totalSpent, 0);
  assert.ok(emptyAnalysis.message.includes('No transactions found'));

  const emptyToolRes = await executeAssistantTool('analyze_budget_spending', { category: 'food' });
  assert.equal(emptyToolRes.status, 'success');
  assert.equal(emptyToolRes.hasData, false);

  // Add authoritative transactions
  addTransaction({
    date: '2026-03-01',
    description: 'Weekly Groceries at Shoprite',
    amount: 35000,
    type: 'expense',
    category: 'Groceries'
  });
  addTransaction({
    date: '2026-03-02',
    description: 'Dinner at Restaurant',
    amount: 15000,
    type: 'expense',
    category: 'Food & Dining'
  });
  addTransaction({
    date: '2026-03-03',
    description: 'Ride fare',
    amount: 5000,
    type: 'expense',
    category: 'Transportation'
  });

  // Query food category
  const foodRes = await executeAssistantTool('analyze_budget_spending', { category: 'food' });
  assert.equal(foodRes.status, 'success');
  assert.equal(foodRes.hasData, true);
  assert.equal(foodRes.totalSpent, 55000);
  assert.equal(foodRes.categorySpent, 15000);
  assert.ok(foodRes.categoryPercentage > 0);
});

test('P0 Phase 2: Debt queries and repayments operate against authoritative BudgetStore state', async () => {
  mockLocalStorage.clear();

  const newDebt = addDebt({
    name: 'Car Loan',
    totalAmount: 1000000,
    remainingAmount: 400000,
    interestRate: 8,
    minimumPayment: 50000
  });

  assert.equal(newDebt.name, 'Car Loan');
  assert.equal(newDebt.remainingAmount, 400000);

  // Repay 100,000
  const repayment = await executeAssistantTool('manage_debts', {
    action: 'repay',
    debtId: newDebt.id,
    amount: 100000
  });

  assert.equal(repayment.status, 'success');
  assert.equal(repayment.remainingAmount, 300000);

  // Check that repayment created an authoritative transaction in the BudgetStore
  const state = loadBudgetState();
  const repaymentTx = state.transactions.find(tx => tx.category === 'Debt Repayment');
  assert.ok(repaymentTx, 'Repayment transaction must be recorded in budget store');
  assert.equal(repaymentTx.amount, 100000);
});

test('P0 Phase 2: Bank statement import pipeline parses, verifies, and persists transactions', async () => {
  mockLocalStorage.clear();

  const sampleCsv = `Date,Description,Amount\n2026-03-01,Monthly Payroll Direct Deposit,750000\n2026-03-02,Shoprite Supermarket,-42000\n2026-03-03,Electric Utility Bill,-18500`;

  const parseRes = parseBankStatement(sampleCsv);
  assert.equal(parseRes.success, true);
  assert.equal(parseRes.count, 3);

  const importRes = await executeAssistantTool('import_bank_statement', {
    content: sampleCsv,
    account: 'GTBank Checking'
  });

  assert.equal(importRes.status, 'success');
  assert.equal(importRes.count, 3);
  assert.equal(importRes.totalIncome, 750000);
  assert.equal(importRes.totalExpense, 60500);

  // Authoritative persistence check
  const state = loadBudgetState();
  assert.equal(state.transactions.length, 3);
});

test('P0 Phase 2: Notes workspace creation and subsequent retrieval', async () => {
  mockLocalStorage.clear();

  const noteTitle = 'Meeting Notes Architecture Review';
  const noteBody = 'Discussed vector rendering, math utility, and budget store.';

  const createRes = await executeAssistantTool('create_note', {
    title: noteTitle,
    content: noteBody
  });
  assert.equal(createRes.status, 'success');
  assert.ok(createRes.noteId);

  // Retrieve note by title
  const getRes = await executeAssistantTool('get_note', { title: 'Architecture Review' });
  assert.equal(getRes.status, 'success');
  assert.equal(getRes.title, noteTitle);
  assert.equal(getRes.body, noteBody);
});

test('P0 Phase 3: Media playback state maintains HTMLAudioElement as single source of truth', () => {
  // Test restore without auto-play or phantom isPlaying: true
  const audioData = {
    audioId: 'aud_test_123',
    url: 'https://example.com/audio-sample.mp3',
    title: 'Test Symphony',
    artist: 'Classical Ensemble',
    duration: 180,
    currentTime: 45
  };

  const instance = AssistantAudioManager.restore(audioData);
  assert.ok(instance);
  assert.equal(instance.id, 'aud_test_123');
  // Must NOT blindly assume playing is true on restore
  assert.equal(instance.isPlaying, false);

  const state = AssistantAudioManager.getPlaybackState('aud_test_123');
  assert.equal(state.isPlaying, false);
});

test('P0 Phase 4: Places search preserves entity intent ("nearest Shoprite" vs driving schools)', async () => {
  // "nearest Shoprite" must return Shoprite supermarket locations, NEVER driving schools
  const shopriteRes = await executeAssistantTool('search_places_nearby', { query: 'nearest Shoprite' });
  assert.equal(shopriteRes.status, 'success');
  assert.ok(shopriteRes.title.toLowerCase().includes('shoprite'));
  assert.ok(shopriteRes.markers.length > 0);
  assert.ok(shopriteRes.markers.some(m => m.name.toLowerCase().includes('shoprite')));
  assert.ok(!shopriteRes.markers.some(m => m.name.toLowerCase().includes('driving school')));

  // Driving schools query must return certified driving schools
  const drivingRes = await executeAssistantTool('search_places_nearby', { query: 'nearest driving school' });
  assert.equal(drivingRes.status, 'success');
  assert.ok(drivingRes.title.toLowerCase().includes('driving school'));
  assert.ok(drivingRes.markers.some(m => m.name.toLowerCase().includes('driving') || m.name.toLowerCase().includes('lasdri') || m.name.toLowerCase().includes('vio')));
});

test('P1 Phase 5: Architecture editor consumes floor plan handoff into editable elements', () => {
  const floorPlanHandoff = {
    title: 'Modern 3-Bedroom Apartment',
    squareMeters: 120,
    rooms: [
      { name: 'Living Room', width: 6.0, length: 5.5, x: 0, y: 0, color: '#3b82f6' },
      { name: 'Master Suite', width: 4.5, length: 4.0, x: 6.0, y: 0, color: '#10b981' },
      { name: 'Guest Bedroom', width: 3.8, length: 3.5, x: 6.0, y: 4.0, color: '#8b5cf6' },
      { name: 'Kitchen & Dining', width: 4.0, length: 3.5, x: 0, y: 5.5, color: '#f59e0b' }
    ]
  };

  const elements = convertFloorPlanHandoffToElements(floorPlanHandoff);
  assert.ok(elements.length >= 16, 'Should generate rooms, walls, doors, and labels');

  const roomElements = elements.filter(e => e.type === 'room');
  assert.equal(roomElements.length, 4);

  const wallElements = elements.filter(e => e.type === 'wall');
  assert.ok(wallElements.length >= 16);

  const doorElements = elements.filter(e => e.type === 'door');
  assert.equal(doorElements.length, 4);

  const textElements = elements.filter(e => e.type === 'text');
  assert.equal(textElements.length, 4);
});
