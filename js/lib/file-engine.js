/* ============================================================
   File & image engine.

   One decode/transform/encode core behind every Images & Files tool,
   so compressing, converting, resizing and cropping are the same
   pipeline with different parameters rather than four separate tools
   that each reinvent canvas handling.

   Everything here runs on the user's device. No file byte ever leaves
   the browser, which is the whole reason these tools belong in Toolbox
   rather than on a site that uploads your passport scan to a server.

   Deliberate choices:
   - `createImageBitmap` where available (off-main-thread decode, honours
     EXIF orientation via imageOrientation) with an <img> fallback.
   - Large downscales are done in halving steps: one-shot canvas scaling
     aliases badly below about 50%.
   - Encoding goes through canvas.toBlob, which strips EXIF as a side
     effect — the metadata tool leans on that rather than rewriting it.
   ============================================================ */

/* ---------------- formats ---------------- */

export const MIME = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

export const EXT_FOR = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/avif': 'avif', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg',
};

/** Formats this browser can actually *write*. Probed once, lazily. */
let encodeSupport = null;
export async function supportedOutputs() {
  if (encodeSupport) return encodeSupport;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2;
  const out = [];
  for (const type of [MIME.png, MIME.jpeg, MIME.webp, MIME.avif]) {
    try {
      const blob = await new Promise(res => canvas.toBlob(res, type, 0.8));
      if (blob && blob.type === type) out.push(type);
    } catch { /* unsupported */ }
  }
  if (!out.includes(MIME.png)) out.push(MIME.png);
  encodeSupport = out;
  return out;
}

export function humanBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(n < 10485760 ? 2 : 1)} MB`;
}

/* ---------------- decode ---------------- */

/**
 * Decode a file into a bitmap plus its natural size.
 * @param {File|Blob} file
 * @returns {Promise<{bitmap: ImageBitmap|HTMLImageElement, width: number, height: number, close: () => void}>}
 */
export async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation:'from-image' applies the EXIF rotation, so a
      // phone photo is not silently sideways after processing.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
    } catch { /* fall through */ }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file could not be read as an image.'));
      el.src = url;
    });
    return {
      bitmap: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/* ---------------- draw ---------------- */

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

/**
 * Draw a source region onto a canvas of the target size, stepping down in
 * halves when shrinking a lot. A single drawImage below ~50% drops pixels
 * instead of averaging them, which is what makes naive resizers look crunchy.
 */
function drawScaled(source, sw, sh, sx, sy, srcW, srcH, targetW, targetH) {
  let curW = srcW;
  let curH = srcH;
  let current = source;
  let cropX = sx;
  let cropY = sy;

  // First hop extracts the crop region at native resolution.
  if (cropX !== 0 || cropY !== 0 || srcW !== sw || srcH !== sh) {
    const c = makeCanvas(srcW, srcH);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, cropX, cropY, srcW, srcH, 0, 0, srcW, srcH);
    current = c;
    cropX = cropY = 0;
  }

  while (curW > targetW * 2 && curH > targetH * 2) {
    const nextW = Math.max(targetW, Math.floor(curW / 2));
    const nextH = Math.max(targetH, Math.floor(curH / 2));
    const c = makeCanvas(nextW, nextH);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, curW, curH, 0, 0, nextW, nextH);
    current = c;
    curW = nextW;
    curH = nextH;
  }

  const out = makeCanvas(targetW, targetH);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current, 0, 0, curW, curH, 0, 0, out.width, out.height);
  return out;
}

/**
 * The one transform every image tool uses.
 * @param {object} opts
 * @param {File|Blob} opts.file
 * @param {number} [opts.width]   target width in px
 * @param {number} [opts.height]  target height in px
 * @param {{x:number,y:number,w:number,h:number}} [opts.crop] source-pixel crop
 * @param {string} [opts.type]    output mime; defaults to the input type
 * @param {number} [opts.quality] 0–1 for lossy formats
 * @param {string} [opts.background] fill colour when flattening transparency
 */
export async function transformImage(opts) {
  const { file, crop, type, quality = 0.82, background } = opts;
  const decoded = await decodeImage(file);

  try {
    const srcW = crop ? crop.w : decoded.width;
    const srcH = crop ? crop.h : decoded.height;
    const sx = crop ? crop.x : 0;
    const sy = crop ? crop.y : 0;

    let targetW = opts.width ?? srcW;
    let targetH = opts.height ?? srcH;
    targetW = Math.max(1, Math.round(targetW));
    targetH = Math.max(1, Math.round(targetH));

    let canvas = drawScaled(decoded.bitmap, decoded.width, decoded.height, sx, sy, srcW, srcH, targetW, targetH);

    const outType = type || (file.type && EXT_FOR[file.type] ? file.type : MIME.png);

    // JPEG has no alpha: without this, transparent PNGs come out black.
    if (background || outType === MIME.jpeg) {
      const flat = makeCanvas(canvas.width, canvas.height);
      const ctx = flat.getContext('2d');
      ctx.fillStyle = background || '#ffffff';
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(canvas, 0, 0);
      canvas = flat;
    }

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error(`This browser cannot write ${outType}.`)),
        outType,
        outType === MIME.png ? undefined : quality,
      );
    });

    return { blob, width: canvas.width, height: canvas.height, type: blob.type };
  } finally {
    decoded.close();
  }
}

/**
 * Compress toward a size budget by bisecting on quality.
 * Returns the best attempt even when the target cannot be met, so the
 * caller can tell the user honestly rather than silently failing.
 */
export async function compressToTarget(file, { type, targetBytes, maxWidth, minQuality = 0.35, steps = 7 }) {
  let width;
  if (maxWidth) {
    const probe = await decodeImage(file);
    width = probe.width > maxWidth ? maxWidth : undefined;
    probe.close();
  }

  let lo = minQuality;
  let hi = 0.95;
  let best = await transformImage({ file, type, quality: hi, width, height: width ? undefined : undefined });

  if (!targetBytes || best.blob.size <= targetBytes) return { ...best, quality: hi, metTarget: true };

  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const attempt = await transformImage({ file, type, quality: mid, width });
    if (attempt.blob.size > targetBytes) hi = mid;
    else { best = attempt; lo = mid; }
    if (hi - lo < 0.02) break;
  }

  const metTarget = best.blob.size <= targetBytes;
  return { ...best, quality: lo, metTarget };
}

/* ---------------- aspect helpers ---------------- */

export function fitWithin(w, h, maxW, maxH) {
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/* ---------------- EXIF ---------------- */

const EXIF_TAGS = {
  0x010f: 'Camera make', 0x0110: 'Camera model', 0x0112: 'Orientation',
  0x0132: 'Date taken', 0x829a: 'Exposure time', 0x829d: 'F number',
  0x8827: 'ISO', 0x920a: 'Focal length', 0x9003: 'Original date',
  0x010e: 'Description', 0x013b: 'Artist', 0x8298: 'Copyright',
  0x0131: 'Software',
};

/**
 * Read the JPEG APP1/EXIF block. Deliberately small: enough to answer
 * "what is this photo telling people about me", not a full parser.
 * @returns {Promise<{present: boolean, gps: boolean, tags: Array<{name:string,value:string}>, raw: number}>}
 */
export async function readExif(file) {
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  const empty = { present: false, gps: false, tags: [], raw: 0 };

  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return empty;   // not a JPEG

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      const start = offset + 4;
      if (view.getUint32(start) !== 0x45786966) break;                     // "Exif"
      return parseTiff(view, start + 6, size);
    }
    if (marker === 0xda) break;                                            // start of scan
    offset += 2 + size;
  }
  return empty;
}

function parseTiff(view, tiffStart, blockSize) {
  const result = { present: true, gps: false, tags: [], raw: blockSize };
  try {
    const little = view.getUint16(tiffStart) === 0x4949;
    const get16 = (o) => view.getUint16(o, little);
    const get32 = (o) => view.getUint32(o, little);
    if (get16(tiffStart + 2) !== 0x002a) return result;

    const readDir = (dirStart, collect) => {
      const count = get16(dirStart);
      for (let i = 0; i < count; i++) {
        const entry = dirStart + 2 + i * 12;
        if (entry + 12 > view.byteLength) return;
        const tag = get16(entry);
        const type = get16(entry + 2);
        const num = get32(entry + 4);
        const valueOffset = entry + 8;

        if (tag === 0x8825) { result.gps = true; continue; }               // GPS IFD pointer
        if (tag === 0x8769) {                                              // Exif sub-IFD
          const sub = tiffStart + get32(valueOffset);
          if (sub > tiffStart && sub < view.byteLength) readDir(sub, collect);
          continue;
        }
        if (!collect[tag]) continue;

        let value = '';
        const dataOffset = (type === 2 && num > 4) || (type === 5) || (type === 10)
          ? tiffStart + get32(valueOffset)
          : valueOffset;
        if (dataOffset >= view.byteLength) continue;

        if (type === 2) {                                                  // ASCII
          let s = '';
          for (let c = 0; c < Math.min(num, 64); c++) {
            const ch = view.getUint8(dataOffset + c);
            if (!ch) break;
            s += String.fromCharCode(ch);
          }
          value = s.trim();
        } else if (type === 3) value = String(get16(dataOffset));
        else if (type === 4) value = String(get32(dataOffset));
        else if (type === 5 || type === 10) {
          const n = type === 5 ? get32(dataOffset) : view.getInt32(dataOffset, little);
          const d = type === 5 ? get32(dataOffset + 4) : view.getInt32(dataOffset + 4, little);
          if (d) value = String(Math.round((n / d) * 1000) / 1000);
        }
        if (value) result.tags.push({ name: collect[tag], value });
      }
    };

    readDir(tiffStart + get32(tiffStart + 4), EXIF_TAGS);
  } catch { /* a malformed block is not worth surfacing as an error */ }
  return result;
}

/* ---------------- output ---------------- */

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function renameExt(filename, ext, suffix = '') {
  const base = String(filename).replace(/\.[^.]+$/, '') || 'file';
  return `${base}${suffix}.${ext}`;
}

/* ---------------- drop zone & upload pipeline ---------------- */

/**
 * Builds a robust file filter predicate from a regex, MIME string, or file extensions list.
 * Supports ".pdf,.txt,.doc", "image/*", /pdf/i, etc.
 */
export function buildAcceptFilter(accept) {
  if (!accept) return () => true;
  if (accept instanceof RegExp) {
    return (f) => accept.test(f.type || '') || accept.test(f.name || '');
  }
  if (typeof accept === 'string') {
    const tokens = accept.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (!tokens.length || tokens.includes('*/*')) return () => true;
    return (f) => {
      const type = (f.type || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      return tokens.some(token => {
        if (token.startsWith('.')) {
          return name.endsWith(token);
        }
        if (token.endsWith('/*')) {
          const prefix = token.slice(0, -1); // e.g. "image/"
          return type.startsWith(prefix);
        }
        return type === token || name.endsWith(`.${token}`);
      });
    };
  }
  return () => true;
}

/**
 * Wire a drop zone, file picker and clipboard paste to one handler.
 * Automatically infers accept filter from input.accept attribute if not explicitly passed.
 * Returns a teardown so tools can clean up in destroy().
 */
export function attachFileInput(zone, input, onFiles, options = {}) {
  const acceptAttr = options.accept !== undefined ? options.accept : input?.getAttribute('accept');
  const isAccepted = buildAcceptFilter(acceptAttr);

  const filter = (list) => {
    const all = [...list];
    const matching = all.filter(isAccepted);
    // If filter dropped everything but files were provided, warn or fallback to all files
    if (all.length > 0 && matching.length === 0) {
      console.warn(`[Toolbox Upload] Files dropped did not match filter "${acceptAttr}".`, all.map(f => `${f.name} (${f.type})`));
    }
    return matching.length > 0 ? matching : all;
  };

  const dispatch = async (files) => {
    if (!files || !files.length) return;
    try {
      zone.classList.add('is-loading');
      const result = onFiles(files);
      if (result instanceof Promise) {
        await result;
      }
    } catch (err) {
      console.error('[Toolbox Upload Error]', err);
      alert(`Could not process file: ${err.message || err}`);
    } finally {
      zone.classList.remove('is-loading');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    zone.classList.remove('is-dragging');
    const files = filter(e.dataTransfer?.files ?? []);
    if (files.length) dispatch(files);
  };
  const onDragOver = (e) => { e.preventDefault(); zone.classList.add('is-dragging'); };
  const onDragLeave = () => zone.classList.remove('is-dragging');
  const onChange = () => {
    const files = filter(input.files ?? []);
    if (files.length) dispatch(files);
    input.value = '';
  };
  const onClick = (e) => { if (!e.target.closest('button, a, input')) input.click(); };
  // The zone behaves like a button, so it has to answer to a keyboard too.
  const onKeydown = (e) => {
    if (e.target !== zone) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    input.click();
  };
  const onPaste = (e) => {
    const files = filter(e.clipboardData?.files ?? []);
    if (files.length) dispatch(files);
  };

  zone.addEventListener('drop', onDrop);
  zone.addEventListener('dragover', onDragOver);
  zone.addEventListener('dragleave', onDragLeave);
  zone.addEventListener('click', onClick);
  zone.addEventListener('keydown', onKeydown);
  if (input) input.addEventListener('change', onChange);
  window.addEventListener('paste', onPaste);

  return () => {
    zone.removeEventListener('drop', onDrop);
    zone.removeEventListener('dragover', onDragOver);
    zone.removeEventListener('dragleave', onDragLeave);
    zone.removeEventListener('click', onClick);
    zone.removeEventListener('keydown', onKeydown);
    if (input) input.removeEventListener('change', onChange);
    window.removeEventListener('paste', onPaste);
  };
}

/** Standard drop-zone markup so every file tool looks and behaves alike. */
export function dropZone(id, { label = 'Drop files here', hint = 'or click to choose · you can also paste', accept = 'image/*', multiple = true } = {}) {
  return `
    <div class="fz" id="${id}" role="button" tabindex="0" aria-label="${label}">
      <input type="file" id="${id}-input" accept="${accept}" ${multiple ? 'multiple' : ''} hidden>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="16"/>
      </svg>
      <strong>${label}</strong>
      <span>${hint}</span>
      <em class="fz-private">Processed on your device — nothing is uploaded</em>
    </div>`;
}
