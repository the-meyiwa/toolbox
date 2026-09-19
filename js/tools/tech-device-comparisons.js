import { DeviceSpecsProvider as Specs } from '../lib/device-specs-provider.js';
import { copyText, showToast } from '../utils.js';

const STORE = 'toolbox_device_comparisons_v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    const devices = (Array.isArray(saved.devices) ? saved.devices : []).filter(d =>
      /^icecat-\d+$/.test(d?.id) && typeof d.name === 'string' && Array.isArray(d.sections) &&
      d.sections.every(s => Array.isArray(s.rows)) && /^https:\/\/(?:coc\.)?icecat\.biz\//.test(d.sourceUrl)).slice(0, 40);
    return { devices, selected: (Array.isArray(saved.selected) ? saved.selected : []).filter(id => devices.some(d => d.id === id)).slice(0, 4) };
  } catch { return { devices: [], selected: [] }; }
}

export default {
  render(container) {
    this.container = container;
    this.state = { ...load(), category: 'all', search: '', differences: false, busy: false, status: 'Checking live catalog…' };
    this.controller = new AbortController();
    this.renderUI();
    const signal = this.controller.signal;
    Specs.status(signal).then(result => {
      if (signal.aborted) return;
      this.state.status = result.configured ? 'Live spec sheets from Icecat. Availability depends on brand and catalog access.' : 'Live lookup is not connected yet. Saved spec sheets remain available.';
      this.updateStatus();
    }).catch(() => {
      if (signal.aborted) return;
      this.state.status = 'Live catalog is unavailable. You can still compare saved spec sheets.';
      this.updateStatus();
    });
  },
  destroy() { this.controller?.abort(); this.container = null; },
  updateStatus() { const el = this.container?.querySelector('#dc-status'); if (el) el.textContent = this.state.status; },
  save() {
    try { localStorage.setItem(STORE, JSON.stringify({ devices: this.state.devices, selected: this.state.selected })); }
    catch { this.state.status = 'These sheets are available for this session, but could not be saved on this device.'; }
  },
  selected() { return this.state.selected.map(id => this.state.devices.find(d => d.id === id)).filter(Boolean); },
  renderUI() {
    if (!this.container) return;
    const s = this.state;
    this.container.innerHTML = `<section class="device-compare">
      <header class="dc-header"><div><h2>Tech Device Comparisons</h2><p>Find exact spec sheets and compare up to four devices side by side.</p></div><span class="dc-brand">Powered by <strong>Voltix</strong></span></header>
      <p class="dc-status" id="dc-status" role="status">${esc(s.status)}</p>
      <form id="dc-lookup" class="dc-lookup">
        <label>Find by<select name="method" id="dc-method"><option value="model">Brand + model / part number</option><option value="gtin">Barcode (EAN / UPC / GTIN)</option><option value="icecatId">Icecat product ID</option></select></label>
        <label id="dc-brand-field">Brand<input name="brand" maxlength="150" placeholder="e.g. Logitech" required></label>
        <label><span id="dc-query-label">Exact model / part number</span><input name="query" maxlength="150" required placeholder="Manufacturer part number"></label>
        <button class="btn btn-primary" type="submit" id="dc-find">Find spec sheet</button>
      </form>
      <p class="dc-hint">Use the model or part number on the product label for the correct variant. Covers phones, computers, displays, TVs, appliances, chargers, MagSafe stands, mice, keyboards, mousepads and other gadgets where a sheet is available.</p>
      <div class="dc-library-bar"><label>Saved sheets<input id="dc-search" type="search" placeholder="Search name, brand or model" value="${esc(s.search)}"></label><label>Category<select id="dc-category">${Specs.getCategories().map(c => `<option value="${c.id}" ${s.category === c.id ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label></div>
      <div id="dc-library" class="dc-library"></div>
      <div class="dc-toolbar"><label><input id="dc-differences" type="checkbox" ${s.differences ? 'checked' : ''}> Show differences only</label><button class="btn btn-secondary btn-sm" id="dc-md" ${s.selected.length ? '' : 'disabled'}>Copy Markdown</button><button class="btn btn-secondary btn-sm" id="dc-csv" ${s.selected.length ? '' : 'disabled'}>Export CSV</button></div>
      <div id="dc-comparison" tabindex="0" role="region" aria-label="Device specification comparison" class="dc-table-wrap"></div>
      <p class="dc-hint">Specifications supplied by <a href="https://icecat.com/structured-data-content-users/" target="_blank" rel="noopener noreferrer">Icecat</a>. A dash means the source did not provide that field. Specs alone do not determine which device is best for you.</p>
    </section>`;
    this.renderLibrary(); this.renderComparison(); this.bindEvents();
  },
  renderLibrary() {
    const el = this.container?.querySelector('#dc-library');
    if (!el) return;
    const s = this.state;
    const devices = s.devices.filter(d => (s.category === 'all' || d.category === s.category) && `${d.name} ${d.brand} ${d.model}`.toLowerCase().includes(s.search.toLowerCase().trim()));
    el.innerHTML = devices.length ? devices.map(d => `<div class="dc-saved"><label><input type="checkbox" data-select="${esc(d.id)}" ${s.selected.includes(d.id) ? 'checked' : ''} ${!s.selected.includes(d.id) && s.selected.length >= 4 ? 'disabled' : ''}><span><strong>${esc(d.name)}</strong><small>${esc(d.categoryName)} · ${esc(d.model)}</small></span></label><button class="btn btn-sm" data-forget="${esc(d.id)}" aria-label="Forget ${esc(d.name)}">Forget</button></div>`).join('') : `<p class="dc-empty">${s.devices.length ? 'No saved sheets match these filters.' : 'No saved spec sheets yet. Look up your first device above.'}</p>`;
    el.querySelectorAll('[data-select]').forEach(input => input.addEventListener('change', () => {
      if (input.checked && s.selected.length < 4) s.selected.push(input.dataset.select);
      else s.selected = s.selected.filter(id => id !== input.dataset.select);
      this.save(); this.renderLibrary(); this.renderComparison(); this.updateExportButtons();
    }));
    el.querySelectorAll('[data-forget]').forEach(btn => btn.addEventListener('click', () => {
      s.devices = s.devices.filter(d => d.id !== btn.dataset.forget);
      s.selected = s.selected.filter(id => id !== btn.dataset.forget);
      this.save(); this.renderLibrary(); this.renderComparison(); this.updateExportButtons();
    }));
  },
  updateExportButtons() {
    for (const id of ['#dc-md', '#dc-csv']) this.container.querySelector(id).disabled = !this.state.selected.length;
    this.updateStatus();
  },
  renderComparison() {
    const el = this.container?.querySelector('#dc-comparison');
    if (!el) return;
    const { devices, sections } = Specs.compareDevices(this.selected());
    if (!devices.length) { el.innerHTML = '<p class="dc-empty">Select saved devices to compare, or look up a device to read its spec sheet.</p>'; return; }
    const visible = sections.map(s => ({ ...s, rows: s.rows.filter(r => !this.state.differences || r.isDifferent) })).filter(s => s.rows.length);
    el.innerHTML = `<table class="dc-table"><caption>${devices.length === 1 ? 'Device spec sheet' : `${devices.length} device comparison`}</caption><thead><tr><th scope="col">Specification</th>${devices.map(d => `<th scope="col"><strong>${esc(d.name)}</strong><small>${esc(d.brand)} · ${esc(d.model)}</small><a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">${d.hasSourceSheet ? 'Source sheet' : `Icecat record ${esc(d.id.replace('icecat-', ''))}`}</a><small>Retrieved ${esc(new Date(d.fetchedAt).toLocaleDateString())}</small><button class="btn btn-sm" data-remove="${esc(d.id)}" aria-label="Remove ${esc(d.name)} from comparison">Remove</button></th>`).join('')}</tr></thead><tbody>${visible.map(s => `<tr class="dc-section"><th colspan="${devices.length + 1}" scope="colgroup">${esc(s.name)}</th></tr>${s.rows.map(r => `<tr class="${r.isDifferent && devices.length > 1 ? 'dc-different' : ''}"><th scope="row" title="${esc(r.description)}">${esc(r.key)}</th>${r.values.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}`).join('') || `<tr><td colspan="${devices.length + 1}">No differing specifications.</td></tr>`}</tbody></table>`;
    el.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
      this.state.selected = this.state.selected.filter(id => id !== btn.dataset.remove);
      this.save(); this.renderLibrary(); this.renderComparison(); this.updateExportButtons();
    }));
  },
  bindEvents() {
    const root = this.container;
    const form = root.querySelector('#dc-lookup');
    root.querySelector('#dc-method').addEventListener('change', event => {
      const model = event.target.value === 'model';
      root.querySelector('#dc-brand-field').hidden = !model;
      form.elements.brand.required = model;
      root.querySelector('#dc-query-label').textContent = model ? 'Exact model / part number' : event.target.value === 'gtin' ? 'Barcode digits' : 'Icecat product ID';
      form.elements.query.placeholder = model ? 'Manufacturer part number' : 'Digits only';
      form.elements.query.value = '';
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.state.busy) return;
      const method = form.elements.method.value;
      const fields = method === 'model' ? { brand: form.elements.brand.value, model: form.elements.query.value } : { [method]: form.elements.query.value };
      const signal = this.controller.signal;
      this.state.busy = true;
      root.querySelector('#dc-find').disabled = true;
      this.state.status = 'Looking up the spec sheet…'; this.updateStatus();
      try {
        const device = await Specs.lookup(fields, signal);
        if (signal.aborted) return;
        this.state.devices = [device, ...this.state.devices.filter(d => d.id !== device.id)].slice(0, 40);
        if (!this.state.selected.includes(device.id) && this.state.selected.length < 4) this.state.selected.push(device.id);
        this.state.category = 'all'; this.state.search = '';
        this.state.status = this.state.selected.includes(device.id) ? `Loaded ${device.name}.` : `Saved ${device.name}. Remove a selected device to compare it (maximum four).`;
        this.save(); this.renderUI();
      } catch (error) {
        if (!signal.aborted) { this.state.status = error.message; this.updateStatus(); }
      } finally {
        if (!signal.aborted) { this.state.busy = false; this.container.querySelector('#dc-find').disabled = false; }
      }
    });
    root.querySelector('#dc-search').addEventListener('input', e => { this.state.search = e.target.value; this.renderLibrary(); });
    root.querySelector('#dc-category').addEventListener('change', e => { this.state.category = e.target.value; this.renderLibrary(); });
    root.querySelector('#dc-differences').addEventListener('change', e => { this.state.differences = e.target.checked; this.renderComparison(); });
    root.querySelector('#dc-md').addEventListener('click', async () => {
      try { copyText(Specs.exportMarkdown(this.selected()), root.querySelector('#dc-md')); } catch { showToast('Could not copy the comparison. Try CSV export.', 'error'); }
    });
    root.querySelector('#dc-csv').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob(['\ufeff', Specs.exportCsv(this.selected())], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'tech-device-comparison.csv';
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  },
};
