/* ============================================================
   TOOLBOX — Instant unit conversion

   "Convert 100 km to miles", "98.6 °F in Celsius", "how many MB in
   2.5 GB". Exact factors, no model. Returns null for anything it is
   not sure of (an unknown unit, two different kinds of unit), and
   the message goes on to the model lanes.
   ============================================================ */

// Each unit: names (singular, plural), the spellings people type, and its size in the base unit.
const U = (kind, names, factor, ...aliases) => ({ kind, names, factor, aliases });

const UNITS = [
  U('length', ['millimetre', 'millimetres'], 0.001, 'mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'),
  U('length', ['centimetre', 'centimetres'], 0.01, 'cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'),
  U('length', ['metre', 'metres'], 1, 'm', 'meter', 'meters', 'metre', 'metres'),
  U('length', ['kilometre', 'kilometres'], 1000, 'km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'),
  U('length', ['inch', 'inches'], 0.0254, 'in', 'inch', 'inches', '"'),
  U('length', ['foot', 'feet'], 0.3048, 'ft', 'foot', 'feet', "'"),
  U('length', ['yard', 'yards'], 0.9144, 'yd', 'yds', 'yard', 'yards'),
  U('length', ['mile', 'miles'], 1609.344, 'mi', 'mile', 'miles'),
  U('length', ['nautical mile', 'nautical miles'], 1852, 'nmi', 'nautical mile', 'nautical miles'),

  U('mass', ['milligram', 'milligrams'], 1e-6, 'mg', 'milligram', 'milligrams'),
  U('mass', ['gram', 'grams'], 0.001, 'g', 'gram', 'grams', 'gramme', 'grammes'),
  U('mass', ['kilogram', 'kilograms'], 1, 'kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'),
  U('mass', ['tonne', 'tonnes'], 1000, 't', 'tonne', 'tonnes', 'metric ton', 'metric tons'),
  U('mass', ['pound', 'pounds'], 0.45359237, 'lb', 'lbs', 'pound', 'pounds'),
  U('mass', ['ounce', 'ounces'], 0.028349523125, 'oz', 'ounce', 'ounces'),
  U('mass', ['stone', 'stone'], 6.35029318, 'st', 'stone'),

  U('area', ['square millimetre', 'square millimetres'], 1e-6, 'mm2', 'mm²', 'sq mm', 'square millimetre', 'square millimetres', 'square millimeter', 'square millimeters'),
  U('area', ['square centimetre', 'square centimetres'], 1e-4, 'cm2', 'cm²', 'sq cm', 'square centimetre', 'square centimetres', 'square centimeter', 'square centimeters'),
  U('area', ['square metre', 'square metres'], 1, 'm2', 'm²', 'sq m', 'sqm', 'square metre', 'square metres', 'square meter', 'square meters'),
  U('area', ['square kilometre', 'square kilometres'], 1e6, 'km2', 'km²', 'sq km', 'square kilometre', 'square kilometres', 'square kilometer', 'square kilometers'),
  U('area', ['square foot', 'square feet'], 0.09290304, 'ft2', 'ft²', 'sq ft', 'sqft', 'square foot', 'square feet'),
  U('area', ['square yard', 'square yards'], 0.83612736, 'yd2', 'yd²', 'sq yd', 'square yard', 'square yards'),
  U('area', ['square mile', 'square miles'], 2589988.110336, 'mi2', 'mi²', 'sq mi', 'square mile', 'square miles'),
  U('area', ['hectare', 'hectares'], 10000, 'ha', 'hectare', 'hectares'),
  U('area', ['acre', 'acres'], 4046.8564224, 'acre', 'acres'),

  U('volume', ['millilitre', 'millilitres'], 0.001, 'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'),
  U('volume', ['litre', 'litres'], 1, 'l', 'litre', 'litres', 'liter', 'liters'),
  U('volume', ['cubic metre', 'cubic metres'], 1000, 'm3', 'm³', 'cubic metre', 'cubic metres', 'cubic meter', 'cubic meters'),
  U('volume', ['cubic foot', 'cubic feet'], 28.316846592, 'ft3', 'ft³', 'cubic foot', 'cubic feet', 'cu ft'),
  U('volume', ['US gallon', 'US gallons'], 3.785411784, 'gal', 'gallon', 'gallons', 'us gallon', 'us gallons'),
  U('volume', ['US pint', 'US pints'], 0.473176473, 'pt', 'pint', 'pints'),
  U('volume', ['US cup', 'US cups'], 0.2365882365, 'cup', 'cups'),

  U('speed', ['metre per second', 'metres per second'], 1, 'm/s', 'mps', 'metres per second', 'meters per second'),
  U('speed', ['kilometre per hour', 'kilometres per hour'], 1 / 3.6, 'km/h', 'kmh', 'kph', 'kmph', 'km/hr', 'kilometres per hour', 'kilometers per hour'),
  U('speed', ['mile per hour', 'miles per hour'], 0.44704, 'mph', 'mi/h', 'miles per hour'),
  U('speed', ['knot', 'knots'], 1852 / 3600, 'kn', 'kt', 'kts', 'knot', 'knots'),

  U('data', ['byte', 'bytes'], 1, 'byte', 'bytes'),
  U('data', ['kilobyte', 'kilobytes'], 1e3, 'kb', 'kilobyte', 'kilobytes'),
  U('data', ['megabyte', 'megabytes'], 1e6, 'mb', 'megabyte', 'megabytes'),
  U('data', ['gigabyte', 'gigabytes'], 1e9, 'gb', 'gigabyte', 'gigabytes'),
  U('data', ['terabyte', 'terabytes'], 1e12, 'tb', 'terabyte', 'terabytes'),
];

const TEMP = {
  c: { name: '°C', to: (v) => v, from: (v) => v },
  f: { name: '°F', to: (v) => (v - 32) * 5 / 9, from: (v) => v * 9 / 5 + 32 },
  k: { name: 'K', to: (v) => v - 273.15, from: (v) => v + 273.15 },
};
const TEMP_ALIAS = { c: 'c', '°c': 'c', 'º c': 'c', celsius: 'c', centigrade: 'c', f: 'f', '°f': 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' };

const BY_ALIAS = new Map();
for (const u of UNITS) for (const a of u.aliases) if (!BY_ALIAS.has(a)) BY_ALIAS.set(a, u);

const find = (raw) => BY_ALIAS.get(String(raw).trim().toLowerCase().replace(/\s+/g, ' ').replace(/^degrees? /, '')) || null;

function number(n) {
  if (!Number.isFinite(n)) return null;
  const r = Number(n.toPrecision(7));
  if (Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-9)) return null;
  return r.toLocaleString('en-US', { maximumFractionDigits: 6 });
}
const label = (u, v) => u.names[Math.abs(v) === 1 ? 0 : 1];

const NUM = '(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))';
const UNIT = '([a-z°º²³/"\' ]+?)';

/**
 * Converts "100 km to miles", "98.6 °F in celsius", "how many metres is 40 feet".
 * Returns { kind: 'units', text } or null.
 */
export function convertUnits(clean) {
  let value;
  let from;
  let to;
  // "convert 100 km to miles", "100 km in miles", "100km to mi"
  let m = new RegExp(`^(?:convert\\s+)?${NUM}\\s*${UNIT}\\s+(?:to|in|into|as)\\s+${UNIT}$`).exec(clean);
  if (m) [, value, from, to] = m;
  // "how many metres is 40 feet", "how many MB in 2.5 GB", "how many km in a mile"
  if (!m) {
    m = new RegExp(`^how many\\s+${UNIT}\\s+(?:are there\\s+)?(?:in|is|are|make up|equals?)\\s+(?:(?:a|an|one)\\s+|${NUM}\\s*)${UNIT}$`).exec(clean);
    if (m) { to = m[1]; value = m[2] ?? '1'; from = m[3]; }
  }
  if (!m) return null;
  value = Number(value);
  if (!Number.isFinite(value)) return null;
  from = from.replace(/\s+/g, ' ').trim();
  to = to.replace(/\s+/g, ' ').trim();

  const tf = TEMP_ALIAS[from.replace(/^degrees? /, '')];
  const tt = TEMP_ALIAS[to.replace(/^degrees? /, '')];
  if (tf && tt) {
    if (tf === tt) return null;
    const out = TEMP[tt].from(TEMP[tf].to(value));
    const [a, b] = [number(value), number(out)];
    return a && b ? { kind: 'units', text: `${a} ${TEMP[tf].name} = **${b} ${TEMP[tt].name}**` } : null;
  }
  const a = find(from);
  const b = find(to);
  if (!a || !b || a.kind !== b.kind || a === b) return null;
  const out = value * a.factor / b.factor;
  const [x, y] = [number(value), number(out)];
  if (!x || !y) return null;
  let text = `${x} ${label(a, value)} = **${y} ${label(b, out)}**`;
  if (a.kind === 'data') {
    // Storage is sold in thousands; memory is counted in 1,024s. Say which one this is.
    const binary = number(value * 1024 ** (['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'].indexOf(a.names[0]) - ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'].indexOf(b.names[0])));
    text += ` (1,000 per step, as drives and data plans count). In binary units, which memory and file sizes use, it is ${binary} ${label(b, out)}.`;
  }
  return { kind: 'units', text };
}
