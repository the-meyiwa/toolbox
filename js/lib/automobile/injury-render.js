/* ============================================================
   Renders the injury reference (injury-data.js) as HTML, and
   opens its links:
     drugs and substances  → Compound Database, on that compound
     body sites            → Anatomy Explorer, showing only that part
   Used by the Automobile Guide and the Assistant's cards.
   Styles: css/vehicle-injuries.css
   ============================================================ */

import { SITES, FRACTURE_TYPES, DISCLAIMER } from './injury-data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Text with {Drug}, {!Substance} and [site|words] references turned into links. */
export function richText(text) {
  return esc(text)
    .replace(/\{!([^}]+)\}/g, (_, n) => `<a href="#compound-database" class="inj-sub" data-compound="${n}" title="Open ${n} in the Compound Database">${n}</a>`)
    .replace(/\{([^}]+)\}/g, (_, n) => `<a href="#compound-database" class="inj-drug" data-compound="${n}" title="Open ${n} in the Compound Database">${n}</a>`)
    .replace(/\[([a-z0-9-]+)\|([^\]]+)\]/g, (_, key, words) => SITES[key]
      ? `<a href="#anatomy-explorer" class="inj-site" data-anatomy-site="${key}" title="Show ${esc(SITES[key].label)} in the Anatomy Explorer">${words}</a>`
      : words);
}

/** Plain text (for the Assistant's messages). */
export function plainText(text) {
  return String(text ?? '').replace(/\{!?([^}]+)\}/g, '$1').replace(/\[[a-z0-9-]+\|([^\]]+)\]/g, '$1');
}

/* A small drawing of each fracture pattern on a bone shaft. */
const BONE = 'M22 4c-5 0-7 4-5 8l2 3v34l-2 3c-2 4 0 8 5 8 3 0 4-2 5-3 1 1 2 3 5 3 5 0 7-4 5-8l-2-3V15l2-3c2-4 0-8-5-8-3 0-4 2-5 3-1-1-2-3-5-3Z';
const PATTERN = {
  transverse: '<path d="M16 32h22"/>',
  oblique: '<path d="M17 38 37 24"/>',
  spiral: '<path d="M17 22c8 2 12 6 20 4M17 34c8-2 12 4 20 2"/>',
  comminuted: '<path d="M17 30l8-3 4 5 8-4M25 27l-2 8M29 32l3 7"/>',
  segmental: '<path d="M17 22h20M17 42h20"/>',
  open: '<path d="M17 32h20"/><path d="M34 32l10-6" stroke-width="3"/>',
  displaced: '<path d="M17 32h20"/><path d="M40 30l4 2-4 2"/>',
  greenstick: '<path d="M17 32c5 1 8 2 10 5"/>',
  compression: '<path d="M18 26l18 3M18 36l18-3"/>',
  burst: '<path d="M27 26v12M20 32h14M22 27l10 10M32 27 22 37"/>',
  chance: '<path d="M16 32h22"/><path d="M14 30h26" stroke-dasharray="2 2"/>',
  avulsion: '<path d="M33 12c3 1 4 4 2 6"/><path d="M40 8l3-3"/>',
  impacted: '<path d="M17 30l20 4M17 34l20-4"/>',
  depressed: '<path d="M17 28c5 6 15 6 20 0"/>',
  linear: '<path d="M18 20l6 8 4 6 8 10"/>',
  basilar: '<path d="M17 52h20"/>',
};
export function fractureSvg(type) {
  const p = PATTERN[type] || PATTERN.transverse;
  return `<svg class="inj-frac-svg" viewBox="0 0 54 64" aria-hidden="true"><path class="inj-bone" d="${BONE}"/><g class="inj-crack">${p}</g></svg>`;
}

const SEVERITY = { minor: 'Minor', serious: 'Serious', critical: 'Life-threatening' };

/** One injury as an expandable block. */
export function injuryHtml(inj, { open = false } = {}) {
  const fractures = (inj.fractures || []).map(k => ({ k, ...FRACTURE_TYPES[k] })).filter(f => f.name);
  const sites = (inj.sites || []).filter(k => SITES[k]);
  return `<details class="inj-item inj-${inj.severity || 'minor'}"${open ? ' open' : ''}>
    <summary><span class="inj-sev">${SEVERITY[inj.severity] || ''}</span><span class="inj-name">${esc(inj.name)}</span></summary>
    <div class="inj-body">
      <p>${richText(inj.what)}</p>
      ${inj.signs ? `<h6>Signs</h6><p>${richText(inj.signs)}</p>` : ''}
      ${inj.firstAid ? `<h6>First aid</h6><p class="inj-firstaid">${richText(inj.firstAid)}</p>` : ''}
      ${inj.treatment?.length ? `<h6>Likely treatment</h6><ul>${inj.treatment.map(t => `<li>${richText(t)}</li>`).join('')}</ul>` : ''}
      ${fractures.length ? `<h6>Fracture types</h6><div class="inj-fracs">${fractures.map(f => `
        <details class="inj-frac"><summary>${fractureSvg(f.k)}<span>${esc(f.name)}</span></summary>
          <p>${esc(f.what)} <em>${esc(f.how)}</em></p></details>`).join('')}</div>` : ''}
      ${sites.length ? `<h6>See it on the body</h6><div class="inj-sites">${sites.map(k => `
        <button type="button" class="inj-site-chip" data-anatomy-site="${k}" data-anatomy-title="${esc(inj.name)}: ${esc(SITES[k].label)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.5" r="2.2"/><path d="M12 7v7m-5-5 5 2 5-2m-7 12 2-7 2 7"/></svg>${esc(SITES[k].label)}</button>`).join('')}</div>` : ''}
    </div>
  </details>`;
}

/** The whole safety section for a part: hazard, injuries, prevention. */
export function safetyHtml(safety, { heading = true } = {}) {
  if (!safety) return '';
  return `<section class="inj">
    ${heading ? '<h5 class="inj-h">Safety</h5>' : ''}
    <p class="inj-hazard">${richText(safety.hazard)}</p>
    ${safety.injuries.length ? `<h5 class="inj-h2">Common injuries involved</h5>${safety.injuries.map(i => injuryHtml(i)).join('')}` : ''}
    ${safety.prevention?.length ? `<h5 class="inj-h2">Prevention</h5><ul class="inj-prevent">${safety.prevention.map(p => `<li>${richText(p)}</li>`).join('')}</ul>` : ''}
    <div class="inj-related"><span>Related tools</span>
      <a href="#anatomy-explorer" class="inj-tool">Anatomy Explorer</a>
      <a href="#compound-database" class="inj-tool">Compound Database</a>
    </div>
    <p class="inj-disclaimer">${esc(DISCLAIMER)}</p>
  </section>`;
}

/* ---------- link handling (once, for the whole app) ---------- */

export function openCompound(name) {
  try { localStorage.setItem('toolbox.compounds.focus', JSON.stringify({ name })); } catch { /* opens without focus */ }
  window.location.hash = '#compound-database';
}

export function openAnatomySite(key, { title, from } = {}) {
  const site = SITES[key];
  if (!site) return;
  try {
    localStorage.setItem('toolbox.anatomy.focus', JSON.stringify({ structures: site.structures, context: site.context || [], marker: site.marker || null, label: site.label, title: title || site.label, from: from || 'the Automobile Guide' }));
  } catch { /* opens without focus */ }
  window.location.hash = '#anatomy-explorer';
}

let installed = false;
export function installInjuryLinks() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', (e) => {
    const c = e.target.closest?.('[data-compound]');
    if (c) { e.preventDefault(); openCompound(c.dataset.compound); return; }
    const s = e.target.closest?.('[data-anatomy-site]');
    if (s) { e.preventDefault(); openAnatomySite(s.dataset.anatomySite, { title: s.dataset.anatomyTitle || s.textContent.trim(), from: s.closest('.astc') ? 'the Assistant' : 'the Automobile Guide' }); }
  });
}
