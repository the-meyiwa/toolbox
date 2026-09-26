/* ============================================================
   RTF reader and writer.

   Reads the parts of RTF people actually use — paragraphs, headings,
   bold/italic/underline/strike, colour, alignment, bullets and
   numbering, tables, links, embedded PNG/JPEG pictures, page breaks —
   and skips every destination it does not understand, which is what
   the spec asks readers to do.
   ============================================================ */

import { mergeRuns, runsText } from './model.js';
import { bytesToDataUrl, dataUrlToBytes } from './xml.js';

/* Windows-1252 differs from Latin-1 only in 0x80–0x9F. */
const CP1252 = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018,
  0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC,
  0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178,
};
const FROM_1252 = Object.fromEntries(Object.entries(CP1252).map(([k, v]) => [v, +k]));

const SKIP_DESTS = new Set([
  'fonttbl', 'stylesheet', 'info', 'header', 'headerl', 'headerr', 'headerf', 'footer', 'footerl', 'footerr', 'footerf',
  'footnote', 'annotation', 'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'xmlnstbl', 'listtable',
  'listoverridetable', 'rsidtbl', 'generator', 'pgdsctbl', 'operator', 'author', 'title', 'subject', 'company',
  'filetbl', 'revtbl', 'object', 'objdata', 'shppict', 'nonshppict', 'bkmkstart', 'bkmkend', 'xe', 'tc', 'txe',
  'mmathPr', 'defchp', 'defpap', 'wgrffmtfilter', 'fchars', 'lchars', 'userprops', 'docvar', 'template',
  'listpicture', 'pnseclvl', 'sp', 'sn', 'sv', 'shpinst', 'shptxt', 'do', 'atnid', 'atnauthor', 'panose', 'falt',
]);

const CHAR_WORDS = {
  emdash: '\u2014', endash: '\u2013', bullet: '\u2022', lquote: '\u2018', rquote: '\u2019',
  ldblquote: '\u201C', rdblquote: '\u201D', emspace: '\u2003', enspace: '\u2002', qmspace: '\u2005',
  tab: '\t', line: '\n', zwj: '\u200D', zwnj: '\u200C',
};

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '{') { tokens.push({ t: 'open' }); i++; continue; }
    if (c === '}') { tokens.push({ t: 'close' }); i++; continue; }
    if (c === '\\') {
      const d = src[i + 1];
      if (d === undefined) break;
      if (/[a-zA-Z]/.test(d)) {
        let j = i + 1;
        while (j < n && /[a-zA-Z]/.test(src[j])) j++;
        const word = src.slice(i + 1, j);
        let num = null;
        let k = j;
        if (src[k] === '-' || /\d/.test(src[k] || '')) {
          let m = k + 1;
          while (m < n && /\d/.test(src[m])) m++;
          num = parseInt(src.slice(k, m), 10);
          k = m;
        }
        if (src[k] === ' ') k++;
        tokens.push({ t: 'word', word, num });
        i = k;
        continue;
      }
      if (d === "'") {
        tokens.push({ t: 'hex', code: parseInt(src.slice(i + 2, i + 4), 16) });
        i += 4;
        continue;
      }
      if (d === '\n' || d === '\r') { tokens.push({ t: 'word', word: 'par', num: null }); i += 2; continue; }
      tokens.push({ t: 'sym', sym: d });
      i += 2;
      continue;
    }
    if (c === '\r' || c === '\n') { i++; continue; }
    let j = i;
    while (j < n && src[j] !== '{' && src[j] !== '}' && src[j] !== '\\' && src[j] !== '\r' && src[j] !== '\n') j++;
    tokens.push({ t: 'text', text: src.slice(i, j) });
    i = j;
  }
  return tokens;
}

const hexToBytes = (hex) => {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(clean.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
};

/** RTF source → document model blocks. */
export function rtfToModel(src) {
  const text = String(src ?? '');
  if (!/^\s*\{\\rtf/.test(text)) {
    // Not RTF at all: treat as text rather than failing.
    return text.split(/\r?\n/).map(l => ({ type: 'paragraph', style: 'p', runs: l ? [{ text: l }] : [] }));
  }
  const tokens = tokenize(text);
  const blocks = [];
  const colors = [];

  const freshChar = () => ({ bold: false, italic: false, underline: false, strike: false, color: undefined, code: false });
  const freshPara = () => ({ align: undefined, list: null, level: 0, heading: null, intbl: false, left: 0 });

  let state = { ...freshChar(), para: freshPara(), skip: false, dest: null, uc: 1 };
  const stack = [];
  let runs = [];
  let ucSkip = 0;
  let hyperlink = null; // { href } while inside fldrslt
  let fldinst = null; // collecting instruction text
  let pict = null; // { hex, type, w, h }
  let listText = null;

  let row = null; // current table row: array of cells (runs[])
  let table = null;

  const emitText = (t) => {
    if (!t) return;
    if (ucSkip > 0) {
      const drop = Math.min(ucSkip, t.length);
      t = t.slice(drop);
      ucSkip -= drop;
      if (!t) return;
    }
    if (pict) { if (!state.pictNested) pict.hex += t; return; }
    if (fldinst != null) { fldinst += t; return; }
    if (listText != null) { listText += t; return; }
    if (state.skip || state.inPn) return;
    const run = { text: t };
    if (state.bold) run.bold = true;
    if (state.italic) run.italic = true;
    if (state.underline) run.underline = true;
    if (state.strike) run.strike = true;
    if (state.color) run.color = state.color;
    if (hyperlink?.href) run.href = hyperlink.href;
    runs.push(run);
  };

  const endParagraph = (kind = 'par') => {
    const p = state.para;
    const merged = mergeRuns(runs);
    runs = [];
    if (p.intbl && kind !== 'par') return merged; // cell content handed to caller
    if (p.intbl) {
      // A \par inside a cell is a line break within that cell.
      runs = merged.length ? [...merged, { text: '\n' }] : [];
      return null;
    }
    flushTable();
    const block = { type: 'paragraph', style: 'p', runs: merged };
    if (p.heading) block.style = `h${Math.min(6, p.heading)}`;
    if (p.align) block.align = p.align;
    if (p.list) block.list = { ordered: p.list === 'ordered', level: Math.max(0, p.level) };
    blocks.push(block);
    return null;
  };

  const flushTable = () => {
    if (row && row.length) { table = table || { type: 'table', rows: [] }; table.rows.push({ cells: row }); }
    row = null;
    if (table) { blocks.push(table); table = null; }
  };

  const finishPict = () => {
    if (!pict) return;
    const mime = pict.type === 'png' ? 'image/png' : pict.type === 'jpeg' ? 'image/jpeg' : null;
    if (mime && pict.hex.length > 16) {
      flushTable();
      const src = bytesToDataUrl(hexToBytes(pict.hex), mime);
      const width = pict.wgoal ? pict.wgoal / 15 : undefined; // twips → px at 96 dpi
      const height = pict.hgoal ? pict.hgoal / 15 : undefined;
      if (runs.length) endParagraph();
      blocks.push({ type: 'image', src, width, height });
    }
    pict = null;
  };

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    if (tok.t === 'open') {
      stack.push({ ...state, para: state.para, pictOwner: false, fldOwner: false, linkOwner: false, listOwner: false });
      state = { ...state };
      if (pict) state.pictNested = true;
      // A destination is the first control word of a group.
      const next = tokens[idx + 1];
      if (next?.t === 'sym' && next.sym === '*') {
        const w = tokens[idx + 2];
        if (w?.t === 'word' && w.word === 'pn') { /* read below */ }
        else if (w?.t === 'word' && w.word === 'fldinst') { /* read below */ }
        else state.skip = true;
      }
      continue;
    }
    if (tok.t === 'close') {
      const top = stack.pop();
      if (!top) continue;
      if (state.pictOwner) finishPict();
      if (state.fldOwner && fldinst != null) {
        const m = /HYPERLINK\s+(?:\\l\s+)?"([^"]+)"/i.exec(fldinst);
        hyperlink = m ? { href: m[1] } : null;
        fldinst = null;
      }
      if (state.linkOwner) hyperlink = null;
      if (state.listOwner && listText != null) {
        state.para.list = /\d|[a-z]\.|[ivx]+\./i.test(listText) ? 'ordered' : 'bullet';
        listText = null;
      }
      const para = state.para;
      state = top;
      state.para = para; // paragraph properties are not group-scoped in practice
      continue;
    }
    if (tok.t === 'hex') {
      if (ucSkip > 0) { ucSkip--; continue; }
      const code = CP1252[tok.code] ?? tok.code;
      emitText(String.fromCharCode(code));
      continue;
    }
    if (tok.t === 'text') { emitText(tok.text); continue; }
    if (tok.t === 'sym') {
      const s = tok.sym;
      if (s === '\\' || s === '{' || s === '}') emitText(s);
      else if (s === '~') emitText('\u00A0');
      else if (s === '_') emitText('\u2011');
      else if (s === '-') { /* optional hyphen */ }
      else if (s === '*') { /* handled at group open */ }
      continue;
    }
    // Control words.
    const { word, num } = tok;
    if (SKIP_DESTS.has(word)) { state.skip = true; continue; }
    if (word === 'colortbl') {
      // Read the colour table in place: ;\red0\green0\blue0; …
      let r = 0, g = 0, b = 0, any = false;
      let j = idx + 1;
      for (; j < tokens.length && tokens[j].t !== 'close'; j++) {
        const t = tokens[j];
        if (t.t === 'word') {
          if (t.word === 'red') { r = t.num; any = true; }
          if (t.word === 'green') { g = t.num; any = true; }
          if (t.word === 'blue') { b = t.num; any = true; }
        } else if (t.t === 'text') {
          for (const ch of t.text) {
            if (ch === ';') { colors.push(any ? [r, g, b].map(v => (v || 0).toString(16).padStart(2, '0')).join('') : undefined); r = g = b = 0; any = false; }
          }
        }
      }
      idx = j - 1;
      continue;
    }
    if (word === 'pict') { pict = { hex: '', type: null }; state.pictOwner = true; state.skip = true; continue; }
    if (pict) {
      if (word === 'pngblip') pict.type = 'png';
      else if (word === 'jpegblip') pict.type = 'jpeg';
      else if (word === 'picwgoal') pict.wgoal = num;
      else if (word === 'pichgoal') pict.hgoal = num;
      else if (word === 'bin') { /* binary pictures are rare; ignore */ }
      continue;
    }
    if (word === 'fldinst') { fldinst = ''; state.fldOwner = true; continue; }
    if (word === 'fldrslt') { state.linkOwner = !!hyperlink; continue; }
    if (word === 'pntext' || word === 'listtext') { listText = ''; state.listOwner = true; continue; }
    if (word === 'pn') { state.inPn = true; continue; }
    if (state.skip) continue;

    switch (word) {
      case 'par': endParagraph(); break;
      case 'sect': endParagraph(); break;
      case 'page': if (runs.length) endParagraph(); flushTable(); blocks.push({ type: 'pagebreak' }); break;
      case 'pard': state.para = freshPara(); break;
      case 'plain': Object.assign(state, freshChar()); break;
      case 'b': state.bold = num !== 0; break;
      case 'i': state.italic = num !== 0; break;
      case 'ul': case 'uld': case 'uldb': case 'ulw': case 'ulth': state.underline = num !== 0; break;
      case 'ulnone': state.underline = false; break;
      case 'strike': case 'striked': state.strike = num !== 0; break;
      case 'cf': state.color = colors[num] || undefined; break;
      case 'qc': state.para.align = 'center'; break;
      case 'qr': state.para.align = 'right'; break;
      case 'qj': state.para.align = 'justify'; break;
      case 'ql': state.para.align = undefined; break;
      case 'li': state.para.left = num || 0; if (state.para.list) state.para.level = Math.max(0, Math.round((num || 0) / 720) - 1); break;
      case 'ilvl': state.para.level = num || 0; break;
      case 'ls': if (!state.para.list) state.para.list = 'bullet'; break;
      case 'pnlvlblt': state.para.list = 'bullet'; state.para.level = Math.max(0, Math.round((state.para.left || 720) / 720) - 1); break;
      case 'pnlvlbody': case 'pndec': case 'pnlcltr': case 'pnucltr': case 'pnlcrm': case 'pnucrm':
        state.para.list = 'ordered'; state.para.level = Math.max(0, Math.round((state.para.left || 720) / 720) - 1); break;
      case 'outlinelevel': state.para.heading = (num ?? 0) + 1; break;
      case 'intbl': state.para.intbl = true; break;
      case 'trowd': row = row && row.length ? row : []; break;
      case 'cell': {
        const merged = endParagraph('cell') || [];
        row = row || [];
        row.push(merged.filter((r, i, a) => !(i === a.length - 1 && r.text === '\n')));
        break;
      }
      case 'row':
        table = table || { type: 'table', rows: [] };
        if (row) table.rows.push({ cells: row });
        row = [];
        state.para.intbl = false;
        break;
      case 'uc': state.uc = num ?? 1; break;
      case 'u': {
        let code = num ?? 0;
        if (code < 0) code += 65536;
        emitText(String.fromCharCode(code));
        ucSkip = state.uc;
        break;
      }
      default:
        if (CHAR_WORDS[word] != null) emitText(CHAR_WORDS[word]);
    }
  }
  if (runs.length) endParagraph();
  flushTable();
  // Paragraphs after the last \par are part of the body; a final empty one is noise.
  while (blocks.length && blocks[blocks.length - 1].type === 'paragraph' && !blocks[blocks.length - 1].runs.length) blocks.pop();
  return blocks;
}

/* ---------------- writer ---------------- */

function rtfEscape(text) {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ch === '\\' || ch === '{' || ch === '}') out += '\\' + ch;
    else if (ch === '\n') out += '\\line ';
    else if (ch === '\t') out += '\\tab ';
    else if (code < 0x80) out += ch;
    else if (code <= 0xFF && !(code >= 0x80 && code <= 0x9F)) out += `\\'${code.toString(16).padStart(2, '0')}`;
    else if (FROM_1252[code] != null) out += `\\'${FROM_1252[code].toString(16)}`;
    else if (code > 0xFFFF) {
      // Surrogate pair, each half as a signed 16-bit \u.
      const hi = Math.floor((code - 0x10000) / 0x400) + 0xD800;
      const lo = ((code - 0x10000) % 0x400) + 0xDC00;
      out += `\\u${hi - 65536}?\\u${lo - 65536}?`;
    } else out += `\\u${code > 32767 ? code - 65536 : code}?`;
  }
  return out;
}

const HEADING_SIZE = { h1: 40, h2: 32, h3: 28, h4: 24, h5: 22, h6: 22 }; // half-points

/** Model blocks → RTF source. */
export function modelToRtf(blocks) {
  const colors = [];
  const colorIndex = (hex) => {
    let i = colors.indexOf(hex);
    if (i < 0) { colors.push(hex); i = colors.length - 1; }
    return i + 1;
  };
  const body = [];

  const runRtf = (r) => {
    let pre = '';
    if (r.bold) pre += '\\b';
    if (r.italic) pre += '\\i';
    if (r.underline || r.href) pre += '\\ul';
    if (r.strike) pre += '\\strike';
    if (r.code) pre += '\\f1';
    if (r.color) pre += `\\cf${colorIndex(r.color)}`;
    const inner = `{${pre}${pre ? ' ' : ''}${rtfEscape(r.text)}}`;
    if (r.href) return `{\\field{\\*\\fldinst{HYPERLINK "${String(r.href).replace(/["\\{}]/g, '')}"}}{\\fldrslt${inner}}}`;
    return inner;
  };
  const runsRtf = (runs) => (runs || []).map(runRtf).join('');

  const counters = [];
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      let pard = '\\pard\\plain\\sa120';
      if (b.align === 'center') pard += '\\qc';
      else if (b.align === 'right') pard += '\\qr';
      else if (b.align === 'justify') pard += '\\qj';
      let prefix = '';
      if (b.list) {
        const lvl = b.list.level;
        counters.length = lvl + 1;
        counters[lvl] = (counters[lvl] || 0) + 1;
        const indent = 720 * (lvl + 1);
        pard += `\\fi-360\\li${indent}`;
        prefix = b.list.ordered
          ? `{\\pntext\\f0 ${counters[lvl]}.\\tab}{\\*\\pn\\pnlvlbody\\pndec\\pnstart1\\pnindent360{\\pntxta .}}`
          : `{\\pntext\\f0 \\'95\\tab}{\\*\\pn\\pnlvlblt\\pnf0\\pnindent360{\\pntxtb\\'95}}`;
      } else counters.length = 0;
      if (b.style && HEADING_SIZE[b.style]) {
        pard += `\\outlinelevel${+b.style[1] - 1}\\b\\fs${HEADING_SIZE[b.style]}`;
      } else if (b.style === 'quote') pard += '\\li720\\i';
      else if (b.style === 'pre') pard += '\\f1\\fs20';
      body.push(`${pard} ${prefix}${runsRtf(b.runs)}\\par`);
    } else if (b.type === 'table') {
      counters.length = 0;
      const width = Math.max(1, ...b.rows.map(r => r.cells.length));
      const cellW = Math.floor(9360 / width);
      for (const row of b.rows) {
        let def = '\\trowd\\trgaph108';
        for (let i = 1; i <= width; i++) def += `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${cellW * i}`;
        const cells = Array.from({ length: width }, (_, i) => `\\pard\\intbl ${row.header ? '{\\b ' : '{'}${runsRtf(row.cells[i] || [])}}\\cell`).join(' ');
        body.push(`${def} ${cells}\\row`);
      }
      body.push('\\pard\\par');
    } else if (b.type === 'image') {
      const data = dataUrlToBytes(b.src);
      if (!data || !/png|jpeg/.test(data.mime)) continue;
      const hex = Array.from(data.bytes, v => v.toString(16).padStart(2, '0')).join('').replace(/(.{128})/g, '$1\n');
      const w = Math.round((b.width || 320) * 15);
      const h = Math.round((b.height || 240) * 15);
      body.push(`\\pard {\\pict${data.mime === 'image/png' ? '\\pngblip' : '\\jpegblip'}\\picwgoal${w}\\pichgoal${h}\n${hex}}\\par`);
    } else if (b.type === 'rule') {
      body.push('\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par');
    } else if (b.type === 'pagebreak') {
      body.push('\\page');
    }
  }

  const colortbl = `{\\colortbl;${colors.map(h => `\\red${parseInt(h.slice(0, 2), 16)}\\green${parseInt(h.slice(2, 4), 16)}\\blue${parseInt(h.slice(4, 6), 16)};`).join('')}}`;
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}{\\f1\\fmodern\\fcharset0 Courier New;}}\n${colortbl}\n\\viewkind4\\fs24\n${body.join('\n')}\n}\n`;
}

export { runsText };
