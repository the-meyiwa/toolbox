// Shared model for Icecat spec sheets. No inferred prices, ratings, or winners.
export const DEVICE_CATEGORIES = [
  ['all', 'All devices'], ['smartphones', 'Smartphones & tablets'],
  ['laptops', 'Laptops & PCs'], ['monitors', 'Monitors'],
  ['keyboards-mice', 'Keyboards, mice & mousepads'], ['accessories', 'Chargers, stands & gadgets'],
  ['tvs', 'TVs & entertainment'], ['appliances', 'Home appliances'],
].map(([id, label]) => ({ id, label }));

const plain = value => String(value ?? '').replace(/<[^>]*>/g, '').trim();
export function normalizeIcecat(data, now = new Date().toISOString()) {
  const info = data?.GeneralInfo;
  if (!info?.IcecatId || !/^\d+$/.test(String(info.IcecatId))) throw new Error('Invalid product sheet');
  let sourceUrl = 'https://icecat.biz/';
  let hasSourceSheet = false;
  try {
    const page = new URL(data.CatalogObjectCloud?.ProductPage?.URL);
    if (page.protocol === 'https:' && ['icecat.biz', 'coc.icecat.biz'].includes(page.hostname) && !page.username && !page.password) {
      sourceUrl = page.href; hasSourceSheet = true;
    }
  } catch { /* Some catalog entitlements do not include a public permalink. */ }
  const categoryName = plain(info.Category?.Name?.Value || info.Category?.Name);
  const category = [
    ['smartphones', /smartphone|mobile phone|tablet/i], ['laptops', /notebook|laptop|desktop|workstation|all.in.one pc/i],
    ['monitors', /monitor|computer display/i], ['keyboards-mice', /keyboard|mice|mouse|mousepad/i],
    ['tvs', /television|tv|projector|soundbar/i],
    ['appliances', /refrigerator|washing|washer|dryer|vacuum|dishwash|microwave|oven|freezer|air condition|appliance|coffee|kettle|blender|air purif/i],
  ].find(([, match]) => match.test(categoryName))?.[0] || 'accessories';
  const sections = (data.FeaturesGroups || []).map(group => ({
    id: String(group.FeatureGroup?.ID || group.ID),
    name: plain(group.FeatureGroup?.Name?.Value || 'Specifications'),
    rows: (group.Features || []).map(f => ({
      id: String(f.Feature?.ID || f.CategoryFeatureId || f.ID),
      key: plain(f.Feature?.Name?.Value || 'Specification'),
      value: plain(f.PresentationValue ?? f.LocalValue ?? f.Value),
      raw: plain(f.RawValue ?? f.Value ?? f.PresentationValue),
      unit: String(f.Feature?.Measure?.ID || ''),
      description: plain(f.Description),
    })).filter(f => f.value !== ''),
  })).filter(group => group.rows.length);
  return {
    id: `icecat-${info.IcecatId}`, name: plain(info.Title || info.ProductName || info.BrandPartCode),
    brand: plain(info.Brand), model: plain(info.BrandPartCode), category, categoryName,
    source: 'Icecat', sourceUrl, hasSourceSheet,
    fetchedAt: now, sections,
  };
}

export class DeviceSpecsProvider {
  static getCategories() { return DEVICE_CATEGORIES; }
  static async status(signal) {
    const res = await fetch('/api/devices/status', { signal });
    if (!res.ok) throw new Error('The device catalog is unavailable. Please try again.');
    return res.json();
  }
  static async lookup(fields, signal) {
    const params = new URLSearchParams();
    for (const key of ['brand', 'model', 'gtin', 'icecatId']) {
      if (fields[key]?.trim()) params.set(key, fields[key].trim());
    }
    let res;
    try { res = await fetch(`/api/devices/lookup?${params}`, { signal }); }
    catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Could not reach the device catalog. Check your connection and try again.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.device) throw new Error(body.error || 'The spec sheet could not be loaded. Please try again.');
    return body.device;
  }
  static compareDevices(devices = []) {
    const unique = [...new Map(devices.filter(Boolean).map(d => [d.id, d])).values()].slice(0, 4);
    const groups = new Map();
    unique.forEach(d => d.sections.forEach(s => {
      if (!groups.has(s.id)) groups.set(s.id, { name: s.name, rows: new Map() });
      s.rows.forEach(r => groups.get(s.id).rows.set(r.id, r));
    }));
    const sections = [...groups].map(([id, group]) => ({ id, name: group.name,
      rows: [...group.rows].map(([featureId, feature]) => {
        const entries = unique.map(d => d.sections.find(s => s.id === id)?.rows.find(r => r.id === featureId));
        const comparable = entries.map(r => r ? `${r.raw}\u0000${r.unit}` : null);
        return { key: feature.key, description: feature.description,
          values: entries.map(r => r?.value ?? '—'), isDifferent: new Set(comparable).size > 1 };
      }),
    }));
    return { devices: unique, sections };
  }
  static exportMarkdown(selected) {
    const { devices, sections } = this.compareDevices(selected);
    if (!devices.length) return '';
    const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
    let md = '# Tech Device Comparisons\n\nPowered by Voltix\n\n';
    devices.forEach(d => { md += `- ${cell(d.name)} — [Icecat ${d.id}](${d.sourceUrl}), retrieved ${d.fetchedAt}\n`; });
    for (const section of sections) {
      md += `\n## ${cell(section.name)}\n\n| Specification | ${devices.map(d => cell(d.name)).join(' | ')} |\n| --- | ${devices.map(() => '---').join(' | ')} |\n`;
      section.rows.forEach(r => { md += `| ${cell(r.key)} | ${r.values.map(cell).join(' | ')} |\n`; });
    }
    return md;
  }
  static exportCsv(selected) {
    const { devices, sections } = this.compareDevices(selected);
    if (!devices.length) return '';
    const cell = s => {
      let text = String(s ?? '');
      if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [['Section', 'Specification', ...devices.map(d => d.name)],
      ['Source', 'Spec sheet', ...devices.map(d => d.sourceUrl)],
      ['Source', 'Record ID', ...devices.map(d => d.id)],
      ['Source', 'Retrieved', ...devices.map(d => d.fetchedAt)],
      ['Attribution', 'Powered by Voltix', ...devices.map(() => 'Icecat specifications')]];
    sections.forEach(s => s.rows.forEach(r => rows.push([s.name, r.key, ...r.values])));
    return rows.map(r => r.map(cell).join(',')).join('\r\n');
  }
}
