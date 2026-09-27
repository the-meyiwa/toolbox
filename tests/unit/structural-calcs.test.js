/* ============================================================
   Structural calculators and the Math Utility "Structures" commands
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as SC from '../../js/lib/structural-calcs.js';
import { run } from '../../js/lib/mathx/command.js';

const near = (v, want, tol = 0.02) => assert.ok(Math.abs(v - want) <= Math.abs(want) * tol, `${v} vs ${want}`);

test('Structural calcs: simply supported UDL beam matches wL²/8 and 5wL⁴/384EI', () => {
  const b = SC.beam({ L: 6, w: 10, section: 'UB 305x165x40' });
  assert.equal(b.Mmax, 45);
  assert.equal(b.Vmax, 30);
  near(b.stressMPa, 80.4);
  near(b.deflectionMm, 9.5, 0.05);
  assert.equal(b.ok, true);
  assert.equal(b.M(3), 45);
  assert.equal(b.V(0), 30);
  const cant = SC.beam({ L: 2, P: 10, support: 'cantilever' });
  assert.equal(cant.Mmax, 20);
});

test('Structural calcs: section properties and column buckling', () => {
  const chs = SC.sectionProperties('CHS 114.3x5');
  near(chs.I * 1e8, 257);         // cm⁴
  near(chs.kgm, 13.5);
  const col = SC.columnBuckling({ section: 'UC 203x203x46', L: 3.5 });
  assert.equal(col.NbRdKn, 1083);
  near(col.chi, 0.671, 0.01);
  const longer = SC.columnBuckling({ section: 'UC 203x203x46', L: 7 });
  assert.ok(longer.NbRdKn < col.NbRdKn / 2);
});

test('Structural calcs: wind, reinforced concrete, U-value and design load', () => {
  assert.equal(SC.windLoad({ V: 38 }).qKnm2, 0.885);
  const rc = SC.rcBeam({ M: 100, b: 230, d: 400 });
  assert.equal(rc.bars, '4Y16');
  assert.equal(rc.AsMm2, 727);
  assert.equal(SC.rcBeam({ M: 900, b: 230, d: 400 }).ok, false);
  assert.equal(SC.uValue({ layers: [{ material: 'render', thickness: 15 }, { material: 'hollow sandcrete', thickness: 225 }, { material: 'render', thickness: 15 }] }).U, 1.717);
  assert.ok(SC.septicTank({ people: 12 }).septicLitres > SC.septicTank({ people: 6 }).septicLitres);
});

test('Math Utility: structures commands give results, steps and a shear/moment plot', () => {
  const b = run('beam L=6 w=10 UB 305x165x40');
  assert.equal(b.category, 'structures');
  assert.match(b.result, /M_\{max\} = 45/);
  assert.ok(b.plot && b.plot.items.length === 2);
  assert.ok(b.steps.length > 2);
  assert.match(run('section CHS 114.3x5').result, /256\.9/);
  assert.match(run('column UC 203x203x46 L=3.5').result, /1083/);
  assert.match(run('wind V=38 h=3 b=6').result, /0\.885/);
  assert.match(run('rcbeam M=100 b=230 d=400').result, /4Y16/);
  // Layers may be written either way round.
  assert.match(run('uvalue render 15, hollow sandcrete 225, render 15').result, /1\.717/);
  assert.match(run('uvalue 200 dense block, 100mm glass wool').result, /U = 0\.35/);
  assert.match(run('loads office').plain, /kN\/m²/);
  // LaTeX spacing survives in the output (no bare ";" from a swallowed "\;").
  assert.doesNotMatch(run('rcbeam M=100 b=230 d=400').input, /[^\\];\s*b/);
});
