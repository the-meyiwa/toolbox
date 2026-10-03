/* ============================================================
   Toolbox Admin — for the owner only.

   Overview   how many people use Toolbox, who joined lately, and
              what has been contributed
   People     every account, searchable, with what each has given
              and which private tools they can open
   Support    every contribution, verified or still pending
   Private    the private tools: open them, and choose exactly who
              else may (another Toolbox user, by email or @username)

   Everything is read through database functions that check the
   signed-in owner's session (supabase/admin.sql); nothing here is
   trusted on its own. Motion: transform and opacity only.
   ============================================================ */

import { TOOLS, BY_ID } from '../registry/index.js';
import { adminRpc, isOwner, refreshAdminAccess } from '../lib/admin-access.js';
import { avatarSrcOf } from '../lib/profile-pictures.js';
import { showToast } from '../utils.js';

const GLIDE = 'cubic-bezier(.22, 1, .36, 1)';
// No motion where the person asked for less, or where the page cannot animate at all.
const reduced = () => typeof document === 'undefined' || typeof document.body?.animate !== 'function'
  || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (p, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  overview: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M16 4.5a3 3 0 0 1 0 6M18 15c1.8.6 3 2.3 3.3 5"/>',
  support: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  private: '<rect x="4" y="10" width="16" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
};
const TABS = [['overview', 'Overview'], ['people', 'People'], ['support', 'Contributions'], ['private', 'Private tools']];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const ago = (d) => {
  if (!d) return 'never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 30 * 86400) return `${Math.round(s / 86400)}d ago`;
  return fmtDate(d);
};
const money = (amount, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0); }
  catch { return `${currency} ${Number(amount || 0).toFixed(2)}`; }
};
const privateTools = () => TOOLS.filter(t => t.admin && t.id !== 'toolbox-admin');

function avatar(u, size = 36) {
  const src = avatarSrcOf(u);
  const name = u.display_name || u.username || u.email || '?';
  return src
    ? `<img class="adm-av" src="${esc(src)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="adm-av adm-av-letter" aria-hidden="true">${esc(name.trim()[0]?.toUpperCase() || '?')}</span>`;
}

/** Rows arrive in a short cascade; already-visible rows are left alone. */
function arrive(els, { y = 10, step = 34, max = 12 } = {}) {
  if (reduced()) return;
  [...els].forEach((el, i) => el.animate?.([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 440, delay: Math.min(i, max) * step, easing: GLIDE, fill: 'backwards', tempo: false }));
}

/** A number counts up to its value (text only: no layout beyond the tile). */
function countUp(el, to) {
  const target = Number(to) || 0;
  if (reduced() || target < 2) { el.textContent = target.toLocaleString(); return; }
  const start = performance.now(), dur = 520;
  const tick = (now) => {
    const k = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString();
    if (k < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export default {
  render(container) {
    this.root = container;
    if (!isOwner()) {
      container.innerHTML = `<div class="adm-empty"><h2>Toolbox Admin is only for the owner</h2></div>`;
      return;
    }
    this.tab = 'overview';
    this.users = { q: '', rows: [], total: 0, loading: false };
    container.innerHTML = `
      <div class="adm">
        <header class="adm-head">
          <div class="adm-title">
            <span class="adm-mark">${ico('<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/>', 20)}</span>
            <div><h2>Toolbox Admin</h2><p>Only you can see this.</p></div>
          </div>
          <button type="button" class="adm-icon-btn" data-act="reload" aria-label="Refresh" title="Refresh">${ico(I.refresh, 18)}</button>
        </header>
        <nav class="adm-tabs" role="tablist" aria-label="Admin sections">
          <span class="adm-tab-pill" aria-hidden="true"></span>
          ${TABS.map(([id, label]) => `<button type="button" role="tab" class="adm-tab" data-tab="${id}" aria-selected="${id === this.tab}">${ico(I[id], 16)}<span>${label}</span></button>`).join('')}
        </nav>
        <div class="adm-note" hidden></div>
        <section class="adm-panel" aria-live="polite"></section>
      </div>`;
    this.el = container.querySelector('.adm');
    this.panel = container.querySelector('.adm-panel');
    this.note = container.querySelector('.adm-note');
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => { if (e.target.matches('.adm-search input')) this.searchUsers(e.target.value); });
    this.el.addEventListener('submit', (e) => { e.preventDefault(); if (e.target.matches('.adm-grant')) this.grant(e.target); });
    this.onResize = () => this.placePill(true);
    window.addEventListener('resize', this.onResize);
    requestAnimationFrame(() => this.placePill(true));
    this.show('overview', { first: true });
  },

  destroy() {
    window.removeEventListener('resize', this.onResize);
    clearTimeout(this.searchTimer);
    this.dead = true;
  },

  placePill(instant = false) {
    const on = this.el?.querySelector('.adm-tab[aria-selected="true"]');
    const pill = this.el?.querySelector('.adm-tab-pill');
    if (!on || !pill) return;
    if (instant) pill.style.transition = 'none';
    pill.style.width = `${on.offsetWidth}px`;
    pill.style.transform = `translateX(${on.offsetLeft}px)`;
    if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
  },

  setNote(err) {
    if (!err) { this.note.hidden = true; return; }
    this.note.hidden = false;
    this.note.classList.toggle('is-setup', !!err.setup);
    this.note.innerHTML = err.setup
      ? `<strong>One step left.</strong> Run <code>supabase/admin.sql</code> in the Supabase SQL editor, then refresh. Until then your private tools still work; people and contributions need it.`
      : esc(err.message || 'Something went wrong.');
  },

  /** Switches section: the old one lifts away, the new one settles in from the side it lies on. */
  async show(tab, { first = false } = {}) {
    const from = TABS.findIndex(t => t[0] === this.tab), to = TABS.findIndex(t => t[0] === tab);
    this.tab = tab;
    this.el.querySelectorAll('.adm-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    this.placePill();
    const dir = first ? 0 : Math.sign(to - from);
    const paint = (html) => {
      if (this.dead || this.tab !== tab) return;
      this.panel.innerHTML = html;
      if (!reduced()) this.panel.animate([{ opacity: 0, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: 'none' }], { duration: 340, easing: GLIDE, tempo: false });
    };
    if (!first && !reduced()) {
      await this.panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 10}px)` }], { duration: 170, easing: 'ease-in', fill: 'forwards', tempo: false }).finished.catch(() => {});
      this.panel.getAnimations().forEach(a => a.cancel());
    }
    if (tab === 'overview') return this.overview(paint);
    if (tab === 'people') return this.people(paint);
    if (tab === 'support') return this.support(paint);
    return this.privateTools(paint);
  },

  skeleton(n = 4) {
    return `<div class="adm-skel">${Array.from({ length: n }, () => '<span></span>').join('')}</div>`;
  },

  /* ---------- Overview ---------- */
  async overview(paint) {
    paint(this.skeleton(6));
    let o;
    try { o = await adminRpc('admin_overview'); this.setNote(null); } catch (err) { this.setNote(err); paint(this.privateSummary()); return; }
    this.lastOverview = o;
    const totals = Object.entries(o.totals || {});
    const days = o.signups || [];
    const max = Math.max(1, ...days.map(d => d.count));
    paint(`
      <div class="adm-stats">
        ${[['users', 'People on Toolbox'], ['new7d', 'Joined this week'], ['active7d', 'Signed in this week'], ['supporters', 'Supporters'], ['contributions', 'Contributions'], ['grants', 'Private tool shares']]
          .map(([k, label]) => `<div class="adm-stat"><strong data-count="${Number(o[k]) || 0}">0</strong><span>${label}</span></div>`).join('')}
      </div>
      <div class="adm-cols">
        <section class="adm-card">
          <h3>Sign-ups, last 30 days</h3>
          ${days.length ? `<div class="adm-bars" role="img" aria-label="Sign-ups per day over the last 30 days">${days.map((d) => `<i style="--h:${(d.count / max).toFixed(3)}" title="${esc(fmtDate(d.day))}: ${d.count}"></i>`).join('')}</div>` : '<p class="adm-muted">No one joined in the last 30 days.</p>'}
        </section>
        <section class="adm-card">
          <h3>Contributed</h3>
          ${totals.length ? `<ul class="adm-totals">${totals.map(([c, v]) => `<li><span>${esc(c)}</span><strong>${esc(money(v, c))}</strong></li>`).join('')}</ul>` : '<p class="adm-muted">No verified contributions yet.</p>'}
          ${o.pending ? `<p class="adm-muted">${o.pending} still waiting for payment.</p>` : ''}
        </section>
      </div>
      ${this.privateSummary()}`);
    this.panel.querySelectorAll('[data-count]').forEach(el => countUp(el, el.dataset.count));
    arrive(this.panel.querySelectorAll('.adm-stat, .adm-card'), { step: 34 });
    if (!reduced()) this.panel.querySelectorAll('.adm-bars i').forEach((b, i) => b.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 500, delay: 120 + i * 10, easing: GLIDE, fill: 'backwards', tempo: false }));
  },

  privateSummary() {
    return `<section class="adm-card adm-card-tools"><h3>Your private tools</h3><div class="adm-toolrow">${privateTools().map(t => `
      <a class="adm-toolchip" href="#${t.id}"><span class="adm-toolchip-ico">${t.icon}</span><span>${esc(t.name)}</span></a>`).join('')}</div></section>`;
  },

  /* ---------- People ---------- */
  async people(paint) {
    paint(`
      <label class="adm-search">${ico(I.search, 16)}<input type="search" placeholder="Search by name, @username or email" value="${esc(this.users.q)}" aria-label="Search people" autocomplete="off" spellcheck="false"></label>
      <p class="adm-count adm-muted"></p>
      <ul class="adm-list adm-people" role="list"></ul>
      <button type="button" class="adm-more" data-act="more" hidden>Show more</button>`);
    await this.loadUsers({ reset: true });
  },

  searchUsers(q) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.users.q = q.trim(); this.loadUsers({ reset: true }); }, 220);
  },

  async loadUsers({ reset = false } = {}) {
    const list = this.panel.querySelector('.adm-people');
    if (!list) return;
    const offset = reset ? 0 : this.users.rows.length;
    if (reset) list.innerHTML = this.skeleton(5);
    let rows;
    try { rows = await adminRpc('admin_list_users', { p_query: this.users.q, p_limit: 40, p_offset: offset }); this.setNote(null); }
    catch (err) { this.setNote(err); list.innerHTML = ''; return; }
    if (this.dead || this.tab !== 'people') return;
    this.users.rows = reset ? rows : [...this.users.rows, ...rows];
    this.users.total = Number(rows[0]?.total ?? (reset ? 0 : this.users.total));
    if (reset) list.innerHTML = '';
    const start = list.children.length;
    list.insertAdjacentHTML('beforeend', rows.map(u => this.personRow(u)).join(''));
    arrive([...list.children].slice(start));
    this.panel.querySelector('.adm-count').textContent = this.users.total
      ? `${this.users.total.toLocaleString()} ${this.users.total === 1 ? 'person' : 'people'}${this.users.q ? ` matching “${this.users.q}”` : ''}`
      : (this.users.q ? `No one matches “${this.users.q}”.` : 'No one has signed up yet.');
    this.panel.querySelector('.adm-more').hidden = this.users.rows.length >= this.users.total;
  },

  personRow(u) {
    const given = Object.entries(u.contributed || {});
    return `<li class="adm-person" data-user="${esc(u.id)}">
      ${avatar(u)}
      <div class="adm-person-main">
        <strong>${esc(u.display_name || u.username || u.email)}</strong>
        <span class="adm-muted">${u.username ? `@${esc(u.username)} · ` : ''}${esc(u.email)}</span>
        <span class="adm-tags">
          ${u.supporter ? '<span class="adm-tag is-ink">Supporter</span>' : ''}
          ${!u.confirmed ? '<span class="adm-tag">Unverified</span>' : ''}
          <span class="adm-tag">${esc(u.provider === 'email' ? 'Email' : u.provider[0].toUpperCase() + u.provider.slice(1))}</span>
          ${(u.tools || []).map(id => `<span class="adm-tag">${esc(BY_ID.get(id)?.name || id)}</span>`).join('')}
        </span>
      </div>
      <div class="adm-person-side">
        <span>Joined ${esc(fmtDate(u.created_at))}</span>
        <span class="adm-muted">Seen ${esc(ago(u.last_sign_in_at))}</span>
        ${given.length ? `<span class="adm-given">${given.map(([c, v]) => esc(money(v, c))).join(' · ')}</span>` : ''}
      </div>
    </li>`;
  },

  /* ---------- Contributions ---------- */
  async support(paint) {
    paint(this.skeleton(5));
    let rows;
    try { rows = await adminRpc('admin_list_contributions', { p_limit: 200 }); this.setNote(null); } catch (err) { this.setNote(err); paint(''); return; }
    if (!rows.length) { paint('<div class="adm-empty-card"><p>No contributions yet.</p></div>'); return; }
    paint(`<p class="adm-count adm-muted">${Number(rows[0].total).toLocaleString()} contribution${Number(rows[0].total) === 1 ? '' : 's'}</p>
      <ul class="adm-list adm-support" role="list">${rows.map(c => `
        <li class="adm-gift${c.verified ? '' : ' is-pending'}">
          <span class="adm-gift-amount">${esc(money(c.paid_amount ?? c.amount, c.currency))}</span>
          <span class="adm-gift-who">${c.email ? `${esc(c.username ? `@${c.username}` : c.email)}` : '<span class="adm-muted">Not signed in</span>'}</span>
          <span class="adm-tag${c.verified ? ' is-ink' : ''}">${c.verified ? 'Verified' : 'Pending'}</span>
          <span class="adm-muted adm-gift-date">${esc(fmtDate(c.verified_at || c.created_at))}</span>
        </li>`).join('')}</ul>`);
    arrive(this.panel.querySelectorAll('.adm-gift'));
  },

  /* ---------- Private tools ---------- */
  async privateTools(paint) {
    let grants = null;
    try { grants = await adminRpc('admin_list_grants'); this.setNote(null); } catch (err) { this.setNote(err); }
    const byTool = new Map();
    for (const g of grants || []) { if (!byTool.has(g.tool_id)) byTool.set(g.tool_id, []); byTool.get(g.tool_id).push(g); }
    paint(`<p class="adm-lead">Private tools are yours alone until you give someone access. They must already have a Toolbox account with a verified email.</p>
      <div class="adm-tools">${privateTools().map(t => this.toolCard(t, byTool.get(t.id) || [], grants !== null)).join('')}</div>`);
    arrive(this.panel.querySelectorAll('.adm-tool'), { step: 42 });
  },

  toolCard(t, people, ready) {
    return `<article class="adm-tool" data-tool="${esc(t.id)}">
      <header class="adm-tool-head">
        <span class="adm-tool-ico">${t.icon}</span>
        <div><h3>${esc(t.name)}</h3><p class="adm-muted">${esc(t.description)}</p></div>
        <a class="adm-btn" href="#${esc(t.id)}">${ico(I.open, 15)}<span>Open</span></a>
      </header>
      <div class="adm-access">
        <p class="adm-access-label">${people.length ? 'Who else can open it' : 'Only you can open it'}</p>
        <ul class="adm-chips" role="list">${people.map(g => this.grantChip(g)).join('')}</ul>
        ${ready ? `<form class="adm-grant" data-tool="${esc(t.id)}">
          <input type="text" name="who" placeholder="Email or @username" aria-label="Give ${esc(t.name)} to" autocomplete="off" spellcheck="false" required>
          <button type="submit" class="adm-btn is-ink">${ico(I.plus, 15)}<span>Give access</span></button>
        </form>` : ''}
      </div>
    </article>`;
  },

  grantChip(g) {
    return `<li class="adm-chip" data-user="${esc(g.user_id)}">${avatar(g, 22)}<span>${esc(g.username ? `@${g.username}` : g.email)}</span>
      <button type="button" class="adm-chip-x" data-act="revoke" aria-label="Take ${esc(g.username || g.email)}'s access away">${ico(I.x, 12)}</button></li>`;
  },

  async grant(form) {
    const tool = form.dataset.tool;
    const input = form.querySelector('input');
    const who = input.value.trim();
    if (!who) return;
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const [g] = await adminRpc('admin_grant_tool', { p_tool: tool, p_who: who });
      const card = form.closest('.adm-tool');
      const list = card.querySelector('.adm-chips');
      if (g && !list.querySelector(`[data-user="${CSS.escape(g.user_id)}"]`)) {
        list.insertAdjacentHTML('beforeend', this.grantChip(g));
        const chip = list.lastElementChild;
        if (!reduced()) chip.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.22, 1, .36, 1)', tempo: false });
      }
      card.querySelector('.adm-access-label').textContent = 'Who else can open it';
      input.value = '';
      showToast(`${g?.username ? `@${g.username}` : who} can now open ${BY_ID.get(tool)?.name || tool}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error', 5000);
      if (!reduced()) form.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 400, easing: 'ease-out', tempo: false });
    } finally { btn.disabled = false; }
  },

  async revoke(chip) {
    const card = chip.closest('.adm-tool');
    const tool = card.dataset.tool, user = chip.dataset.user;
    chip.style.pointerEvents = 'none';
    try {
      await adminRpc('admin_revoke_tool', { p_tool: tool, p_user: user });
      const list = chip.parentElement;
      const sibs = [...list.children].filter(c => c !== chip);
      const before = new Map(sibs.map(s => [s, s.getBoundingClientRect().left]));
      const out = reduced() ? null : chip.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 230, easing: 'ease-in', fill: 'forwards', tempo: false });
      await out?.finished.catch(() => {});
      chip.remove();
      if (!reduced()) sibs.forEach(s => { const dx = before.get(s) - s.getBoundingClientRect().left; if (Math.abs(dx) > 0.5) s.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 310, easing: GLIDE, tempo: false }); });
      if (!list.children.length) card.querySelector('.adm-access-label').textContent = 'Only you can open it';
    } catch (err) {
      chip.style.pointerEvents = '';
      showToast(err.message, 'error', 5000);
    }
  },

  /** What the Assistant sees when opened over Admin (Ctrl/Cmd+K): the numbers, not anyone's details. */
  getAssistantContext() {
    const o = this.lastOverview;
    const tab = TABS.find(t => t[0] === this.tab)?.[1] || 'Overview';
    const numbers = o ? `People: ${o.users} (${o.new7d} joined and ${o.active7d} signed in this week). Supporters: ${o.supporters}. Verified contributions: ${o.contributions}${Object.keys(o.totals || {}).length ? ` (${Object.entries(o.totals).map(([c, v]) => money(v, c)).join(', ')})` : ''}, ${o.pending} pending. Private tool shares: ${o.grants}.` : '';
    return { toolId: 'toolbox-admin', label: `Toolbox Admin · ${tab}`, summary: `Toolbox Admin, the owner's dashboard, on the ${tab} section. ${numbers} Private tools: ${privateTools().map(t => t.name).join(', ')}.`, text: '' };
  },

  onClick(e) {
    const tab = e.target.closest('.adm-tab');
    if (tab && tab.dataset.tab !== this.tab) { this.show(tab.dataset.tab); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'reload') { refreshAdminAccess(); this.show(this.tab, { first: true }); }
    if (act === 'more') this.loadUsers();
    if (act === 'revoke') this.revoke(e.target.closest('.adm-chip'));
  },
};
