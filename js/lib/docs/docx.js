/* ============================================================
   .docx read (own OOXML reader) and write (the docx library).

   Reading keeps what the editor can show — headings, alignment,
   lists, colour, links, tables, pictures — so saving back does not
   quietly drop them. The docx library loads on first save only.
   ============================================================ */

import { parseXml, kids, kid, path, all, attr, relId, localName, bytesToDataUrl, dataUrlToBytes, imageMime, resolvePart, loadZip, toBytes } from './xml.js';
import { mergeRuns, safeHref } from './model.js';

const EMU_PER_PX = 9525;

function onOff(el) {
  if (!el) return undefined;
  const v = attr(el, 'val');
  return !(v === '0' || v === 'false' || v === 'off');
}

function runProps(rPr, base = {}) {
  const m = { ...base };
  if (!rPr) return m;
  const b = onOff(kid(rPr, 'b')); if (b !== undefined) m.bold = b;
  const i = onOff(kid(rPr, 'i')); if (i !== undefined) m.italic = i;
  const u = kid(rPr, 'u'); if (u) m.underline = attr(u, 'val') !== 'none';
  const st = onOff(kid(rPr, 'strike')) || onOff(kid(rPr, 'dstrike')); if (st !== undefined) m.strike = st;
  const c = attr(kid(rPr, 'color'), 'val');
  if (c && /^[0-9a-f]{6}$/i.test(c)) m.color = c.toLowerCase() === '000000' ? undefined : c.toLowerCase();
  const font = attr(kid(rPr, 'rFonts'), 'ascii') || '';
  if (/courier|consolas|mono/i.test(font)) m.code = true;
  return m;
}

const clean = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v));

/** .docx → model blocks, read straight from the OOXML parts. */
export async function docxToModel(data) {
  const zip = await loadZip(await toBytes(data));
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('This file has no document part');
  const doc = parseXml(await docFile.async('string'));
  const read = async (name) => { const f = zip.file(name); return f ? parseXml(await f.async('string')) : null; };
  const [stylesDoc, numberingDoc, relsDoc] = await Promise.all([read('word/styles.xml'), read('word/numbering.xml'), read('word/_rels/document.xml.rels')]);

  const rels = new Map();
  for (const r of all(relsDoc?.documentElement, 'Relationship')) rels.set(attr(r, 'Id'), { target: attr(r, 'Target'), external: attr(r, 'TargetMode') === 'External' });

  // Styles, with basedOn chains flattened.
  const styleEls = new Map();
  for (const s of all(stylesDoc?.documentElement, 'style')) styleEls.set(attr(s, 'styleId'), s);
  const styleCache = new Map();
  const style = (id, depth = 0) => {
    if (!id || depth > 10) return { name: '', run: {}, para: {} };
    if (styleCache.has(id)) return styleCache.get(id);
    const el = styleEls.get(id);
    if (!el) return { name: '', run: {}, para: {} };
    const parent = style(attr(kid(el, 'basedOn'), 'val'), depth + 1);
    const pPr = kid(el, 'pPr');
    const numPr = kid(pPr, 'numPr');
    const out = {
      name: String(attr(kid(el, 'name'), 'val') || id),
      chain: [String(attr(kid(el, 'name'), 'val') || id), ...(parent.chain || [])],
      run: runProps(kid(el, 'rPr'), parent.run),
      para: {
        ...parent.para,
        ...(attr(kid(pPr, 'jc'), 'val') ? { jc: attr(kid(pPr, 'jc'), 'val') } : {}),
        ...(attr(kid(pPr, 'outlineLvl'), 'val') != null ? { outline: +attr(kid(pPr, 'outlineLvl'), 'val') } : {}),
        ...(numPr ? { numId: attr(kid(numPr, 'numId'), 'val'), ilvl: +(attr(kid(numPr, 'ilvl'), 'val') || 0) } : {}),
      },
    };
    styleCache.set(id, out);
    return out;
  };

  // Numbering: numId → abstract → per-level format.
  const abstracts = new Map();
  for (const a of all(numberingDoc?.documentElement, 'abstractNum')) {
    const lvls = new Map();
    for (const l of kids(a, 'lvl')) lvls.set(+attr(l, 'ilvl'), attr(kid(l, 'numFmt'), 'val') || 'bullet');
    abstracts.set(attr(a, 'abstractNumId'), lvls);
  }
  const nums = new Map();
  for (const n of all(numberingDoc?.documentElement, 'num')) nums.set(attr(n, 'numId'), attr(kid(n, 'abstractNumId'), 'val'));
  const listOrdered = (numId, ilvl) => {
    const fmt = abstracts.get(nums.get(numId))?.get(ilvl);
    return !!fmt && fmt !== 'bullet' && fmt !== 'none';
  };

  const pendingImages = [];
  const image = (drawing) => {
    const blip = all(drawing, 'blip')[0];
    const rel = rels.get(attr(blip, 'embed'));
    if (!rel || rel.external) return null;
    const ext = all(drawing, 'extent')[0];
    const block = {
      type: 'image', src: '',
      width: ext ? Math.round(+attr(ext, 'cx') / EMU_PER_PX) : undefined,
      height: ext ? Math.round(+attr(ext, 'cy') / EMU_PER_PX) : undefined,
      alt: attr(all(drawing, 'docPr')[0], 'descr') || undefined,
    };
    const partName = resolvePart('word/document.xml', rel.target);
    const f = zip.file(partName);
    if (!f) return null;
    pendingImages.push(f.async('uint8array').then(b => { block.src = bytesToDataUrl(b, imageMime(partName)); }));
    return block;
  };

  const blocks = [];

  /** Runs of a paragraph-like element; images and page breaks go to `after`. */
  const readRuns = (p, base, after) => {
    const runs = [];
    let field = null; // complex field: { instr, href, phase }
    const walk = (node, marks, href) => {
      for (const c of kids(node)) {
        const tag = localName(c);
        if (tag === 'r') {
          const rPr = kid(c, 'rPr');
          const rs = style(attr(kid(rPr, 'rStyle'), 'val'));
          // Link styling comes back from the link itself on save.
          const m = runProps(rPr, /hyperlink/i.test(rs.name) ? marks : { ...marks, ...rs.run });
          if (/hyperlink/i.test(rs.name)) { delete m.underline; delete m.color; }
          for (const x of kids(c)) {
            const t = localName(x);
            if (t === 'fldChar') {
              const type = attr(x, 'fldCharType');
              if (type === 'begin') field = { instr: '', phase: 'instr' };
              else if (type === 'separate' && field) {
                const hl = /HYPERLINK\s+"([^"]+)"/i.exec(field.instr);
                field.href = hl ? hl[1] : null;
                field.phase = 'result';
              } else if (type === 'end') field = null;
              continue;
            }
            if (t === 'instrText') { if (field) field.instr += x.textContent; continue; }
            if (field?.phase === 'instr') continue;
            const link = href || field?.href || undefined;
            if (t === 't') runs.push({ text: x.textContent, ...clean(m), ...(link ? { href: link } : {}) });
            else if (t === 'tab') runs.push({ text: '\t', ...clean(m) });
            else if (t === 'br' || t === 'cr') {
              if (attr(x, 'type') === 'page') after.push({ type: 'pagebreak' });
              else runs.push({ text: '\n', ...clean(m) });
            } else if (t === 'sym') {
              const code = parseInt(attr(x, 'char') || '', 16);
              if (code) runs.push({ text: String.fromCharCode(code >= 0xF000 ? code - 0xF000 : code), ...clean(m) });
            } else if (t === 'drawing' || t === 'pict') {
              const img = image(x);
              if (img) after.push(img);
            } else if (t === 'noBreakHyphen') runs.push({ text: '\u2011', ...clean(m) });
          }
        } else if (tag === 'hyperlink') {
          const rel = rels.get(relId(c) || attr(c, 'id'));
          const target = rel?.target ? safeHref(rel.target) : (attr(c, 'anchor') ? `#${attr(c, 'anchor')}` : undefined);
          walk(c, marks, target);
        } else if (tag === 'ins' || tag === 'smartTag' || tag === 'fldSimple' || tag === 'customXml' || tag === 'bdo' || tag === 'dir') {
          const instr = attr(c, 'instr') || '';
          const hl = /HYPERLINK\s+"([^"]+)"/i.exec(instr);
          walk(c, marks, hl ? hl[1] : href);
        } else if (tag === 'sdt') walk(kid(c, 'sdtContent'), marks, href);
      }
    };
    walk(p, base, undefined);
    return mergeRuns(runs);
  };

  const paragraph = (p) => {
    const pPr = kid(p, 'pPr');
    const ps = style(attr(kid(pPr, 'pStyle'), 'val') || 'Normal');
    const block = { type: 'paragraph', style: 'p', runs: [] };
    const chain = (ps.chain || []).join('|');
    const heading = /^heading (\d)$/i.exec(ps.name);
    const outline = attr(kid(pPr, 'outlineLvl'), 'val') ?? ps.para.outline;
    if (heading) block.style = `h${Math.min(6, +heading[1])}`;
    else if (/^Title$/i.test(ps.name)) block.style = 'h1';
    else if (/^Subtitle$/i.test(ps.name)) block.style = 'h2';
    else if (outline != null && +outline < 6) block.style = `h${+outline + 1}`;
    else if (/quote/i.test(chain)) block.style = 'quote';
    else if (/HTML Preformatted|Code|Macro Text/i.test(chain)) block.style = 'pre';
    const jc = attr(kid(pPr, 'jc'), 'val') || ps.para.jc;
    if (jc === 'center') block.align = 'center';
    else if (jc === 'right' || jc === 'end') block.align = 'right';
    else if (jc === 'both' || jc === 'distribute') block.align = 'justify';
    const numPr = kid(pPr, 'numPr');
    const numId = numPr ? attr(kid(numPr, 'numId'), 'val') : ps.para.numId;
    const ilvl = numPr ? +(attr(kid(numPr, 'ilvl'), 'val') || 0) : (ps.para.ilvl || 0);
    if (numId && numId !== '0' && !block.style.startsWith('h')) block.list = { ordered: listOrdered(numId, ilvl), level: ilvl };
    if (onOff(kid(pPr, 'pageBreakBefore'))) blocks.push({ type: 'pagebreak' });
    const after = [];
    const baseMarks = block.style === 'p' ? ps.run : {};
    block.runs = readRuns(p, baseMarks, after);
    if (block.style.startsWith('h')) block.runs = block.runs.map(({ bold, ...r }) => (void bold, r));
    if (block.runs.length || !after.length) blocks.push(block);
    blocks.push(...after);
  };

  const table = (tbl) => {
    const rows = [];
    for (const tr of kids(tbl, 'tr')) {
      const header = !!path(tr, 'trPr', 'tblHeader');
      const cells = [];
      for (const tc of kids(tr, 'tc')) {
        const parts = [];
        for (const p of all(tc, 'p')) {
          const r = readRuns(p, {}, []);
          if (parts.length) parts.push({ text: '\n' });
          parts.push(...r);
        }
        const span = +(attr(path(tc, 'tcPr', 'gridSpan'), 'val') || 1);
        cells.push(mergeRuns(parts));
        for (let i = 1; i < span; i++) cells.push([]);
      }
      rows.push({ header, cells });
    }
    if (rows.length) blocks.push({ type: 'table', rows });
  };

  const body = (node) => {
    for (const c of kids(node)) {
      const tag = localName(c);
      if (tag === 'p') paragraph(c);
      else if (tag === 'tbl') table(c);
      else if (tag === 'sdt') body(kid(c, 'sdtContent'));
      else if (tag === 'customXml' || tag === 'ins') body(c);
    }
  };
  body(all(doc.documentElement, 'body')[0]);
  await Promise.all(pendingImages);
  return blocks.filter(b => b.type !== 'image' || b.src);
}

const HEADING_LEVELS = ['HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6'];

/** Model blocks → .docx Blob. */
export async function modelToDocx(blocks, { title } = {}) {
  const d = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink,
    Table, TableRow, TableCell, WidthType, ImageRun, PageBreak, LevelFormat, BorderStyle,
  } = d;

  const align = (a) => ({ center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[a]);

  const textRuns = (r, extra = {}) => {
    const opts = {
      bold: r.bold || extra.bold || undefined,
      italics: r.italic || extra.italic || undefined,
      underline: r.underline ? {} : undefined,
      strike: r.strike || undefined,
      color: r.color || undefined,
      font: r.code || extra.code ? 'Courier New' : undefined,
      style: r.href ? 'Hyperlink' : undefined,
    };
    return String(r.text).split('\n').map((line, i) => new TextRun({ ...opts, text: line, break: i ? 1 : undefined }));
  };

  const children = (runs, extra) => (runs || []).flatMap(r => (r.href
    ? [new ExternalHyperlink({ link: r.href, children: textRuns(r, extra) })]
    : textRuns(r, extra)));

  const out = [];
  let breakNext = false;
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      const opts = { alignment: align(b.align), pageBreakBefore: breakNext || undefined };
      const extra = {};
      breakNext = false;
      if (/^h[1-6]$/.test(b.style)) opts.heading = HeadingLevel[HEADING_LEVELS[+b.style[1] - 1]];
      if (b.list) opts.numbering = { reference: b.list.ordered ? 'numbers' : 'bullets', level: Math.min(8, b.list.level) };
      if (b.style === 'quote') opts.style = 'Quote';
      if (b.style === 'pre') opts.style = 'Code';
      out.push(new Paragraph({ ...opts, children: children(b.runs, extra) }));
    } else if (b.type === 'table') {
      const width = Math.max(1, ...b.rows.map(r => r.cells.length));
      const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
      out.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: b.rows.map(row => new TableRow({
          tableHeader: row.header || undefined,
          children: Array.from({ length: width }, (_, i) => new TableCell({
            width: { size: Math.floor(100 / width), type: WidthType.PERCENTAGE },
            borders: { top: border, bottom: border, left: border, right: border },
            children: [new Paragraph({ children: children(row.cells[i] || [], row.header ? { bold: true } : {}) })],
          })),
        })),
      }));
    } else if (b.type === 'image') {
      const data = dataUrlToBytes(b.src);
      const type = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp' }[data?.mime];
      if (!type) continue;
      let w = b.width || 400, h = b.height || 300;
      if (w > 620) { h = h * 620 / w; w = 620; }
      out.push(new Paragraph({ children: [new ImageRun({ type, data: data.bytes, transformation: { width: Math.round(w), height: Math.round(h) }, altText: b.alt ? { name: b.alt, description: b.alt, title: b.alt } : undefined })] }));
    } else if (b.type === 'rule') {
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, children: [] }));
    } else if (b.type === 'pagebreak') {
      breakNext = true;
    }
  }
  if (breakNext) out.push(new Paragraph({ children: [new PageBreak()] }));
  if (!out.length) out.push(new Paragraph({ children: [] }));

  const levels = (ordered) => Array.from({ length: 9 }, (_, level) => ({
    level,
    format: ordered ? [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3] : LevelFormat.BULLET,
    text: ordered ? `%${level + 1}.` : ['•', '◦', '▪'][level % 3],
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));

  const doc = new Document({
    title: title || undefined,
    creator: 'Toolbox',
    numbering: { config: [{ reference: 'bullets', levels: levels(false) }, { reference: 'numbers', levels: levels(true) }] },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      paragraphStyles: [
        { id: 'Quote', name: 'Quote', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { italics: true, color: '404040' }, paragraph: { indent: { left: 720, right: 720 } } },
        { id: 'Code', name: 'Code', basedOn: 'Normal', next: 'Normal', run: { font: 'Courier New', size: 20 }, paragraph: { spacing: { after: 0 } } },
      ],
    },
    sections: [{ children: out }],
  });
  return typeof Blob !== 'undefined' && Packer.toBlob ? Packer.toBlob(doc) : new Blob([await Packer.toBuffer(doc)]);
}
