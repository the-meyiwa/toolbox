/* ============================================================
   Chemistry Engine & Science Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS } from '../../js/lib/chemistry-data.js';
import { parseChemicalFormula, calculateMolarMass, balanceChemicalEquation, calculateStoichiometry } from '../../js/lib/chemistry-engine.js';
import { COMPOUNDS_DATA } from '../../js/lib/compounds-dataset.js';

test('Chemistry: periodic table contains 118 elements', () => {
  assert.equal(ELEMENTS.length, 118);
  const hydrogen = ELEMENTS.find(e => e.symbol === 'H');
  assert.equal(hydrogen.number, 1);
  assert.ok(Math.abs(hydrogen.weight - 1.008) < 0.01);
});

test('Chemistry: formula parser parses simple and polyatomic molecules', () => {
  // Simple: H2O -> H:2, O:1
  const h2o = parseChemicalFormula('H2O');
  assert.deepEqual(h2o, { H: 2, O: 1 });

  // Polyatomic: Ca(OH)2 -> Ca:1, O:2, H:2
  const ca_oh_2 = parseChemicalFormula('Ca(OH)2');
  assert.deepEqual(ca_oh_2, { Ca: 1, O: 2, H: 2 });

  // Complex: Al2(SO4)3 -> Al:2, S:3, O:12
  const al_so4_3 = parseChemicalFormula('Al2(SO4)3');
  assert.deepEqual(al_so4_3, { Al: 2, S: 3, O: 12 });

  // Hydrate: CuSO4*5H2O -> Cu:1, S:1, O:9, H:10
  const cuso4_hydrate = parseChemicalFormula('CuSO4*5H2O');
  assert.deepEqual(cuso4_hydrate, { Cu: 1, S: 1, O: 9, H: 10 });
});

test('Chemistry: calculateMolarMass calculates accurate molar masses', () => {
  // Water: ~18.015 g/mol
  const h2o = calculateMolarMass('H2O');
  assert.ok(Math.abs(h2o.molarMass - 18.015) < 0.1);

  // Glucose: C6H12O6 -> ~180.156 g/mol
  const glucose = calculateMolarMass('C6H12O6');
  assert.ok(Math.abs(glucose.molarMass - 180.156) < 0.2);

  // Sulfuric acid: H2SO4 -> ~98.078 g/mol
  const h2so4 = calculateMolarMass('H2SO4');
  assert.ok(Math.abs(h2so4.molarMass - 98.078) < 0.1);
});

test('Chemistry: equation balancer balances standard reactions', () => {
  // Water synthesis: H2 + O2 -> H2O => 2 H2 + O2 -> 2 H2O
  const r1 = balanceChemicalEquation('H2 + O2 -> H2O');
  assert.equal(r1.reactants.find(r => r.formula === 'H2').coeff, 2);
  assert.equal(r1.reactants.find(r => r.formula === 'O2').coeff, 1);
  assert.equal(r1.products.find(p => p.formula === 'H2O').coeff, 2);

  // Propane combustion: C3H8 + O2 -> CO2 + H2O => C3H8 + 5 O2 -> 3 CO2 + 4 H2O
  const r2 = balanceChemicalEquation('C3H8 + O2 = CO2 + H2O');
  assert.equal(r2.reactants.find(r => r.formula === 'C3H8').coeff, 1);
  assert.equal(r2.reactants.find(r => r.formula === 'O2').coeff, 5);
  assert.equal(r2.products.find(p => p.formula === 'CO2').coeff, 3);
  assert.equal(r2.products.find(p => p.formula === 'H2O').coeff, 4);

  // Photosynthesis: CO2 + H2O -> C6H12O6 + O2 => 6 CO2 + 6 H2O -> C6H12O6 + 6 O2
  const r3 = balanceChemicalEquation('CO2 + H2O -> C6H12O6 + O2');
  assert.equal(r3.reactants.find(r => r.formula === 'CO2').coeff, 6);
  assert.equal(r3.reactants.find(r => r.formula === 'H2O').coeff, 6);
  assert.equal(r3.products.find(p => p.formula === 'C6H12O6').coeff, 1);
  assert.equal(r3.products.find(p => p.formula === 'O2').coeff, 6);
});

test('Chemistry: stoichiometry calculates limiting reactant and yields', () => {
  // Balanced: 2 H2 + O2 -> 2 H2O
  const balanced = balanceChemicalEquation('H2 + O2 -> H2O');

  // Provide 4g H2 (~2 moles) and 32g O2 (1 mole)
  const result = calculateStoichiometry(balanced, {
    'H2': { amount: 4, unit: 'g' },
    'O2': { amount: 32, unit: 'g' },
  });

  assert.ok(result.productYields.length > 0);
  const waterYield = result.productYields.find(p => p.formula === 'H2O');
  assert.ok(waterYield);
  assert.ok(Math.abs(waterYield.grams - 36) < 0.5); // 4g + 32g = 36g H2O
});

test('Chemistry: compound database contains valid compound records', () => {
  assert.ok(COMPOUNDS_DATA.length >= 10, 'Expected compounds in database');
  for (const c of COMPOUNDS_DATA) {
    assert.ok(c.name, 'Compound missing name');
    assert.ok(c.formula, 'Compound missing formula');
    assert.ok(c.molarMass > 0, 'Compound molarMass must be positive');
  }
});
