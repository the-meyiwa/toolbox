/* ============================================================
   The document model Scribe edits through.

   Every reader turns a file into HTML for the editing surface, and
   every writer starts from this model, which is read back off that
   surface. Keeping one small model in the middle means each format
   only needs one reader and one writer, not one per pair.

   Block
     { type: 'paragraph', style: 'p'|'h1'…'h6'|'quote'|'pre',
       align?: 'left'|'center'|'right'|'justify',
       list?: { ordered: boolean, level: number }, runs: Run[] }
     { type: 'table', rows: { header?: boolean, cells: Run[][] }[] }
     { type: 'image', src: string, width?: number, height?: number, alt?: string }
     { type: 'rule' }
     { type: 'pagebreak' }
   Run
     { text, bold?, italic?, underline?, strike?, code?, href?, color? }
   A newline inside a run's text is a line break within the paragraph.
   ============================================================ */

import { escHtml } from './xml.js';

const MARKS = ['bold', 'italic', 'underline', 'strike', 'code', 'href', 'color'];
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'hr', 'section', 'article', 'header', 'footer', 'main', 'aside', 'figure', 'figcaption', 'nav', 'dl', 'dt', 'dd', 'address', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'body', 'html']);
const SKIP_TAGS = new Set(['script', 'style', 'head', 'title', 'meta', 'link', 'noscript', 'template', 'iframe', 'object', 'embed', 'svg', 'math', 'button', 'input', 'select', 'textarea']);

const tagOf = (n) => String(n.localName || n.nodeName || '').toLowerCase().replace(/^.*:/, '');

export function sameMarks(a, b) {
  return MARKS.every(k => (a[k] || false) === (b[k] || false));
}

/** Join neighbouring runs that look the same, and drop empty ones. */
export function mergeRuns(runs) {
  const out = [];
  for (const r of runs) {
    if (!r || r.text == null || r.text === '') continue;
    const last = out[out.length - 1];
    if (last && sameMarks(last, r)) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

export function runsText(runs) {
  return (runs || []).map(r => r.text).join('');
}

function styleMap(el) {
  const out = {};
  const s = el.getAttribute?.('style');
  if (!s) return out;
  for (const part of String(s).split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim().toLowerCase();
  }
  return out;
}

function alignOf(el) {
  const st = styleMap(el);
  const a = st['text-align'] || String(el.getAttribute?.('align') || '').toLowerCase();
  if (a === 'center' || a === 'right' || a === 'justify') return a;
  if (a === 'start' || a === 'left') return 'left';
  return undefined;
}

function normColor(c) {
  if (!c) return undefined;
  const s = String(c).trim().toLowerCase();
  let m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return m[1] === '000000' ? undefined : m[1];
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  if (m) { const hex = m[1] + m[1] + m[2] + m[2] + m[3] + m[3]; return hex === '000000' ? undefined : hex; }
  m = /^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (m) {
    const hex = [m[1], m[2], m[3]].map(v => Math.min(255, +v).toString(16).padStart(2, '0')).join('');
    return hex === '000000' ? undefined : hex;
  }
  return undefined;
}

function marksFor(el, inherited) {
  const tag = tagOf(el);
  const m = { ...inherited };
  if (tag === 'b' || tag === 'strong') m.bold = true;
  if (tag === 'i' || tag === 'em' || tag === 'cite') m.italic = true;
  if (tag === 'u' || tag === 'ins') m.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') m.strike = true;
  if (tag === 'code' || tag === 'kbd' || tag === 'samp' || tag === 'tt') m.code = true;
  if (tag === 'a') {
    const href = safeHref(el.getAttribute?.('href'));
    if (href) m.href = href;
  }
  if (tag === 'font') {
    const c = normColor(el.getAttribute?.('color'));
    if (c) m.color = c;
  }
  const st = styleMap(el);
  if (st['font-weight'] && (st['font-weight'] === 'bold' || +st['font-weight'] >= 600)) m.bold = true;
  if (st['font-weight'] === 'normal' || st['font-weight'] === '400') m.bold = false;
  if (st['font-style'] === 'italic' || st['font-style'] === 'oblique') m.italic = true;
  const deco = st['text-decoration'] || st['text-decoration-line'] || '';
  if (deco.includes('underline')) m.underline = true;
  if (deco.includes('line-through')) m.strike = true;
  const c = normColor(st.color);
  if (c) m.color = c;
  return m;
}

/** Only links that cannot run script survive into a saved file. */
export function safeHref(href) {
  const h = String(href || '').trim();
  if (!h) return undefined;
  if (/^(https?:|mailto:|tel:|#)/i.test(h)) return h;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(h)) return h; // relative
  return undefined;
}

/**
 * Read the model back off an HTML tree (the editing surface, or a parsed
 * document). Works on any DOM with childNodes/getAttribute.
 * @returns {object[]} blocks
 */
export function htmlToModel(root) {
  const blocks = [];
  let para = null; // open paragraph collecting loose inline content

  const flush = () => {
    if (para) {
      para.runs = mergeRuns(para.runs);
      if (para.runs.length || para.keepEmpty) { delete para.keepEmpty; blocks.push(para); }
      para = null;
    }
  };
  const openPara = (extra = {}) => { if (!para) para = { type: 'paragraph', style: 'p', runs: [], ...extra }; return para; };

  /** Inline content into `target.runs`; images and nested blocks break out. */
  const inline = (node, marks, target, onBlock) => {
    for (let n = node.firstChild; n; n = n.nextSibling) inlineOne(n, marks, target, onBlock);
  };
  const inlineOne = (n, marks, target, onBlock) => {
    if (n.nodeType === 3) {
      const text = String(n.nodeValue ?? '').replace(/[\t\n\r ]+/g, ' ');
      if (text) target.runs.push({ text, ...marks });
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = tagOf(n);
    if (SKIP_TAGS.has(tag)) return;
    if (tag === 'br') { target.runs.push({ text: '\n', ...marks }); return; }
    if (tag === 'img') { onBlock(n); return; }
    if (BLOCK_TAGS.has(tag) && tag !== 'td' && tag !== 'th') { onBlock(n); return; }
    inline(n, marksFor(n, marks), target, onBlock);
  };

  const image = (el) => {
    const src = el.getAttribute?.('src') || '';
    if (!/^data:image\//i.test(src) && !/^(https?:|blob:)/i.test(src)) return;
    const w = parseFloat(el.getAttribute?.('width') || styleMap(el).width) || undefined;
    const h = parseFloat(el.getAttribute?.('height') || styleMap(el).height) || undefined;
    flush();
    blocks.push({ type: 'image', src, width: w, height: h, alt: el.getAttribute?.('alt') || undefined });
  };

  const trimRuns = (runs) => {
    const out = mergeRuns(runs);
    if (out.length) {
      out[0].text = out[0].text.replace(/^ +/, '');
      const last = out[out.length - 1];
      last.text = last.text.replace(/[ ]+$/, '');
    }
    return mergeRuns(out);
  };

  const paragraph = (el, extra) => {
    flush();
    const p = { type: 'paragraph', style: 'p', runs: [], ...extra };
    const align = alignOf(el);
    if (align && align !== 'left') p.align = align;
    const pending = [];
    inline(el, marksFor(el, {}), p, (child) => pending.push(child));
    p.runs = trimRuns(p.runs);
    // Strip a trailing line break the editor leaves in an otherwise empty block.
    if (p.runs.length === 1 && p.runs[0].text === '\n') p.runs = [];
    blocks.push(p);
    for (const child of pending) block(child, extra?.list ? extra.list.level : 0);
  };

  const list = (el, level) => {
    flush();
    const ordered = tagOf(el) === 'ol';
    for (const li of kidsOf(el)) {
      const tag = tagOf(li);
      if (tag === 'ul' || tag === 'ol') { list(li, level + 1); continue; }
      if (tag !== 'li') { block(li, level); continue; }
      const p = { type: 'paragraph', style: 'p', runs: [], list: { ordered, level } };
      const nested = [];
      inline(li, {}, p, (child) => nested.push(child));
      p.runs = trimRuns(p.runs);
      blocks.push(p);
      for (const child of nested) {
        const t = tagOf(child);
        if (t === 'ul' || t === 'ol') list(child, level + 1);
        else if (t === 'p' || t === 'div') {
          // A paragraph inside a list item continues the item's text.
          const extraP = { type: 'paragraph', style: 'p', runs: [] };
          inline(child, marksFor(child, {}), extraP, () => {});
          const add = trimRuns(extraP.runs);
          if (add.length) p.runs = mergeRuns(p.runs.length ? [...p.runs, { text: '\n' }, ...add] : add);
        } else block(child, level);
      }
    }
  };

  const table = (el) => {
    flush();
    const rows = [];
    const collect = (node) => {
      for (const c of kidsOf(node)) {
        const t = tagOf(c);
        if (t === 'thead' || t === 'tbody' || t === 'tfoot') collect(c);
        else if (t === 'tr') {
          const cells = [];
          let header = false;
          for (const td of kidsOf(c)) {
            const tt = tagOf(td);
            if (tt !== 'td' && tt !== 'th') continue;
            if (tt === 'th') header = true;
            const cell = { runs: [] };
            const blockText = (b) => { cell.runs.push({ text: '\n' }); inline(b, marksFor(b, {}), cell, blockText); };
            inline(td, {}, cell, blockText);
            cells.push(trimRuns(cell.runs.filter((r, i) => !(i === 0 && r.text === '\n'))));
          }
          if (cells.length) rows.push({ header: header || tagOf(node) === 'thead', cells });
        }
      }
    };
    collect(el);
    if (rows.length) blocks.push({ type: 'table', rows });
  };

  const block = (el, level = 0) => {
    const tag = tagOf(el);
    if (SKIP_TAGS.has(tag)) return;
    if (HEADINGS.has(tag)) return paragraph(el, { style: tag });
    if (tag === 'p' || tag === 'dt' || tag === 'dd' || tag === 'figcaption' || tag === 'address') return paragraph(el, {});
    if (tag === 'blockquote') {
      if (kidsOf(el).some(k => BLOCK_TAGS.has(tagOf(k)))) {
        const start = blocks.length;
        container(el);
        for (let i = start; i < blocks.length; i++) if (blocks[i].type === 'paragraph' && blocks[i].style === 'p' && !blocks[i].list) blocks[i].style = 'quote';
        return;
      }
      return paragraph(el, { style: 'quote' });
    }
    if (tag === 'pre') {
      flush();
      const text = String(el.textContent ?? '').replace(/\n$/, '');
      blocks.push({ type: 'paragraph', style: 'pre', runs: text ? [{ text }] : [] });
      return;
    }
    if (tag === 'ul' || tag === 'ol') return list(el, level);
    if (tag === 'li') return paragraph(el, { list: { ordered: false, level } });
    if (tag === 'table') return table(el);
    if (tag === 'hr') {
      flush();
      if (/page-break|break-after|break-before/.test(el.getAttribute?.('style') || '') || el.getAttribute?.('data-page-break') != null) blocks.push({ type: 'pagebreak' });
      else blocks.push({ type: 'rule' });
      return;
    }
    if (tag === 'img') return image(el);
    if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'main' || tag === 'aside' || tag === 'figure' || tag === 'nav' || tag === 'body' || tag === 'html' || tag === 'dl') {
      if (tag === 'div' && !kidsOf(el).some(k => BLOCK_TAGS.has(tagOf(k)) || tagOf(k) === 'img')) return paragraph(el, {});
      return container(el);
    }
    // Stray inline element at block level.
    inlineOne(el, {}, openPara(), (child) => { flush(); block(child, level); });
  };

  const container = (el) => {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        const text = String(n.nodeValue ?? '').replace(/[\t\n\r ]+/g, ' ');
        if (text.trim()) openPara().runs.push({ text });
        else if (para && text) para.runs.push({ text });
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = tagOf(n);
      if (SKIP_TAGS.has(tag)) continue;
      if (tag === 'br') { if (para) para.runs.push({ text: '\n' }); else blocks.push({ type: 'paragraph', style: 'p', runs: [] }); continue; }
      if (BLOCK_TAGS.has(tag) || tag === 'img') { flush(); block(n); continue; }
      inlineOne(n, {}, openPara(), (child) => { flush(); block(child); });
    }
    flush();
  };

  container(root);
  // Trim a trailing run of whitespace-only paragraphs the editor leaves behind.
  return blocks.map(b => (b.type === 'paragraph' ? { ...b, runs: mergeRuns(b.runs) } : b));
}

function kidsOf(el) {
  const out = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n);
  return out;
}

/* ---------------- writers that need no library ---------------- */

function runHtml(r) {
  let s = escHtml(r.text).replace(/\n/g, '<br>');
  if (r.code) s = `<code>${s}</code>`;
  if (r.bold) s = `<strong>${s}</strong>`;
  if (r.italic) s = `<em>${s}</em>`;
  if (r.underline) s = `<u>${s}</u>`;
  if (r.strike) s = `<s>${s}</s>`;
  if (r.color) s = `<span style="color:#${escHtml(r.color)}">${s}</span>`;
  if (r.href) s = `<a href="${escHtml(r.href)}">${s}</a>`;
  return s;
}

export function runsHtml(runs) {
  return (runs || []).map(runHtml).join('');
}

/** Model → HTML body markup (no <html> wrapper). */
export function modelToHtml(blocks) {
  const out = [];
  let listStack = []; // [{ordered}]
  const closeLists = (depth) => {
    while (listStack.length > depth) out.push(listStack.pop().ordered ? '</ol>' : '</ul>');
  };
  for (const b of blocks) {
    if (b.type === 'paragraph' && b.list) {
      const depth = b.list.level + 1;
      closeLists(depth);
      if (listStack.length === depth && listStack[depth - 1].ordered !== b.list.ordered) closeLists(depth - 1);
      while (listStack.length < depth) {
        const ordered = b.list.ordered;
        listStack.push({ ordered });
        out.push(ordered ? '<ol>' : '<ul>');
      }
      out.push(`<li>${runsHtml(b.runs) || '<br>'}</li>`);
      continue;
    }
    closeLists(0);
    if (b.type === 'paragraph') {
      const align = b.align ? ` style="text-align:${b.align}"` : '';
      const inner = runsHtml(b.runs) || '<br>';
      if (b.style === 'pre') out.push(`<pre>${escHtml(runsText(b.runs))}</pre>`);
      else if (b.style === 'quote') out.push(`<blockquote${align}>${inner}</blockquote>`);
      else if (HEADINGS.has(b.style)) out.push(`<${b.style}${align}>${inner}</${b.style}>`);
      else out.push(`<p${align}>${inner}</p>`);
    } else if (b.type === 'table') {
      out.push('<table><tbody>');
      for (const row of b.rows) {
        const cell = row.header ? 'th' : 'td';
        out.push(`<tr>${row.cells.map(c => `<${cell}>${runsHtml(c) || '<br>'}</${cell}>`).join('')}</tr>`);
      }
      out.push('</tbody></table>');
    } else if (b.type === 'image') {
      const size = [b.width ? ` width="${Math.round(b.width)}"` : '', b.height ? ` height="${Math.round(b.height)}"` : ''].join('');
      out.push(`<p><img src="${escHtml(b.src)}" alt="${escHtml(b.alt || '')}"${size}></p>`);
    } else if (b.type === 'rule') out.push('<hr>');
    else if (b.type === 'pagebreak') out.push('<hr data-page-break="true" style="page-break-after:always">');
  }
  closeLists(0);
  return out.join('\n');
}

function mdEscape(s) {
  return String(s).replace(/([\\`*_[\]<>])/g, '\\$1');
}

function runsMd(runs) {
  return (runs || []).map(r => {
    if (r.code) return '`' + r.text.replace(/`/g, '​`') + '`';
    let s = mdEscape(r.text).replace(/\n/g, '  \n');
    const lead = s.match(/^\s*/)[0];
    const trail = s.match(/\s*$/)[0];
    let core = s.trim();
    if (!core) return s;
    if (r.strike) core = `~~${core}~~`;
    if (r.italic) core = `*${core}*`;
    if (r.bold) core = `**${core}**`;
    if (r.href) core = `[${core}](${r.href.replace(/\)/g, '%29')})`;
    return lead + core + trail;
  }).join('');
}

export function modelToMarkdown(blocks) {
  const out = [];
  const counters = [];
  let prevList = false;
  for (const b of blocks) {
    if (b.type === 'paragraph' && b.list) {
      const { level, ordered } = b.list;
      counters.length = level + 1;
      counters[level] = (counters[level] || 0) + 1;
      const bullet = ordered ? `${counters[level]}.` : '-';
      out.push(`${'   '.repeat(level)}${bullet} ${runsMd(b.runs).replace(/\n/g, '\n' + '   '.repeat(level + 1))}`);
      prevList = true;
      continue;
    }
    counters.length = 0;
    if (prevList) out.push('');
    prevList = false;
    if (b.type === 'paragraph') {
      if (b.style === 'pre') out.push('```\n' + runsText(b.runs) + '\n```');
      else if (HEADINGS.has(b.style)) out.push(`${'#'.repeat(+b.style[1])} ${runsMd(b.runs).replace(/\s*\n\s*/g, ' ')}`);
      else if (b.style === 'quote') out.push(runsMd(b.runs).split('\n').map(l => `> ${l}`).join('\n'));
      else out.push(runsMd(b.runs));
    } else if (b.type === 'table') {
      const width = Math.max(...b.rows.map(r => r.cells.length));
      const cellMd = (c) => runsMd(c).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, '<br>');
      const [head, ...rest] = b.rows;
      const row = (r) => `| ${Array.from({ length: width }, (_, i) => cellMd(r.cells[i] || [])).join(' | ')} |`;
      out.push([row(head), `| ${Array(width).fill('---').join(' | ')} |`, ...rest.map(row)].join('\n'));
    } else if (b.type === 'image') out.push(`![${mdEscape(b.alt || '')}](${b.src})`);
    else if (b.type === 'rule' || b.type === 'pagebreak') out.push('---');
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function modelToText(blocks) {
  const out = [];
  const counters = [];
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      if (b.list) {
        counters.length = b.list.level + 1;
        counters[b.list.level] = (counters[b.list.level] || 0) + 1;
        out.push(`${'  '.repeat(b.list.level)}${b.list.ordered ? `${counters[b.list.level]}.` : '•'} ${runsText(b.runs)}`);
      } else { counters.length = 0; out.push(runsText(b.runs)); }
    } else if (b.type === 'table') {
      counters.length = 0;
      for (const r of b.rows) out.push(r.cells.map(c => runsText(c).replace(/\n/g, ' ')).join('\t'));
    } else if (b.type === 'rule') out.push('----------');
    else if (b.type === 'pagebreak') out.push('\f');
  }
  return out.join('\n') + '\n';
}

/** A standalone HTML file around the model, for saving as .html. */
export function modelToHtmlFile(blocks, title = 'Document') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escHtml(title)}</title>
<style>body{font:16px/1.6 Georgia,serif;max-width:46rem;margin:3rem auto;padding:0 1rem;color:#111}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}img{max-width:100%}</style>
</head>
<body>
${modelToHtml(blocks)}
</body>
</html>
`;
}

/** Plain text → blocks, one paragraph per line. */
export function textToModel(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(line => ({
    type: 'paragraph', style: 'p', runs: line ? [{ text: line }] : [],
  }));
}
