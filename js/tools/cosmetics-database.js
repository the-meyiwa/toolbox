/* ============================================================
   TOOLBOX — Cosmetics Database

   Products from brands around the world with their specifications
   (SPF, finish, shades, actives, fragrance notes…) and complete
   ingredient lists, read ingredient by ingredient: what each one
   does, the compound behind it (every one is a record in the
   Compound Database), how the formula breaks down, and what is
   worth knowing (fragrance allergens, alcohol, silicones…).
   Brands and ingredients have pages of their own, and any product
   in the world can be looked up live in Open Beauty Facts.

   Every block arrives with motion (lib/reveal-motion.js): titles
   rise word by word, counts climb, cards lift in, ingredient rows
   cascade and the composition bar fills.
   ============================================================ */

import {
  CATEGORIES, CATEGORY_BY_ID, REGIONS, REGION_BY_ID, BRANDS, BRAND_BY_ID, PRODUCTS, PRODUCT_BY_ID, INCI, INGREDIENTS,
  FUNCTION_GROUPS, FUNCTION_GROUP_BY_ID, STATS, analyse, ingredientInfo, productsOfBrand, productsWith, similarProducts, search,
  searchOnline, typeLabel, groupOf, CATALOGUE_SOURCE,
} from '../lib/cosmetics/db.js';
import { RevealMotion, flip, pointerLight } from '../lib/reveal-motion.js';
import { icon } from '../lib/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TABS = ['discover', 'products', 'brands', 'ingredients'];
const FOCUS_KEY = 'toolbox.cosmetics.focus';
const PAGE = 60;
const SOURCE_DATA_URL = new URL('../lib/cosmetics/products-openbeautyfacts.json', import.meta.url).href;

/* Pack shapes, drawn at 48×48. */
const PACK = {
  dropper: '<rect x="16" y="19" width="16" height="23" rx="4.5"/><path d="M20 19v-4h8v4"/><path d="M22 15V8.5a2 2 0 0 1 4 0V15"/><path d="M20 30h8"/>',
  jar: '<rect x="8" y="21" width="32" height="19" rx="6"/><rect x="10" y="13" width="28" height="8" rx="3"/><path d="M15 30h18"/>',
  tube: '<path d="M15 6h18l-2.5 29h-13z"/><rect x="19" y="35" width="10" height="7" rx="1.5"/><path d="M15 10h18"/>',
  pump: '<rect x="14" y="21" width="20" height="21" rx="5"/><path d="M20 21v-5h8v5M24 16V10h8"/><path d="M19 31h10"/>',
  spray: '<rect x="15" y="18" width="18" height="24" rx="5"/><path d="M20 18v-6h8v6M28 12h3"/><path d="M35 9l3-2M35 13h4M35 17l3 2"/>',
  stick: '<rect x="17" y="25" width="14" height="17" rx="2"/><rect x="19" y="18" width="10" height="7"/><path d="M20 18v-7l8-5v12"/>',
  compact: '<ellipse cx="24" cy="31" rx="16" ry="7"/><path d="M8 31v-3c0-3.9 7.2-7 16-7s16 3.1 16 7v3"/><path d="M14 27c3 2 17 2 20 0"/>',
  bar: '<rect x="7" y="17" width="34" height="17" rx="8"/><path d="M14 25.5h8"/>',
  perfume: '<rect x="11" y="20" width="26" height="22" rx="6"/><rect x="19" y="13" width="10" height="7" rx="1.5"/><path d="M22 13V8h4v5"/><path d="M17 29h14"/>',
  polish: '<rect x="13" y="25" width="22" height="17" rx="5"/><rect x="19" y="7" width="10" height="18" rx="2"/>',
  wand: '<rect x="19" y="4" width="10" height="19" rx="2.5"/><rect x="21" y="23" width="6" height="21" rx="3"/><path d="M19 11h10"/>',
  paste: '<path d="M6 19h26l7 3.5v3L32 29H6z"/><path d="M39 22.5h3v3h-3"/><path d="M11 19v10"/>',
  bottle: '<path d="M18 6h12v6l4 6v20a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18l4-6z"/><path d="M14 24h20"/>',
};
const PACK_OF_TYPE = {
  serum: 'dropper', 'eye serum': 'dropper', 'face oil': 'dropper', essence: 'bottle', toner: 'bottle', 'micellar water': 'bottle', mist: 'spray',
  moisturizer: 'jar', balm: 'jar', ointment: 'jar', mask: 'jar', cleanser: 'pump', exfoliant: 'bottle', 'spot treatment': 'tube',
  sunscreen: 'tube', foundation: 'pump', concealer: 'wand', powder: 'compact', blush: 'compact', bronzer: 'compact', highlighter: 'dropper',
  primer: 'tube', 'setting spray': 'spray', mascara: 'wand', eyeliner: 'wand', eyeshadow: 'compact', brow: 'wand', lipstick: 'stick',
  'lip gloss': 'wand', 'lip balm': 'stick', shampoo: 'pump', conditioner: 'pump', 'hair treatment': 'bottle', 'hair oil': 'dropper', styling: 'jar',
  'body lotion': 'pump', 'body wash': 'pump', 'bar soap': 'bar', deodorant: 'spray', fragrance: 'perfume', toothpaste: 'paste', mouthwash: 'bottle',
  'nail polish': 'polish', baby: 'jar', shaving: 'spray', cosmetic: 'bottle',
};
const CATEGORY_PACK = { skincare: 'dropper', sun: 'tube', makeup: 'stick', hair: 'pump', body: 'bar', fragrance: 'perfume', oral: 'paste', nails: 'polish', lips: 'stick', baby: 'jar', men: 'spray' };
const pack = (shape, size = 48) => `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${size <= 24 ? 3 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PACK[shape] || PACK.bottle}</svg>`;
const packOf = (p, size) => pack(PACK_OF_TYPE[p.type] || CATEGORY_PACK[p.category] || 'bottle', size);

const MOTION = {
  titles: '.cz-hero h2, .cz-phero h2',
  units: [
    ['.cz-hero h2, .cz-phero h2', 'title'],
    ['.cz-stat', 'pop'],
    ['.cz-pack-art', 'widget'],
    ['.cz-tile, .cz-region, .cz-pcard, .cz-sim', 'card'],
    ['.cz-irow, .cz-brow, .cz-urow, .cz-lrow', 'row'],
    ['.cz-kv > div, .cz-legend > li', 'li'],
    ['.cz-note', 'flip'],
    ['.cz-compo', 'wipe'],
    ['.cz-chip, .cz-badge, .cz-tag, .cz-letter, .cz-cta, .cz-active', 'pop'],
    ['.cz-sec > h3, .cz-sec-head', 'rule'],
    ['.cz-card, .cz-phero, .cz-hero, .cz-filters', 'panel'],
    ['.cz-muted, .cz-sub', 'fade'],
    ['p', 'up'],
  ],
  atomic: '.cz-tile, .cz-region, .cz-pcard, .cz-sim, .cz-irow, .cz-brow, .cz-urow, .cz-lrow, .cz-chip, .cz-badge, .cz-note, .cz-kv > div, .cz-legend > li, .cz-stat, .cz-active, .cz-filters',
  fill: '.cz-seg, .cz-meter i, .cz-posbar i',
  skip: '.cz-qs',
  hold: { widget: 2200, title: 1600 },
};

export default {
  render(container) {
    this.container = container;
    this.stack = [{ page: 'discover' }];
    this.productsState = { cat: '', ff: false, spf: false, source: '', sort: 'brand', shown: PAGE };
    this.brandsState = { region: '', q: '' };
    this.ingState = { group: '', q: '', shown: 120 };
    this.online = new Map();
    container.innerHTML = `
      <div class="cz">
        <div class="cz-top">
          ${this.qsHtml()}
          <div class="cz-bar">
            <button type="button" class="cz-back" data-back hidden aria-label="Back">${icon('chevron-left', { size: 18 })}<span>Back</span></button>
            <div class="cz-tabs" role="tablist" aria-label="Cosmetics Database">
              <span class="cz-pill" aria-hidden="true"></span>
              <button type="button" role="tab" data-tab="discover">Discover</button>
              <button type="button" role="tab" data-tab="products">Products</button>
              <button type="button" role="tab" data-tab="brands">Brands</button>
              <button type="button" role="tab" data-tab="ingredients">Ingredients</button>
            </div>
          </div>
        </div>
        <div class="cz-page"></div>
      </div>`;
    const q = (s) => container.querySelector(s);
    this.el = { root: q('.cz'), page: q('.cz-page'), tabs: q('.cz-tabs'), pill: q('.cz-pill'), back: q('[data-back]'), qs: q('.cz-qs') };
    this.motion = new RevealMotion(this.el.page, MOTION);
    this.unlight = pointerLight(this.el.root, '.cz-card, .cz-pcard, .cz-tile, .cz-region, .cz-phero, .cz-sim', '.cz-pcard, .cz-tile, .cz-region, .cz-sim');
    this.onClick = (e) => this.click(e);
    container.addEventListener('click', this.onClick);
    container.addEventListener('input', (e) => this.input(e));
    container.addEventListener('change', (e) => this.change(e));
    container.addEventListener('keydown', (e) => this.keydown(e));
    container.addEventListener('focusin', (e) => { if (e.target.matches?.('[data-qs-input]')) this.fillDropdown(); });
    this.onOutside = (e) => { if (!this.el?.qs.contains(e.target)) this.closeDropdown(); };
    document.addEventListener('pointerdown', this.onOutside, true);
    if (typeof ResizeObserver === 'function') { this.ro = new ResizeObserver(() => this.placePill(false)); this.ro.observe(this.el.tabs); }

    // Opened from the Assistant or another tool: a product, brand, ingredient or search.
    let focus = null;
    try { focus = JSON.parse(localStorage.getItem(FOCUS_KEY) || 'null'); localStorage.removeItem(FOCUS_KEY); } catch { /* storage unavailable */ }
    const route = focus?.product && PRODUCT_BY_ID.has(focus.product) ? { page: 'product', id: focus.product }
      : focus?.brand && BRAND_BY_ID.has(focus.brand) ? { page: 'brand', id: focus.brand }
        : focus?.ingredient && ingredientInfo(focus.ingredient) ? { page: 'ingredient', inci: ingredientInfo(focus.ingredient).inci }
          : focus?.online ? { page: 'online', q: String(focus.online) } : null;
    if (route) this.stack.push(route);
    this.show(0);
  },

  destroy() {
    this.motion?.reset();
    this.unlight?.();
    this.ro?.disconnect();
    this.abort?.abort();
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.container = null;
  },

  /* ---------------- navigation ---------------- */
  route() { return this.stack[this.stack.length - 1]; },
  go(route) { this.stack.push(route); this.show(1); },
  back() { if (this.stack.length > 1) { this.stack.pop(); this.show(-1); } },
  tab(id) {
    const cur = this.route().page;
    const dir = Math.sign(TABS.indexOf(id) - Math.max(0, TABS.indexOf(cur))) || 1;
    this.stack = [{ page: id }];
    this.show(dir);
  },

  /** Draws the current route; the page slides the way you travelled and its blocks arrive in turn. */
  show(dir = 0) {
    if (!this.container) return;
    const r = this.route();
    const tab = TABS.includes(r.page) ? r.page : ({ product: 'products', brand: 'brands', ingredient: 'ingredients', online: 'products' }[r.page]);
    this.el.tabs.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    this.placePill(true);
    this.el.back.hidden = this.stack.length < 2;
    const page = this.el.page;
    const paint = () => {
      this.motion.reset();
      page.classList.remove('cz-out-l', 'cz-out-r');
      page.innerHTML = this[`page_${r.page}`](r);
      this.after?.(); this.after = null;
      this.motion.enter(page, { mode: dir > 0 ? 'forward' : dir < 0 ? 'back' : 'up' });
      if (dir) {
        const top = this.el.root.getBoundingClientRect().top;
        if (top < 0) this.el.root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      }
    };
    if (!dir || reduced() || !page.firstChild) { paint(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; paint(); } };
    page.classList.add(dir > 0 ? 'cz-out-l' : 'cz-out-r');
    page.addEventListener('animationend', go, { once: true });
    setTimeout(go, 200);
  },

  placePill(animate) {
    const sel = this.el?.tabs.querySelector('[aria-selected="true"]');
    const pill = this.el?.pill;
    if (!sel || !pill || !sel.offsetWidth) return;
    if (!animate || !pill.dataset.ready) pill.style.transition = 'none';
    pill.style.width = `${sel.offsetWidth}px`;
    pill.style.transform = `translateX(${sel.offsetLeft - 3}px)`;
    if (!animate || !pill.dataset.ready) { void pill.offsetWidth; pill.style.transition = ''; }
    pill.dataset.ready = '1';
  },

  /* ---------------- search bar (drawn like the home page's) ---------------- */
  qsHtml() {
    return `<div class="home-search-wrap cz-qs">
      <div class="home-search-field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input type="text" class="home-search-input" data-qs-input placeholder="Search a product, brand or ingredient — or any product in the world" autocomplete="off" spellcheck="false" aria-label="Search products, brands and ingredients" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="cz-dd">
        <button type="button" class="btn-icon btn-primary home-search-submit" data-qs-go aria-label="Open the top match" title="Open the top match (Enter)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
      </div>
      <div class="home-hero-dropdown cz-dd" id="cz-dd" role="listbox" hidden></div>
    </div>`;
  },
  ddRow(attrs, iconHtml, name, desc, i, trail = '') {
    return `<div class="hero-dd-row cz-dd-row" role="option" tabindex="-1" aria-selected="false" ${attrs} style="--i:${i}">
      <span class="hero-dd-icon">${iconHtml}</span>
      <span class="hero-dd-text"><span class="hero-dd-name">${name}</span><span class="hero-dd-desc">${desc}</span></span>${trail}</div>`;
  },
  fillDropdown() {
    const input = this.el.qs.querySelector('[data-qs-input]'), dd = this.el.qs.querySelector('.cz-dd');
    const q = input.value.trim();
    let i = 0, html = '';
    const label = (t) => `<div class="hero-dd-label">${esc(t)}</div>`;
    if (!q) {
      const picks = ['cerave--moisturizing-cream', 'the-ordinary--niacinamide-10-zinc-1', 'beauty-of-joseon--relief-sun-rice-probiotics-spf50', 'chanel--n-5-eau-de-parfum'].map(id => PRODUCT_BY_ID.get(id)).filter(Boolean);
      html += label('Popular') + picks.map(p => this.ddRow(`data-go-product="${esc(p.id)}"`, packOf(p, 18), esc(p.name), esc(`${p.brand} · ${typeLabel(p.type)}`), i++)).join('');
      html += label('Ingredients people ask about') + ['Niacinamide', 'Retinol', 'Sodium Hyaluronate', 'Salicylic Acid'].map(n => this.ddRow(`data-go-ingredient="${esc(n)}"`, icon('sparkle'), esc(n), esc(INCI[n]?.f || ''), i++)).join('');
    } else {
      const r = search(q, { limit: 6 });
      if (r.products.length) html += label('Products') + r.products.map(p => this.ddRow(`data-go-product="${esc(p.id)}"`, packOf(p, 18), esc(p.name), esc(`${p.brand} · ${typeLabel(p.type)}${p.year ? ` · ${p.year}` : ''}`), i++)).join('');
      if (r.brands.length) html += label('Brands') + r.brands.slice(0, 4).map(b => this.ddRow(`data-go-brand="${esc(b.id)}"`, `<span class="cz-mono">${esc(initials(b.name))}</span>`, esc(b.name), esc([b.country, b.parent && b.parent !== b.name ? b.parent : ''].filter(Boolean).join(' · ')), i++)).join('');
      if (r.ingredients.length) html += label('Ingredients') + r.ingredients.slice(0, 5).map(x => this.ddRow(`data-go-ingredient="${esc(x.inci)}"`, icon('sparkle'), esc(x.inci), esc(`${x.info.f}${x.uses.length ? ` · in ${x.uses.length} product${x.uses.length === 1 ? '' : 's'}` : ''}`), i++)).join('');
      html += label('Worldwide') + this.ddRow(`data-go-online="${esc(q)}"`, icon('search'), `Search every brand for “${esc(q)}”`, 'Live product labels from Open Beauty Facts', i++);
    }
    dd.innerHTML = html;
    dd.hidden = false;
    this.el.qs.classList.add('is-open');
    input.setAttribute('aria-expanded', 'true');
    this.setActive(0);
  },
  closeDropdown() {
    const dd = this.el?.qs.querySelector('.cz-dd');
    if (!dd || dd.hidden) return;
    dd.hidden = true;
    this.el.qs.classList.remove('is-open');
    this.el.qs.querySelector('[data-qs-input]').setAttribute('aria-expanded', 'false');
  },
  setActive(i) {
    const rows = [...this.el.qs.querySelectorAll('.cz-dd-row')];
    if (!rows.length) return;
    const j = Math.max(0, Math.min(rows.length - 1, i));
    rows.forEach((r, k) => { r.classList.toggle('is-active', k === j); r.setAttribute('aria-selected', String(k === j)); });
    rows[j].scrollIntoView?.({ block: 'nearest' });
  },
  activate(row) {
    const input = this.el.qs.querySelector('[data-qs-input]');
    input.value = ''; input.blur();
    this.closeDropdown();
    const d = row.dataset;
    if (d.goProduct) this.go({ page: 'product', id: d.goProduct });
    else if (d.goBrand) this.go({ page: 'brand', id: d.goBrand });
    else if (d.goIngredient) this.go({ page: 'ingredient', inci: d.goIngredient });
    else if (d.goOnline) this.go({ page: 'online', q: d.goOnline });
  },

  /* ---------------- pages ---------------- */
  page_discover() {
    const catCount = (id) => PRODUCTS.filter(p => p.category === id).length;
    const regionBrands = (id) => BRANDS.filter(b => b.region === id).length;
    const featured = ['cerave--moisturizing-cream', 'la-roche-posay--cicaplast-baume-b5', 'cosrx--advanced-snail-96-mucin-power-essence', 'skinceuticals--c-e-ferulic', 'mac--matte-lipstick-ruby-woo', 'maison-francis-kurkdjian--baccarat-rouge-540-eau-de-parfum', 'moroccanoil--moroccanoil-treatment', 'sensodyne--repair-protect-toothpaste']
      .map(id => PRODUCT_BY_ID.get(id)).filter(Boolean);
    const asked = ['Niacinamide', 'Retinol', 'Sodium Hyaluronate', 'Salicylic Acid', 'Glycolic Acid', 'Ascorbic Acid', 'Ceramide NP', 'Squalane', 'Zinc Oxide', 'Panthenol', 'Centella Asiatica Extract', 'Parfum', 'Dimethicone', 'Phenoxyethanol', 'Butyrospermum Parkii Butter', 'Snail Secretion Filtrate'];
    return `
      <section class="cz-hero">
        <div class="cz-hero-art" aria-hidden="true">${['dropper', 'jar', 'stick', 'perfume', 'tube'].map((s, i) => `<span style="--k:${i}">${pack(s, 56)}</span>`).join('')}</div>
        <h2>What is really in your cosmetics</h2>
        <p class="cz-sub">Explore ${STATS.products.toLocaleString()} product labels, curated formulas and an ingredient dictionary that connects cosmetics to chemistry.</p>
        <div class="cz-stats">
          <div class="cz-stat"><b data-count="${STATS.products}">${STATS.products}</b><span>products in detail</span></div>
          <div class="cz-stat"><b data-count="${STATS.brands}">${STATS.brands}</b><span>brands</span></div>
          <div class="cz-stat"><b data-count="${STATS.countries}">${STATS.countries}</b><span>countries</span></div>
          <div class="cz-stat"><b data-count="${STATS.ingredients}">${STATS.ingredients}</b><span>ingredients, each a compound</span></div>
        </div>
      </section>
      <section class="cz-sec">
        <h3>Browse by category</h3>
        <div class="cz-tiles">${CATEGORIES.map(c => `<button type="button" class="cz-tile" data-cat="${c.id}">
          <span class="cz-tile-art cat-${c.id}">${pack(CATEGORY_PACK[c.id], 36)}</span>
          <span class="cz-tile-text"><strong>${esc(c.label)}</strong><small>${esc(c.blurb)}</small></span>
          <span class="cz-tile-n">${catCount(c.id)}</span></button>`).join('')}</div>
      </section>
      <section class="cz-sec">
        <h3>Beauty around the world</h3>
        <div class="cz-regions">${REGIONS.map(r => `<button type="button" class="cz-region" data-region="${r.id}">
          <strong>${esc(r.label)}</strong><small>${esc(r.blurb)}</small><span>${regionBrands(r.id)} brands ${icon('arrow-right')}</span></button>`).join('')}</div>
      </section>
      <section class="cz-sec">
        <h3>Ingredients people ask about</h3>
        <div class="cz-chips">${asked.filter(n => INCI[n]).map(n => `<button type="button" class="cz-chip" data-go-ingredient="${esc(n)}">${esc(n)}<small>${esc(groupOf(INCI[n].f).label)}</small></button>`).join('')}</div>
      </section>
      <section class="cz-sec">
        <h3>Icons, taken apart</h3>
        <div class="cz-grid">${featured.map(p => this.productCard(p)).join('')}</div>
      </section>
      <p class="cz-note-foot">${STATS.curated} curated formulas and ${STATS.community.toLocaleString()} community labels from <a href="https://world.openbeautyfacts.org" target="_blank" rel="noopener noreferrer">Open Beauty Facts</a>, imported ${esc(CATALOGUE_SOURCE.imported)}. Community records can be incomplete or out of date; unknown ingredients stay unidentified. The pack in hand is the final word. Data under <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a>. <a href="${esc(SOURCE_DATA_URL)}" download="toolbox-cosmetics-source.json">Download the source catalogue</a>.</p>`;
  },

  compoHtml(a, { mini = false } = {}) {
    const total = a.rows.length || 1;
    const groups = FUNCTION_GROUPS.filter(g => a.groups[g.id]).map(g => ({ g, n: a.groups[g.id] }));
    if (a.groups.other) groups.push({ g: { id: 'other', label: 'Other' }, n: a.groups.other });
    const bar = `<div class="cz-compo${mini ? ' is-mini' : ''}" role="img" aria-label="${esc(groups.map(x => `${x.g.label}: ${x.n}`).join(', '))}">${groups.map(x => `<span class="cz-seg g-${x.g.id}" style="--w:${(x.n / total * 100).toFixed(2)}%"></span>`).join('')}</div>`;
    if (mini) return bar;
    return `${bar}<ul class="cz-legend">${groups.map(x => `<li><i class="g-${x.g.id}"></i>${esc(x.g.label)}<b>${x.n}</b></li>`).join('')}</ul>`;
  },

  productCard(p) {
    const chips = [p.specs.spf ? `SPF ${p.specs.spf}` : '', p.specs.pa ? `PA${p.specs.pa}` : '', p.flags.ff ? 'Fragrance-free' : '', p.specs.conc || '', p.specs.finish ? p.specs.finish.split(',')[0] : ''].filter(Boolean).slice(0, 3);
    return `<button type="button" class="cz-pcard" data-go-product="${esc(p.id)}">
      <span class="cz-pcard-art cat-${p.category}">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : packOf(p, 40)}</span>
      <span class="cz-pcard-brand">${esc(p.brand)}</span>
      <strong class="cz-pcard-name">${esc(p.name)}</strong>
      <span class="cz-pcard-meta">${esc([typeLabel(p.type), p.size, p.year].filter(Boolean).join(' · '))}</span>
      ${chips.length ? `<span class="cz-pcard-chips">${chips.map(c => `<em>${esc(c)}</em>`).join('')}</span>` : ''}
      ${p.inci.length ? this.compoHtml(analyse(p), { mini: true }) : ''}
      <span class="cz-pcard-n">${p.inci.length ? `${p.inci.length} ingredient${p.inci.length === 1 ? '' : 's'}` : 'No ingredient list'}${p.source === 'openbeautyfacts' ? ' · Community label' : ''}</span>
    </button>`;
  },

  page_products() {
    const s = this.productsState;
    let list = PRODUCTS.filter(p => {
      if (s.cat && p.category !== s.cat || s.source && p.source !== s.source || s.spf && !p.specs.spf) return false;
      if (!s.ff) return true;
      const a = analyse(p);
      return a.complete && !a.fragrance.length && !a.allergens.length && !a.essentialOils.length;
    });
    list = list.slice().sort((a, b) => s.sort === 'newest' ? (b.year || 0) - (a.year || 0) : s.sort === 'name' ? a.name.localeCompare(b.name) : a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
    const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, PRODUCTS.filter(p => p.category === c.id).length]));
    return `
      <section class="cz-filters">
        <div class="cz-chips cz-chips-scroll" role="group" aria-label="Category">
          <button type="button" class="cz-chip${!s.cat ? ' is-on' : ''}" data-filter-cat="">All<small>${PRODUCTS.length}</small></button>
          ${CATEGORIES.map(c => `<button type="button" class="cz-chip${s.cat === c.id ? ' is-on' : ''}" data-filter-cat="${c.id}">${esc(c.label)}<small>${counts[c.id]}</small></button>`).join('')}
        </div>
        <div class="cz-filter-row">
          <label class="cz-switch"><input type="checkbox" class="switch" data-filter="ff" ${s.ff ? 'checked' : ''}><span>No added fragrance</span></label>
          <label class="cz-switch"><input type="checkbox" class="switch" data-filter="spf" ${s.spf ? 'checked' : ''}><span>With SPF</span></label>
          <select class="tool-select" data-filter="source" aria-label="Label source"><option value="" ${!s.source ? 'selected' : ''}>All sources</option><option value="catalogue" ${s.source === 'catalogue' ? 'selected' : ''}>Curated formulas</option><option value="openbeautyfacts" ${s.source === 'openbeautyfacts' ? 'selected' : ''}>Community labels</option></select>
          <select class="tool-select" data-filter="sort" aria-label="Sort"><option value="brand" ${s.sort === 'brand' ? 'selected' : ''}>Sort: Brand</option><option value="name" ${s.sort === 'name' ? 'selected' : ''}>Sort: Name</option><option value="newest" ${s.sort === 'newest' ? 'selected' : ''}>Sort: Newest</option></select>
        </div>
      </section>
      <p class="cz-muted cz-count">${list.length} product${list.length === 1 ? '' : 's'}${s.cat ? ` in ${esc(CATEGORY_BY_ID[s.cat].label.toLowerCase())}` : ''}</p>
      <div class="cz-grid">${list.slice(0, s.shown).map(p => this.productCard(p)).join('') || '<p class="cz-muted">Nothing matches those filters. Turn one off, or search every brand above.</p>'}</div>
      ${list.length > s.shown ? `<div class="cz-more"><button type="button" class="btn btn-secondary" data-more="products">Show ${Math.min(PAGE, list.length - s.shown)} more</button></div>` : ''}`;
  },

  page_brands() {
    const s = this.brandsState;
    const q = s.q.trim().toLowerCase();
    const list = BRANDS.filter(b => (!s.region || b.region === s.region) && (!q || `${b.name} ${b.country} ${b.parent}`.toLowerCase().includes(q)));
    const letters = new Map();
    list.forEach(b => { const L = /^[a-z]/i.test(b.name) ? b.name[0].toUpperCase() : '#'; if (!letters.has(L)) letters.set(L, []); letters.get(L).push(b); });
    const counts = Object.fromEntries(REGIONS.map(r => [r.id, BRANDS.filter(b => b.region === r.id).length]));
    return `
      <section class="cz-filters">
        <div class="cz-chips cz-chips-scroll" role="group" aria-label="Region">
          <button type="button" class="cz-chip${!s.region ? ' is-on' : ''}" data-filter-region="">All<small>${BRANDS.length}</small></button>
          ${REGIONS.map(r => `<button type="button" class="cz-chip${s.region === r.id ? ' is-on' : ''}" data-filter-region="${r.id}">${esc(r.label)}<small>${counts[r.id]}</small></button>`).join('')}
        </div>
        <label class="cz-find">${icon('search', { size: 16 })}<input type="search" data-filter="brand-q" value="${esc(s.q)}" placeholder="Filter brands, countries and owners" aria-label="Filter brands"></label>
      </section>
      ${s.region ? `<p class="cz-muted cz-count">${esc(REGION_BY_ID[s.region].blurb)}</p>` : ''}
      <div class="cz-brand-list">${[...letters].map(([L, bs]) => `
        <section class="cz-letter-group"><span class="cz-letter">${esc(L)}</span>
          ${bs.map(b => `<button type="button" class="cz-brow" data-go-brand="${esc(b.id)}">
            <span class="cz-mono">${esc(initials(b.name))}</span>
            <span class="cz-brow-main"><strong>${esc(b.name)}</strong><small>${esc([b.country, b.founded ? `since ${b.founded}` : '', b.parent && b.parent !== b.name ? b.parent : ''].filter(Boolean).join(' · '))}</small></span>
            <span class="cz-brow-focus">${b.focus.slice(0, 3).map(f => `<em>${esc(f)}</em>`).join('')}</span>
            <span class="cz-brow-n">${productsOfBrand(b.id).length || ''}</span>
          </button>`).join('')}
        </section>`).join('') || '<p class="cz-muted">No brand matches that. Search every brand above to look it up online.</p>'}</div>`;
  },

  page_ingredients() {
    const s = this.ingState;
    const q = s.q.trim().toLowerCase();
    const all = Object.entries(INCI).map(([inci, info]) => ({ inci, info, n: productsWith(inci).length, group: groupOf(info.f).id }));
    const list = all.filter(x => (!s.group || x.group === s.group) && (!q || `${x.inci} ${x.info.c} ${x.info.f}`.toLowerCase().includes(q)))
      .sort((a, b) => b.n - a.n || a.inci.localeCompare(b.inci));
    const counts = {};
    all.forEach(x => { counts[x.group] = (counts[x.group] || 0) + 1; });
    return `
      <section class="cz-filters">
        <div class="cz-chips cz-chips-scroll" role="group" aria-label="What it does">
          <button type="button" class="cz-chip${!s.group ? ' is-on' : ''}" data-filter-group="">All<small>${all.length}</small></button>
          ${FUNCTION_GROUPS.filter(g => counts[g.id]).map(g => `<button type="button" class="cz-chip${s.group === g.id ? ' is-on' : ''}" data-filter-group="${g.id}"><i class="cz-dot g-${g.id}"></i>${esc(g.label)}<small>${counts[g.id]}</small></button>`).join('')}
        </div>
        <label class="cz-find">${icon('search', { size: 16 })}<input type="search" data-filter="ing-q" value="${esc(s.q)}" placeholder="Filter by label name, compound or job" aria-label="Filter ingredients"></label>
      </section>
      <p class="cz-muted cz-count">${list.length} ingredient${list.length === 1 ? '' : 's'}, most used first. Each one is a record in the Compound Database.</p>
      <div class="cz-list">${list.slice(0, s.shown).map(x => this.ingRow(x.inci, x.info, x.n)).join('')}</div>
      ${list.length > s.shown ? `<div class="cz-more"><button type="button" class="btn btn-secondary" data-more="ingredients">Show ${Math.min(120, list.length - s.shown)} more</button></div>` : ''}`;
  },
  ingRow(inci, info, n) {
    return `<button type="button" class="cz-lrow" data-go-ingredient="${esc(inci)}">
      <i class="cz-dot g-${groupOf(info.f).id}"></i>
      <span class="cz-lrow-main"><strong>${esc(inci)}</strong><small>${esc(alsoKnown(info, inci) ? `${info.c} · ${info.f}` : info.f)}</small></span>
      ${info.formula ? `<span class="cz-formula">${formulaHtml(info.formula)}</span>` : ''}
      <span class="cz-lrow-n">${n ? `${n} product${n === 1 ? '' : 's'}` : ''}</span>
    </button>`;
  },

  productOf(r) {
    if (r.page === 'product' && r.id) return PRODUCT_BY_ID.get(r.id) || this.online.get(r.id);
    return null;
  },

  page_product(r) {
    const p = this.productOf(r);
    if (!p) return this.page_discover();
    const a = analyse(p);
    const brand = p.brandId ? BRAND_BY_ID.get(p.brandId) : null;
    const s = p.specs;
    const badges = [
      s.spf && `<span class="cz-badge is-sun">${icon('sun', { size: 14 })}SPF ${esc(s.spf)}</span>`,
      s.pa && `<span class="cz-badge">PA${esc(s.pa)}</span>`,
      s.water && `<span class="cz-badge">Water resistant ${esc(s.water)}</span>`,
      p.flags.ff && `<span class="cz-badge is-good">${icon('check', { size: 14 })}Fragrance-free</span>`,
      p.flags.nc && `<span class="cz-badge is-good">${icon('check', { size: 14 })}Non-comedogenic</span>`,
      p.flags.vegan && `<span class="cz-badge is-good">${icon('check', { size: 14 })}Vegan</span>`,
      s.conc && `<span class="cz-badge">${esc(s.conc)}</span>`,
    ].filter(Boolean).join('');
    const actives = s.actives ? s.actives.split(',').map(x => x.trim()).filter(Boolean) : a.actives.slice(0, 5).map(x => x.name);
    const pct = (t) => { const m = /(\d+(?:\.\d+)?)\s*%/.exec(t); return m ? Number(m[1]) : null; };
    const KV = [['Type', typeLabel(p.type)], ['Size', p.size], ['Launched', p.year], ['Skin / hair', s.skin || s.hair || s.lips || s.teeth], ['Finish', s.finish], ['Coverage', s.coverage], ['Shades', s.shades || s.shade],
      ['Wear', s.wear], ['UVA', s.uva], ['pH', s.ph], ['Fluoride', s.fluoride], ['Alcohol', s.alcohol], ['Protection', s.protection], ['Family', s.family], ['Perfumer', s.perfumer],
      ['Top notes', s.top], ['Heart notes', s.heart], ['Base notes', s.base], ['Formula', s.formula], ['Claim', s.claim], ['Made by', brand ? [brand.name, brand.parent && brand.parent !== brand.name ? brand.parent : ''].filter(Boolean).join(' · ') : p.brand],
      ['Countries', p.countries]].filter(([, v]) => v);
    const similar = p.source === 'catalogue' ? similarProducts(p, 6) : [];
    const more = p.brandId ? productsOfBrand(p.brandId).filter(x => x.id !== p.id).slice(0, 6) : [];
    return `
      <section class="cz-phero">
        <div class="cz-pack-art cat-${p.category}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : `<span>${packOf(p, 96)}</span>`}<i></i><i></i><i></i></div>
        <div class="cz-phero-text">
          ${brand ? `<button type="button" class="cz-brandlink" data-go-brand="${esc(brand.id)}">${esc(brand.name)}${icon('chevron-right', { size: 14 })}</button>` : `<span class="cz-brandlink is-plain">${esc(p.brand)}</span>`}
          <h2>${esc(p.name)}</h2>
          <p class="cz-sub">${esc([typeLabel(p.type), p.size, p.year ? `launched ${p.year}` : '', brand?.country].filter(Boolean).join(' · '))}</p>
          ${badges ? `<div class="cz-badges">${badges}</div>` : ''}
          ${p.source === 'openbeautyfacts' ? `<p class="cz-muted">Community label from Open Beauty Facts. ${p.modified ? `Record edited ${esc(p.modified)}. ` : ''}${p.imported ? `Offline snapshot: ${esc(p.imported)}. ` : ''}Not independently verified. <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">See the record${icon('external', { size: 12 })}</a></p>` : ''}
        </div>
      </section>
      ${actives.length ? `<section class="cz-card cz-sec"><div class="cz-sec-head"><h3>Key actives</h3></div>
        <div class="cz-actives">${actives.map(t => { const v = pct(t); return `<div class="cz-active"><span>${esc(t)}</span>${v != null ? `<span class="cz-meter"><i style="--w:${Math.min(100, v / 30 * 100)}%"></i></span><b data-count="${v}"${v % 1 ? ' data-dec="1"' : ''} data-suffix="%">${v}%</b>` : ''}</div>`; }).join('')}</div></section>` : ''}
      ${p.inci.length ? `<section class="cz-card cz-sec">
        <div class="cz-sec-head"><h3>What the formula is made of</h3><span class="cz-muted">${p.inci.length} ingredients, grouped by what they do</span></div>
        ${this.compoHtml(a)}
      </section>` : ''}
      ${a.notes.length ? `<section class="cz-sec"><h3>Worth knowing</h3><div class="cz-notes">${a.notes.map(n => `<div class="cz-note is-${n.kind}"><span class="cz-note-icon">${icon(n.kind === 'good' ? 'check-circle' : n.kind === 'warn' ? 'alert' : 'info', { size: 18 })}</span><span><strong>${esc(n.title)}</strong><small>${esc(n.text)}</small></span></div>`).join('')}</div></section>` : ''}
      <section class="cz-card cz-sec">
        <div class="cz-sec-head"><h3>Every ingredient</h3><span class="cz-muted">${p.source === 'openbeautyfacts' ? 'As transcribed by contributors; verify order and completeness on the pack' : 'In label order, highest amount first (below 1% the order is free)'}</span></div>
        ${p.typical ? `<p class="cz-typical">${icon('info', { size: 15 })}Representative list: the key ingredients are confirmed, the full list may differ from the pack you have.</p>` : ''}
        <ol class="cz-ings">${a.rows.map(row => `<li><button type="button" class="cz-irow" ${row.info ? `data-go-ingredient="${esc(row.info.inci)}"` : `data-compound-search="${esc(row.name)}"`}>
          <span class="cz-irow-pos">${row.position}</span>
          <i class="cz-dot g-${row.group}"></i>
          <span class="cz-irow-main"><strong>${esc(row.name)}</strong><small>${row.info ? esc(alsoKnown(row.info, row.name) ? `${row.info.c} · ${row.fn}` : row.fn) : 'Not in the dictionary yet: look it up in the Compound Database'}</small></span>
          ${row.info?.formula ? `<span class="cz-formula">${formulaHtml(row.info.formula)}</span>` : ''}
          ${icon('chevron-right', { size: 16 })}
        </button></li>`).join('') || '<li class="cz-muted">Open Beauty Facts has no ingredient list for this product yet.</li>'}</ol>
      </section>
      ${KV.length ? `<section class="cz-card cz-sec"><div class="cz-sec-head"><h3>Specifications</h3></div><dl class="cz-kv">${KV.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
      ${similar.length ? `<section class="cz-sec"><h3>Similar formulas</h3><div class="cz-sims">${similar.map(x => `<button type="button" class="cz-sim" data-go-product="${esc(x.product.id)}"><span class="cz-pcard-art cat-${x.product.category}">${packOf(x.product, 28)}</span><span><small>${esc(x.product.brand)}</small><strong>${esc(x.product.name)}</strong><em>${x.shared} ingredients in common</em></span></button>`).join('')}</div></section>` : ''}
      ${more.length ? `<section class="cz-sec"><h3>More from ${esc(brand.name)}</h3><div class="cz-grid">${more.map(x => this.productCard(x)).join('')}</div></section>` : ''}`;
  },

  page_brand(r) {
    const b = BRAND_BY_ID.get(r.id);
    if (!b) return this.page_brands();
    const list = productsOfBrand(b.id);
    const siblings = b.parent ? BRANDS.filter(x => x.parent === b.parent && x.id !== b.id).slice(0, 12) : [];
    return `
      <section class="cz-phero is-brand">
        <div class="cz-pack-art is-mono"><span class="cz-mono is-big">${esc(initials(b.name))}</span><i></i><i></i><i></i></div>
        <div class="cz-phero-text">
          <span class="cz-brandlink is-plain">${esc(REGION_BY_ID[b.region]?.label || b.country)}</span>
          <h2>${esc(b.name)}</h2>
          <p class="cz-sub">${esc([b.country, b.founded ? `founded ${b.founded}` : '', b.parent && b.parent !== b.name ? `part of ${b.parent}` : 'independent'].filter(Boolean).join(' · '))}</p>
          <div class="cz-badges">${b.tier ? `<span class="cz-badge">${esc(b.tier[0].toUpperCase() + b.tier.slice(1))}</span>` : ''}${b.focus.map(f => `<span class="cz-badge">${esc(f[0].toUpperCase() + f.slice(1))}</span>`).join('')}</div>
        </div>
      </section>
      ${list.length ? `<section class="cz-sec"><h3>${list.length} product${list.length === 1 ? '' : 's'} in detail</h3><div class="cz-grid">${list.map(p => this.productCard(p)).join('')}</div></section>` : ''}
      <section class="cz-card cz-sec cz-online-cta">
        <div><h3>Every ${esc(b.name)} product</h3><p class="cz-muted">Read the labels of the rest of the range, live from Open Beauty Facts.</p></div>
        <button type="button" class="btn btn-primary cz-cta" data-go-online="${esc(b.name)}">${icon('search', { size: 16 })}Search ${esc(b.name)}</button>
      </section>
      ${siblings.length ? `<section class="cz-sec"><h3>Also from ${esc(b.parent)}</h3><div class="cz-chips">${siblings.map(x => `<button type="button" class="cz-chip" data-go-brand="${esc(x.id)}">${esc(x.name)}<small>${esc(x.country)}</small></button>`).join('')}</div></section>` : ''}`;
  },

  page_ingredient(r) {
    const info = ingredientInfo(r.inci);
    if (!info) return this.page_ingredients();
    const uses = productsWith(info.inci).slice().sort((x, y) => x.position - y.position);
    const g = groupOf(info.f);
    const sameJob = Object.entries(INCI).filter(([k, v]) => k !== info.inci && groupOf(v.f).id === g.id).map(([k]) => ({ k, n: productsWith(k).length }))
      .sort((a, b) => b.n - a.n).slice(0, 10);
    const aliases = Object.entries(INCI).filter(([k, v]) => v.c === info.c && k !== info.inci).map(([k]) => k);
    const facts = [['Compound Database record', info.c], ['What it does', info.f], ['Formula', info.formula ? formulaHtml(info.formula) : ''], ['Molar mass', info.mw ? `${info.mw} g/mol` : ''],
      ['CAS number', info.cas], ['PubChem CID', info.cid ? `<a href="https://pubchem.ncbi.nlm.nih.gov/compound/${info.cid}" target="_blank" rel="noopener noreferrer">${info.cid}${icon('external', { size: 12 })}</a>` : ''],
      ['Also on labels as', aliases.join(', ')]].filter(([, v]) => v);
    return `
      <section class="cz-phero is-ingredient">
        <div class="cz-pack-art is-molecule g-${g.id}"><span>${icon('sparkle', { size: 64 })}</span>${info.cid ? `<img src="https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${info.cid}/PNG?image_size=300x300" alt="Structure of ${esc(info.c)}" loading="lazy" onerror="this.remove()">` : ''}<i></i><i></i><i></i></div>
        <div class="cz-phero-text">
          <span class="cz-brandlink is-plain"><i class="cz-dot g-${g.id}"></i>${esc(g.label)}</span>
          <h2>${esc(info.inci)}</h2>
          <p class="cz-sub">${esc(info.f)}</p>
          <div class="cz-badges"><button type="button" class="btn btn-primary btn-sm cz-cta" data-open-compound="${esc(info.c)}">${icon('external', { size: 14 })}Open in the Compound Database</button></div>
        </div>
      </section>
      <section class="cz-card cz-sec"><div class="cz-sec-head"><h3>The compound</h3></div><dl class="cz-kv">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${k === 'Formula' || k === 'PubChem CID' ? v : esc(v)}</dd></div>`).join('')}</dl></section>
      ${uses.length ? `<section class="cz-card cz-sec"><div class="cz-sec-head"><h3>In ${uses.length} product${uses.length === 1 ? '' : 's'}</h3><span class="cz-muted">Where it sits on each list</span></div>
        ${uses.map(u => `<button type="button" class="cz-urow" data-go-product="${esc(u.product.id)}">
          <span class="cz-pcard-art cat-${u.product.category}">${packOf(u.product, 24)}</span>
          <span class="cz-urow-main"><small>${esc(u.product.brand)}</small><strong>${esc(u.product.name)}</strong></span>
          <span class="cz-posbar" title="Position ${u.position} of ${u.product.inci.length}"><i style="--w:${Math.max(4, 100 - (u.position - 1) / Math.max(1, u.product.inci.length - 1) * 100).toFixed(1)}%"></i></span>
          <span class="cz-urow-pos">#${u.position}<small> of ${u.product.inci.length}</small></span>
        </button>`).join('')}</section>` : ''}
      ${sameJob.length ? `<section class="cz-sec"><h3>Does the same job</h3><div class="cz-chips">${sameJob.map(x => `<button type="button" class="cz-chip" data-go-ingredient="${esc(x.k)}">${esc(x.k)}${x.n ? `<small>${x.n}</small>` : ''}</button>`).join('')}</div></section>` : ''}`;
  },

  page_online(r) {
    const key = r.q.toLowerCase();
    const cached = this.onlineResults?.[key];
    if (!cached) this.after = () => this.loadOnline(r.q);
    return `
      <section class="cz-phero is-online">
        <div class="cz-pack-art is-globe"><span>${icon('search', { size: 56 })}</span><i></i><i></i><i></i></div>
        <div class="cz-phero-text">
          <span class="cz-brandlink is-plain">Every brand, worldwide</span>
          <h2>${esc(r.q)}</h2>
          <p class="cz-sub">Live product labels from Open Beauty Facts, the open database of cosmetics</p>
        </div>
      </section>
      <div class="cz-online" data-online="${esc(key)}">${cached ? this.onlineHtml(cached) : `<p class="cz-status" role="status"><span class="cz-spin" aria-hidden="true"></span>Reading labels from Open Beauty Facts…</p>`}</div>`;
  },
  onlineHtml(res) {
    if (res.error) return `<p class="cz-status is-error" role="status">${icon('alert', { size: 16 })}${esc(res.error)}</p>`;
    if (!res.list.length) return `<p class="cz-status" role="status">Open Beauty Facts has nothing under that name yet. Try the brand alone, or the name as printed on the pack.</p>`;
    return `<p class="cz-muted cz-count">${res.list.length} product${res.list.length === 1 ? '' : 's'} found</p><div class="cz-grid">${res.list.map(p => this.productCard(p)).join('')}</div>`;
  },
  async loadOnline(q) {
    const key = q.toLowerCase();
    this.abort?.abort();
    this.abort = typeof AbortController === 'function' ? new AbortController() : null;
    let res;
    try {
      const list = await searchOnline(q, { signal: this.abort?.signal });
      list.forEach(p => this.online.set(p.id, p));
      res = { list };
    } catch (err) {
      if (err?.name === 'AbortError') return;
      res = { list: [], error: navigator.onLine === false ? 'You are offline. The built-in catalogue still works; search every brand once you are back online.' : 'Open Beauty Facts did not answer. Try again in a moment.' };
    }
    (this.onlineResults ||= {})[key] = res;
    const box = this.container?.querySelector(`[data-online="${CSS.escape(key)}"]`);
    if (!box) return;
    box.innerHTML = this.onlineHtml(res);
    this.motion.enter(box, { mode: 'quick' });
  },

  /* ---------------- events ---------------- */
  click(e) {
    const t = e.target;
    const row = t.closest('.cz-dd-row');
    if (row) { e.preventDefault(); this.activate(row); return; }
    if (t.closest('[data-qs-go]')) {
      const first = this.el.qs.querySelector('.cz-dd-row.is-active') || this.el.qs.querySelector('.cz-dd-row');
      if (first) this.activate(first); else { this.fillDropdown(); const r = this.el.qs.querySelector('.cz-dd-row'); if (r) this.activate(r); }
      return;
    }
    if (t.closest('[data-back]')) { this.back(); return; }
    const tab = t.closest('[data-tab]');
    if (tab) { if (!(this.stack.length === 1 && this.route().page === tab.dataset.tab)) this.tab(tab.dataset.tab); return; }
    const d = (sel) => t.closest(sel);
    let x;
    if ((x = d('[data-go-product]'))) { this.go({ page: 'product', id: x.dataset.goProduct }); return; }
    if ((x = d('[data-go-brand]'))) { this.go({ page: 'brand', id: x.dataset.goBrand }); return; }
    if ((x = d('[data-go-ingredient]'))) { this.go({ page: 'ingredient', inci: x.dataset.goIngredient }); return; }
    if ((x = d('[data-go-online]'))) { this.go({ page: 'online', q: x.dataset.goOnline }); return; }
    if ((x = d('[data-cat]'))) { this.productsState = { ...this.productsState, cat: x.dataset.cat, shown: PAGE }; this.stack = [{ page: 'products' }]; this.show(1); return; }
    if ((x = d('[data-region]'))) { this.brandsState = { region: x.dataset.region, q: '' }; this.stack = [{ page: 'brands' }]; this.show(1); return; }
    if ((x = d('[data-filter-cat]'))) { this.productsState.cat = x.dataset.filterCat; this.productsState.shown = PAGE; this.refresh(); return; }
    if ((x = d('[data-filter-region]'))) { this.brandsState.region = x.dataset.filterRegion; this.refresh(); return; }
    if ((x = d('[data-filter-group]'))) { this.ingState.group = x.dataset.filterGroup; this.ingState.shown = 120; this.refresh(); return; }
    if ((x = d('[data-more]'))) {
      if (x.dataset.more === 'products') this.productsState.shown += PAGE; else this.ingState.shown += 120;
      this.refresh({ keepScroll: true });
      return;
    }
    if ((x = d('[data-open-compound]'))) { openCompound(x.dataset.openCompound); return; }
    if ((x = d('[data-compound-search]'))) { openCompound(x.dataset.compoundSearch); }
  },
  input(e) {
    const t = e.target;
    if (t.matches('[data-qs-input]')) { this.fillDropdown(); return; }
    if (t.dataset.filter === 'brand-q') { this.brandsState.q = t.value; this.refreshList('.cz-brand-list', () => this.page_brands()); return; }
    if (t.dataset.filter === 'ing-q') { this.ingState.q = t.value; this.ingState.shown = 120; this.refreshList('.cz-list', () => this.page_ingredients(), ['.cz-count', '.cz-more']); }
  },
  change(e) {
    const t = e.target;
    if (t.dataset.filter === 'ff' || t.dataset.filter === 'spf') { this.productsState[t.dataset.filter] = t.checked; this.productsState.shown = PAGE; this.refresh(); return; }
    if (t.dataset.filter === 'sort') { this.productsState.sort = t.value; this.refresh(); }
    if (t.dataset.filter === 'source') { this.productsState.source = t.value; this.productsState.shown = PAGE; this.refresh(); }
  },
  keydown(e) {
    if (!e.target.matches?.('[data-qs-input]')) return;
    const rows = [...this.el.qs.querySelectorAll('.cz-dd-row')];
    const i = rows.findIndex(r => r.classList.contains('is-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.setActive(e.key === 'ArrowDown' ? i + 1 : i - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = rows[Math.max(0, i)]; if (r) this.activate(r); }
    else if (e.key === 'Escape' && !this.el.qs.querySelector('.cz-dd').hidden) { e.preventDefault(); e.stopPropagation(); this.closeDropdown(); }
  },

  /** Filters changed: the page redraws in place and its results arrive quickly (the filter bar keeps its place). */
  refresh({ keepScroll = false } = {}) {
    const y = window.scrollY;
    const f = flip(this.el.page, { scale: false, duration: 420 });
    this.motion.reset();
    const r = this.route();
    this.el.page.innerHTML = this[`page_${r.page}`](r);
    this.el.page.querySelectorAll('.cz-filters').forEach(n => n.classList.add('rv-arrived'));
    f.play();
    this.motion.enter(this.el.page, { mode: 'quick' });
    if (keepScroll) window.scrollTo(0, y);
  },
  /** Typing in a filter box: only the list redraws, so the box keeps focus. */
  refreshList(sel, html, extra = []) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html();
    for (const s of [sel, ...extra]) {
      const now = this.el.page.querySelector(s), next = tmp.querySelector(s);
      if (now && next) now.replaceWith(next); else if (now && !next) now.remove(); else if (!now && next) this.el.page.appendChild(next);
    }
    this.motion.reset();
    const box = this.el.page.querySelector(sel);
    if (box) this.motion.enter(box, { mode: 'quick' });
  },
};

/** The compound's own name, when it tells you something the label name and its job do not ("Aqua" → Water, not "Parfum" → Fragrance). */
function alsoKnown(info, label) {
  const c = String(info.c).toLowerCase();
  return c !== String(label).toLowerCase() && !String(info.f).toLowerCase().startsWith(c);
}

function initials(name) {
  const w = String(name).replace(/[^A-Za-z0-9À-ÿ&+ ]/g, ' ').split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
}

/** C8H9NO2 → C<sub>8</sub>H<sub>9</sub>NO<sub>2</sub> */
function formulaHtml(f) {
  return esc(f).replace(/(\d+)/g, '<sub>$1</sub>');
}

/** Opens a record in the Compound Database (it reads this key on open, like the Vehicle Guide's links). */
function openCompound(name) {
  try { localStorage.setItem('toolbox.compounds.focus', JSON.stringify({ name })); } catch { /* opens without focus */ }
  window.location.hash = '#compound-database';
}
