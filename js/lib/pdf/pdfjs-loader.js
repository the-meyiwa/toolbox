/* ============================================================
   pdf.js loader, shared by every tool that renders or reads PDFs.

   - Polyfills Map/WeakMap getOrInsertComputed / getOrInsert, which
     pdf.js 6 calls and older engines lack.
   - Resolves the worker once. The production URL is the one Vite
     rewrites at build time; in development (where that URL can fall
     through to the SPA's index.html) it probes a few known locations.
   - Opens documents with a password callback, so encrypted files can
     prompt instead of failing.
   ============================================================ */

export function polyfillMapUpserts() {
  // Math.sumPrecise (ES2026) is used by pdf.js too; Neumaier summation is close enough.
  if (typeof Math.sumPrecise !== 'function') {
    Object.defineProperty(Math, 'sumPrecise', {
      configurable: true, writable: true,
      value(items) {
        let sum = 0, c = 0;
        for (const x of items) {
          const t = sum + x;
          c += Math.abs(sum) >= Math.abs(x) ? (sum - t) + x : (x - t) + sum;
          sum = t;
        }
        return sum + c;
      },
    });
  }
  for (const C of [globalThis.Map, globalThis.WeakMap]) {
    if (!C) continue;
    if (!C.prototype.getOrInsertComputed) {
      Object.defineProperty(C.prototype, 'getOrInsertComputed', {
        configurable: true, writable: true,
        value(key, fn) { if (!this.has(key)) this.set(key, fn(key)); return this.get(key); },
      });
    }
    if (!C.prototype.getOrInsert) {
      Object.defineProperty(C.prototype, 'getOrInsert', {
        configurable: true, writable: true,
        value(key, v) { if (!this.has(key)) this.set(key, v); return this.get(key); },
      });
    }
  }
}

// Whether the engine has these natively; if not, the worker needs the polyfill too.
const NATIVE_UPSERTS = typeof Map.prototype.getOrInsertComputed === 'function' && typeof WeakMap.prototype.getOrInsertComputed === 'function'
  && typeof Math.sumPrecise === 'function';
polyfillMapUpserts();

const WORKER_PATH = 'pdfjs-dist/build/pdf.worker.min.mjs';
let pdfjsPromise = null;

function viteWorkerUrl() {
  try { return new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href; } catch { return ''; }
}

async function looksLikeScript(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
    const type = res.headers.get('content-type') || '';
    return res.ok && /javascript|ecmascript/.test(type);
  } catch { return false; }
}

async function resolveWorkerSrc() {
  if (globalThis.__PDFJS_WORKER_SRC__) return globalThis.__PDFJS_WORKER_SRC__;
  const primary = viteWorkerUrl();
  // A built bundle rewrites the URL to /assets/…; trust it without a request.
  if (primary && !/\/js\/lib\//.test(primary) && !primary.includes('/node_modules/')) return primary;
  if (typeof fetch !== 'function' || typeof location === 'undefined') return primary;
  const candidates = [primary, `/node_modules/${WORKER_PATH}`, `/_g/${WORKER_PATH}`];
  for (const url of candidates) if (url && await looksLikeScript(url)) return url;
  return primary;
}

/**
 * A module worker that installs the Map/WeakMap polyfill and then loads
 * the real pdf.js worker. Dynamic import, so the polyfill runs first.
 */
function polyfilledWorker(src) {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof location === 'undefined' || !src) return null;
  try {
    const abs = new URL(src, location.href).href;
    // Messages that arrive while the real worker is still loading are queued and replayed.
    const code = [
      'const queued = []; const early = (e) => queued.push(e.data); self.addEventListener("message", early);',
      `(${polyfillMapUpserts.toString()})();`,
      `await import(${JSON.stringify(abs)});`,
      'self.removeEventListener("message", early);',
      'for (const data of queued) self.dispatchEvent(new MessageEvent("message", { data }));',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    return new Worker(url, { type: 'module', name: 'pdfjs-worker' });
  } catch { return null; }
}

/** pdf.js with its worker configured. */
export function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      polyfillMapUpserts();
      const pdfjs = await import('pdfjs-dist');
      if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = await resolveWorkerSrc();
      if (!NATIVE_UPSERTS && !pdfjs.GlobalWorkerOptions.workerPort) {
        const port = polyfilledWorker(pdfjs.GlobalWorkerOptions.workerSrc);
        if (port) pdfjs.GlobalWorkerOptions.workerPort = port;
      }
      return pdfjs;
    })().catch(err => { pdfjsPromise = null; throw err; });
  }
  return pdfjsPromise;
}

export class PasswordCancelled extends Error {
  constructor() { super('A password is needed to open this PDF.'); this.name = 'PasswordCancelled'; this.passwordCancelled = true; }
}

/**
 * Open bytes with pdf.js. The bytes are copied because pdf.js transfers
 * (detaches) the buffer it is given to its worker.
 * @param {Uint8Array} bytes
 * @param {{password?: string, onPassword?: (reason: 'need'|'incorrect') => Promise<string|null>}} o
 * @returns {Promise<{doc: any, password: string}>}
 */
export async function openPdfJs(bytes, { password = '', onPassword } = {}) {
  const pdfjs = await loadPdfJs();
  let used = password;
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    password: password || undefined,
    isEvalSupported: false,
    enableXfa: false,
    stopAtErrors: false,
  });
  let cancelled = false;
  task.onPassword = async (update, reason) => {
    const why = reason === pdfjs.PasswordResponses?.INCORRECT_PASSWORD ? 'incorrect' : 'need';
    const answer = onPassword ? await onPassword(why) : null;
    if (answer == null) { cancelled = true; task.destroy(); return; }
    used = answer;
    update(answer);
  };
  try {
    const doc = await task.promise;
    return { doc, password: used };
  } catch (err) {
    if (cancelled) throw new PasswordCancelled();
    if (/password/i.test(err?.message || '') || err?.name === 'PasswordException') throw new PasswordCancelled();
    throw err;
  }
}
