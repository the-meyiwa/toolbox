/* ============================================================
   TOOLBOX — Archive Engine (PKZIP Generator & Extractor)
   Lightweight, standards-compliant ZIP creation and decompression
   using browser standard CompressionStream / DecompressionStream.
   No external npm dependencies required.
   ============================================================ */

/**
 * Standard CRC32 table for ZIP checksums
 */
let crcTable = null;
function makeCRCTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

export function computeCRC32(data) {
  if (!crcTable) crcTable = makeCRCTable();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Normalizes input data to Uint8Array
 * @param {string|Uint8Array|ArrayBuffer|Blob} data
 * @returns {Promise<Uint8Array>}
 */
async function toUint8Array(data) {
  if (!data) return new Uint8Array(0);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  return new Uint8Array(0);
}

/**
 * Compresses data using raw deflate stream
 * @param {Uint8Array} data 
 * @returns {Promise<{compressed: Uint8Array, method: number}>}
 */
async function deflateData(data) {
  if (!data || data.length === 0) {
    return { compressed: data || new Uint8Array(0), method: 0 };
  }
  try {
    if (typeof CompressionStream !== 'undefined') {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(data);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      const comp = new Uint8Array(buf);
      if (comp.length < data.length) {
        return { compressed: comp, method: 8 }; // 8 = Deflated
      }
    }
  } catch (err) {
    // Fallback to Stored
  }
  return { compressed: data, method: 0 }; // 0 = Stored
}

/**
 * Decompresses raw deflate or stored data
 * @param {Uint8Array} data 
 * @param {number} method 
 * @returns {Promise<Uint8Array>}
 */
async function inflateData(data, method) {
  if (method === 0) return data;
  if (method === 8) {
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(data);
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(buf);
    }
  }
  throw new Error(`Unsupported compression method: ${method}`);
}

/**
 * Create standard PKZIP archive Blob from an array of file entries
 * @param {Array<{path: string, name?: string, data?: any, isDirectory?: boolean}>} entries
 * @returns {Promise<Blob>}
 */
export async function createZip(entries = []) {
  const fileRecords = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const rawPath = (entry.path || entry.name || 'file.txt').replace(/\\/g, '/').replace(/^\/+/, '');
    const isDir = Boolean(entry.isDirectory || rawPath.endsWith('/'));
    const entryPath = isDir && !rawPath.endsWith('/') ? `${rawPath}/` : rawPath;
    const nameBytes = new TextEncoder().encode(entryPath);

    let rawData = new Uint8Array(0);
    let compData = new Uint8Array(0);
    let method = 0;
    let crc = 0;

    const inputData = entry.data != null ? entry.data : entry.content;
    if (!isDir && inputData != null) {
      rawData = await toUint8Array(inputData);
      crc = computeCRC32(rawData);
      const def = await deflateData(rawData);
      compData = def.compressed;
      method = def.method;
    }

    // Local file header (30 bytes + name length)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true);         // Version needed to extract (2.0)
    lv.setUint16(6, 0, true);          // General purpose bit flag
    lv.setUint16(8, method, true);     // Compression method
    lv.setUint16(10, 0, true);         // File last modification time
    lv.setUint16(12, 0, true);         // File last modification date
    lv.setUint32(14, crc, true);        // CRC-32
    lv.setUint32(18, compData.length, true); // Compressed size
    lv.setUint32(22, rawData.length, true);  // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // File name length
    lv.setUint16(28, 0, true);                // Extra field length
    localHeader.set(nameBytes, 30);

    fileRecords.push({
      path: entryPath,
      nameBytes,
      crc,
      method,
      compressedSize: compData.length,
      uncompressedSize: rawData.length,
      localHeader,
      compData,
      offset: currentOffset,
      isDir
    });

    currentOffset += localHeader.length + compData.length;
  }

  // Central directory records
  const centralDirRecords = [];
  let centralDirSize = 0;

  for (const rec of fileRecords) {
    const cd = new Uint8Array(46 + rec.nameBytes.length);
    const cv = new DataView(cd.buffer);

    cv.setUint32(0, 0x02014b50, true); // Central directory header signature
    cv.setUint16(4, 20, true);         // Version made by
    cv.setUint16(6, 20, true);         // Version needed to extract
    cv.setUint16(8, 0, true);          // General purpose bit flag
    cv.setUint16(10, rec.method, true);// Compression method
    cv.setUint16(12, 0, true);         // Mod time
    cv.setUint16(14, 0, true);         // Mod date
    cv.setUint32(16, rec.crc, true);   // CRC-32
    cv.setUint32(20, rec.compressedSize, true);   // Comp size
    cv.setUint32(24, rec.uncompressedSize, true); // Uncomp size
    cv.setUint16(28, rec.nameBytes.length, true); // Name len
    cv.setUint16(30, 0, true);         // Extra field len
    cv.setUint16(32, 0, true);         // Comment len
    cv.setUint16(34, 0, true);         // Disk start
    cv.setUint16(36, 0, true);         // Internal attributes
    cv.setUint32(38, rec.isDir ? 0x10 : 0, true); // External attributes (directory flag)
    cv.setUint32(42, rec.offset, true);// Relative offset of local header
    cd.set(rec.nameBytes, 46);

    centralDirRecords.push(cd);
    centralDirSize += cd.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central dir signature
  ev.setUint16(4, 0, true);          // Number of this disk
  ev.setUint16(6, 0, true);          // Disk with central dir
  ev.setUint16(8, fileRecords.length, true);  // Entries on this disk
  ev.setUint16(10, fileRecords.length, true); // Total entries
  ev.setUint32(12, centralDirSize, true);     // Size of central directory
  ev.setUint32(16, currentOffset, true);      // Offset of start of central dir
  ev.setUint16(20, 0, true);                  // Comment len

  // Assemble full archive chunks
  const chunks = [];
  for (const rec of fileRecords) {
    chunks.push(rec.localHeader);
    if (rec.compData.length > 0) chunks.push(rec.compData);
  }
  for (const cd of centralDirRecords) {
    chunks.push(cd);
  }
  chunks.push(eocd);

  return new Blob(chunks, { type: 'application/zip' });
}

/**
 * Check if binary buffer is a valid PKZIP file
 * @param {ArrayBuffer|Uint8Array} buffer 
 * @returns {boolean}
 */
export function isZipArchive(buffer) {
  if (!buffer) return false;
  const byteLength = buffer.byteLength || buffer.length || 0;
  if (byteLength < 22) return false;
  const view = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer, buffer.byteOffset || 0, byteLength);
  return view.getUint32(0, true) === 0x04034b50;
}

/**
 * Parse and unpack standard PKZIP archive
 * @param {ArrayBuffer|Uint8Array|Blob} zipData
 * @returns {Promise<Array<{path: string, name: string, isDirectory: boolean, size: number, compressedSize: number, data: Uint8Array}>>}
 */
export async function extractZip(zipData) {
  const bytes = await toUint8Array(zipData);
  if (bytes.length < 22) {
    throw new Error('File is too small to be a valid ZIP archive.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Find End of Central Directory (EOCD) signature: 0x06054b50 backwards
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Corrupt ZIP: End of Central Directory record not found.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const entries = [];
  let cursor = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (cursor + 46 > bytes.length) break;
    const sig = view.getUint32(cursor, true);
    if (sig !== 0x02014b50) break;

    const method = view.getUint16(cursor + 10, true);
    const compSize = view.getUint32(cursor + 20, true);
    const uncompSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);

    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLen);
    const entryPath = new TextDecoder('utf-8').decode(nameBytes);
    const isDir = entryPath.endsWith('/') || (view.getUint32(cursor + 38, true) & 0x10) !== 0;

    // Read local header to get to payload
    if (localHeaderOffset + 30 <= bytes.length) {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compSlice = bytes.subarray(dataStart, dataStart + compSize);

      let uncompressedData = new Uint8Array(0);
      if (!isDir && uncompSize > 0) {
        uncompressedData = await inflateData(compSlice, method);
      }

      const basename = entryPath.replace(/\/$/, '').split('/').pop() || entryPath;

      entries.push({
        path: entryPath,
        name: basename,
        isDirectory: isDir,
        size: uncompSize,
        compressedSize: compSize,
        data: uncompressedData
      });
    }

    cursor += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}
