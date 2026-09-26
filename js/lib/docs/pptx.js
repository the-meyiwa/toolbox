/* ============================================================
   .pptx read (own OOXML reader) and write (pptxgenjs).

   The deck model Podium edits:
     { width, height,               slide size in points
       slides: [{ background?: 'rrggbb', notes: string, elements: [
         { type: 'box', x, y, w, h, shape?: 'rect'|'ellipse'|'roundRect',
           fill?: 'rrggbb', line?: 'rrggbb', valign?: 'middle'|'bottom',
           paragraphs: [{ align?, bullet?, level?, runs: [{ text, bold?, italic?,
             underline?, strike?, size? (pt), color? }] }] },
         { type: 'image', x, y, w, h, src: dataURL } ] }] }
   ============================================================ */

import { parseXml, kids, kid, path, all, attr, relId, localName, bytesToDataUrl, imageMime, resolvePart, loadZip, toBytes } from './xml.js';
import { mergeRunsSized } from './odf.js';

const EMU_PER_PT = 12700;
const pt = (emu) => (+emu || 0) / EMU_PER_PT;

async function readXml(zip, name) {
  const f = zip.file(name);
  return f ? parseXml(await f.async('string')) : null;
}

async function readRels(zip, part) {
  const dir = part.split('/').slice(0, -1).join('/');
  const file = part.split('/').pop();
  const doc = await readXml(zip, `${dir}/_rels/${file}.rels`);
  const map = new Map();
  for (const r of all(doc?.documentElement, 'Relationship')) {
    map.set(attr(r, 'Id'), {
      type: String(attr(r, 'Type') || '').split('/').pop(),
      target: attr(r, 'TargetMode') === 'External' ? attr(r, 'Target') : resolvePart(part, attr(r, 'Target')),
      external: attr(r, 'TargetMode') === 'External',
    });
  }
  return map;
}

function colorOf(fillParent, theme) {
  const solid = kid(fillParent, 'solidFill');
  if (!solid) return undefined;
  const srgb = kid(solid, 'srgbClr');
  if (srgb) return String(attr(srgb, 'val') || '').toLowerCase() || undefined;
  const scheme = kid(solid, 'schemeClr');
  if (scheme) return theme[attr(scheme, 'val')] || undefined;
  const sys = kid(solid, 'sysClr');
  if (sys) return String(attr(sys, 'lastClr') || '').toLowerCase() || undefined;
  return undefined;
}

async function readTheme(zip) {
  const theme = {};
  const name = Object.keys(zip.files).find(n => /^ppt\/theme\/theme\d+\.xml$/.test(n));
  const doc = name ? await readXml(zip, name) : null;
  const scheme = all(doc?.documentElement, 'clrScheme')[0];
  for (const c of kids(scheme)) {
    const srgb = kid(c, 'srgbClr');
    const sys = kid(c, 'sysClr');
    const v = srgb ? attr(srgb, 'val') : sys ? attr(sys, 'lastClr') : null;
    if (v) theme[localName(c)] = v.toLowerCase();
  }
  Object.assign(theme, { tx1: theme.dk1, bg1: theme.lt1, tx2: theme.dk2, bg2: theme.lt2 });
  return theme;
}

const DEFAULT_SIZES = { title: 44, ctrTitle: 44, subTitle: 24, body: 24, obj: 24, other: 18 };

/** Placeholder geometry and defaults from a layout or master tree. */
function placeholderMap(doc) {
  const map = new Map();
  for (const sp of all(doc?.documentElement, 'sp')) {
    const ph = path(sp, 'nvSpPr', 'nvPr', 'ph');
    if (!ph) continue;
    const xfrm = path(sp, 'spPr', 'xfrm');
    const off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext');
    const lvl1 = path(sp, 'txBody', 'lstStyle', 'lvl1pPr', 'defRPr');
    const anchor = attr(path(sp, 'txBody', 'bodyPr'), 'anchor');
    const info = {
      x: pt(attr(off, 'x')), y: pt(attr(off, 'y')), w: pt(attr(ext, 'cx')), h: pt(attr(ext, 'cy')), hasGeo: !!off,
      size: lvl1 && attr(lvl1, 'sz') ? +attr(lvl1, 'sz') / 100 : undefined,
      anchor,
      algn: attr(path(sp, 'txBody', 'lstStyle', 'lvl1pPr'), 'algn'),
    };
    const type = attr(ph, 'type') || 'body';
    const idx = attr(ph, 'idx');
    if (idx != null) map.set(`idx:${idx}`, info);
    if (!map.has(`type:${type}`)) map.set(`type:${type}`, info);
  }
  return map;
}

function lookupPh(maps, ph) {
  if (!ph) return null;
  const type = attr(ph, 'type') || 'body';
  const idx = attr(ph, 'idx');
  const typeKeys = type === 'ctrTitle' ? ['ctrTitle', 'title'] : type === 'subTitle' ? ['subTitle', 'body'] : [type];
  const merged = {};
  // Master first, then layout, so the more specific wins.
  for (const map of [...maps].reverse()) {
    const hit = (idx != null && map.get(`idx:${idx}`)) || typeKeys.map(t => map.get(`type:${t}`)).find(Boolean);
    if (hit) for (const [k, v] of Object.entries(hit)) if (v !== undefined && (k !== 'hasGeo' || v)) merged[k] = v;
  }
  return Object.keys(merged).length ? merged : null;
}

function masterTextSize(master, kind, level) {
  const styles = path(master?.documentElement, 'txStyles');
  const holder = kid(styles, kind === 'title' ? 'titleStyle' : kind === 'other' ? 'otherStyle' : 'bodyStyle');
  const lvl = kid(holder, `lvl${Math.min(9, level + 1)}pPr`);
  const def = kid(lvl, 'defRPr');
  return def && attr(def, 'sz') ? +attr(def, 'sz') / 100 : undefined;
}

export async function pptxToDeck(data) {
  const zip = await loadZip(await toBytes(data));
  const pres = await readXml(zip, 'ppt/presentation.xml');
  if (!pres) throw new Error('This file has no presentation part');
  const sz = all(pres.documentElement, 'sldSz')[0];
  const width = pt(attr(sz, 'cx')) || 960;
  const height = pt(attr(sz, 'cy')) || 540;
  const presRels = await readRels(zip, 'ppt/presentation.xml');
  const theme = await readTheme(zip);
  const media = new Map();
  const image = async (target) => {
    if (!target) return '';
    if (!media.has(target)) {
      const f = zip.file(target);
      media.set(target, f ? f.async('uint8array').then(b => bytesToDataUrl(b, imageMime(target))) : Promise.resolve(''));
    }
    return media.get(target);
  };
  const layoutCache = new Map();
  const loadLayout = async (layoutPath) => {
    if (!layoutPath) return { maps: [], master: null, bg: undefined };
    if (layoutCache.has(layoutPath)) return layoutCache.get(layoutPath);
    const layout = await readXml(zip, layoutPath);
    const rels = await readRels(zip, layoutPath);
    const masterPath = [...rels.values()].find(r => r.type === 'slideMaster')?.target;
    const master = masterPath ? await readXml(zip, masterPath) : null;
    const bgOf = (doc) => colorOf(path(doc?.documentElement, 'cSld', 'bg', 'bgPr'), theme);
    const result = { maps: [placeholderMap(layout), placeholderMap(master)], master, bg: bgOf(layout) || bgOf(master) };
    layoutCache.set(layoutPath, result);
    return result;
  };

  const slides = [];
  for (const id of all(path(pres.documentElement, 'sldIdLst'), 'sldId')) {
    const rel = presRels.get(relId(id));
    if (!rel) continue;
    const slidePath = rel.target;
    const doc = await readXml(zip, slidePath);
    if (!doc) continue;
    const rels = await readRels(zip, slidePath);
    const layoutPath = [...rels.values()].find(r => r.type === 'slideLayout')?.target;
    const { maps, master, bg } = await loadLayout(layoutPath);
    const slide = { elements: [], notes: '' };
    slide.background = colorOf(path(doc.documentElement, 'cSld', 'bg', 'bgPr'), theme) || bg;

    const pending = [];
    const readTree = (tree, tx = (x, y, w, h) => ({ x, y, w, h })) => {
      for (const el of kids(tree)) {
        const tag = localName(el);
        if (tag === 'grpSp') {
          const xfrm = path(el, 'grpSpPr', 'xfrm');
          const off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext'), chOff = kid(xfrm, 'chOff'), chExt = kid(xfrm, 'chExt');
          const [ox, oy, ow, oh] = [pt(attr(off, 'x')), pt(attr(off, 'y')), pt(attr(ext, 'cx')), pt(attr(ext, 'cy'))];
          const [cx, cy, cw, ch] = [pt(attr(chOff, 'x')), pt(attr(chOff, 'y')), pt(attr(chExt, 'cx')) || ow, pt(attr(chExt, 'cy')) || oh];
          const sx = cw ? ow / cw : 1, sy = ch ? oh / ch : 1;
          readTree(el, (x, y, w, h) => tx(ox + (x - cx) * sx, oy + (y - cy) * sy, w * sx, h * sy));
          continue;
        }
        if (tag === 'sp' || tag === 'cxnSp') {
          const ph = path(el, 'nvSpPr', 'nvPr', 'ph');
          const phType = ph ? (attr(ph, 'type') || 'body') : null;
          if (phType && ['dt', 'ftr', 'sldNum', 'hdr'].includes(phType)) continue;
          const inherited = lookupPh(maps, ph);
          const xfrm = path(el, 'spPr', 'xfrm');
          const off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext');
          let geo = off
            ? { x: pt(attr(off, 'x')), y: pt(attr(off, 'y')), w: pt(attr(ext, 'cx')), h: pt(attr(ext, 'cy')) }
            : inherited?.hasGeo ? { x: inherited.x, y: inherited.y, w: inherited.w, h: inherited.h } : null;
          if (!geo) continue;
          geo = tx(geo.x, geo.y, geo.w, geo.h);
          const box = { type: 'box', ...geo, paragraphs: [] };
          const prst = attr(path(el, 'spPr', 'prstGeom'), 'prst');
          const hasFill = !!kid(kid(el, 'spPr'), 'solidFill');
          if (prst === 'ellipse') box.shape = 'ellipse';
          else if (prst === 'roundRect') box.shape = 'roundRect';
          else if (hasFill || (prst && prst !== 'rect')) box.shape = 'rect';
          const fill = colorOf(kid(el, 'spPr'), theme);
          if (fill) box.fill = fill;
          const line = colorOf(path(el, 'spPr', 'ln'), theme);
          if (line) box.line = line;
          const bodyPr = path(el, 'txBody', 'bodyPr');
          const anchor = attr(bodyPr, 'anchor') || inherited?.anchor;
          if (anchor === 'ctr') box.valign = 'middle';
          else if (anchor === 'b') box.valign = 'bottom';
          const kind = phType === 'title' || phType === 'ctrTitle' ? 'title' : phType ? 'body' : 'other';
          const isBodyPh = phType === 'body' || phType === 'obj' || (ph && !attr(ph, 'type'));
          for (const p of kids(kid(el, 'txBody'), 'p')) {
            const pPr = kid(p, 'pPr');
            const level = +attr(pPr, 'lvl') || 0;
            const para = { runs: [], level };
            const algn = attr(pPr, 'algn') || (level === 0 ? inherited?.algn : undefined);
            if (algn === 'ctr') para.align = 'center';
            else if (algn === 'r') para.align = 'right';
            else if (algn === 'just') para.align = 'justify';
            const bulletOn = kid(pPr, 'buChar') || kid(pPr, 'buAutoNum');
            if (bulletOn || (isBodyPh && !kid(pPr, 'buNone'))) para.bullet = true;
            const defSize = inherited?.size || masterTextSize(master, kind, level) || DEFAULT_SIZES[phType || 'other'] || 18;
            const endSz = attr(kid(p, 'endParaRPr'), 'sz');
            for (const r of kids(p)) {
              const t = localName(r);
              if (t === 'br') { para.runs.push({ text: '\n', size: defSize }); continue; }
              if (t !== 'r' && t !== 'fld') continue;
              const rPr = kid(r, 'rPr');
              const run = { text: String(kid(r, 't')?.textContent ?? '') };
              if (!run.text) continue;
              if (attr(rPr, 'b') === '1' || attr(rPr, 'b') === 'true') run.bold = true;
              if (attr(rPr, 'i') === '1' || attr(rPr, 'i') === 'true') run.italic = true;
              if (attr(rPr, 'u') && attr(rPr, 'u') !== 'none') run.underline = true;
              if (attr(rPr, 'strike') && attr(rPr, 'strike') !== 'noStrike') run.strike = true;
              run.size = attr(rPr, 'sz') ? +attr(rPr, 'sz') / 100 : defSize;
              const color = colorOf(rPr, theme);
              if (color) run.color = color;
              para.runs.push(run);
            }
            if (!para.runs.length && endSz) para.size = +endSz / 100;
            para.runs = mergeRunsSized(para.runs);
            if (!para.runs.length) delete para.bullet;
            box.paragraphs.push(para);
          }
          // An empty placeholder is a prompt ("Click to add title"), not content.
          if (ph && !box.paragraphs.some(p => p.runs.length) && !box.fill) continue;
          slide.elements.push(box);
          continue;
        }
        if (tag === 'pic') {
          const blip = path(el, 'blipFill', 'blip');
          const target = rels.get(attr(blip, 'embed'))?.target;
          const xfrm = path(el, 'spPr', 'xfrm');
          const off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext');
          if (!off || !target) continue;
          const item = { type: 'image', ...tx(pt(attr(off, 'x')), pt(attr(off, 'y')), pt(attr(ext, 'cx')), pt(attr(ext, 'cy'))), src: '' };
          pending.push(image(target).then(src => { item.src = src; }));
          slide.elements.push(item);
          continue;
        }
        if (tag === 'graphicFrame') {
          const tbl = all(el, 'tbl')[0];
          const xfrm = kid(el, 'xfrm');
          const off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext');
          if (!tbl || !off) continue;
          const rows = kids(tbl, 'tr').map(tr => kids(tr, 'tc').map(tc => all(tc, 't').map(t => t.textContent).join(' ')).join('   |   '));
          slide.elements.push({
            type: 'box', ...tx(pt(attr(off, 'x')), pt(attr(off, 'y')), pt(attr(ext, 'cx')), pt(attr(ext, 'cy'))),
            line: 'bfbfbf', paragraphs: rows.map((text, i) => ({ runs: [{ text, size: 14, bold: i === 0 || undefined }] })),
          });
        }
      }
    };
    readTree(path(doc.documentElement, 'cSld', 'spTree'));
    await Promise.all(pending);
    slide.elements = slide.elements.filter(e => e.type !== 'image' || e.src);

    const notesPath = [...rels.values()].find(r => r.type === 'notesSlide')?.target;
    if (notesPath) {
      const notes = await readXml(zip, notesPath);
      const bodySp = all(notes?.documentElement, 'sp').find(sp => attr(path(sp, 'nvSpPr', 'nvPr', 'ph'), 'type') === 'body');
      if (bodySp) slide.notes = kids(kid(bodySp, 'txBody'), 'p').map(p => all(p, 't').map(t => t.textContent).join('')).join('\n').trim();
    }
    slides.push(slide);
  }
  return { width, height, slides: slides.length ? slides : [{ elements: [], notes: '' }] };
}

/* ---------------- deck → .pptx ---------------- */

export async function deckToPptx(deck, { title } = {}) {
  const mod = await import('pptxgenjs');
  const PptxGenJS = mod.default ?? mod;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'TOOLBOX', width: deck.width / 72, height: deck.height / 72 });
  pptx.layout = 'TOOLBOX';
  if (title) pptx.title = title;
  pptx.author = 'Toolbox';

  const inch = (v) => Math.max(0, v / 72);
  for (const s of deck.slides) {
    const slide = pptx.addSlide();
    if (s.background) slide.background = { color: s.background.toUpperCase() };
    for (const el of s.elements) {
      const geo = { x: inch(el.x), y: inch(el.y), w: Math.max(0.05, inch(el.w)), h: Math.max(0.05, inch(el.h)) };
      if (el.type === 'image') {
        if (!el.src) continue;
        slide.addImage({ data: el.src.replace(/^data:/, ''), ...geo });
        continue;
      }
      const runs = [];
      (el.paragraphs || []).forEach((p, pi, arr) => {
        const pOpts = {
          align: p.align || 'left',
          bullet: p.bullet ? true : false,
          indentLevel: p.level || 0,
        };
        const list = p.runs?.length ? p.runs : [{ text: '', size: p.size }];
        list.forEach((r, ri) => {
          runs.push({
            text: r.text,
            options: {
              ...pOpts,
              bold: !!r.bold, italic: !!r.italic,
              underline: r.underline ? { style: 'sng' } : undefined,
              strike: r.strike ? 'sngStrike' : undefined,
              fontSize: r.size || 18,
              color: r.color ? r.color.toUpperCase() : '000000',
              breakLine: ri === list.length - 1 && pi < arr.length - 1,
            },
          });
        });
      });
      const opts = {
        ...geo,
        valign: el.valign || 'top',
        margin: 6,
        fit: 'none',
      };
      if (el.fill) opts.fill = { color: el.fill.toUpperCase() };
      if (el.line) opts.line = { color: el.line.toUpperCase(), width: 1 };
      if (el.shape) opts.shape = el.shape === 'ellipse' ? pptx.ShapeType.ellipse : el.shape === 'roundRect' ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
      slide.addText(runs.length ? runs : [{ text: '' }], opts);
    }
    if (s.notes) slide.addNotes(s.notes);
  }
  return pptx.write({ outputType: 'blob' });
}
