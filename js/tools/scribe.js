/* ============================================================
   Scribe — a word processor for .docx, .odt, .rtf, .md, .txt and
   .html, that saves back to the format it opened. Legacy .doc files
   open as text and save as .docx.

   The page is a contenteditable surface. Saving reads the document
   model back off it (lib/docs/model.js) and hands that to the writer
   for the chosen format.
   ============================================================ */

import { mountShell, icon, esc } from '../lib/docs/editor-shell.js';
import { extOf } from '../lib/docs/formats.js';
import { htmlToModel, modelToHtml, modelToMarkdown, modelToText, modelToHtmlFile, textToModel } from '../lib/docs/model.js';

const I = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M11 5h6M7 19h6M14 5l-4 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  strike: '<path d="M4 12h16M16 7a4 3 0 0 0-8 0c0 4 8 2 8 6a4 3 0 0 1-8 0"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  ol: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1V9M3.5 14.5a1.5 1.5 0 0 1 3 .5L3.5 19h3"/>',
  left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  justify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  rule: '<path d="M4 12h16"/>',
  pagebreak: '<path d="M6 3v5h12V3M6 21v-5h12v5"/><path d="M3 12h3M9 12h2M13 12h2M18 12h3"/>',
  clear: '<path d="M6 5h12M12 5l-3 14M4 20l16-16"/>',
  indent: '<path d="M10 6h10M10 12h10M10 18h10M4 9l3 3-3 3"/>',
  outdent: '<path d="M10 6h10M10 12h10M10 18h10M7 9l-3 3 3 3"/>',
};

const btn = (cmd, label, ic, extra = '') => `<button type="button" class="dx-tbtn" data-cmd="${cmd}" title="${esc(label)}" aria-label="${esc(label)}"${extra}>${icon(ic)}</button>`;

const TOOLBAR = `
  <div class="dx-tgroup">${btn('undo', 'Undo (Ctrl+Z)', I.undo)}${btn('redo', 'Redo (Ctrl+Y)', I.redo)}</div>
  <select class="dx-select" data-block aria-label="Paragraph style" title="Paragraph style">
    <option value="p">Normal text</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option>
    <option value="h3">Heading 3</option><option value="h4">Heading 4</option><option value="blockquote">Quote</option><option value="pre">Code</option>
  </select>
  <div class="dx-tgroup">${btn('bold', 'Bold (Ctrl+B)', I.bold, ' data-state="bold"')}${btn('italic', 'Italic (Ctrl+I)', I.italic, ' data-state="italic"')}${btn('underline', 'Underline (Ctrl+U)', I.underline, ' data-state="underline"')}${btn('strikeThrough', 'Strikethrough', I.strike, ' data-state="strikeThrough"')}
    <label class="dx-tbtn dx-color" title="Text colour"><span class="dx-color-a" aria-hidden="true">A</span><input type="color" data-color value="#c0392b" aria-label="Text colour"></label>
    ${btn('link', 'Link (Ctrl+K)', I.link)}${btn('removeFormat', 'Clear formatting', I.clear)}</div>
  <div class="dx-tgroup">${btn('insertUnorderedList', 'Bulleted list', I.ul, ' data-state="insertUnorderedList"')}${btn('insertOrderedList', 'Numbered list', I.ol, ' data-state="insertOrderedList"')}${btn('outdent', 'Decrease indent', I.outdent)}${btn('indent', 'Increase indent', I.indent)}</div>
  <div class="dx-tgroup">${btn('justifyLeft', 'Align left', I.left, ' data-state="justifyLeft"')}${btn('justifyCenter', 'Centre', I.center, ' data-state="justifyCenter"')}${btn('justifyRight', 'Align right', I.right, ' data-state="justifyRight"')}${btn('justifyFull', 'Justify', I.justify, ' data-state="justifyFull"')}</div>
  <div class="dx-tgroup">${btn('table', 'Insert table', I.table)}<label class="dx-tbtn" title="Insert picture" aria-label="Insert picture">${icon(I.image)}<input type="file" accept="image/png,image/jpeg,image/gif" data-image hidden></label>${btn('rule', 'Horizontal line', I.rule)}${btn('pagebreak', 'Page break', I.pagebreak)}</div>
`;

const BODY = `
  <div class="dx-canvas">
    <article class="dx-page" contenteditable="true" spellcheck="true" aria-label="Document" data-placeholder="Start writing…"></article>
  </div>
`;

async function sanitize(html) {
  const mod = await import('dompurify');
  const purify = mod.default ?? mod;
  return purify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'code', 'kbd', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'hr', 'sub', 'sup', 'font'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'width', 'height', 'style', 'align', 'color', 'colspan', 'rowspan', 'data-page-break'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|data:image\/(?:png|jpe?g|gif|webp|bmp);)/i,
  });
}

export default {
  ownFileChrome: true,
  render(container, { artifact } = {}) {
    let page = null;
    const shell = mountShell(container, {
      tool: 'scribe',
      defaultName: 'Untitled.docx',
      accept: '.docx,.doc,.odt,.rtf,.md,.markdown,.txt,.html,.htm',
      toolbar: TOOLBAR,
      body: BODY,
      footer: '<span class="dx-count" aria-live="polite"></span>',
      load: async (bytes, name) => {
        const ext = extOf(name);
        let html;
        if (ext === 'docx') html = modelToHtml(await (await import('../lib/docs/docx.js')).docxToModel(bytes));
        else if (ext === 'odt') html = modelToHtml(await (await import('../lib/docs/odf.js')).odtToModel(bytes));
        else if (ext === 'rtf') html = modelToHtml((await import('../lib/docs/rtf.js')).rtfToModel(new TextDecoder('latin1').decode(bytes)));
        else if (ext === 'doc') html = modelToHtml(textToModel(await (await import('../lib/docs/legacy.js')).docToText(bytes)));
        else if (ext === 'md' || ext === 'markdown') {
          const { marked } = await import('marked');
          html = marked.parse(new TextDecoder().decode(bytes), { gfm: true, breaks: false });
        } else if (ext === 'html' || ext === 'htm') {
          const text = new TextDecoder().decode(bytes);
          html = /<body[^>]*>([\s\S]*)<\/body>/i.exec(text)?.[1] ?? text;
        } else html = modelToHtml(textToModel(new TextDecoder().decode(bytes)));
        setHtml(await sanitize(html));
      },
      blank: () => setHtml(''),
      selection: () => {
        const s = window.getSelection?.();
        return s && page && s.rangeCount && page.contains(s.anchorNode) ? s.toString() : '';
      },
      serialize: async (format) => {
        const blocks = readModel();
        const title = shell.state.name.replace(/\.[^.]+$/, '');
        if (format === 'docx') return (await import('../lib/docs/docx.js')).modelToDocx(blocks, { title });
        if (format === 'odt') return (await import('../lib/docs/odf.js')).modelToOdt(blocks, { title });
        if (format === 'rtf') return new Blob([(await import('../lib/docs/rtf.js')).modelToRtf(blocks)], { type: 'application/rtf' });
        if (format === 'md') return new Blob([modelToMarkdown(blocks)], { type: 'text/markdown;charset=utf-8' });
        if (format === 'html') return new Blob([modelToHtmlFile(blocks, title)], { type: 'text/html;charset=utf-8' });
        return new Blob([modelToText(blocks)], { type: 'text/plain;charset=utf-8' });
      },
    });
    this._shell = shell;
    page = shell.root.querySelector('.dx-page');
    const counter = shell.root.querySelector('.dx-count');
    const blockSel = shell.root.querySelector('[data-block]');

    function setHtml(html) {
      page.innerHTML = html || '<p><br></p>';
      updateCount();
    }
    function readModel() {
      try { return htmlToModel(page); } catch (err) { console.warn('Scribe could not read the page', err); return textToModel(page.textContent || ''); }
    }
    this._read = readModel;
    this._setHtml = setHtml;

    const updateCount = () => {
      const text = String(page.textContent || '');
      const words = (text.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
      counter.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'} · ${text.length.toLocaleString()} characters`;
    };

    const exec = (cmd, value = null) => {
      page.focus();
      try { document.execCommand?.(cmd, false, value); } catch { /* not in this browser */ }
      shell.markDirty();
      updateCount();
      refreshState();
    };

    const refreshState = () => {
      if (typeof document.queryCommandState !== 'function') return;
      shell.root.querySelectorAll('[data-state]').forEach(b => {
        let on = false;
        try { on = document.queryCommandState(b.dataset.state); } catch { /* ignore */ }
        b.setAttribute('aria-pressed', String(on));
      });
      try {
        const block = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
        blockSel.value = ['h1', 'h2', 'h3', 'h4', 'blockquote', 'pre'].includes(block) ? block : 'p';
      } catch { /* ignore */ }
    };

    const insertHtml = (html) => exec('insertHTML', html);

    shell.root.querySelector('.dx-toolbar').addEventListener('mousedown', (e) => {
      // Keep the selection in the page when a toolbar button is pressed.
      if (e.target.closest('button')) e.preventDefault();
    });
    shell.root.querySelector('.dx-toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (!b) return;
      const cmd = b.dataset.cmd;
      if (cmd === 'link') {
        const url = typeof prompt === 'function' ? prompt('Link address', 'https://') : null;
        if (url && /^(https?:|mailto:|tel:|#)/i.test(url.trim())) exec('createLink', url.trim());
        else if (url) exec('unlink');
      } else if (cmd === 'table') {
        const cells = (tag) => `<tr>${Array.from({ length: 3 }, () => `<${tag}><br></${tag}>`).join('')}</tr>`;
        insertHtml(`<table><tbody>${cells('th')}${cells('td')}${cells('td')}</tbody></table><p><br></p>`);
      } else if (cmd === 'rule') insertHtml('<hr><p><br></p>');
      else if (cmd === 'pagebreak') insertHtml('<hr data-page-break="true" style="page-break-after:always"><p><br></p>');
      else exec(cmd);
    });
    blockSel.addEventListener('change', () => exec('formatBlock', `<${blockSel.value}>`));
    shell.root.querySelector('[data-color]').addEventListener('input', (e) => exec('foreColor', e.target.value));
    shell.root.querySelector('[data-image]').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const url = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
      const img = new Image();
      img.onload = () => {
        const w = Math.min(img.naturalWidth || 400, 620);
        const h = Math.round((img.naturalHeight || 300) * (w / (img.naturalWidth || 400)));
        insertHtml(`<img src="${url}" width="${w}" height="${h}" alt="${esc(file.name)}">`);
      };
      img.src = url;
    });

    page.addEventListener('input', () => { shell.markDirty(); updateCount(); });
    page.addEventListener('keyup', refreshState);
    page.addEventListener('mouseup', refreshState);
    page.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); shell.root.querySelector('[data-cmd="link"]').click(); }
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        const inList = e.target.closest?.('li') || window.getSelection?.()?.anchorNode?.parentElement?.closest?.('li');
        if (inList) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
      }
    });
    // Paste as clean markup: formatting stays, foreign styles and scripts do not.
    page.addEventListener('paste', async (e) => {
      const html = e.clipboardData?.getData('text/html');
      if (!html) return;
      e.preventDefault();
      const clean = await sanitize(html);
      const holder = document.createElement('div');
      holder.innerHTML = clean;
      insertHtml(modelToHtml(htmlToModel(holder)));
    });

    try { document.execCommand?.('defaultParagraphSeparator', false, 'p'); } catch { /* optional */ }
    setHtml('');

    const incoming = artifact || this._pending;
    if (incoming) this.setArtifact(incoming);
  },

  getArtifact() {
    if (!this._read) return null;
    try { return { kind: 'markdown', text: modelToMarkdown(this._read()), name: (this._shell?.state.name || 'Untitled').replace(/\.[^.]+$/, '.md') }; } catch { return null; }
  },

  async setArtifact(a) {
    if (!a) return;
    if (!this._shell) { this._pending = a; return; }
    try { await this._shell.openArtifact(a); } catch (err) { console.warn('Scribe could not open that file', err); }
  },

  destroy() {
    this._shell?.destroy();
    this._shell = this._read = this._setHtml = this._pending = null;
  },
};
