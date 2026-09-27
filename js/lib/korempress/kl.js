/* ============================================================
   The Korempress `kl` codec (LZ77 + Huffman / range coder), compiled
   to WebAssembly from wasm/korempress/kl.c. MIT, Ogheneovo Segba.

   One instance per realm; every call copies in, runs, copies out and
   frees, so memory stays flat across many calls. Level 3 is the
   everyday setting. Levels 7-9 are slow by design and can take tens
   of seconds on degenerate input, so run them in a worker.
   ============================================================ */

let instancePromise = null;

/** @param {() => Promise<ArrayBuffer|Uint8Array>} [fetchBytes] override for tests and workers */
export function loadKl(fetchBytes) {
  if (!instancePromise) {
    instancePromise = (async () => {
      const bytes = fetchBytes
        ? await fetchBytes()
        : await (await fetch(new URL('/wasm/kl.wasm', globalThis.location?.href || 'http://localhost/'))).arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      return instance.exports;
    })();
    instancePromise.catch(() => { instancePromise = null; });
  }
  return instancePromise;
}

function copyIn(x, data) {
  const p = x.kl_alloc(Math.max(1, data.length));
  if (!p) throw new Error('Out of memory for the codec');
  new Uint8Array(x.memory.buffer, p, data.length).set(data);
  return p;
}

/** Compress bytes. Empty input gives an empty result. */
export async function klEncode(data, level = 3) {
  if (!data.length) return new Uint8Array(0);
  const x = await loadKl();
  const src = copyIn(x, data);
  const dst = x.kl_alloc(x.kl_bound(data.length));
  if (!dst) { x.kl_free(src); throw new Error('Out of memory for the codec'); }
  try {
    const n = x.kl_encode(src, data.length, dst, level);
    if (!n) throw new Error('The codec produced no output');
    return new Uint8Array(x.memory.buffer, dst, n).slice();
  } finally {
    x.kl_free(src); x.kl_free(dst);
  }
}

/** Decompress bytes made by klEncode. Refuses corrupt or foreign input. */
export async function klDecode(data) {
  if (!data.length) return new Uint8Array(0);
  const x = await loadKl();
  const src = copyIn(x, data);
  const want = x.kl_raw_length(src, data.length);
  const dst = x.kl_alloc(want + 64);
  if (!dst) { x.kl_free(src); throw new Error('Out of memory for the codec'); }
  try {
    const n = x.kl_decode(src, data.length, dst);
    if (n !== want) throw new Error('This data is corrupt or was not made by this codec');
    return new Uint8Array(x.memory.buffer, dst, n).slice();
  } finally {
    x.kl_free(src); x.kl_free(dst);
  }
}
