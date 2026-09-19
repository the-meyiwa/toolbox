import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIcecat, DeviceSpecsProvider as Specs, DEVICE_CATEGORIES } from '../../js/lib/device-specs-provider.js';
import { handleDeviceRequest } from '../../server-device-specs.js';

const fixture = (id = 1, category = 'Computer monitors', value = '60', presentation = '60 Hz') => ({
  GeneralInfo: { IcecatId: id, Title: `Test display ${id}`, Brand: 'Test', BrandPartCode: `D${id}`, Category: { Name: { Value: category } } },
  FeaturesGroups: [{ FeatureGroup: { ID: 10, Name: { Value: 'Display' } }, Features: [
    { Feature: { ID: 20, Name: { Value: 'Refresh rate' }, Measure: { ID: 30 } }, Value: value, RawValue: value, PresentationValue: presentation },
  ] }],
});

test('normalizes provider category, feature identities, source and retrieval date without inventing data', () => {
  for (const [category, expected] of [['Smartphones', 'smartphones'], ['Notebooks', 'laptops'], ['Computer monitors', 'monitors'], ['Mouse pads', 'keyboards-mice'], ['Wireless chargers', 'accessories'], ['Televisions', 'tvs'], ['Washing machines', 'appliances']]) {
    const d = normalizeIcecat(fixture(1, category), '2026-09-19T00:00:00Z');
    assert.equal(d.category, expected); assert.equal(d.sections[0].rows[0].value, '60 Hz');
    assert.equal(d.fetchedAt, '2026-09-19T00:00:00Z'); assert.equal(d.price, undefined);
    assert.match(d.sourceUrl, /icecat\.biz/);
  }
  assert.equal(DEVICE_CATEGORIES.length, 8);
  assert.throws(() => normalizeIcecat({}));
  const source = fixture(); source.CatalogObjectCloud = { ProductPage: { URL: 'https://coc.icecat.biz/test-sheet' } };
  assert.equal(normalizeIcecat(source).sourceUrl, 'https://coc.icecat.biz/test-sheet');
  source.CatalogObjectCloud.ProductPage.URL = 'javascript:alert(1)';
  assert.equal(normalizeIcecat(source).hasSourceSheet, false);
});

test('comparison uses raw values and units, preserves missing fields, deduplicates and limits devices', () => {
  const a = normalizeIcecat(fixture(1)); const b = normalizeIcecat(fixture(2, 'Computer monitors', '60', '60.0 Hz'));
  assert.equal(Specs.compareDevices([a, b]).sections[0].rows[0].isDifferent, false);
  b.sections[0].rows[0].unit = 'different';
  assert.equal(Specs.compareDevices([a, b]).sections[0].rows[0].isDifferent, true);
  b.sections = [];
  assert.deepEqual(Specs.compareDevices([a, b]).sections[0].rows[0].values, ['60 Hz', '—']);
  assert.equal(Specs.compareDevices([a, a]).devices.length, 1);
  assert.equal(Specs.compareDevices([1, 2, 3, 4, 5].map(i => normalizeIcecat(fixture(i)))).devices.length, 4);
});

test('exports source attribution, escaped cells and spreadsheet-safe values', () => {
  const a = normalizeIcecat(fixture()); a.name = '=HYPERLINK("bad")'; a.sections[0].rows[0].value = '60 | Hz';
  assert.match(Specs.exportCsv([a]), /"'=HYPERLINK/);
  assert.match(Specs.exportCsv([a]), /Powered by Voltix/);
  assert.match(Specs.exportMarkdown([a]), /60 \\\| Hz/);
  assert.equal(Specs.exportCsv([]), '');
});

async function request(query, method = 'GET') {
  let status; let body;
  const response = { writeHead(s) { status = s; }, end(s) { body = JSON.parse(s); } };
  const handled = await handleDeviceRequest({ method }, response, new URL(`http://localhost${query}`));
  return { handled, status, body };
}

test('API validates identifiers, protects credentials and normalizes successful upstream response', async t => {
  const oldName = process.env.ICECAT_USERNAME; const oldToken = process.env.ICECAT_API_TOKEN;
  t.after(() => { for (const [k, v] of [['ICECAT_USERNAME', oldName], ['ICECAT_API_TOKEN', oldToken]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  delete process.env.ICECAT_USERNAME; delete process.env.ICECAT_API_TOKEN;
  assert.equal((await request('/api/devices/status')).body.configured, false);
  assert.equal((await request('/api/devices/lookup?icecatId=1')).status, 503);
  assert.equal((await request('/api/devices/lookup?brand=HP')).status, 400);
  assert.equal((await request('/api/devices/lookup?gtin=123')).status, 400);
  assert.equal((await request('/api/devices/lookup?icecatId=1&gtin=12345678')).status, 400);
  assert.equal((await request('/api/devices/status', 'POST')).status, 405);
  process.env.ICECAT_USERNAME = 'test-account'; process.env.ICECAT_API_TOKEN = 'secret-token';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.hostname, 'live.icecat.biz'); assert.equal(url.searchParams.get('ProductCode'), 'A#12');
    assert.equal(options.headers['api-token'], 'secret-token'); assert.ok(!url.href.includes('secret-token'));
    return new Response(JSON.stringify({ data: fixture() }));
  });
  const result = await request('/api/devices/lookup?brand=HP&model=A%2312');
  assert.equal(result.status, 200); assert.equal(result.body.device.id, 'icecat-1');
  assert.ok(!JSON.stringify(result.body).includes('secret-token'));
  for (const [upstream, expected] of [[429, 429], [403, 502], [404, 404], [500, 502]]) {
    globalThis.fetch = async () => new Response('{}', { status: upstream });
    assert.equal((await request('/api/devices/lookup?icecatId=1')).status, expected);
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ statusCode: 4, message: 'internal credentials detail' }));
  assert.equal((await request('/api/devices/lookup?icecatId=1')).status, 404);
  globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
  assert.equal((await request('/api/devices/lookup?icecatId=1')).status, 504);
});
