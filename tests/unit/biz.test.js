/* ============================================================
   Business & Finance Functions Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { money, num, pct, parseNum, months, toCSV } from '../../js/lib/biz.js';

test('Biz: money formatting handles normal and compact values', () => {
  assert.equal(money(100, 'USD'), '$100');
  assert.equal(money(1500, 'USD'), '$1,500');
  assert.equal(money(1000000, 'USD', { compact: true }), '$1M');
  assert.equal(money(NaN), '—');
});

test('Biz: num, pct, parseNum behave accurately', () => {
  assert.equal(num(1234.567, 2), '1,234.57');
  assert.equal(pct(15.456, 1), '15.5%');
  assert.equal(parseNum('$1,234.50'), 1234.5);
  assert.equal(parseNum('invalid', 42), 42);
});

test('Biz: months duration formatting', () => {
  assert.equal(months(6), '6 months');
  assert.equal(months(12), '1 year');
  assert.equal(months(18), '1y 6m');
  assert.equal(months(Infinity), 'indefinite');
  assert.equal(months(NaN), '—');
});

test('Biz: toCSV generates escaped comma-separated data', () => {
  const cols = ['Item', 'Price', 'Notes'];
  const rows = [
    ['Widget "A"', 10.5, 'Normal note'],
    ['Widget B', 20, 'Line 1\nLine 2'],
  ];
  const csv = toCSV(cols, rows);
  assert.ok(csv.includes('"Widget ""A"""'));
  assert.ok(csv.includes('"Line 1\nLine 2"'));
});

test('Biz: Margin & Markup financial equations', () => {
  const cost = 80;
  const markupPct = 25; // 25% markup
  const price = cost * (1 + markupPct / 100); // 100
  const profit = price - cost; // 20
  const marginPct = (profit / price) * 100; // 20%

  assert.equal(price, 100);
  assert.equal(profit, 20);
  assert.equal(marginPct, 20);
});

test('Biz: Compound Interest computation', () => {
  const principal = 10000;
  const rate = 0.05; // 5%
  const years = 10;
  const compoundFreq = 12; // monthly
  const monthlyContrib = 100;

  let balance = principal;
  const r = rate / compoundFreq;
  const totalMonths = years * compoundFreq;

  for (let i = 0; i < totalMonths; i++) {
    balance = balance * (1 + r) + monthlyContrib;
  }

  assert.ok(balance > principal + monthlyContrib * totalMonths);
  assert.ok(Math.abs(balance - 31959) < 200); // Approx ~32k
});

test('Biz: Loan Amortization formula (PMT)', () => {
  const loan = 200000;
  const annualRate = 0.06; // 6%
  const years = 30;
  const n = years * 12;
  const r = annualRate / 12;

  const monthlyPayment = (loan * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  assert.ok(Math.abs(monthlyPayment - 1199.10) < 1.0);
});

test('Biz: Break-Even analysis formula', () => {
  const fixedCosts = 50000;
  const unitPrice = 100;
  const variableCost = 60;
  const contributionMargin = unitPrice - variableCost; // 40
  const breakEvenUnits = fixedCosts / contributionMargin; // 1250
  const breakEvenRevenue = breakEvenUnits * unitPrice; // 125000

  assert.equal(breakEvenUnits, 1250);
  assert.equal(breakEvenRevenue, 125000);
});

test('Biz: NPV and IRR logic', () => {
  const cashFlows = [-1000, 300, 400, 500, 600]; // Initial + 4 periods
  const discountRate = 0.10; // 10%

  // NPV calculation
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + discountRate, t);
  }
  assert.ok(npv > 0); // Positive NPV

  // IRR root finder (Newton-Raphson or binary search)
  function calcNPV(rate) {
    return cashFlows.reduce((acc, val, t) => acc + val / Math.pow(1 + rate, t), 0);
  }

  let low = 0.0, high = 1.0;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (calcNPV(mid) > 0) low = mid;
    else high = mid;
  }
  const irr = (low + high) / 2;
  assert.ok(Math.abs(irr - 0.2489) < 0.01); // Approx 24.9%
});

test('Biz: Unit Economics (LTV, CAC, Payback)', () => {
  const cac = 150;
  const arpu = 50;
  const grossMargin = 0.80; // 80%
  const churnRate = 0.05; // 5% monthly churn

  const ltv = (arpu * grossMargin) / churnRate; // (50 * 0.8) / 0.05 = 800
  const ltvCacRatio = ltv / cac; // 800 / 150 = 5.33
  const paybackMonths = cac / (arpu * grossMargin); // 150 / 40 = 3.75

  assert.equal(ltv, 800);
  assert.ok(Math.abs(ltvCacRatio - 5.33) < 0.01);
  assert.equal(paybackMonths, 3.75);
});
