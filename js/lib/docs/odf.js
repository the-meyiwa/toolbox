/* ============================================================
   OpenDocument text (.odt) and presentation (.odp), read and write.

   Spreadsheets (.ods) go through SheetJS instead; see sheets.js.
   ============================================================ */

import { parseXml, kids, kid, all, attr, localName, escXml, bytesToDataUrl, dataUrlToBytes, imageMime, loadZip, newZip, toBytes } from './xml.js';
import { mergeRuns } from './model.js';

/* ---------------- units and styles ---------------- */

/** "2.5cm" / "1in" / "12pt" / "25mm" / "3px" → points. */
export function toPt(v, fallback = 0) {
  const m = /^(-?[\d.]+)\s*(cm|mm|in|pt|pc|px)?$/.exec(String(v ?? '').trim());
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'cm': return n * 72 / 2.54;
    case 'mm': return n * 72 / 25.4;
    case 'in': return n * 72;
    case 'pc': return n * 12;
    case 'px': return n * 0.75;
    default: return n;
  }
}

const cm = (pt) => `${(pt * 2.54 / 72).toFixed(3)}cm`;

/**
 * Style lookup across content.xml automatic styles and styles.xml, with
 * parent chains resolved. Properties are flattened into one object keyed
 * by local attribute name ('font-weight', 'text-align', 'fill-color'…).
 */
function styleResolver(...docs) {
  const byName = new Map();
  for (const doc of docs) {
    if (!doc) continue;
    for (const holder of ['automatic-styles', 'styles', 'master-styles']) {
      for (const h of all(doc.documentElement, holder)) {
        for (const s of kids(h)) {
          const name = attr(s, 'name');
          if (name && !byName.has(`${localName(s)}:${name}`)) byName.set(`${localName(s)}:${name}`, s);
          if (name && localName(s) === 'style' && !byName.has(name)) byName.set(name, s);
        }
      }
    }
  }
  const cache = new Map();
  const props = (name, depth = 0) => {
    if (!name || depth > 12) return {};
    if (cache.has(name)) return cache.get(name);
    const el = byName.get(name);
    if (!el) return {};
    const parent = props(attr(el, 'parent-style-name'), depth + 1);
    const own = {};
    for (const p of kids(el)) {
      if (!/-properties$/.test(localName(p))) continue;
      for (let i = 0; i < p.attributes.length; i++) {
        const a = p.attributes[i];
        own[a.localName || String(a.name).replace(/^.*:/, '')] = a.value;
      }
    }
    const listStyle = attr(el, 'list-style-name');
    const out = { ...parent, ...own, _name: name, _parents: [name, ...(parent._parents || [])] };
    if (listStyle) out._list = listStyle;
    const outline = attr(el, 'default-outline-level');
    if (outline) out._outline = +outline;
    cache.set(name, out);
    return out;
  };
  const listOrdered = (name, level = 1) => {
    const el = byName.get(`list-style:${name}`);
    if (!el) return false;
    const lv = kids(el).find(k => +attr(k, 'level') === level) || kids(el)[0];
    return lv ? localName(lv) === 'list-level-style-number' && (attr(lv, 'num-format') || '') !== '' : false;
  };
  return { props, listOrdered };
}

const truthy = (v) => v != null && v !== 'none' && v !== '';

function marksFromProps(p) {
  const m = {};
  if (p['font-weight'] === 'bold' || +p['font-weight'] >= 600) m.bold = true;
  if (p['font-style'] === 'italic' || p['font-style'] === 'oblique') m.italic = true;
  if (truthy(p['text-underline-style'])) m.underline = true;
  if (truthy(p['text-line-through-style'])) m.strike = true;
  const color = /^#([0-9a-f]{6})$/i.exec(p.color || '');
  if (color && color[1].toLowerCase() !== '000000') m.color = color[1].toLowerCase();
  if (p['font-size'] && /pt$/.test(p['font-size'])) m.size = parseFloat(p['font-size']);
  if (/mono|courier|consol/i.test(p['font-name'] || p['font-family'] || '')) m.code = true;
  return m;
}

/* ---------------- shared text walker ---------------- */

/** Inline content of a text:p / text:h / text:span into runs. */
function readRuns(el, styles, base, images) {
  const runs = [];
  const walk = (node, marks) => {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (n.nodeValue) runs.push({ text: n.nodeValue.replace(/[\n\r\t]+/g, ' '), ...marks }); continue; }
      if (n.nodeType !== 1) continue;
      const tag = localName(n);
      if (tag === 's') { runs.push({ text: ' '.repeat(+attr(n, 'c') || 1), ...marks }); continue; }
      if (tag === 'tab') { runs.push({ text: '\t', ...marks }); continue; }
      if (tag === 'line-break') { runs.push({ text: '\n', ...marks }); continue; }
      if (tag === 'span') {
        const own = marksFromProps(styles.props(attr(n, 'style-name')));
        walk(n, { ...marks, ...own });
        continue;
      }
      if (tag === 'a') { walk(n, { ...marks, href: attr(n, 'href') || undefined }); continue; }
      if (tag === 'frame') { images?.(n); continue; }
      if (tag === 'note' || tag === 'annotation' || tag === 'bookmark' || tag === 'bookmark-start' || tag === 'bookmark-end' || tag === 'soft-page-break' || tag === 'sequence-decls') continue;
      walk(n, marks);
    }
  };
  walk(el, base);
  return mergeRuns(runs.map(r => { const { size, ...rest } = r; void size; return rest; }));
}

async function zipImage(zip, href) {
  const file = href && zip.file(href.replace(/^\.\//, ''));
  if (!file) return null;
  const bytes = await file.async('uint8array');
  return bytesToDataUrl(bytes, imageMime(href));
}

/* ---------------- ODT → model ---------------- */

export async function odtToModel(data) {
  const zip = await loadZip(await toBytes(data));
  const content = parseXml(await zip.file('content.xml').async('string'));
  const stylesFile = zip.file('styles.xml');
  const stylesDoc = stylesFile ? parseXml(await stylesFile.async('string')) : null;
  const styles = styleResolver(content, stylesDoc);
  const body = all(content.documentElement, 'text')[0] || all(content.documentElement, 'body')[0];
  const blocks = [];
  const pendingImages = [];

  const imageFrame = (frame) => {
    const img = all(frame, 'image')[0];
    const href = attr(img, 'href');
    if (!href) return;
    const block = { type: 'image', src: '', width: toPt(attr(frame, 'width')) / 0.75 || undefined, height: toPt(attr(frame, 'height')) / 0.75 || undefined };
    pendingImages.push(zipImage(zip, href).then(src => { block.src = src || ''; }));
    blocks.push(block);
  };

  const paragraph = (el, extra = {}) => {
    const p = styles.props(attr(el, 'style-name'));
    const block = { type: 'paragraph', style: 'p', runs: [], ...extra };
    const lvl = localName(el) === 'h' ? (+attr(el, 'outline-level') || p._outline || 1) : p._outline;
    if (localName(el) === 'h' || lvl) block.style = `h${Math.min(6, lvl || 1)}`;
    else if ((p._parents || []).some(n => /Quotation|Quote/i.test(n))) block.style = 'quote';
    else if ((p._parents || []).some(n => /Preformatted/i.test(n))) block.style = 'pre';
    const align = p['text-align'];
    if (align === 'center' || align === 'end' || align === 'right' || align === 'justify') block.align = align === 'end' ? 'right' : align;
    if (p['break-before'] === 'page') blocks.push({ type: 'pagebreak' });
    const at = blocks.length;
    block.runs = readRuns(el, styles, marksFromProps(p), imageFrame);
    // Images inside the paragraph were pushed after `at`, so they follow it.
    // A paragraph that only held an image is just the image.
    if (block.runs.length || blocks.length === at) blocks.splice(at, 0, block);
    if (block.style.startsWith('h')) block.runs = block.runs.map(r => { const { bold, ...rest } = r; void bold; return rest; });
    if (p['break-after'] === 'page') blocks.push({ type: 'pagebreak' });
  };

  const list = (el, level, ordered) => {
    const styleName = attr(el, 'style-name');
    if (styleName) ordered = styles.listOrdered(styleName, level + 1);
    for (const item of kids(el)) {
      if (localName(item) !== 'list-item' && localName(item) !== 'list-header') continue;
      let first = true;
      for (const c of kids(item)) {
        const tag = localName(c);
        if (tag === 'p' || tag === 'h') {
          if (first) { paragraph(c, { list: { ordered, level } }); first = false; }
          else {
            // A second paragraph in an item continues it on a new line.
            const prev = blocks[blocks.length - 1];
            const more = readRuns(c, styles, {}, imageFrame);
            if (prev?.list) prev.runs = mergeRuns([...prev.runs, { text: '\n' }, ...more]);
          }
        } else if (tag === 'list') list(c, level + 1, ordered);
      }
    }
  };

  const table = (el) => {
    const rows = [];
    const rowsOf = (node, header) => {
      for (const c of kids(node)) {
        const tag = localName(c);
        if (tag === 'table-header-rows') rowsOf(c, true);
        else if (tag === 'table-rows' || tag === 'table-row-group') rowsOf(c, header);
        else if (tag === 'table-row') {
          const cells = [];
          for (const cell of kids(c)) {
            if (localName(cell) !== 'table-cell' && localName(cell) !== 'covered-table-cell') continue;
            const rep = Math.min(+attr(cell, 'number-columns-repeated') || 1, 64);
            const runs = [];
            kids(cell).forEach((p, i) => { if (i) runs.push({ text: '\n' }); runs.push(...readRuns(p, styles, {}, null)); });
            for (let i = 0; i < rep; i++) cells.push(mergeRuns(runs));
          }
          const rep = Math.min(+attr(c, 'number-rows-repeated') || 1, 64);
          for (let i = 0; i < rep; i++) rows.push({ header: !!header, cells });
        }
      }
    };
    rowsOf(el, false);
    // Drop trailing columns that are empty in every row (LibreOffice pads).
    if (rows.length) blocks.push({ type: 'table', rows });
  };

  const walkBody = (node) => {
    for (const c of kids(node)) {
      const tag = localName(c);
      if (tag === 'p' || tag === 'h') paragraph(c);
      else if (tag === 'list') list(c, 0, false);
      else if (tag === 'table') table(c);
      else if (tag === 'section' || tag === 'index-body' || tag === 'table-of-content' || tag === 'illustration-index' || tag === 'alphabetical-index') walkBody(c);
      else if (tag === 'frame') imageFrame(c);
    }
  };
  walkBody(body);
  await Promise.all(pendingImages);
  return blocks.filter(b => b.type !== 'image' || b.src);
}

/* ---------------- model → ODT ---------------- */

const MANIFEST = (entries) => `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
${entries.map(([path, type]) => ` <manifest:file-entry manifest:full-path="${escXml(path)}" manifest:media-type="${escXml(type)}"${path === '/' ? ' manifest:version="1.3"' : ''}/>`).join('\n')}
</manifest:manifest>
`;

const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"';

function metaXml(title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta ${NS}><office:meta><meta:generator>Toolbox</meta:generator>${title ? `<dc:title>${escXml(title)}</dc:title>` : ''}<meta:creation-date>${new Date().toISOString().slice(0, 19)}</meta:creation-date></office:meta></office:document-meta>
`;
}

/** Text with runs of spaces, tabs and breaks as ODF elements. */
function odfText(text) {
  let out = '';
  const parts = String(text).split(/(\n|\t| {2,})/);
  for (const part of parts) {
    if (!part) continue;
    if (part === '\n') out += '<text:line-break/>';
    else if (part === '\t') out += '<text:tab/>';
    else if (/^ {2,}$/.test(part)) out += ` <text:s text:c="${part.length - 1}"/>`;
    else out += escXml(part);
  }
  return out;
}

function textStyleKey(r) {
  return [r.bold ? 'b' : '', r.italic ? 'i' : '', r.underline ? 'u' : '', r.strike ? 's' : '', r.code ? 'c' : '', r.color ? `#${r.color}` : ''].join('');
}

function textStyleXml(name, r) {
  const attrs = [];
  if (r.bold) attrs.push('fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"');
  if (r.italic) attrs.push('fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"');
  if (r.underline) attrs.push('style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"');
  if (r.strike) attrs.push('style:text-line-through-style="solid"');
  if (r.code) attrs.push('style:font-name="Liberation Mono" fo:font-family="\'Liberation Mono\', monospace"');
  if (r.color) attrs.push(`fo:color="#${r.color}"`);
  if (r.size) attrs.push(`fo:font-size="${r.size}pt"`);
  return `<style:style style:name="${name}" style:family="text"><style:text-properties ${attrs.join(' ')}/></style:style>`;
}

/** Runs → ODF inline markup, registering text styles as needed. */
function runsOdf(runs, textStyles) {
  return (runs || []).map(r => {
    const key = textStyleKey(r) + (r.size ? `@${r.size}` : '');
    let inner = odfText(r.text);
    if (key) {
      if (!textStyles.has(key)) textStyles.set(key, { name: `T${textStyles.size + 1}`, run: r });
      inner = `<text:span text:style-name="${textStyles.get(key).name}">${inner}</text:span>`;
    }
    if (r.href) inner = `<text:a xlink:type="simple" xlink:href="${escXml(r.href)}">${inner}</text:a>`;
    return inner;
  }).join('');
}

const ODT_STYLES = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS}>
<office:font-face-decls>
 <style:font-face style:name="Liberation Serif" svg:font-family="'Liberation Serif'" style:font-family-generic="roman"/>
 <style:font-face style:name="Liberation Sans" svg:font-family="'Liberation Sans'" style:font-family-generic="swiss"/>
 <style:font-face style:name="Liberation Mono" svg:font-family="'Liberation Mono'" style:font-family-generic="modern" style:font-pitch="fixed"/>
</office:font-face-decls>
<office:styles>
 <style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.212cm"/><style:text-properties style:font-name="Liberation Serif" fo:font-size="12pt" fo:language="en" fo:country="US"/></style:default-style>
 <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
 <style:style style:name="Text_20_body" style:display-name="Text body" style:family="paragraph" style:parent-style-name="Standard" style:class="text"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.247cm" fo:line-height="115%"/></style:style>
 <style:style style:name="Heading" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Text_20_body" style:class="text"><style:paragraph-properties fo:margin-top="0.423cm" fo:margin-bottom="0.212cm" fo:keep-with-next="always"/><style:text-properties style:font-name="Liberation Sans" fo:font-weight="bold"/></style:style>
${[28, 22, 18, 15, 13, 12].map((size, i) => ` <style:style style:name="Heading_20_${i + 1}" style:display-name="Heading ${i + 1}" style:family="paragraph" style:parent-style-name="Heading" style:next-style-name="Text_20_body" style:default-outline-level="${i + 1}" style:class="text"><style:text-properties fo:font-size="${size}pt" fo:font-weight="bold"/></style:style>`).join('\n')}
 <style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard" style:class="html"><style:paragraph-properties fo:margin-left="1cm" fo:margin-right="1cm" fo:margin-bottom="0.247cm"/><style:text-properties fo:font-style="italic"/></style:style>
 <style:style style:name="Preformatted_20_Text" style:display-name="Preformatted Text" style:family="paragraph" style:parent-style-name="Standard" style:class="html"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0cm"/><style:text-properties style:font-name="Liberation Mono" fo:font-size="10pt"/></style:style>
 <style:style style:name="Table_20_Contents" style:display-name="Table Contents" style:family="paragraph" style:parent-style-name="Standard" style:class="extra"/>
 <style:style style:name="Internet_20_link" style:display-name="Internet link" style:family="text"><style:text-properties fo:color="#000080" style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"/></style:style>
</office:styles>
<office:automatic-styles>
 <style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21.001cm" fo:page-height="29.7cm" style:print-orientation="portrait" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/></style:page-layout>
</office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles>
</office:document-styles>
`;

export async function modelToOdt(blocks, { title } = {}) {
  const zip = await newZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  const textStyles = new Map();
  const paraStyles = new Map(); // key → {name, xml}
  const pictures = [];
  const body = [];

  const paraStyle = (parent, align, pageBreak) => {
    if (!align && !pageBreak) return parent;
    const key = `${parent}|${align || ''}|${pageBreak ? 'pb' : ''}`;
    if (!paraStyles.has(key)) {
      const name = `P${paraStyles.size + 1}`;
      const pa = [align ? `fo:text-align="${align === 'right' ? 'end' : align}" style:justify-single-word="false"` : '', pageBreak ? 'fo:break-before="page"' : ''].filter(Boolean).join(' ');
      paraStyles.set(key, { name, xml: `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="${parent}"><style:paragraph-properties ${pa}/></style:style>` });
    }
    return paraStyles.get(key).name;
  };

  let pageBreakNext = false;
  let openLists = []; // stack of ordered flags
  const closeLists = (depth) => {
    while (openLists.length > depth) { openLists.pop(); body.push('</text:list-item></text:list>'); }
  };

  for (const b of blocks) {
    if (b.type === 'paragraph' && b.list) {
      const depth = b.list.level + 1;
      if (openLists.length >= depth && openLists[depth - 1] !== b.list.ordered) closeLists(depth - 1);
      if (openLists.length > depth) closeLists(depth);
      if (openLists.length === depth) body.push('</text:list-item><text:list-item>');
      while (openLists.length < depth) {
        openLists.push(b.list.ordered);
        body.push(`<text:list text:style-name="${b.list.ordered ? 'LN' : 'LB'}"><text:list-item>`);
      }
      body.push(`<text:p text:style-name="${paraStyle('Standard', b.align, pageBreakNext)}">${runsOdf(b.runs, textStyles)}</text:p>`);
      pageBreakNext = false;
      continue;
    }
    closeLists(0);
    if (b.type === 'paragraph') {
      if (/^h[1-6]$/.test(b.style)) {
        const lvl = +b.style[1];
        body.push(`<text:h text:style-name="${paraStyle(`Heading_20_${lvl}`, b.align, pageBreakNext)}" text:outline-level="${lvl}">${runsOdf(b.runs, textStyles)}</text:h>`);
      } else if (b.style === 'pre') {
        for (const line of (b.runs || []).map(r => r.text).join('').split('\n')) {
          body.push(`<text:p text:style-name="${paraStyle('Preformatted_20_Text', null, pageBreakNext)}">${odfText(line)}</text:p>`);
          pageBreakNext = false;
        }
      } else {
        const parent = b.style === 'quote' ? 'Quotations' : 'Text_20_body';
        body.push(`<text:p text:style-name="${paraStyle(parent, b.align, pageBreakNext)}">${runsOdf(b.runs, textStyles)}</text:p>`);
      }
      pageBreakNext = false;
    } else if (b.type === 'table') {
      const width = Math.max(1, ...b.rows.map(r => r.cells.length));
      const name = `Table${body.filter(x => x.startsWith('<table:table ')).length + 1}`;
      const rows = b.rows.map(r => `<table:table-row>${Array.from({ length: width }, (_, i) => `<table:table-cell table:style-name="TC" office:value-type="string">${String(runsOdf(r.cells[i] || [], textStyles)).split('<text:line-break/>').map(part => `<text:p text:style-name="Table_20_Contents">${r.header ? `<text:span text:style-name="TB">${part}</text:span>` : part}</text:p>`).join('')}</table:table-cell>`).join('')}</table:table-row>`);
      body.push(`<table:table table:name="${name}" table:style-name="TT"><table:table-column table:number-columns-repeated="${width}"/>${rows.join('')}</table:table>`);
    } else if (b.type === 'image') {
      const data = dataUrlToBytes(b.src);
      if (!data) continue;
      const ext = (data.mime.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
      const path = `Pictures/image${pictures.length + 1}.${ext}`;
      pictures.push([path, data]);
      const wPt = (b.width || 320) * 0.75;
      const hPt = (b.height || 240) * 0.75;
      body.push(`<text:p text:style-name="${paraStyle('Standard', null, pageBreakNext)}"><draw:frame draw:name="Image${pictures.length}" text:anchor-type="as-char" svg:width="${cm(wPt)}" svg:height="${cm(hPt)}" draw:z-index="0"><draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>`);
      pageBreakNext = false;
    } else if (b.type === 'rule') {
      body.push('<text:p text:style-name="HR"/>');
    } else if (b.type === 'pagebreak') {
      pageBreakNext = true;
    }
  }
  closeLists(0);
  if (!body.length) body.push('<text:p text:style-name="Standard"/>');

  const listStyle = (name, ordered) => `<text:list-style style:name="${name}">${Array.from({ length: 10 }, (_, i) => ordered
    ? `<text:list-level-style-number text:level="${i + 1}" style:num-suffix="." style:num-format="1"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="${(0.635 * (i + 1) + 0.635).toFixed(3)}cm" fo:text-indent="-0.635cm" fo:margin-left="${(0.635 * (i + 2)).toFixed(3)}cm"/></style:list-level-properties></text:list-level-style-number>`
    : `<text:list-level-style-bullet text:level="${i + 1}" text:bullet-char="${['•', '◦', '▪'][i % 3]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="${(0.635 * (i + 2)).toFixed(3)}cm" fo:text-indent="-0.635cm" fo:margin-left="${(0.635 * (i + 2)).toFixed(3)}cm"/></style:list-level-properties></text:list-level-style-bullet>`).join('')}</text:list-style>`;

  const automatic = [
    ...[...paraStyles.values()].map(s => s.xml),
    ...[...textStyles.values()].map(s => textStyleXml(s.name, s.run)),
    '<style:style style:name="TB" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>',
    '<style:style style:name="TT" style:family="table"><style:table-properties style:width="17cm" table:align="margins"/></style:style>',
    '<style:style style:name="TC" style:family="table-cell"><style:table-cell-properties fo:padding="0.097cm" fo:border="0.5pt solid #000000"/></style:style>',
    '<style:style style:name="HR" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:border-bottom="0.06pt solid #808080" fo:padding="0cm" fo:margin-bottom="0.3cm"/></style:style>',
    listStyle('LB', false),
    listStyle('LN', true),
  ].join('\n');

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS}>
<office:font-face-decls>
 <style:font-face style:name="Liberation Serif" svg:font-family="'Liberation Serif'" style:font-family-generic="roman"/>
 <style:font-face style:name="Liberation Sans" svg:font-family="'Liberation Sans'" style:font-family-generic="swiss"/>
 <style:font-face style:name="Liberation Mono" svg:font-family="'Liberation Mono'" style:font-family-generic="modern" style:font-pitch="fixed"/>
</office:font-face-decls>
<office:automatic-styles>
${automatic}
</office:automatic-styles>
<office:body><office:text>
${body.join('\n')}
</office:text></office:body>
</office:document-content>
`;
  zip.file('content.xml', content);
  zip.file('styles.xml', ODT_STYLES);
  zip.file('meta.xml', metaXml(title));
  for (const [p, d] of pictures) zip.file(p, d.bytes);
  zip.file('META-INF/manifest.xml', MANIFEST([
    ['/', 'application/vnd.oasis.opendocument.text'],
    ['content.xml', 'text/xml'], ['styles.xml', 'text/xml'], ['meta.xml', 'text/xml'],
    ...pictures.map(([p, d]) => [p, d.mime]),
  ]));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text', compression: 'DEFLATE' });
}

/* ---------------- ODP → deck ---------------- */

const DEFAULT_SIZE = { title: 40, subtitle: 24, outline: 22, notes: 12 };

export async function odpToDeck(data) {
  const zip = await loadZip(await toBytes(data));
  const content = parseXml(await zip.file('content.xml').async('string'));
  const stylesFile = zip.file('styles.xml');
  const stylesDoc = stylesFile ? parseXml(await stylesFile.async('string')) : null;
  const styles = styleResolver(content, stylesDoc);

  let width = 960, height = 540;
  const layout = stylesDoc && all(stylesDoc.documentElement, 'page-layout-properties')[0];
  if (layout) {
    width = toPt(attr(layout, 'page-width'), 960) || 960;
    height = toPt(attr(layout, 'page-height'), 540) || 540;
  }

  const pending = [];
  const slides = [];
  const presentation = all(content.documentElement, 'presentation')[0];
  for (const page of kids(presentation, 'page')) {
    const pageProps = styles.props(attr(page, 'style-name'));
    const slide = { elements: [], notes: '' };
    if (pageProps.fill === 'solid' && pageProps['fill-color']) slide.background = pageProps['fill-color'].replace('#', '').toLowerCase();

    const readShape = (el, dx = 0, dy = 0) => {
      const tag = localName(el);
      if (tag === 'g') { for (const c of kids(el)) readShape(c, dx, dy); return; }
      if (tag === 'notes') {
        slide.notes = all(el, 'p').map(p => p.textContent).join('\n').trim();
        return;
      }
      const x = toPt(attr(el, 'x')) + dx, y = toPt(attr(el, 'y')) + dy;
      const w = toPt(attr(el, 'width')), h = toPt(attr(el, 'height'));
      const cls = attr(el, 'class') || '';
      const gProps = styles.props(attr(el, 'style-name'));
      const box = { type: 'box', x, y, w, h, paragraphs: [] };
      if (tag === 'rect' || tag === 'custom-shape' || tag === 'ellipse') {
        box.shape = tag === 'ellipse' || /ellipse/.test(attr(all(el, 'enhanced-geometry')[0], 'type') || '') ? 'ellipse' : 'rect';
      }
      if (gProps.fill === 'solid' && gProps['fill-color']) box.fill = gProps['fill-color'].replace('#', '').toLowerCase();
      if (gProps.stroke && gProps.stroke !== 'none' && gProps['stroke-color']) box.line = gProps['stroke-color'].replace('#', '').toLowerCase();
      const va = gProps['textarea-vertical-align'];
      if (va === 'middle' || va === 'bottom') box.valign = va;

      if (tag === 'frame') {
        const img = kid(el, 'image');
        const textBox = kid(el, 'text-box');
        if (img && !textBox) {
          const item = { type: 'image', x, y, w, h, src: '' };
          pending.push(zipImage(zip, attr(img, 'href')).then(src => { item.src = src || ''; }));
          slide.elements.push(item);
          return;
        }
        if (!textBox) return;
        readText(textBox, box, cls, gProps);
      } else if (tag === 'rect' || tag === 'custom-shape' || tag === 'ellipse') {
        readText(el, box, cls, gProps);
      } else return;
      slide.elements.push(box);
    };

    const readText = (holder, box, cls, gProps) => {
      const baseSize = parseFloat(gProps['font-size']) || DEFAULT_SIZE[cls] || 18;
      const emit = (p, bullet, level) => {
        const pp = styles.props(attr(p, 'style-name'));
        const para = { runs: [], level };
        if (bullet) para.bullet = true;
        const align = pp['text-align'];
        if (align === 'center' || align === 'end' || align === 'right' || align === 'justify') para.align = align === 'end' ? 'right' : align;
        const runs = [];
        const walk = (node, marks) => {
          for (let n = node.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 3) { if (n.nodeValue) runs.push({ text: n.nodeValue, ...marks }); continue; }
            if (n.nodeType !== 1) continue;
            const t = localName(n);
            if (t === 's') runs.push({ text: ' '.repeat(+attr(n, 'c') || 1), ...marks });
            else if (t === 'tab') runs.push({ text: '\t', ...marks });
            else if (t === 'line-break') runs.push({ text: '\n', ...marks });
            else if (t === 'span') walk(n, { ...marks, ...marksFromProps(styles.props(attr(n, 'style-name'))) });
            else walk(n, marks);
          }
        };
        const base = { size: baseSize, ...marksFromProps(gProps), ...marksFromProps(pp) };
        walk(p, base);
        para.runs = mergeRunsSized(runs);
        box.paragraphs.push(para);
      };
      const walkList = (list, level) => {
        for (const item of kids(list)) for (const cc of kids(item)) {
          if (localName(cc) === 'list') walkList(cc, level + 1);
          else if (localName(cc) === 'p') emit(cc, true, level);
        }
      };
      for (const c of kids(holder)) {
        const t = localName(c);
        if (t === 'p' || t === 'h') emit(c, false, 0);
        else if (t === 'list') walkList(c, 0);
      }
    };

    for (const el of kids(page)) readShape(el);
    slides.push(slide);
  }
  await Promise.all(pending);
  for (const s of slides) s.elements = s.elements.filter(e => e.type !== 'image' || e.src);
  return { width, height, slides: slides.length ? slides : [{ elements: [], notes: '' }] };
}

/** Like mergeRuns but also keeps runs of different sizes apart. */
export function mergeRunsSized(runs) {
  const out = [];
  for (const r of runs) {
    if (!r || !r.text) continue;
    const last = out[out.length - 1];
    if (last && ['bold', 'italic', 'underline', 'strike', 'color', 'size', 'href'].every(k => (last[k] || false) === (r[k] || false))) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

/* ---------------- deck → ODP ---------------- */

export async function deckToOdp(deck) {
  const zip = await newZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.presentation', { compression: 'STORE' });
  const auto = [];
  const autoKeys = new Map();
  const style = (key, xml) => {
    if (!autoKeys.has(key)) { const name = `a${autoKeys.size + 1}`; autoKeys.set(key, name); auto.push(xml(name)); }
    return autoKeys.get(key);
  };
  const pictures = [];
  const pages = [];

  deck.slides.forEach((slide, si) => {
    const pageStyle = slide.background
      ? style(`dp:${slide.background}`, n => `<style:style style:name="${n}" style:family="drawing-page"><style:drawing-page-properties draw:fill="solid" draw:fill-color="#${slide.background}" presentation:background-visible="true" draw:background-size="full"/></style:style>`)
      : style('dp:none', n => `<style:style style:name="${n}" style:family="drawing-page"><style:drawing-page-properties presentation:background-visible="true" presentation:background-objects-visible="true"/></style:style>`);
    const shapes = [];
    slide.elements.forEach((el, ei) => {
      const geo = `svg:x="${cm(el.x)}" svg:y="${cm(el.y)}" svg:width="${cm(el.w)}" svg:height="${cm(el.h)}"`;
      if (el.type === 'image') {
        const data = dataUrlToBytes(el.src);
        if (!data) return;
        const ext = (data.mime.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
        const p = `Pictures/s${si + 1}i${ei + 1}.${ext}`;
        pictures.push([p, data]);
        shapes.push(`<draw:frame draw:layer="layout" ${geo}><draw:image xlink:href="${p}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"><text:p/></draw:image></draw:frame>`);
        return;
      }
      const gKey = `g:${el.fill || ''}:${el.line || ''}:${el.valign || ''}:${el.shape ? 's' : 'f'}`;
      const gStyle = style(gKey, n => `<style:style style:name="${n}" style:family="graphic"><style:graphic-properties draw:fill="${el.fill ? 'solid' : 'none'}"${el.fill ? ` draw:fill-color="#${el.fill}"` : ''} draw:stroke="${el.line ? 'solid' : 'none'}"${el.line ? ` svg:stroke-color="#${el.line}"` : ''} draw:textarea-vertical-align="${el.valign || 'top'}" draw:auto-grow-height="false" fo:padding-top="0.125cm" fo:padding-bottom="0.125cm" fo:padding-left="0.25cm" fo:padding-right="0.25cm" fo:wrap-option="wrap"/></style:style>`);
      const paras = [];
      let inList = false;
      for (const p of el.paragraphs || []) {
        const pStyle = p.align ? style(`p:${p.align}`, n => `<style:style style:name="${n}" style:family="paragraph"><style:paragraph-properties fo:text-align="${p.align === 'right' ? 'end' : p.align}"/></style:style>`) : null;
        const inner = (p.runs || []).map(r => {
          const tKey = `t:${r.bold ? 'b' : ''}${r.italic ? 'i' : ''}${r.underline ? 'u' : ''}${r.strike ? 's' : ''}:${r.color || ''}:${r.size || ''}`;
          const tStyle = style(tKey, n => textStyleXml(n, r));
          return `<text:span text:style-name="${tStyle}">${odfText(r.text)}</text:span>`;
        }).join('');
        const pOpen = `<text:p${pStyle ? ` text:style-name="${pStyle}"` : ''}>`;
        if (p.bullet) {
          const lvl = p.level || 0;
          let wrap = pOpen + inner + '</text:p>';
          for (let i = 0; i < lvl; i++) wrap = `<text:list><text:list-item>${wrap}</text:list-item></text:list>`;
          paras.push(`${inList ? '' : '<text:list text:style-name="LB">'}<text:list-item>${wrap}</text:list-item>`);
          inList = true;
        } else {
          if (inList) { paras.push('</text:list>'); inList = false; }
          paras.push(pOpen + inner + '</text:p>');
        }
      }
      if (inList) paras.push('</text:list>');
      const text = paras.join('');
      if (el.shape === 'ellipse') shapes.push(`<draw:ellipse draw:style-name="${gStyle}" draw:layer="layout" ${geo}>${text}</draw:ellipse>`);
      else if (el.shape) shapes.push(`<draw:rect draw:style-name="${gStyle}" draw:layer="layout" ${geo}>${text}</draw:rect>`);
      else shapes.push(`<draw:frame draw:style-name="${gStyle}" draw:layer="layout" ${geo}><draw:text-box>${text || '<text:p/>'}</draw:text-box></draw:frame>`);
    });
    const notes = slide.notes ? `<presentation:notes><draw:frame presentation:class="notes" svg:x="2cm" svg:y="14cm" svg:width="17cm" svg:height="12cm"><draw:text-box>${String(slide.notes).split('\n').map(l => `<text:p>${odfText(l)}</text:p>`).join('')}</draw:text-box></draw:frame></presentation:notes>` : '';
    pages.push(`<draw:page draw:name="Slide ${si + 1}" draw:style-name="${pageStyle}" draw:master-page-name="Default">${shapes.join('')}${notes}</draw:page>`);
  });

  const bulletList = `<text:list-style style:name="LB">${Array.from({ length: 9 }, (_, i) => `<text:list-level-style-bullet text:level="${i + 1}" text:bullet-char="${['•', '–', '•'][i % 3]}"><style:list-level-properties text:space-before="${(0.6 * i).toFixed(1)}cm" text:min-label-width="0.6cm"/></text:list-level-style-bullet>`).join('')}</text:list-style>`;

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS}>
<office:automatic-styles>
${auto.join('\n')}
${bulletList}
</office:automatic-styles>
<office:body><office:presentation>
${pages.join('\n')}
</office:presentation></office:body>
</office:document-content>
`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS}>
<office:styles>
 <style:default-style style:family="graphic"><style:text-properties fo:font-size="18pt" style:font-name="Liberation Sans" fo:font-family="'Liberation Sans'"/></style:default-style>
</office:styles>
<office:automatic-styles>
 <style:page-layout style:name="PM1"><style:page-layout-properties fo:margin-top="0cm" fo:margin-bottom="0cm" fo:margin-left="0cm" fo:margin-right="0cm" fo:page-width="${cm(deck.width)}" fo:page-height="${cm(deck.height)}" style:print-orientation="landscape"/></style:page-layout>
 <style:style style:name="Mdp1" style:family="drawing-page"><style:drawing-page-properties draw:background-size="full"/></style:style>
</office:automatic-styles>
<office:master-styles>
 <draw:layer-set><draw:layer draw:name="layout"/><draw:layer draw:name="background"/><draw:layer draw:name="backgroundobjects"/><draw:layer draw:name="controls"/><draw:layer draw:name="measurelines"/></draw:layer-set>
 <style:master-page style:name="Default" style:page-layout-name="PM1" draw:style-name="Mdp1"/>
</office:master-styles>
</office:document-styles>
`;
  zip.file('content.xml', content);
  zip.file('styles.xml', stylesXml);
  zip.file('meta.xml', metaXml(deck.title));
  for (const [p, d] of pictures) zip.file(p, d.bytes);
  zip.file('META-INF/manifest.xml', MANIFEST([
    ['/', 'application/vnd.oasis.opendocument.presentation'],
    ['content.xml', 'text/xml'], ['styles.xml', 'text/xml'], ['meta.xml', 'text/xml'],
    ...pictures.map(([p, d]) => [p, d.mime]),
  ]));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.presentation', compression: 'DEFLATE' });
}
