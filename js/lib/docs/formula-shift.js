/* ============================================================
   Keep formulas pointing at the same cells when rows or columns are
   inserted or deleted, the way spreadsheets do. A reference to a
   deleted cell becomes #REF!; a range loses the deleted line.
   ============================================================ */

import { colToIndex, indexToCol } from './formula.js';

const REF = /((?:'(?:[^']|'')+'|[A-Za-z_][\w.]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?::(\$?)([A-Za-z]{1,3})(\$?)(\d+))?(?![\w(])/g;

/**
 * @param {string} f formula without "="
 * @param {{ axis: 'row'|'col', at: number, delta: 1|-1, sheetName: string, own: boolean }} change
 *   `own` is true when the formula lives on the sheet being changed.
 */
export function shiftFormula(f, { axis, at, delta, sheetName, own }) {
  // Only rewrite outside string literals.
  return String(f).split(/("(?:[^"]|"")*")/).map((part, i) => (i % 2 ? part : part.replace(REF, (m, prefix, d1, c1, d2, r1, d3, c2, d4, r2) => {
    const target = prefix ? prefix.slice(0, -1).replace(/^'|'$/g, '').replace(/''/g, "'") : null;
    const applies = target ? target.toLowerCase() === String(sheetName).toLowerCase() : own;
    if (!applies) return m;
    const get = (c, r) => (axis === 'row' ? +r - 1 : colToIndex(c));
    const put = (c, r, v) => (axis === 'row' ? [c, v + 1] : [indexToCol(v), r]);
    const a = get(c1, r1);
    if (c2 === undefined) {
      if (delta < 0 && a === at) return '#REF!';
      const v = a >= at ? a + delta : a;
      const [cc, rr] = put(c1, r1, v);
      return `${prefix || ''}${d1}${cc}${d2}${rr}`;
    }
    let b = get(c2, r2);
    let lo = Math.min(a, b), hi = Math.max(a, b);
    if (delta > 0) { if (lo >= at) lo += 1; if (hi >= at) hi += 1; }
    else {
      if (lo === at && hi === at) return '#REF!';
      if (lo > at) lo -= 1;
      if (hi >= at) hi -= 1;
    }
    const [ca, ra] = put(c1, r1, lo);
    const [cb, rb] = put(c2, r2, hi);
    return `${prefix || ''}${d1}${ca}${d2}${ra}:${d3}${cb}${d4}${rb}`;
  }))).join('');
}
