/* ============================================================
   Chemistry Engine — Equation Balancer, Stoichiometry & Parser.

   Mathematical chemistry algorithms:
   1. Chemical formula AST tokenizer (nested parentheses & hydrates).
   2. Exact Gaussian elimination null-space solver for chemical balancing.
   3. Stoichiometric yield, limiting reagent, and solution calculators.
   ============================================================ */

import { ELEMENTS } from './chemistry-data.js';

const ELEMENT_MAP = new Map(ELEMENTS.map(e => [e.symbol, e]));

/**
 * Parses a chemical formula string (e.g. "Ca(OH)2", "Al2(SO4)3", "CuSO4*5H2O")
 * into an elemental count dictionary.
 * @param {string} formula
 * @returns {Record<string, number>}
 */
export function parseChemicalFormula(formula) {
  const clean = formula.trim().replace(/\s+/g, '');
  if (!clean) return {};

  // Handle hydrates like CuSO4*5H2O or FeSO4.7H2O
  if (clean.includes('*') || clean.includes('·') || clean.includes('.')) {
    const parts = clean.split(/[*·.]/);
    const main = parseChemicalFormula(parts[0]);
    if (parts.length > 1) {
      const hydrateMatch = parts[1].match(/^(\d*)(.*)$/);
      const coeff = hydrateMatch[1] ? parseInt(hydrateMatch[1], 10) : 1;
      const hydrateCounts = parseChemicalFormula(hydrateMatch[2]);
      for (const [el, count] of Object.entries(hydrateCounts)) {
        main[el] = (main[el] || 0) + count * coeff;
      }
    }
    return main;
  }

  let i = 0;
  function parseGroup() {
    const counts = {};
    while (i < clean.length) {
      const ch = clean[i];

      if (ch === '(' || ch === '[' || ch === '{') {
        i++;
        const subCounts = parseGroup();
        // Read multiplier after closing bracket
        let numStr = '';
        while (i < clean.length && /\d/.test(clean[i])) {
          numStr += clean[i++];
        }
        const mult = numStr ? parseInt(numStr, 10) : 1;
        for (const [el, cnt] of Object.entries(subCounts)) {
          counts[el] = (counts[el] || 0) + cnt * mult;
        }
      } else if (ch === ')' || ch === ']' || ch === '}') {
        i++;
        break;
      } else if (/[A-Z]/.test(ch)) {
        // Element symbol starts with capital letter
        let sym = ch;
        i++;
        if (i < clean.length && /[a-z]/.test(clean[i])) {
          sym += clean[i++];
        }
        let numStr = '';
        while (i < clean.length && /\d/.test(clean[i])) {
          numStr += clean[i++];
        }
        const cnt = numStr ? parseInt(numStr, 10) : 1;
        counts[sym] = (counts[sym] || 0) + cnt;
      } else {
        i++;
      }
    }
    return counts;
  }

  return parseGroup();
}

/**
 * Calculates the exact standard molar mass of a molecular formula (g/mol).
 * @param {string} formula
 * @returns {{ molarMass: number, composition: Array<{ symbol: string, name: string, count: number, mass: number, percent: number }> }}
 */
export function calculateMolarMass(formula) {
  const counts = parseChemicalFormula(formula);
  let totalMass = 0;
  const breakdown = [];

  for (const [sym, count] of Object.entries(counts)) {
    const el = ELEMENT_MAP.get(sym);
    if (!el) throw new Error(`Unknown chemical element symbol "${sym}" in formula "${formula}"`);
    const mass = el.weight * count;
    totalMass += mass;
    breakdown.push({
      symbol: sym,
      name: el.name,
      count: count,
      atomicWeight: el.weight,
      mass: mass,
      percent: 0,
    });
  }

  for (const item of breakdown) {
    item.percent = totalMass > 0 ? (item.mass / totalMass) * 100 : 0;
  }

  return {
    molarMass: totalMass,
    composition: breakdown.sort((a, b) => b.mass - a.mass),
  };
}

/**
 * Exact Rational Number Class for Exact Linear System Solving
 */
class Fraction {
  constructor(n = 0, d = 1) {
    if (d === 0) throw new Error('Division by zero');
    if (d < 0) { n = -n; d = -d; }
    const g = Fraction.gcd(Math.abs(n), d);
    this.n = n / g;
    this.d = d / g;
  }

  static gcd(a, b) {
    return b === 0 ? a : Fraction.gcd(b, a % b);
  }

  static lcm(a, b) {
    return (a * b) / Fraction.gcd(a, b);
  }

  add(f) { return new Fraction(this.n * f.d + f.n * this.d, this.d * f.d); }
  sub(f) { return new Fraction(this.n * f.d - f.n * this.d, this.d * f.d); }
  mul(f) { return new Fraction(this.n * f.n, this.d * f.d); }
  div(f) { return new Fraction(this.n * f.d, this.d * f.n); }
  isZero() { return this.n === 0; }
  toDecimal() { return this.n / this.d; }
}

/**
 * Balances an arbitrary chemical reaction equation using exact integer null-space solving.
 * @param {string} equation - e.g. "C3H8 + O2 -> CO2 + H2O" or "KMnO4 + HCl = KCl + MnCl2 + H2O + Cl2"
 * @returns {{ balancedString: string, reactants: Array<{ formula: string, coeff: number }>, products: Array<{ formula: string, coeff: number }>, steps: string[] }}
 */
export function balanceChemicalEquation(equation) {
  const parts = equation.split(/->|=/);
  if (parts.length !== 2) throw new Error('Equation must contain a reaction arrow "->" or "=" separator.');

  const parseSpecies = (sideStr) => sideStr.split('+').map(s => s.trim()).filter(Boolean);
  const reactantFormulas = parseSpecies(parts[0]);
  const productFormulas = parseSpecies(parts[1]);

  if (!reactantFormulas.length || !productFormulas.length) {
    throw new Error('Both reactants and products must be present.');
  }

  const allSpecies = [...reactantFormulas, ...productFormulas];
  const numReactants = reactantFormulas.length;
  const numSpecies = allSpecies.length;

  // Extract all distinct elements
  const allElements = new Set();
  const speciesCounts = allSpecies.map(sp => {
    const counts = parseChemicalFormula(sp);
    for (const el of Object.keys(counts)) allElements.add(el);
    return counts;
  });

  const elementsList = Array.from(allElements);
  const numElements = elementsList.length;

  // Build conservation matrix M: (numElements x numSpecies)
  // Reactants are positive, products are negative: M * c = 0
  const matrix = elementsList.map(el => {
    return allSpecies.map((_, j) => {
      const count = speciesCounts[j][el] || 0;
      const signedCount = (j < numReactants) ? count : -count;
      return new Fraction(signedCount, 1);
    });
  });

  // Gaussian Elimination to Reduced Row Echelon Form (RREF)
  let lead = 0;
  for (let r = 0; r < numElements; r++) {
    if (lead >= numSpecies) break;
    let i = r;
    while (matrix[i][lead].isZero()) {
      i++;
      if (i === numElements) {
        i = r;
        lead++;
        if (lead === numSpecies) break;
      }
    }
    if (lead >= numSpecies) break;

    // Swap rows
    const temp = matrix[i];
    matrix[i] = matrix[r];
    matrix[r] = temp;

    // Normalize row r
    const val = matrix[r][lead];
    for (let c = 0; c < numSpecies; c++) {
      matrix[r][c] = matrix[r][c].div(val);
    }

    // Eliminate other rows
    for (let u = 0; u < numElements; u++) {
      if (u !== r) {
        const factor = matrix[u][lead];
        for (let c = 0; c < numSpecies; c++) {
          matrix[u][c] = matrix[u][c].sub(factor.mul(matrix[r][c]));
        }
      }
    }
    lead++;
  }

  // Solve for smallest positive integer vector
  // Set the last free variable to 1 and back-substitute
  const rawSolution = new Array(numSpecies).fill(null).map(() => new Fraction(1, 1));
  rawSolution[numSpecies - 1] = new Fraction(1, 1);

  for (let r = numElements - 1; r >= 0; r--) {
    let pivotCol = -1;
    for (let c = 0; c < numSpecies; c++) {
      if (!matrix[r][c].isZero()) { pivotCol = c; break; }
    }
    if (pivotCol !== -1 && pivotCol < numSpecies - 1) {
      let sum = new Fraction(0, 1);
      for (let c = pivotCol + 1; c < numSpecies; c++) {
        sum = sum.add(matrix[r][c].mul(rawSolution[c]));
      }
      rawSolution[pivotCol] = new Fraction(0, 1).sub(sum);
    }
  }

  // Find LCM of all denominators to make all coefficients integers
  let commonDenom = 1;
  for (const f of rawSolution) {
    commonDenom = Fraction.lcm(commonDenom, f.d);
  }

  const intCoeffs = rawSolution.map(f => Math.abs((f.n * commonDenom) / f.d));

  // Find GCD of all integer coefficients to reduce to lowest terms
  let overallGcd = intCoeffs[0];
  for (let k = 1; k < intCoeffs.length; k++) {
    overallGcd = Fraction.gcd(overallGcd, intCoeffs[k]);
  }
  const finalCoeffs = intCoeffs.map(c => Math.max(1, Math.round(c / overallGcd)));

  const reactants = reactantFormulas.map((f, idx) => ({ formula: f, coeff: finalCoeffs[idx] }));
  const products = productFormulas.map((f, idx) => ({ formula: f, coeff: finalCoeffs[numReactants + idx] }));

  const formatSide = (arr) => arr.map(item => `${item.coeff === 1 ? '' : item.coeff + ' '}${item.formula}`).join(' + ');
  const balancedString = `${formatSide(reactants)}  ${formatSide(products)}`;

  return {
    balancedString,
    reactants,
    products,
    elements: elementsList,
  };
}

/**
 * Stoichiometry Reaction Calculator:
 * Given a balanced reaction and masses/moles of reactants, calculates:
 * - Limiting reactant
 * - Excess reactant remaining
 * - Theoretical yield of all products
 */
export function calculateStoichiometry(balancedReaction, givenInputs = {}) {
  // givenInputs: { [formula]: { amount: number, unit: 'g'|'mol'|'L' } }
  const { reactants, products } = balancedReaction;

  const reactantData = reactants.map(r => {
    const mm = calculateMolarMass(r.formula).molarMass;
    const input = givenInputs[r.formula] || { amount: 0, unit: 'g' };
    let moles = 0;
    if (input.unit === 'mol') moles = input.amount;
    else if (input.unit === 'g') moles = mm > 0 ? input.amount / mm : 0;
    else if (input.unit === 'L') moles = input.amount / 22.414; // STP gas

    return {
      formula: r.formula,
      coeff: r.coeff,
      molarMass: mm,
      inputAmount: input.amount,
      inputUnit: input.unit,
      molesAvailable: moles,
      reactionExtents: r.coeff > 0 ? moles / r.coeff : 0,
    };
  });

  // Find limiting reactant (lowest reaction extent > 0)
  const activeReactants = reactantData.filter(r => r.molesAvailable > 0);
  let limiting = null;
  if (activeReactants.length > 0) {
    limiting = activeReactants.reduce((min, cur) => cur.reactionExtents < min.reactionExtents ? cur : min, activeReactants[0]);
  }

  const extent = limiting ? limiting.reactionExtents : 0;

  // Calculate product theoretical yields
  const productYields = products.map(p => {
    const mm = calculateMolarMass(p.formula).molarMass;
    const molesProduced = p.coeff * extent;
    const gramsProduced = molesProduced * mm;
    const litersProduced = molesProduced * 22.414;
    return {
      formula: p.formula,
      coeff: p.coeff,
      molarMass: mm,
      moles: molesProduced,
      grams: gramsProduced,
      litersSTP: litersProduced,
      molecules: molesProduced * 6.02214076e23,
    };
  });

  // Calculate excess reactants left over
  const excess = reactantData.map(r => {
    const molesUsed = r.coeff * extent;
    const molesRemaining = Math.max(0, r.molesAvailable - molesUsed);
    const gramsRemaining = molesRemaining * r.molarMass;
    return {
      formula: r.formula,
      molesUsed,
      molesRemaining,
      gramsRemaining,
      isLimiting: limiting?.formula === r.formula,
    };
  });

  return {
    limitingReactant: limiting ? limiting.formula : 'None specified',
    extentOfReaction: extent,
    productYields,
    excessAnalysis: excess,
  };
}
