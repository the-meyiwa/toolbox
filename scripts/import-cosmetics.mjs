/** Import a public Open Beauty Facts TSV export, retaining only public label fields.
 * Download: https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz
 * Usage: node scripts/import-cosmetics.mjs <download.csv.gz> [limit=4000]
 * This never contacts a service, copies contributor identities, or invents ingredients.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BRAND_ROWS } from '../js/lib/cosmetics/brands.js';
import { INCI } from '../js/lib/cosmetics/inci.js';

export function* parseTSV(text) {
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && (quoted || !value)) {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (ch === '\t' || ch === '\n')) {
      row.push(value.replace(/\r$/, '')); value = '';
      if (ch === '\n') { yield row; row = []; }
    } else value += ch;
  }
  if (value || row.length) { row.push(value); yield row; }
}

const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const brandIds = new Map(BRAND_ROWS.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
  const [id, name] = l.split(' | '); return [norm(name), id.trim()];
}));
const names = new Set(Object.keys(INCI).map(norm));
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function selectProducts(text, limit) {
  const iterator = parseTSV(text), header = iterator.next().value;
  const pos = Object.fromEntries(header.map((key, i) => [key, i]));
  const buckets = new Map();
  for (const row of iterator) {
    const get = key => row[pos[key]] || '';
    const code = get('code'), name = clean(get('product_name'), 220);
    const brand = get('brands').split(',').map(s => brandIds.get(norm(s))).find(Boolean);
    const ingredients = clean(get('ingredients_text'), 6000);
    if (!/^\d{8,14}$/.test(code) || !brand || name.length < 3 || !ingredients || get('data_quality_errors_tags')) continue;
    // Reject likely OCR prose, advertisements, URLs and truncated/incoherent labels.
    if (/[<>]|https?:\/\/|\bwww\.|@/.test(name + ingredients) || ingredients.length >= 6000) continue;
    const list = ingredients.replace(/^ingredients\s*:?\s*/i, '').split(/[,;•·]\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
    if (list.length < 3 || list.length > 90 || list.some(n => n.length > 160)) continue;
    const known = list.filter(n => names.has(norm(n)) || n.split(/[()/]/).some(part => names.has(norm(part)))).length;
    if (known / list.length < .8) continue;
    const record = {
      code, brandId: brand, product_name: name, quantity: clean(get('quantity'), 100),
      categories: clean(get('categories_en') || get('categories'), 700),
      ingredients_text: ingredients, countries: clean(get('countries_en'), 240),
      modified: /^\d{4}-\d{2}-\d{2}T/.test(get('last_modified_datetime')) ? get('last_modified_datetime').slice(0, 10) : null,
    };
    if (!buckets.has(brand)) buckets.set(brand, []);
    buckets.get(brand).push(record);
  }
  // Round-robin across brands prevents a large single-brand catalogue dominating.
  const lists = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([, rows]) => rows.sort((a, b) => (b.modified || '').localeCompare(a.modified || '') || a.code.localeCompare(b.code)));
  const selected = [], seen = new Set();
  for (let i = 0; selected.length < limit && lists.some(rows => i < rows.length); i++) {
    for (const rows of lists) {
      const p = rows[i];
      if (!p || selected.length >= limit || seen.has(p.code)) continue;
      seen.add(p.code); selected.push(p);
    }
  }
  return selected.sort((a, b) => a.brandId.localeCompare(b.brandId) || a.product_name.localeCompare(b.product_name));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const input = process.argv[2];
  if (!input) throw new Error('Supply a downloaded Open Beauty Facts .csv.gz file.');
  const source = fs.readFileSync(input), text = zlib.gunzipSync(source).toString('utf8');
  const products = selectProducts(text, Math.max(1, Math.min(20000, Number(process.argv[3]) || 4000)));
  const data = {
    source: 'Open Beauty Facts', url: 'https://world.openbeautyfacts.org',
    download: 'https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz',
    license: 'ODbL-1.0', licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    contentsLicense: 'https://opendatacommons.org/licenses/dbcl/1-0/',
    imported: new Date().toISOString().slice(0, 10), sha256: crypto.createHash('sha256').update(source).digest('hex'),
    selection: 'Known brands; barcode, product name and label required; at least 80% of label entries match the ingredient dictionary; source quality errors excluded. Community labels, not manufacturer verification.',
    products,
  };
  fs.writeFileSync(new URL('../js/lib/cosmetics/products-openbeautyfacts.json', import.meta.url), JSON.stringify(data) + '\n');
  console.log(JSON.stringify({ products: products.length, brands: new Set(products.map(p => p.brandId)).size, bytes: JSON.stringify(data).length }));
}
