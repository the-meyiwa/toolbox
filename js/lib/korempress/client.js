/* ============================================================
   Main-thread handle on the Korempress worker. Falls back to running
   in the page where workers are unavailable (tests, old browsers).
   Cancelling terminates the worker; the next job starts a fresh one.
   ============================================================ */

let worker = null;
let seq = 0;

function getWorker() {
  if (worker || typeof Worker === 'undefined') return worker;
  try { worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); } catch { worker = null; }
  return worker;
}

export async function runKorempress(op, bytes, { name = '', level = 6, signal, onProgress } = {}) {
  const w = getWorker();
  if (!w) {
    const c = await import('./container.js');
    if (op === 'packPdf') return c.packPdf(bytes, { level, onProgress });
    if (op === 'unpackPdf') return { bytes: await c.unpackPdf(bytes, { onProgress }) };
    if (op === 'packFile') return { bytes: await c.packFile(bytes, name, { level }) };
    return c.unpackFile(bytes);
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const onMsg = ({ data }) => {
      if (data.id !== id) return;
      if ('progress' in data) { onProgress?.(data.progress, data.label); return; }
      cleanup();
      if (data.error) reject(new Error(data.error)); else resolve(data.result);
    };
    const onErr = (e) => { cleanup(); worker = null; reject(new Error(e.message || 'The compressor stopped unexpectedly')); };
    const onAbort = () => { cleanup(); w.terminate(); worker = null; reject(Object.assign(new Error('Cancelled'), { cancelled: true })); };
    const cleanup = () => { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); signal?.removeEventListener('abort', onAbort); };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    signal?.addEventListener('abort', onAbort, { once: true });
    const copy = bytes.slice();
    w.postMessage({ id, op, bytes: copy, name, level }, [copy.buffer]);
  });
}
