/* ============================================================
   TOOLBOX — Lossless transfer packing

   Files leaving the device (Files cloud sync, files shared in
   Messaging) are packed with Korempress before upload and
   unpacked after download, so fewer bytes cross the network.
   Packing runs in the Korempress worker, off the page, and is
   lossless: every unpack checks the original's SHA-256, so the
   file that arrives is byte-for-byte the file that was sent.

   Only files that shrink are packed: text, documents, PDFs,
   spreadsheets, code, SVG and raw data. Photos, video, audio and
   archives are already compressed and are sent as they are. A
   packed copy is kept only when it saves at least 12%.
   ============================================================ */

// Sent as a generic binary so storage buckets with MIME allow-lists accept it.
export const PACK_TYPE = 'application/octet-stream';
const MIN_BYTES = 16 * 1024;
const MIN_SAVING = 0.12;

const COMPRESSIBLE_TYPE = /^(text\/|application\/(json|xml|pdf|javascript|x-javascript|sql|rtf|x-yaml|yaml|csv|x-ndjson|x-tex|postscript|vnd\.ms-excel|msword)|image\/(svg\+xml|bmp|tiff|x-portable))/i;
const COMPRESSIBLE_NAME = /\.(txt|md|markdown|csv|tsv|json|ndjson|xml|html?|css|js|mjs|ts|tsx|jsx|py|java|c|cpp|h|cs|go|rs|rb|php|sql|log|ini|toml|ya?ml|tex|rtf|svg|pdf|bmp|tiff?|ppm|pgm|ps|eps|doc|xls|dxf|obj|stl|ply|gltf|ics|vcf|srt|vtt)$/i;
const ALREADY_COMPRESSED = /\.(jpe?g|png|gif|webp|avif|heic|mp4|mov|webm|mkv|mp3|m4a|aac|ogg|opus|flac|zip|gz|tgz|bz2|xz|7z|rar|zst|br|docx|xlsx|pptx|odt|ods|odp|epub|apk|jar|woff2?|glb|kpk)$/i;

/** Whether packing this file is worth trying. */
export function isCompressible({ name = '', type = '', size = 0 } = {}) {
  if (size < MIN_BYTES) return false;
  if (ALREADY_COMPRESSED.test(name)) return false;
  return COMPRESSIBLE_TYPE.test(type) || COMPRESSIBLE_NAME.test(name);
}

const isPdf = (name, type) => /pdf/i.test(type) || /\.pdf$/i.test(name);

/**
 * Packs a file for upload when it is worth it.
 * Resolves to { blob, packed, size, packedSize, type } — `blob` is what to send.
 */
export async function packForTransfer(fileOrBlob, { name = fileOrBlob?.name || 'file', type = fileOrBlob?.type || '' } = {}) {
  const size = fileOrBlob.size;
  const plain = { blob: fileOrBlob, packed: false, size, packedSize: size, type };
  if (!isCompressible({ name, type, size })) return plain;
  try {
    const bytes = new Uint8Array(await fileOrBlob.arrayBuffer());
    const { runKorempress } = await import('./korempress/client.js');
    const res = isPdf(name, type)
      ? await runKorempress('packPdf', bytes, { level: 4 })
      : await runKorempress('packFile', bytes, { name, level: 4 });
    const out = res?.bytes;
    if (!out || out.length > size * (1 - MIN_SAVING)) return plain;
    return { blob: new Blob([out], { type: PACK_TYPE }), packed: true, size, packedSize: out.length, type };
  } catch {
    return plain;   // packing is an optimisation: any failure sends the original
  }
}

/** Unpacks downloaded bytes if they are a Korempress package; otherwise returns them unchanged. */
export async function unpackTransfer(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { isContainer, isKlFile } = await import('./korempress/container.js');
  if (!isContainer(b) && !isKlFile(b)) return b;
  const { runKorempress } = await import('./korempress/client.js');
  const res = await runKorempress(isContainer(b) ? 'unpackPdf' : 'unpackFile', b);
  return res.bytes;
}

/** Downloads a shared file and returns the original as a Blob (unpacked when needed). */
export async function fetchTransfer(url, { type = '' } = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const bytes = await unpackTransfer(new Uint8Array(await res.arrayBuffer()));
  return new Blob([bytes], { type: type || res.headers.get('content-type') || 'application/octet-stream' });
}
