/* ============================================================
   Slides as HTML. Shared by the File Explorer preview and Podium,
   so a slide looks the same whether you glance at it or edit it.

   Geometry is written in percentages of the slide and text sizes in
   container-query units, so one slide scales to any width without
   re-rendering.
   ============================================================ */

import { escHtml } from './xml.js';

const pct = (v, of) => `${((v / of) * 100).toFixed(4)}%`;
/** Points → a length that scales with the slide's width. */
export const scaled = (ptSize, deckWidth) => `${((ptSize / deckWidth) * 100).toFixed(4)}cqw`;

const hex = (c) => (/^[0-9a-f]{6}$/i.test(c || '') ? `#${c}` : null);

export function runStyle(r, deck) {
  const s = [];
  if (r.bold) s.push('font-weight:700');
  if (r.italic) s.push('font-style:italic');
  const deco = [r.underline ? 'underline' : '', r.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  if (deco) s.push(`text-decoration:${deco}`);
  if (r.size) s.push(`font-size:${scaled(r.size, deck.width)}`);
  if (hex(r.color)) s.push(`color:${hex(r.color)}`);
  return s.join(';');
}

export function paragraphHtml(p, deck) {
  const style = [];
  if (p.align) style.push(`text-align:${p.align}`);
  const size = p.runs?.[0]?.size || p.size || 18;
  style.push(`font-size:${scaled(size, deck.width)}`);
  if (p.level) style.push(`margin-left:${scaled(p.level * 24, deck.width)}`);
  const inner = (p.runs || []).map(r => `<span style="${runStyle(r, deck)}">${escHtml(r.text).replace(/\n/g, '<br>')}</span>`).join('') || '<br>';
  return `<p class="dk-p${p.bullet ? ' is-bullet' : ''}" data-level="${p.level || 0}" style="${style.join(';')}">${inner}</p>`;
}

export function boxStyle(el, deck) {
  const s = [
    `left:${pct(el.x, deck.width)}`, `top:${pct(el.y, deck.height)}`,
    `width:${pct(el.w, deck.width)}`, `height:${pct(el.h, deck.height)}`,
  ];
  if (el.type === 'box') {
    if (hex(el.fill)) s.push(`background:${hex(el.fill)}`);
    if (hex(el.line)) s.push(`border:${scaled(1, deck.width)} solid ${hex(el.line)}`);
    if (el.shape === 'ellipse') s.push('border-radius:50%');
    if (el.shape === 'roundRect') s.push('border-radius:8%');
    s.push(`justify-content:${el.valign === 'middle' ? 'center' : el.valign === 'bottom' ? 'flex-end' : 'flex-start'}`);
    s.push(`padding:${scaled(5, deck.width)} ${scaled(7, deck.width)}`);
  }
  return s.join(';');
}

export function elementHtml(el, deck, i, { editable = false } = {}) {
  if (el.type === 'image') {
    return `<div class="dk-el dk-img" data-i="${i}" style="${boxStyle(el, deck)}"><img src="${escHtml(el.src)}" alt="" draggable="false"></div>`;
  }
  const body = (el.paragraphs || []).map(p => paragraphHtml(p, deck)).join('');
  return `<div class="dk-el dk-box" data-i="${i}" style="${boxStyle(el, deck)}"><div class="dk-text"${editable ? ' contenteditable="false"' : ''}>${body}</div></div>`;
}

export function slideHtml(slide, deck, opts = {}) {
  const bg = hex(slide.background) || '#ffffff';
  return `<div class="dk-slide" style="aspect-ratio:${deck.width}/${deck.height};background:${bg}">${(slide.elements || []).map((el, i) => elementHtml(el, deck, i, opts)).join('')}</div>`;
}

/** CSS for slides; scoped under .dk-slide so it can live in any page. */
export const DECK_CSS = `
.dk-slide{position:relative;width:100%;container-type:inline-size;overflow:hidden;color:#111;font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;line-height:1.15}
.dk-el{position:absolute;box-sizing:border-box;display:flex;flex-direction:column;overflow:visible}
.dk-img img{width:100%;height:100%;object-fit:fill;display:block}
.dk-text{outline:none;min-height:1em;overflow-wrap:break-word}
.dk-p{margin:0 0 .2em;white-space:pre-wrap}
.dk-p.is-bullet{padding-left:1.1em;position:relative}
.dk-p.is-bullet::before{content:'•';position:absolute;left:.2em}
.dk-p.is-bullet[data-level="1"]::before,.dk-p.is-bullet[data-level="3"]::before{content:'–'}
`;
