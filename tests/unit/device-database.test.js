/* ============================================================
   Tech Device Comparisons database: every category loads, ids are
   unique, every value matches its schema field, and each category
   scores its devices and writes a head-to-head verdict.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

const db = await import('../../js/lib/devices/db.js');

test('every category is grouped exactly once', () => {
  const grouped = db.CATEGORY_GROUPS.flatMap(g => g.cats);
  assert.deepEqual([...grouped].sort(), [...db.CATEGORY_ORDER].sort());
  assert.equal(new Set(grouped).size, grouped.length);
  for (const c of db.CATEGORY_ORDER) assert.ok(db.CATEGORIES[c], `${c} has a schema`);
});

test('device data matches the schema', async () => {
  let total = 0;
  for (const cat of db.CATEGORY_ORDER) {
    const ids = new Set();   // ids are unique within a category (a Surface Pro is both a tablet and a laptop)
    const data = await db.loadCategory(cat);
    const fields = new Map(db.CATEGORIES[cat].fields.map(f => [f.key, f]));
    assert.ok(data.devices.length >= 15, `${cat} has devices`);
    total += data.devices.length;
    for (const d of data.devices) {
      assert.ok(!ids.has(d.id), `duplicate id ${d.id} in ${cat}`);
      ids.add(d.id);
      assert.ok(d.name && d.brand, `${d.id} has a name and brand`);
      assert.match(d.released || '', /^\d{4}(-\d{2})?$/, `${d.id} release date`);
      for (const [k, v] of Object.entries(d)) {
        if (k.startsWith('_') || ['id', 'name', 'category'].includes(k) || v == null) continue;
        const f = fields.get(k);
        assert.ok(f, `${cat}/${d.id}: "${k}" is not a ${cat} field`);
        if (f.type === 'num') assert.equal(typeof v, 'number', `${d.id}.${k} is a number`);
        if (f.type === 'bool') assert.equal(typeof v, 'boolean', `${d.id}.${k} is true/false`);
        if (f.type === 'list') assert.ok(Array.isArray(v), `${d.id}.${k} is a list`);
      }
    }
  }
  assert.ok(total >= 2000, `${total} devices`);
});

test('new categories score and compare', async () => {
  const pairs = [
    ['evs', 'byd-seal-awd', 'tesla-model-3-lr-awd-2024'], ['gpus', 'gtx-1080-ti', 'rx-5700-xt'], ['cpus', 'core-i7-2600k', 'ryzen-7-3700x'],
    ['powerbanks', 'anker-737-24k', 'ecoflow-river-2'], ['printers', 'epson-et-2850', 'brother-hl-l2350dw'], ['guitars', 'gibson-lp-standard-50s', 'epiphone-lp-standard-50s'],
    ['inverters', 'deye-sun-5k-sg03lp1', 'growatt-spf-5000-es'], ['ups', 'apc-br1500ms2', 'cyberpower-cp1500pfclcd'], ['coffee', 'breville-bambino', 'gaggia-classic-pro'],
  ];
  for (const [cat, a, b] of pairs) {
    const data = await db.loadCategory(cat);
    const A = data.byId.get(a), B = data.byId.get(b);
    assert.ok(A && B, `${a} and ${b} exist`);
    assert.ok(A._score != null && B._score != null, `${cat} scores`);
    const v = db.verdicts(cat, A, B);
    assert.ok(v.tech.headline, `${cat} verdict`);
  }
  const evs = await db.loadCategory('evs');
  assert.equal(db.parse.evRange(evs.byId.get('xiaomi-su7')), Math.round(700 * 0.75));
});
