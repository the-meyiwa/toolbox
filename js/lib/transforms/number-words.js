/* ============================================================
   Numbers to words, for cheques, invoices and contracts.

   Short scale (billion = 10^9), British "and" optional, decimals read
   digit by digit or as a currency's minor unit. Works on strings via
   BigInt so large amounts are exact.
   ============================================================ */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion'];

export const CURRENCIES = {
  none: null,
  USD: ['dollar', 'dollars', 'cent', 'cents'], EUR: ['euro', 'euros', 'cent', 'cents'], GBP: ['pound', 'pounds', 'penny', 'pence'],
  NGN: ['naira', 'naira', 'kobo', 'kobo'], GHS: ['cedi', 'cedis', 'pesewa', 'pesewas'], KES: ['shilling', 'shillings', 'cent', 'cents'],
  ZAR: ['rand', 'rand', 'cent', 'cents'], INR: ['rupee', 'rupees', 'paisa', 'paise'], CAD: ['dollar', 'dollars', 'cent', 'cents'],
  AUD: ['dollar', 'dollars', 'cent', 'cents'], JPY: ['yen', 'yen', null, null], CNY: ['yuan', 'yuan', 'fen', 'fen'],
};

function under1000(n, and) {
  const h = Math.floor(n / 100); const r = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) {
    const t = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : '');
    parts.push(h && and ? `and ${t}` : t);
  }
  return parts.join(' ');
}

/** Whole number (string or bigint) to words. */
export function integerToWords(value, { and = true } = {}) {
  let n = BigInt(value);
  if (n === 0n) return 'zero';
  const neg = n < 0n; if (neg) n = -n;
  const groups = [];
  while (n > 0n) { groups.push(Number(n % 1000n)); n /= 1000n; }
  if (groups.length > SCALES.length) throw new Error('That number is too large to write out');
  const words = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    const isLastSmall = i === 0 && g < 100 && groups.length > 1 && and;
    words.push((isLastSmall ? 'and ' : '') + under1000(g, and) + (SCALES[i] ? ` ${SCALES[i]}` : ''));
  }
  return (neg ? 'minus ' : '') + words.join(' ');
}

const cap = (s, style) => (style === 'upper' ? s.toUpperCase() : style === 'title' ? s.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : style === 'sentence' ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * @param {string|number} input e.g. "1,234.56"
 * @param {{currency?: string, and?: boolean, style?: string, only?: boolean}} o
 */
export function numberToWords(input, { currency = 'none', and = true, style = 'sentence', only = false } = {}) {
  const raw = String(input).trim().replace(/[,\s_]/g, '').replace(/^\+/, '');
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error('Enter a number such as 1250 or 1,250.75');
  const neg = raw.startsWith('-');
  const [intPart, frac = ''] = raw.replace('-', '').split('.');
  const cur = CURRENCIES[currency];
  let out;
  if (cur) {
    const [one, many, minorOne, minorMany] = cur;
    const major = BigInt(intPart);
    const minor = minorOne ? Math.round(Number(`0.${frac || '0'}`) * 100) : 0;
    const carry = minor === 100 ? 1n : 0n;
    const m = major + carry; const c = minor === 100 ? 0 : minor;
    out = `${integerToWords(m, { and })} ${m === 1n ? one : many}`;
    if (c) out += `${and ? ' and' : ','} ${integerToWords(c, { and })} ${c === 1 ? minorOne : minorMany}`;
    if (only) out += ' only';
  } else {
    out = integerToWords(intPart, { and });
    if (frac) out += ` point ${[...frac].map((d) => ONES[Number(d)]).join(' ')}`;
  }
  return cap((neg ? 'minus ' : '') + out, style);
}

/** 21 → "twenty-first". */
export function ordinal(n) {
  const w = integerToWords(n, { and: false });
  const irregular = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
  return w.replace(/(\w+)$/, (last) => irregular[last] || (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`));
}

export function toRoman(n) {
  let v = Math.floor(Number(n));
  if (!(v > 0 && v < 4000)) throw new Error('Roman numerals cover 1 to 3999');
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [k, s] of map) while (v >= k) { out += s; v -= k; }
  return out;
}
