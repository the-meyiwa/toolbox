/* ============================================================
   Store-only ZIP writer for PDF outputs.

   PDFs and JPEG/PNG pages are already compressed, so deflating them
   again costs time for almost no gain. Stored entries also mean the
   whole archive can be built synchronously from byte arrays.
   ============================================================ */

let table = null;

export function crc32(bytes, crc = 0) {
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
  }
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/** Make names unique and safe inside the archive ("a.pdf", "a (2).pdf"). */
function uniqueNames(entries) {
  const used = new Set();
  return entries.map(e => {
    let name = String(e.name || 'file').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\.\//g, '');
    if (used.has(name.toLowerCase())) {
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      let n = 2;
      while (used.has(`${stem} (${n})${ext}`.toLowerCase())) n++;
      name = `${stem} (${n})${ext}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/**
 * @param {Array<{name: string, data: Uint8Array|ArrayBuffer|string}>} entries
 * @returns {Uint8Array}
 */
export function createZip(entries) {
  const enc = new TextEncoder();
  const names = uniqueNames(entries);
  const { time, date } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;

  entries.forEach((entry, i) => {
    const data = typeof entry.data === 'string' ? enc.encode(entry.data)
      : entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const name = enc.encode(names[i]);
    const crc = crc32(data);

    const lh = new Uint8Array(30 + name.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);          // UTF-8 names
    lv.setUint16(8, 0, true);               // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    lh.set(name, 30);

    const ch = new Uint8Array(46 + name.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    ch.set(name, 46);

    locals.push(lh, data);
    centrals.push(ch);
    offset += lh.length + data.length;
  });

  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, p); p += part.length; }
  return out;
}

/** Read back a store-only archive (used by tests and to sanity-check output). */
export function readStoredZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const files = [];
  let p = 0;
  while (p + 30 <= bytes.length && view.getUint32(p, true) === 0x04034b50) {
    const size = view.getUint32(p + 18, true);
    const nameLen = view.getUint16(p + 26, true);
    const extra = view.getUint16(p + 28, true);
    const crc = view.getUint32(p + 14, true);
    const name = dec.decode(bytes.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extra;
    const data = bytes.subarray(start, start + size);
    files.push({ name, data, crcOk: crc32(data) === crc });
    p = start + size;
  }
  return files;
}
