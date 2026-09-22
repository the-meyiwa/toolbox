/* ============================================================
   Web preview builder.

   Turns a page from the workspace (or from a virtual Node/Express
   server) into a self-contained document for a sandboxed iframe with an
   opaque origin — student code can never reach Toolbox's storage,
   cookies or tokens.

   Because an opaque-origin frame can't fetch anything from the
   workspace, everything it needs is resolved before it loads:
     <script src>, <link rel=stylesheet>, <img>/<source>/<video> src,
     CSS url(), and the whole ES-module graph: every workspace module is
     transformed (JSX/TypeScript via the TypeScript compiler), its
     imports rewritten to import-map keys, and the import map points
     each key at a data: URL. Bare imports ("react", "lodash") map to
     esm.sh. `import './App.css'`, JSON and image imports work as they do
     in Vite.
   At run time a small shim inside the frame answers fetch()/XHR for
   workspace files and virtual servers through postMessage, maps
   dynamically assigned asset URLs, turns link clicks and form posts into
   preview navigations, and forwards console output and errors to the
   IDE.
   ============================================================ */

import { normalize, resolve as resolvePath, dirname, extname, basename } from './paths.js';
import { mimeFor, isBinaryPath } from './languages.js';
import { cdn, readDependencies, packageName, esmUrl } from './runtimes.js';
import { toBytes } from './vfs.js';

const MODULE_EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.json', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
const MAX_INLINE_ASSET = 8 * 1024 * 1024;

let tsPromise = null;
/** Load the TypeScript compiler on the page (used for JSX/TS in the preview). */
export function loadTypeScript() {
  if (typeof window !== 'undefined' && window.ts) return Promise.resolve(window.ts);
  if (tsPromise) return tsPromise;
  tsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = cdn('typescript');
    s.onload = () => (window.ts ? resolve(window.ts) : reject(new Error('TypeScript failed to initialise')));
    s.onerror = () => { tsPromise = null; reject(new Error('Could not load the TypeScript compiler.')); };
    document.head.appendChild(s);
  });
  return tsPromise;
}

function b64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function dataUrl(mime, content) {
  if (typeof content === 'string') {
    return `data:${mime};charset=utf-8;base64,${b64(new TextEncoder().encode(content))}`;
  }
  return `data:${mime};base64,${b64(toBytes(content))}`;
}

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const isExternal = (u) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u) && !/^file:/i.test(u);

/**
 * @typedef {object} Source
 * @property {(path:string)=>Promise<{status:number, headers?:object, body:string|Uint8Array}|null>} fetch
 *   resolves an absolute site path ("/src/app.js") to a response
 * @property {string} [label]
 */

/** Static source: serve files from the workspace under `root`. */
export function staticSource(vfs, root = '') {
  const base = normalize(root);
  return {
    kind: 'static',
    root: base,
    async fetch(sitePath) {
      const clean = decodeURIComponent(String(sitePath).split(/[?#]/)[0]);
      let p = normalize(`${base}/${clean}`);
      if (vfs.isDir(p)) p = normalize(`${p}/index.html`);
      if (!vfs.isFile(p)) {
        // SPA-style fallback for extensionless routes
        if (!extname(p) && vfs.isFile(normalize(`${base}/index.html`)) && /\.html?$/.test('x.html')) return null;
        return null;
      }
      const bin = isBinaryPath(p);
      return { status: 200, headers: { 'content-type': mimeFor(p) }, body: bin ? vfs.readBinary(p) : vfs.readFile(p), path: p };
    },
  };
}

/**
 * Build the srcdoc for a page.
 * @param {object} o
 * @param {Source} o.source
 * @param {string} o.path  site path of the page, e.g. "/index.html" or "/about"
 * @param {string} [o.html] already-fetched HTML (server responses)
 * @param {import('./vfs.js').WorkspaceFS} [o.vfs] used for package versions
 * @param {string} [o.framework] optional CSS framework URL(s)
 * @param {string} o.channel  id the shim uses in postMessage traffic
 * @returns {Promise<{html:string, warnings:string[]}>}
 */
export async function buildPreview({ source, path = '/index.html', html = null, vfs = null, channel = 'pg', injectHead = '' }) {
  const warnings = [];
  const pagePath = path.startsWith('/') ? path : `/${path}`;
  let doc = html;
  if (doc == null) {
    const res = await source.fetch(pagePath);
    if (!res) throw Object.assign(new Error(`Cannot GET ${pagePath}`), { status: 404 });
    doc = typeof res.body === 'string' ? res.body : new TextDecoder().decode(res.body);
  }
  const pageDir = pagePath.endsWith('/') ? pagePath : pagePath.slice(0, pagePath.lastIndexOf('/') + 1);
  const resolveUrl = (u) => {
    if (u.startsWith('/')) return normalizeSite(u);
    return normalizeSite(pageDir + u);
  };
  const deps = vfs ? readDependencies(vfs, source.root || '') : {};
  const ctx = { source, deps, warnings, compileErrors: [], modules: new Map(), importMap: {}, assets: new Map(), ts: null, usesReact: Boolean(deps.react || deps['react-dom']) };

  // HTML fragments (no <html>/<body>) get a skeleton, like CodePen.
  if (!/<html[\s>]/i.test(doc) && !/<body[\s>]/i.test(doc) && !/<head[\s>]/i.test(doc)) {
    doc = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${doc}\n</body>\n</html>`;
  }

  // 1. Stylesheets
  doc = await replaceAsync(doc, /<link\b[^>]*>/gi, async (tag) => {
    const rel = attr(tag, 'rel') || '';
    const href = attr(tag, 'href');
    if (!href || isExternal(href)) return tag;
    if (/stylesheet/i.test(rel)) {
      const url = resolveUrl(href);
      const res = await source.fetch(url);
      if (!res) { warnings.push(`Stylesheet not found: ${href}`); return `<!-- missing stylesheet ${escAttr(href)} -->`; }
      const css = await inlineCssUrls(asText(res.body), url, ctx);
      return `<style data-href="${escAttr(href)}">\n${css}\n</style>`;
    }
    if (/icon|manifest|preload|modulepreload/i.test(rel)) {
      if (/modulepreload/i.test(rel)) return '';
      const url = resolveUrl(href);
      const d = await assetDataUrl(url, ctx);
      return d ? setAttr(tag, 'href', d) : tag;
    }
    return tag;
  });

  // 2. Inline <style> blocks: url() references
  doc = await replaceAsync(doc, /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, async (m, open, css, close) => `${open}${await inlineCssUrls(css, pagePath, ctx)}${close}`);

  // 3. Scripts
  let hasModules = false;
  doc = await replaceAsync(doc, /<script\b([^>]*)>([\s\S]*?)<\/script>/gi, async (full, attrs, body) => {
    const type = (attr(`<x ${attrs}>`, 'type') || '').toLowerCase();
    const src = attr(`<x ${attrs}>`, 'src');
    if (type === 'importmap') {
      try { Object.assign(ctx.importMap, JSON.parse(body).imports || {}); } catch { warnings.push('Invalid import map ignored.'); }
      return '';
    }
    const isModule = type === 'module';
    const isBabel = /babel|jsx/.test(type);
    if (src && isExternal(src)) return full;
    if (src) {
      const url = resolveUrl(src);
      const res = await source.fetch(url);
      if (!res) { warnings.push(`Script not found: ${src}`); return `<script>console.error(${JSON.stringify(`Failed to load script ${src} (404)`)})</script>`; }
      if (isModule || /\.(jsx|tsx?)$/.test(url)) {
        hasModules = true;
        const key = await loadModule(url, ctx);
        return `<script type="module">import ${JSON.stringify(key)};</script>`;
      }
      return `<script${attrs.replace(/\s(src|type)\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, '')}>${escapeScript(asText(res.body))}\n//# sourceURL=${siteToFileUrl(url)}</script>`;
    }
    if (isModule || isBabel) {
      hasModules = true;
      const virtual = `${pageDir}__inline_${ctx.modules.size}.${isBabel ? 'jsx' : 'js'}`;
      const key = await loadModule(virtual, ctx, body);
      return `<script type="module">import ${JSON.stringify(key)};</script>`;
    }
    return full;
  });

  // A module failed to compile: like Vite, show an error overlay instead of
  // a half-linked page (whose only error would be a confusing import failure).
  if (ctx.compileErrors.length) {
    doc = doc.replace(/<script type="module">import "@pg[^"]*";<\/script>/g, '');
    const overlay = errorOverlay(ctx.compileErrors);
    doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${overlay}</body>`) : `${doc}${overlay}`;
  }

  // 4. Media / image sources
  doc = await replaceAsync(doc, /<(img|source|video|audio|input|track|embed|object|iframe)\b[^>]*>/gi, async (tag, name) => {
    let out = tag;
    for (const a of ['src', 'poster', 'data']) {
      const v = attr(out, a);
      if (!v || isExternal(v) || v.startsWith('data:') || v.startsWith('#')) continue;
      if (name.toLowerCase() === 'iframe') continue;
      const d = await assetDataUrl(resolveUrl(v), ctx);
      if (d) out = setAttr(out, a, d); else warnings.push(`File not found: ${v}`);
    }
    const srcset = attr(out, 'srcset');
    if (srcset && !isExternal(srcset)) {
      const parts = await Promise.all(srcset.split(',').map(async (part) => {
        const [u, w] = part.trim().split(/\s+/);
        if (!u || isExternal(u)) return part;
        const d = await assetDataUrl(resolveUrl(u), ctx);
        return d ? `${d}${w ? ` ${w}` : ''}` : part;
      }));
      out = setAttr(out, 'srcset', parts.join(', '));
    }
    return out;
  });

  // 5. style="background: url(...)" attributes
  doc = await replaceAsync(doc, /\sstyle\s*=\s*"([^"]*url\([^"]*)"/gi, async (m, css) => ` style="${escAttr(await inlineCssUrls(css.replace(/&quot;/g, '"'), pagePath, ctx))}"`);

  // 6. Import map + runtime shim at the top of <head>
  finishImportMap(ctx);
  const importMap = { imports: { ...ctx.importMap } };
  const head = [
    '<meta charset="utf-8">',
    `<script>${shimSource(channel, pagePath, assetTable(ctx))}</script>`,
    hasModules || Object.keys(importMap.imports).length ? `<script type="importmap">${JSON.stringify(importMap)}</script>` : '',
    injectHead,
  ].join('\n');
  if (/<head[^>]*>/i.test(doc)) doc = doc.replace(/<head[^>]*>/i, (h) => `${h}\n${head}\n`);
  else if (/<html[^>]*>/i.test(doc)) doc = doc.replace(/<html[^>]*>/i, (h) => `${h}\n<head>${head}</head>\n`);
  else doc = `${head}\n${doc}`;
  if (!/^\s*<!doctype/i.test(doc)) doc = `<!DOCTYPE html>\n${doc}`;
  return { html: doc, warnings };
}

function errorOverlay(errors) {
  const e = errors[0];
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const report = errors.map((x) => `console.error(${JSON.stringify(`[compile error] ${x.message} (${x.site.replace(/^\//, '')}:${x.line})`)});`).join('');
  return `<div id="__pg_error_overlay" style="position:fixed;inset:0;z-index:2147483647;background:rgba(15,17,23,.96);color:#e6e9ef;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:28px;overflow:auto">
<div style="max-width:900px;margin:0 auto;border-top:4px solid #f0605d;background:#1c1f26;border-radius:8px;padding:18px 22px;box-shadow:0 10px 40px rgba(0,0,0,.5)">
<div style="color:#f0605d;font-weight:700;font-size:15px;margin-bottom:6px">[plugin:toolbox] ${esc(e.message)}</div>
<div style="color:#8b93a6;margin-bottom:12px">${esc(e.site.replace(/^\//, ''))}:${e.line}:${e.column}</div>
<pre style="margin:0;background:#12141a;border-radius:6px;padding:12px;color:#f7c873;white-space:pre;overflow:auto">${esc(e.frame)}</pre>
${errors.length > 1 ? `<div style="margin-top:10px;color:#8b93a6">+ ${errors.length - 1} more error${errors.length > 2 ? 's' : ''}: ${errors.slice(1).map((x) => esc(`${x.site.replace(/^\//, '')}:${x.line}`)).join(', ')}</div>` : ''}
<div style="margin-top:14px;color:#8b93a6;font-family:system-ui,sans-serif">Fix the code and save — the preview reloads automatically.</div>
</div></div><script>${report}</script>`;
}

function normalizeSite(u) {
  const [p, rest = ''] = String(u).split(/(?=[?#])/);
  return `/${normalize(p)}${rest}`;
}
function siteToFileUrl(u) { return `workspace://${u.split(/[?#]/)[0]}`; }
function asText(body) { return typeof body === 'string' ? body : new TextDecoder().decode(body); }
function escapeScript(s) { return String(s).replace(/<\/script/gi, '<\\/script'); }

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}
function setAttr(tag, name, value) {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  return tag.replace(re, (m, pre) => `${pre}"${escAttr(value)}"`);
}

async function replaceAsync(str, re, fn) {
  const jobs = [];
  str.replace(re, (...args) => { jobs.push(fn(...args)); return args[0]; });
  const results = await Promise.all(jobs);
  let i = 0;
  return str.replace(re, () => results[i++]);
}

async function assetDataUrl(sitePath, ctx) {
  const clean = sitePath.split(/[?#]/)[0];
  if (ctx.assets.has(clean)) return ctx.assets.get(clean);
  const res = await ctx.source.fetch(clean);
  if (!res) return null;
  const size = typeof res.body === 'string' ? res.body.length : res.body.byteLength;
  if (size > MAX_INLINE_ASSET) { ctx.warnings.push(`${clean} is larger than 8 MB and was skipped.`); return null; }
  const mime = res.headers?.['content-type'] || mimeFor(clean);
  const d = dataUrl(mime.split(';')[0], res.body);
  ctx.assets.set(clean, d);
  return d;
}

async function inlineCssUrls(css, fromSite, ctx) {
  const dir = fromSite.slice(0, fromSite.lastIndexOf('/') + 1);
  // @import "other.css"
  css = await replaceAsync(css, /@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?\s*([^;]*);/g, async (m, u, media) => {
    if (isExternal(u)) return m;
    const url = u.startsWith('/') ? normalizeSite(u) : normalizeSite(dir + u);
    const res = await ctx.source.fetch(url);
    if (!res) { ctx.warnings.push(`CSS import not found: ${u}`); return ''; }
    const inner = await inlineCssUrls(asText(res.body), url, ctx);
    return media.trim() ? `@media ${media.trim()} {\n${inner}\n}` : inner;
  });
  return replaceAsync(css, /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, async (m, q, u) => {
    if (isExternal(u) || u.startsWith('data:') || u.startsWith('#')) return m;
    const url = u.startsWith('/') ? normalizeSite(u) : normalizeSite(dir + u);
    const d = await assetDataUrl(url, ctx);
    return d ? `url("${d}")` : m;
  });
}

function assetTable(ctx) {
  const out = {};
  for (const [k, v] of ctx.assets) out[k] = v;
  return out;
}

/* ---------------- ES module graph ---------------- */

async function resolveModulePath(spec, fromSite, ctx) {
  const base = spec.startsWith('/') ? normalizeSite(spec) : normalizeSite(fromSite.slice(0, fromSite.lastIndexOf('/') + 1) + spec);
  const clean = base.split(/[?#]/)[0];
  for (const ext of MODULE_EXTS) {
    const cand = clean + ext;
    if (ctx.modules.has(cand)) return cand;
    const res = await ctx.source.fetch(cand);
    if (res && !(ext === '' && res.path && ctx.source.kind === 'static' && res.path.endsWith('/index.html'))) return cand;
  }
  // "./utils.js" written for a TypeScript file utils.ts
  if (/\.js$/.test(clean)) {
    for (const ext of ['.ts', '.tsx', '.jsx']) {
      const cand = clean.slice(0, -3) + ext;
      if (await ctx.source.fetch(cand)) return cand;
    }
  }
  return null;
}

function moduleKey(site) { return `@pg${site}`; }

async function loadModule(site, ctx, inlineCode = null) {
  const key = moduleKey(site);
  if (ctx.modules.has(site)) return key;
  ctx.modules.set(site, 'loading');
  let code = inlineCode;
  let mime = 'text/javascript';
  if (code == null) {
    const res = await ctx.source.fetch(site);
    if (!res) throw new Error(`Module not found: ${site}`);
    mime = res.headers?.['content-type'] || mimeFor(site);
    if (/\.css$/.test(site)) code = cssModule(await inlineCssUrls(asText(res.body), site, ctx), site);
    else if (/\.json$/.test(site)) code = `export default ${asText(res.body).trim() || 'null'};`;
    else if (isBinaryPath(site) || /\.(svg|txt|md|csv)$/.test(site)) {
      const d = await assetDataUrl(site, ctx);
      code = /\.(txt|md|csv)$/.test(site) && /[?&]raw\b/.test(site) ? `export default ${JSON.stringify(asText(res.body))};` : `export default ${JSON.stringify(d)};`;
    } else code = asText(res.body);
  }
  const isJsLike = /\.(m?jsx?|tsx?)$/.test(site) || inlineCode != null;
  if (isJsLike) {
    code = await transformModule(code, site, ctx);
    code = await rewriteImports(code, site, ctx);
    code = `${code}\n//# sourceURL=${siteToFileUrl(site)}`;
  }
  ctx.importMap[key] = dataUrl('text/javascript', code);
  ctx.modules.set(site, 'done');
  return key;
}

function cssModule(css, site) {
  return `const css = ${JSON.stringify(css)};\nconst el = document.createElement('style');\nel.setAttribute('data-file', ${JSON.stringify(site)});\nel.textContent = css;\ndocument.head.appendChild(el);\nexport default css;\n`;
}

async function transformModule(code, site, ctx) {
  const ext = extname(site.split(/[?#]/)[0]);
  const needs = ext === '.jsx' || ext === '.tsx' || ext === '.ts' || /\b__inline_\d+\.jsx$/.test(site) || (ext === '.js' && /<\/?[A-Za-z][\w.]*[\s/>]/.test(code) && /return\s*\(?\s*<|=>\s*\(?\s*<|render\(\s*</.test(code));
  if (!needs) return code;
  const ts = ctx.ts || (ctx.ts = await loadTypeScript());
  const jsxImport = ctx.deps.preact ? 'preact' : 'react';
  const out = ts.transpileModule(code, {
    fileName: site.replace(/^\//, '') + (ext === '.js' ? 'x' : ''),
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: jsxImport,
      esModuleInterop: true,
      isolatedModules: true,
      verbatimModuleSyntax: false,
      useDefineForClassFields: true,
    },
  });
  const errs = (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errs.length) {
    const d = errs[0];
    const pos = d.file ? d.file.getLineAndCharacterOfPosition(d.start || 0) : { line: 0, character: 0 };
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    const msg = `${site}:${pos.line + 1}:${pos.character + 1}: ${message}`;
    const lines = code.split('\n');
    const from = Math.max(0, pos.line - 2);
    const frame = lines.slice(from, pos.line + 3).map((l, i) => {
      const n = from + i + 1;
      const mark = n === pos.line + 1;
      return `${mark ? '>' : ' '} ${String(n).padStart(4)} | ${l}${mark ? `\n       | ${' '.repeat(pos.character)}^` : ''}`;
    }).join('\n');
    ctx.compileErrors.push({ site, line: pos.line + 1, column: pos.character + 1, message, frame });
    ctx.warnings.push(msg);
    return `throw new SyntaxError(${JSON.stringify(msg)});`;
  }
  return out.outputText.replace(/\/\/# sourceMappingURL=.*$/m, '');
}

const IMPORT_SPEC_RE = /(\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?|\bexport\s*(?:[\w*{}\s,$]+?\s*from\s*)|\bimport\s*\(\s*)(['"])([^'"\n]+)\2/g;

async function rewriteImports(code, site, ctx) {
  const specs = new Map();
  let m;
  IMPORT_SPEC_RE.lastIndex = 0;
  while ((m = IMPORT_SPEC_RE.exec(code))) specs.set(m[3], null);
  for (const spec of specs.keys()) {
    if (spec in ctx.importMap && !spec.startsWith('.') && !spec.startsWith('/')) continue; // user import map
    if (/^(https?:|data:|blob:)/.test(spec)) continue;
    if (spec.startsWith('.') || spec.startsWith('/')) {
      const target = await resolveModulePath(spec, site, ctx);
      if (!target) {
        ctx.warnings.push(`${site}: cannot resolve import "${spec}"`);
        specs.set(spec, `data:text/javascript,${encodeURIComponent(`throw new Error(${JSON.stringify(`Cannot find module '${spec}' imported from ${site}`)})`)}`);
        continue;
      }
      specs.set(spec, await loadModule(target, ctx));
    } else {
      // npm package via esm.sh (finalised in finishImportMap so React is shared)
      if (!ctx.importMap[spec]) ctx.importMap[spec] = { esm: spec };
      if (/^(react|react-dom|preact)(\/|$)/.test(spec)) ctx.usesReact = ctx.usesReact || /^react/.test(spec);
    }
  }
  IMPORT_SPEC_RE.lastIndex = 0;
  return code.replace(IMPORT_SPEC_RE, (full, pre, q, spec) => {
    const to = specs.get(spec);
    return to ? `${pre}${q}${to}${q}` : full;
  });
}

const DEFAULT_PINS = { react: '18.3.1', 'react-dom': '18.3.1' };

/**
 * Turn pending npm entries into esm.sh URLs. When React is used, every
 * other package imports "react" as an external so the page gets exactly
 * one copy (two copies break hooks).
 */
function finishImportMap(ctx) {
  const map = ctx.importMap;
  const pins = { ...DEFAULT_PINS, ...ctx.deps };
  if (ctx.usesReact) {
    for (const k of ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client']) if (!map[k]) map[k] = { esm: k };
  }
  for (const [k, v] of Object.entries(map)) {
    if (!v || typeof v !== 'object' || !v.esm) continue;
    const name = packageName(v.esm);
    let url = esmUrl(v.esm, pins, { dev: ctx.usesReact });
    if (ctx.usesReact) {
      const ext = [];
      if (name !== 'react') ext.push('react');
      if (name !== 'react' && name !== 'react-dom') ext.push('react-dom');
      if (v.esm.startsWith('react/')) ext.length = 0;
      if (ext.length) url += `&external=${ext.join(',')}`;
    }
    map[k] = url;
  }
}

/* ---------------- runtime shim inside the frame ---------------- */

function shimSource(channel, pagePath, assets) {
  // Keep this small and dependency-free: it runs before the student's code.
  return `(function(){
var CH=${JSON.stringify(channel)},PAGE=${JSON.stringify(pagePath)},ASSETS=${JSON.stringify(assets)};
var parentWin=window.parent!==window?window.parent:(window.opener||null);
function post(m){m.__pg=CH;try{parentWin&&parentWin.postMessage(m,'*');}catch(e){}}
function fmt(a){try{if(a instanceof Error)return a.stack||String(a);if(typeof a==='object'&&a!==null){var s=JSON.stringify(a,function(k,v){return typeof v==='function'?'[Function]':v instanceof Error?String(v):v;},2);return s&&s.length>4000?s.slice(0,4000)+'…':s;}return String(a);}catch(e){return String(a);}}
['log','info','warn','error','debug','table'].forEach(function(l){var o=console[l];console[l]=function(){try{post({type:'console',level:l==='table'?'log':l,text:Array.prototype.map.call(arguments,fmt).join(' ')});}catch(e){}return o&&o.apply(console,arguments);};});
window.addEventListener('error',function(e){post({type:'error',message:e.message,file:(e.filename||'').replace('workspace://',''),line:e.lineno,column:e.colno,stack:e.error&&e.error.stack});});
window.addEventListener('unhandledrejection',function(e){var r=e.reason;post({type:'error',message:'Unhandled promise rejection: '+(r&&r.message||fmt(r)),stack:r&&r.stack});});
var dir=PAGE.slice(0,PAGE.lastIndexOf('/')+1);
function norm(p){var out=[];p.split('/').forEach(function(s){if(!s||s==='.')return;if(s==='..')out.pop();else out.push(s);});return '/'+out.join('/');}
function local(u){if(u==null)return null;u=String(u);if(/^(data:|blob:|javascript:|mailto:|tel:|#|about:)/i.test(u))return null;var m=/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?(\\/.*)?$/i.exec(u);if(m)return {port:m[2]?Number(m[2].slice(1)):80,path:m[3]||'/'};if(/^[a-z][a-z0-9+.-]*:|^\\/\\//i.test(u))return null;var q=u.search(/[?#]/);var p=q===-1?u:u.slice(0,q),rest=q===-1?'':u.slice(q);return {port:null,path:norm(p.charAt(0)==='/'?p:dir+p)+rest};}
function asset(u){var l=local(u);if(!l||l.port)return null;return ASSETS[l.path.split(/[?#]/)[0]]||null;}
var seq=0,pending={};
window.addEventListener('message',function(e){var m=e.data;if(!m||m.__pg!==CH)return;if(m.type==='fetch-response'&&pending[m.id]){pending[m.id](m);delete pending[m.id];}if(m.type==='snapshot')post(snap({type:'snapshot-result',id:m.id}));if(m.type==='interact')act(m.actions||[]).then(function(r){var s=snap({type:'interact-result',id:m.id});s.results=r;post(s);});});
function vis(el){var r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
function label(el){return (el.innerText||el.value||el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.getAttribute('title')||el.name||'').trim().slice(0,80);}
function snap(o){var b=document.body;o.title=document.title;o.text=b?(b.innerText||'').slice(0,15000):'';var q=function(sel){return Array.prototype.slice.call(document.querySelectorAll(sel)).filter(vis).slice(0,40);};o.inputs=q('input,textarea,select').map(function(el){return {selector:cssPath(el),type:el.type||el.tagName.toLowerCase(),value:el.type==='password'?'***':String(el.value||'').slice(0,80),label:label(el)};});o.buttons=q('button,[role=button],input[type=submit],input[type=button]').map(function(el){return {selector:cssPath(el),text:label(el)};});o.links=q('a[href]').map(function(el){return {text:label(el),href:el.getAttribute('href')};});return o;}
function cssPath(el){if(el.id)return '#'+el.id;var parts=[];while(el&&el.nodeType===1&&parts.length<4){var s=el.tagName.toLowerCase();if(el.id){parts.unshift('#'+el.id);break;}var cls=(el.className&&typeof el.className==='string')?el.className.trim().split(/\s+/).slice(0,2).join('.'):'';if(cls)s+='.'+cls;var p=el.parentElement;if(p){var same=Array.prototype.filter.call(p.children,function(c){return c.tagName===el.tagName;});if(same.length>1)s+=':nth-of-type('+(same.indexOf(el)+1)+')';}parts.unshift(s);el=p;}return parts.join(' > ');}
function find(sel){if(!sel)return document.activeElement;if(sel.indexOf('text:')===0){var t=sel.slice(5).trim().toLowerCase();var all=Array.prototype.slice.call(document.querySelectorAll('button,a,[role=button],input,textarea,select,label,summary,li,td,span,div,h1,h2,h3,p'));var hit=all.filter(function(el){return vis(el)&&label(el).toLowerCase()===t;})[0]||all.filter(function(el){return vis(el)&&label(el).toLowerCase().indexOf(t)!==-1&&!el.querySelector('button,a');})[0];if(hit&&hit.tagName==='LABEL'&&hit.control)return hit.control;return hit||null;}try{return document.querySelector(sel);}catch(e){return null;}}
function setVal(el,v){var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;var d=Object.getOwnPropertyDescriptor(proto,'value');if(d&&d.set)d.set.call(el,v);else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
function act(list){var out=[];var i=0;return new Promise(function(done){function next(){if(i>=list.length){setTimeout(function(){done(out);},250);return;}var a=list[i++];try{if(a.action==='wait'){setTimeout(next,Math.min(5000,a.ms||500));return;}var el=find(a.selector);if(!el&&a.action!=='press'){out.push({action:a.action,selector:a.selector,ok:false,error:'element not found'});next();return;}if(a.action==='click'){el.scrollIntoView&&el.scrollIntoView({block:'center'});el.focus&&el.focus();el.click();out.push({action:'click',selector:a.selector,ok:true});}else if(a.action==='type'){el.focus&&el.focus();if(el.isContentEditable){el.textContent=a.text||'';el.dispatchEvent(new Event('input',{bubbles:true}));}else setVal(el,a.text||'');out.push({action:'type',selector:a.selector,ok:true});}else if(a.action==='press'){var t=el||document.activeElement||document.body;var k=a.text||'Enter';['keydown','keypress','keyup'].forEach(function(ev){t.dispatchEvent(new KeyboardEvent(ev,{key:k,bubbles:true,cancelable:true}));});if(k==='Enter'&&t.form){if(t.form.requestSubmit)t.form.requestSubmit();else t.form.submit();}out.push({action:'press',key:k,ok:true});}else out.push({action:a.action,ok:false,error:'unknown action'});}catch(err){out.push({action:a.action,ok:false,error:String(err&&err.message||err)});}setTimeout(next,120);}next();});}
function bridge(method,l,headers,body){return new Promise(function(res){var id=++seq;pending[id]=res;post({type:'fetch',id:id,method:method,path:l.path,port:l.port,headers:headers,body:body});});}
function toBody(m){if(m.bodyBase64){var s=atob(m.bodyBase64),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}return m.body==null?'':m.body;}
var realFetch=window.fetch;
window.fetch=function(input,init){var url=typeof input==='string'?input:input&&input.url;var l=local(url);if(!l)return realFetch.apply(this,arguments);init=init||{};var h={};try{new Headers(init.headers||(input&&input.headers)||{}).forEach(function(v,k){h[k]=v;});}catch(e){}var b=init.body;if(b&&typeof b!=='string'){try{b=b instanceof URLSearchParams?b.toString():JSON.stringify(b);}catch(e){b=String(b);}}return bridge((init.method||(input&&input.method)||'GET').toUpperCase(),l,h,b==null?null:String(b)).then(function(m){if(m.error)throw new TypeError('Failed to fetch '+url+': '+m.error);return new Response(m.status===204||m.status===304?null:toBody(m),{status:m.status,statusText:m.statusText||'',headers:m.headers||{}});});};
var RX=window.XMLHttpRequest;
function FX(){var x=this;x.readyState=0;x.status=0;x.responseText='';x.response='';x._h={};x.onreadystatechange=null;x.onload=null;x.onerror=null;x._ev={};}
FX.prototype.open=function(m,u,a){this._m=m;this._u=u;this._l=local(u);if(!this._l){this._real=new RX();this._real.open.apply(this._real,arguments);var self=this;['onload','onerror','onreadystatechange'].forEach(function(k){self._real[k]=function(){self.readyState=self._real.readyState;self.status=self._real.status;self.responseText=self._real.responseText;self.response=self._real.response;if(self[k])self[k].apply(self,arguments);};});}this.readyState=1;};
FX.prototype.setRequestHeader=function(k,v){if(this._real)return this._real.setRequestHeader(k,v);this._h[k]=v;};
FX.prototype.addEventListener=function(t,f){(this._ev[t]=this._ev[t]||[]).push(f);if(this._real)this._real.addEventListener(t,f);};
FX.prototype.getResponseHeader=function(k){return this._rh?this._rh[String(k).toLowerCase()]||null:this._real?this._real.getResponseHeader(k):null;};
FX.prototype.getAllResponseHeaders=function(){var h=this._rh||{};return Object.keys(h).map(function(k){return k+': '+h[k];}).join('\\r\\n');};
FX.prototype.abort=function(){if(this._real)this._real.abort();};
FX.prototype.send=function(b){if(this._real)return this._real.send(b);var x=this;bridge(String(x._m||'GET').toUpperCase(),x._l,x._h,b==null?null:String(b)).then(function(m){x.readyState=4;x.status=m.status;x._rh=m.headers||{};var body=toBody(m);x.responseText=typeof body==='string'?body:'';x.response=x.responseType==='json'?JSON.parse(x.responseText||'null'):x.responseText;if(x.onreadystatechange)x.onreadystatechange();if(x.onload)x.onload();(x._ev.load||[]).forEach(function(f){f.call(x);});(x._ev.loadend||[]).forEach(function(f){f.call(x);});});};
window.XMLHttpRequest=FX;
function patchSrc(proto,prop){var d=Object.getOwnPropertyDescriptor(proto,prop);if(!d||!d.set)return;Object.defineProperty(proto,prop,{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){var a=asset(v);d.set.call(this,a||v);}});}
[HTMLImageElement,HTMLSourceElement,HTMLMediaElement,HTMLScriptElement,HTMLTrackElement].forEach(function(C){if(C)patchSrc(C.prototype,'src');});
if(window.HTMLVideoElement)patchSrc(HTMLVideoElement.prototype,'poster');
var sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){if(/^(src|href|poster)$/i.test(n)&&!(this instanceof HTMLAnchorElement)&&!(this instanceof HTMLFormElement)){var a=asset(v);if(a)v=a;}return sa.call(this,n,v);};
var RA=window.Audio;if(RA){window.Audio=function(u){return new RA(asset(u)||u);};window.Audio.prototype=RA.prototype;}
document.addEventListener('click',function(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey)return;var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href');if(!href||href.charAt(0)==='#'||a.target==='_blank'&&!local(href))return;var l=local(href);if(!l){if(/^https?:/i.test(href)){e.preventDefault();window.open(href,'_blank','noopener');}return;}e.preventDefault();post({type:'navigate',path:l.path,port:l.port});},false);
document.addEventListener('submit',function(e){var f=e.target;if(e.defaultPrevented||!f||!f.getAttribute)return;var action=f.getAttribute('action')||'';var l=local(action||PAGE);if(!l)return;e.preventDefault();var method=(f.getAttribute('method')||'GET').toUpperCase();var fd=new FormData(f);var params=new URLSearchParams();fd.forEach(function(v,k){params.append(k,typeof v==='string'?v:v.name);});if(method==='GET'){post({type:'navigate',path:l.path.split('?')[0]+'?'+params.toString(),port:l.port});}else{post({type:'navigate',path:l.path,port:l.port,method:method,body:params.toString(),headers:{'content-type':'application/x-www-form-urlencoded'}});}},false);
var ls={};try{window.localStorage.getItem('x');}catch(e){var mk=function(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null;},setItem:function(k,v){d[k]=String(v);post({type:'storage',key:k});},removeItem:function(k){delete d[k];},clear:function(){d={};},key:function(i){return Object.keys(d)[i]||null;},get length(){return Object.keys(d).length;}};};try{Object.defineProperty(window,'localStorage',{value:mk(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:mk(),configurable:true});}catch(e2){}}
var hs=history.pushState;history.pushState=function(s,t,u){try{return hs.apply(history,arguments);}catch(e){post({type:'route',path:String(u)});}};var hr=history.replaceState;history.replaceState=function(s,t,u){try{return hr.apply(history,arguments);}catch(e){}};
post({type:'loaded',path:PAGE,title:document.title});
document.addEventListener('DOMContentLoaded',function(){post({type:'ready',path:PAGE,title:document.title});});
})();`;
}

/* ---------------- helpers for the IDE side of the bridge ---------------- */

/** Answer a fetch() made inside the frame. */
export async function answerFrameFetch(msg, { staticSrc, requestServer }) {
  try {
    if (msg.port) {
      const r = await requestServer(msg.port, { method: msg.method, url: msg.path, headers: msg.headers || {}, body: msg.body });
      return { status: r.status, statusText: r.statusText || '', headers: r.headers || {}, body: r.body, bodyBase64: r.bodyBase64 };
    }
    if (msg.method && msg.method !== 'GET' && msg.method !== 'HEAD') {
      return { status: 405, headers: { 'content-type': 'text/plain' }, body: `${msg.method} ${msg.path}: static previews can only answer GET requests. Run a Node/Express server (node server.js) to handle ${msg.method}.` };
    }
    const res = await staticSrc.fetch(msg.path.split(/[?#]/)[0]);
    if (!res) return { status: 404, headers: { 'content-type': 'text/plain' }, body: `Cannot GET ${msg.path}` };
    if (typeof res.body === 'string') return { status: 200, headers: res.headers, body: res.body };
    return { status: 200, headers: res.headers, bodyBase64: b64(toBytes(res.body)) };
  } catch (err) {
    return { status: 0, error: err?.message || String(err) };
  }
}

/** Markdown document for the preview pane. */
export function markdownDocument(htmlBody, title = 'Preview') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escAttr(title)}</title><style>
  body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:860px;margin:0 auto;padding:24px;color:#1f2328}
  pre{background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto}code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em}
  :not(pre)>code{background:#eff1f3;padding:.1em .35em;border-radius:4px}table{border-collapse:collapse}td,th{border:1px solid #d0d7de;padding:6px 12px}
  blockquote{margin:0;padding:0 1em;color:#59636e;border-left:.25em solid #d0d7de}img{max-width:100%}h1,h2{border-bottom:1px solid #d8dee4;padding-bottom:.3em}
  </style></head><body>${htmlBody}</body></html>`;
}

export { basename, dirname, resolvePath };
