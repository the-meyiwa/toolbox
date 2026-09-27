/* ============================================================
   ffmpeg.wasm, loaded once and shared by every media tool.

   The single-threaded core needs no cross-origin isolation, so it
   works on any host. The core (~30 MB) is too large to ship with the
   site and comes from a public CDN on first use, then from the
   browser cache. Files are processed on this device; only the codec
   itself is downloaded.
   ============================================================ */

const CORE_VERSION = '0.12.10';
const CDNS = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
];

let instance = null;
let loading = null;

async function load(onProgress) {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
  const ff = new FFmpeg();
  let lastErr;
  for (const base of CDNS) {
    try {
      onProgress?.(0, 'Downloading the video engine (first time only)');
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm', true, (e) => { if (e.total) onProgress?.(e.received / e.total, 'Downloading the video engine (first time only)'); }),
      ]);
      await ff.load({ coreURL, wasmURL });
      return ff;
    } catch (err) { lastErr = err; }
  }
  throw new Error(`The video engine could not be downloaded. Check your connection and try again.${lastErr?.message ? ` (${lastErr.message})` : ''}`);
}

export async function getFFmpeg(onProgress) {
  if (instance) return instance;
  loading ??= load(onProgress).then((ff) => { instance = ff; return ff; }).finally(() => { loading = null; });
  return loading;
}

/** Stop whatever is running. The next job loads a fresh engine (fast, the core is cached). */
export function resetFFmpeg() {
  try { instance?.terminate(); } catch { /* already gone */ }
  instance = null;
}

/** "00:01:02.5", "1:02", "62.5" → seconds. */
export function parseTime(s) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '';
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec - h * 3600 - m * 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${s.toFixed(s % 1 ? 2 : 0).padStart(s % 1 ? 5 : 2, '0')}`;
}

/**
 * Run one ffmpeg command.
 * @param {{name: string, data: Uint8Array}[]} inputs written to the virtual disk under their names
 * @param {string[]} args ffmpeg arguments, naming the inputs and `output`
 * @param {string} output file name to read back
 */
export async function runFFmpeg(inputs, args, output, { signal, onProgress, duration } = {}) {
  const ff = await getFFmpeg(onProgress);
  const log = [];
  const onLog = ({ message }) => {
    log.push(message); if (log.length > 200) log.shift();
    // Progress from "time=00:00:12.34" when the duration is known.
    const m = duration && message.match(/time=(\d+):(\d+):([\d.]+)/);
    if (m) onProgress?.(Math.min(0.99, (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) / duration), 'Processing');
  };
  const onProg = ({ progress }) => { if (!duration && progress >= 0 && progress <= 1) onProgress?.(progress, 'Processing'); };
  ff.on('log', onLog); ff.on('progress', onProg);
  const abort = () => resetFFmpeg();
  signal?.addEventListener('abort', abort, { once: true });
  const written = [];
  try {
    for (const f of inputs) { await ff.writeFile(f.name, f.data); written.push(f.name); }
    onProgress?.(0, 'Processing');
    const code = await ff.exec(args);
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { cancelled: true });
    if (code !== 0) throw new Error(explain(log));
    const out = await ff.readFile(output);
    await ff.deleteFile(output).catch(() => {});
    return out;
  } catch (err) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { cancelled: true });
    if (err?.message?.startsWith('The video') || /could not|does not|no audio|has no/i.test(err?.message || '')) throw err;
    throw new Error(explain(log, err));
  } finally {
    signal?.removeEventListener('abort', abort);
    if (instance === ff) {
      ff.off('log', onLog); ff.off('progress', onProg);
      for (const n of written) await ff.deleteFile(n).catch(() => {});
    }
  }
}

function explain(log, err) {
  const text = log.join('\n');
  if (/matches no streams|does not contain any stream|Output file #0 does not contain/i.test(text)) return 'This file has no stream of the kind this job needs (for example, no audio track).';
  if (/Invalid data found|could not find codec parameters|moov atom not found/i.test(text)) return 'This file could not be read. It may be damaged or in a format the browser engine does not support.';
  if (/memory|OOM|Aborted\(\)/i.test(text + (err?.message || ''))) return 'The file is too large to process in the browser. Try a shorter clip or a lower resolution.';
  const last = log.filter((l) => /error|invalid|failed/i.test(l)).pop();
  return `Processing failed${last ? `: ${last.trim()}` : err?.message ? `: ${err.message}` : ''}`;
}

/** Duration in seconds, read by the browser (no engine needed). */
export function probeDuration(file) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const el = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    el.src = url;
  });
}
