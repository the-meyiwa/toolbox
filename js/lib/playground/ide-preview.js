/* ============================================================
   Preview controller: the browser pane of the IDE.

   Shows workspace web pages (with live reload as files change) and
   virtual Node/Express servers (http://localhost:PORT/…), answers the
   frame's fetch/XHR/navigation through the bridge, collects its console
   output, and lets the agent read and drive the page.
   ============================================================ */

import { buildPreview, staticSource, answerFrameFetch, markdownDocument } from './preview.js';
import { normalize, dirname, basename, extname } from './paths.js';
import { languageOf } from './languages.js';

let channelSeq = 0;

export class PreviewController {
  /**
   * @param {object} o
   * @param {HTMLIFrameElement} o.frame
   * @param {import('./vfs.js').WorkspaceFS} o.vfs
   * @param {(port:number, req:object)=>Promise<object>} o.requestServer
   * @param {(port:number)=>boolean} o.hasServer
   * @param {(entry:object)=>void} o.onConsole
   * @param {(state:object)=>void} o.onState
   * @param {(md:string)=>string} [o.renderMarkdown]
   */
  constructor(o) {
    this.o = o;
    this.frame = o.frame;
    this.vfs = o.vfs;
    this.state = null;        // { kind:'static'|'server'|'markdown', root, path, port }
    this.history = [];
    this.forward = [];
    this.channel = `pg-${Date.now().toString(36)}-${++channelSeq}`;
    this.logs = [];
    this.pending = new Map();
    this.seq = 0;
    this.buildToken = 0;
    this.popup = null;
    this.onMessage = (e) => this.handleMessage(e);
    window.addEventListener('message', this.onMessage);
  }

  dispose() {
    window.removeEventListener('message', this.onMessage);
    clearTimeout(this.reloadTimer);
    try { this.popup?.close(); } catch { /* ignore */ }
  }

  /** Decide what to show for a file path. */
  targetForFile(path) {
    const lang = languageOf(path);
    if (lang === 'markdown') return { kind: 'markdown', path };
    if (lang === 'html' || lang === 'svg') return { kind: 'static', root: dirname(path), path: `/${basename(path)}` };
    // CSS/JS/JSX files belong to the nearest index.html (the page that uses them).
    let dir = dirname(path);
    for (;;) {
      if (this.vfs.isFile(normalize(dir ? `${dir}/index.html` : 'index.html'))) return { kind: 'static', root: dir, path: '/index.html' };
      if (!dir) break;
      dir = dirname(dir);
    }
    return null;
  }

  async show(target, { push = true } = {}) {
    if (!target) return;
    if (push && this.state) { this.history.push(this.state); this.forward = []; }
    this.state = { ...target };
    this.logs = [];
    await this.render();
  }

  back() { if (!this.history.length) return; this.forward.push(this.state); this.state = this.history.pop(); this.render(); }
  fwd() { if (!this.forward.length) return; this.history.push(this.state); this.state = this.forward.pop(); this.render(); }
  reload() { if (this.state) { this.logs = []; this.render(); } }

  address() {
    const s = this.state;
    if (!s) return '';
    if (s.kind === 'server') return `localhost:${s.port}${s.path || '/'}`;
    if (s.kind === 'markdown') return s.path;
    return `${s.root ? `${s.root}` : ''}${s.path}`.replace(/^\//, '') || 'index.html';
  }

  /** Called by the IDE whenever workspace files change. */
  filesChanged(paths) {
    const s = this.state;
    if (!s || s.kind === 'server') return;
    if (s.kind === 'markdown' && !paths.includes(s.path)) return;
    if (s.kind === 'static' && s.root && !paths.some((p) => p === s.root || p.startsWith(`${s.root}/`))) return;
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => this.render({ soft: true }), 350);
  }

  serverStopped(port) {
    if (this.state?.kind === 'server' && this.state.port === port) this.o.onState?.({ ...this.state, status: 'stopped' });
  }

  async render() {
    const token = ++this.buildToken;
    const s = this.state;
    this.o.onState?.({ ...s, status: 'loading', address: this.address() });
    try {
      let html;
      let warnings = [];
      if (s.kind === 'markdown') {
        const md = this.vfs.isFile(s.path) ? this.vfs.readFile(s.path) : `File not found: ${s.path}`;
        html = markdownDocument(this.o.renderMarkdown ? this.o.renderMarkdown(md) : `<pre>${escapeHtml(md)}</pre>`, basename(s.path));
      } else if (s.kind === 'server') {
        if (!this.o.hasServer(s.port)) {
          html = messagePage('No server running', `Nothing is listening on <b>localhost:${s.port}</b>.<br>Start your server in the terminal, e.g. <code>node server.js</code> or <code>npm start</code>.`);
        } else {
          const res = await this.o.requestServer(s.port, { method: s.method || 'GET', url: s.path || '/', headers: { accept: 'text/html,*/*', ...(s.headers || {}) }, body: s.body || null });
          if (token !== this.buildToken) return;
          if (res.status >= 300 && res.status < 400 && res.headers?.location) {
            const loc = res.headers.location;
            this.state = { kind: 'server', port: s.port, path: loc.replace(/^https?:\/\/[^/]+/, '') || '/' };
            return this.render();
          }
          const ct = String(res.headers?.['content-type'] || '');
          const body = res.body ?? (res.bodyBase64 ? atob(res.bodyBase64) : '');
          if (/html/.test(ct) || (!ct && /^\s*</.test(body))) {
            const source = serverSource(this.o.requestServer, s.port);
            ({ html, warnings } = await buildPreview({ source, path: (s.path || '/').split('?')[0], html: body, vfs: this.vfs, channel: this.channel }));
          } else if (/json/.test(ct)) {
            let pretty = body;
            try { pretty = JSON.stringify(JSON.parse(body), null, 2); } catch { /* raw */ }
            html = codePage(pretty, `HTTP ${res.status} · ${ct}`);
          } else if (/^image\//.test(ct) && res.bodyBase64) {
            html = `<!DOCTYPE html><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#111"><img src="data:${ct};base64,${res.bodyBase64}"></body>`;
          } else {
            html = codePage(body, `HTTP ${res.status} · ${ct || 'text/plain'}`);
          }
        }
      } else {
        const source = staticSource(this.vfs, s.root || '');
        const exists = await source.fetch(s.path);
        if (!exists) {
          html = messagePage('Page not found', `There is no <code>${escapeHtml(s.path)}</code> in <code>/${escapeHtml(s.root || '')}</code>.<br>Create an <code>index.html</code> file to preview a website.`);
        } else {
          ({ html, warnings } = await buildPreview({ source, path: s.path, vfs: this.vfs, channel: this.channel }));
        }
      }
      if (token !== this.buildToken) return;
      for (const w of warnings) this.pushLog({ level: 'warn', text: w, source: 'preview' });
      this.lastHtml = html;
      this.readyWaiters?.forEach((r) => r(false));
      this.readyWaiters = [];
      this.frame.srcdoc = html;
      this.sendToPopup(html);
      this.o.onState?.({ ...s, status: 'ready', address: this.address() });
    } catch (err) {
      if (token !== this.buildToken) return;
      this.frame.srcdoc = messagePage('Preview error', escapeHtml(err.message || String(err)));
      this.pushLog({ level: 'error', text: err.message || String(err), source: 'preview' });
      this.o.onState?.({ ...s, status: 'error', address: this.address() });
    }
  }

  pushLog(entry) {
    const e = { ...entry, time: Date.now() };
    this.logs.push(e);
    if (this.logs.length > 500) this.logs.shift();
    this.o.onConsole?.(e);
  }

  /* ---------------- bridge ---------------- */

  async handleMessage(e) {
    const m = e.data;
    if (!m || m.__pg !== this.channel) return;
    const fromFrame = e.source === this.frame.contentWindow;
    const fromPopup = this.popup && e.source === this.popupFrameWindow;
    if (!fromFrame && !fromPopup && e.source !== this.popup) return;
    const reply = (msg) => {
      const target = fromFrame ? this.frame.contentWindow : this.popupFrameWindow;
      try { target?.postMessage({ ...msg, __pg: this.channel }, '*'); } catch { /* frame gone */ }
    };
    switch (m.type) {
      case 'console': this.pushLog({ level: m.level, text: m.text, source: 'browser' }); break;
      case 'error': this.pushLog({ level: 'error', text: m.message + (m.line ? ` (${m.file || 'page'}:${m.line})` : ''), file: m.file, line: m.line, column: m.column, source: 'browser' }); break;
      case 'fetch': {
        if (m.port === null && this.state?.kind === 'server') {
          // relative fetch from a server-rendered page goes to that server
          const r = await this.o.requestServer(this.state.port, { method: m.method, url: m.path, headers: m.headers || {}, body: m.body });
          reply({ status: r.status, statusText: r.statusText || '', headers: r.headers || {}, body: r.body, bodyBase64: r.bodyBase64, error: r.error, type: 'fetch-response', id: m.id });
          break;
        }
        const res = await answerFrameFetch(m, { staticSrc: staticSource(this.vfs, this.state?.kind === 'static' ? this.state.root : ''), requestServer: this.o.requestServer });
        reply({ ...res, type: 'fetch-response', id: m.id });
        break;
      }
      case 'navigate': {
        if (m.port || this.state?.kind === 'server') {
          this.show({ kind: 'server', port: m.port || this.state.port, path: m.path, method: m.method, body: m.body, headers: m.headers });
        } else {
          const root = this.state?.root || '';
          const clean = m.path.split(/[?#]/)[0];
          let target = clean;
          if (!extname(clean) && !this.vfs.isFile(normalize(`${root}/${clean}`))) target = `${clean.replace(/\/$/, '')}/index.html`;
          if (!extname(target) && this.vfs.isFile(normalize(`${root}/${clean}.html`))) target = `${clean}.html`;
          this.show({ kind: 'static', root, path: target });
        }
        break;
      }
      case 'ready': case 'loaded':
        if (m.type === 'ready') { this.readyWaiters?.forEach((r) => r(true)); this.readyWaiters = []; }
        this.o.onState?.({ ...this.state, status: 'ready', address: this.address(), title: m.title });
        break;
      case 'snapshot-result': case 'interact-result': {
        const r = this.pending.get(m.id);
        if (r) { this.pending.delete(m.id); r(m); }
        break;
      }
      default: break;
    }
  }

  waitReady(timeout = 4000) {
    return new Promise((resolve) => {
      this.readyWaiters = this.readyWaiters || [];
      this.readyWaiters.push(resolve);
      setTimeout(() => resolve(false), timeout);
    });
  }

  request(type, payload = {}, timeout = 5000) {
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      try { this.frame.contentWindow?.postMessage({ __pg: this.channel, type, id, ...payload }, '*'); } catch { /* ignore */ }
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); resolve(null); } }, timeout);
    });
  }

  async snapshot() {
    const r = await this.request('snapshot');
    return r ? { title: r.title, text: r.text, url: this.address(), inputs: r.inputs, buttons: r.buttons, links: r.links } : null;
  }

  async interact(actions) {
    const r = await this.request('interact', { actions }, 15000);
    return r;
  }

  /* ---------------- pop-out window ---------------- */

  openInNewTab() {
    if (!this.lastHtml) return;
    const w = window.open('/pg-preview.html', '_blank');
    if (!w) return;
    this.popup = w;
    const onReady = (e) => {
      if (e.source !== w || e.data?.type !== 'pg-preview-ready') return;
      window.removeEventListener('message', onReady);
      this.sendToPopup(this.lastHtml);
    };
    window.addEventListener('message', onReady);
  }

  sendToPopup(html) {
    if (!this.popup || this.popup.closed) { this.popup = null; return; }
    try {
      this.popup.postMessage({ type: 'pg-preview-load', html, title: this.address() }, window.location.origin);
      this.popupFrameWindow = this.popup.frames?.[0] || null;
    } catch { /* ignore */ }
  }
}

function serverSource(requestServer, port) {
  return {
    kind: 'server',
    root: '',
    async fetch(path) {
      const r = await requestServer(port, { method: 'GET', url: path, headers: {} });
      if (!r || r.status >= 400) return null;
      const ct = r.headers?.['content-type'] || '';
      let body = r.body;
      if (body == null && r.bodyBase64) {
        const s = atob(r.bodyBase64);
        body = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) body[i] = s.charCodeAt(i);
      }
      return { status: r.status, headers: { 'content-type': ct }, body: body ?? '' };
    },
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function messagePage(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font:15px/1.6 system-ui,sans-serif;color:#475569;display:grid;place-items:center;min-height:90vh;margin:0;background:#f8fafc}div{max-width:440px;text-align:center;padding:24px}h2{color:#0f172a;font-size:1.1rem}code{background:#e2e8f0;padding:1px 6px;border-radius:4px}</style></head><body><div><h2>${escapeHtml(title)}</h2><p>${body}</p></div></body></html>`;
}

function codePage(text, header) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#0f172a;color:#e2e8f0}header{padding:8px 12px;background:#1e293b;color:#94a3b8;font:12px system-ui,sans-serif}pre{margin:0;padding:12px;white-space:pre-wrap;word-break:break-word}</style></head><body><header>${escapeHtml(header)}</header><pre>${escapeHtml(text)}</pre></body></html>`;
}
