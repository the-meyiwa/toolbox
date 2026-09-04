/* ============================================================
   TOOLBOX — File Compressor
   Compress single or multiple files and folders into ZIP, TAR,
   and GZ archives with compression settings and instant download.
   ============================================================ */

export default {
  render(container) {
    let filesToCompress = [];

    container.innerHTML = `
      <div class="tool-section">
        <div class="compressor-dropzone" id="comp-dropzone">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--g500); margin-bottom:8px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:4px;">Drag & Drop files or click to browse</div>
          <div style="font-size:0.78rem; color:var(--g500);">Supports all file types (documents, images, audio, video, code)</div>
          <input type="file" id="comp-file-input" multiple style="display:none;">
          <div style="margin-top:12px; display:flex; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="comp-choose-btn">Choose Files</button>
            <button type="button" class="btn btn-secondary btn-sm" id="comp-clear-btn" style="display:none;">Clear List</button>
          </div>
        </div>

        <!-- File List & Options -->
        <div id="comp-options-area" style="display:none; margin-top:18px;">
          <div class="tool-row" style="margin-bottom:14px; flex-wrap:wrap; gap:12px;">
            <div style="flex:1; min-width:180px;">
              <label class="tool-label">Archive Name</label>
              <input type="text" class="tool-input" id="comp-archive-name" value="archive.zip">
            </div>
            <div style="width:160px;">
              <label class="tool-label">Format</label>
              <select class="tool-input" id="comp-format">
                <option value="zip" selected>ZIP (.zip)</option>
                <option value="tar">TAR (.tar)</option>
                <option value="gz">GZIP (.gz - 1st file)</option>
              </select>
            </div>
          </div>

          <!-- Files Table -->
          <div style="border:1px solid var(--g200); border-radius:10px; overflow:hidden; background:var(--white); margin-bottom:14px;">
            <div style="padding:10px 14px; background:var(--g50); border-bottom:1px solid var(--g200); font-weight:600; font-size:0.82rem; display:flex; justify-content:space-between;">
              <span id="comp-files-count">0 Files Selected</span>
              <span id="comp-total-raw-size">Total: 0 KB</span>
            </div>
            <div id="comp-file-list" style="max-height:220px; overflow-y:auto; font-size:0.82rem; font-family:var(--mono);"></div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div id="comp-stats" style="font-size:0.84rem; color:var(--g600);"></div>
            <button type="button" class="btn btn-primary" id="comp-start-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Compress & Download
            </button>
          </div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#comp-dropzone');
    const fileInput = container.querySelector('#comp-file-input');
    const chooseBtn = container.querySelector('#comp-choose-btn');
    const clearBtn = container.querySelector('#comp-clear-btn');
    const optionsArea = container.querySelector('#comp-options-area');
    const fileListEl = container.querySelector('#comp-file-list');
    const filesCountEl = container.querySelector('#comp-files-count');
    const rawSizeEl = container.querySelector('#comp-total-raw-size');
    const startBtn = container.querySelector('#comp-start-btn');
    const statsEl = container.querySelector('#comp-stats');

    chooseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--black)';
      dropzone.style.background = 'var(--g100)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--g300)';
      dropzone.style.background = 'var(--white)';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--g300)';
      dropzone.style.background = 'var(--white)';
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });

    clearBtn.addEventListener('click', () => {
      filesToCompress = [];
      updateList();
    });

    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }

    function handleFiles(files) {
      for (const file of files) {
        filesToCompress.push(file);
      }
      updateList();
    }

    function updateList() {
      if (!filesToCompress.length) {
        optionsArea.style.display = 'none';
        clearBtn.style.display = 'none';
        return;
      }

      optionsArea.style.display = 'block';
      clearBtn.style.display = 'inline-flex';
      filesCountEl.textContent = `${filesToCompress.length} File${filesToCompress.length === 1 ? '' : 's'} Selected`;

      const totalBytes = filesToCompress.reduce((acc, f) => acc + f.size, 0);
      rawSizeEl.textContent = `Total: ${formatBytes(totalBytes)}`;

      fileListEl.innerHTML = filesToCompress.map((f, i) => `
        <div style="padding:6px 14px; border-bottom:1px solid var(--g150); display:flex; justify-content:space-between; align-items:center;">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">${f.name}</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="color:var(--g500);">${formatBytes(f.size)}</span>
            <button type="button" class="comp-remove-file" data-idx="${i}" style="background:none; border:none; color:var(--g400); cursor:pointer; font-size:1rem;">&times;</button>
          </div>
        </div>
      `).join('');

      fileListEl.querySelectorAll('.comp-remove-file').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          filesToCompress.splice(idx, 1);
          updateList();
        });
      });
    }

    startBtn.addEventListener('click', async () => {
      if (!filesToCompress.length) return;

      const format = container.querySelector('#comp-format').value;
      let archiveName = container.querySelector('#comp-archive-name').value.trim() || 'archive';

      startBtn.disabled = true;
      startBtn.textContent = 'Compressing...';
      statsEl.textContent = 'Reading files and packaging archive...';

      try {
        let blob;
        if (format === 'zip') {
          blob = await createZipArchive(filesToCompress);
          if (!archiveName.endsWith('.zip')) archiveName += '.zip';
        } else if (format === 'tar') {
          blob = await createTarArchive(filesToCompress);
          if (!archiveName.endsWith('.tar')) archiveName += '.tar';
        } else if (format === 'gz') {
          const file = filesToCompress[0];
          const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
          blob = await new Response(stream).blob();
          if (!archiveName.endsWith('.gz')) archiveName += '.gz';
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = archiveName;
        a.click();
        URL.revokeObjectURL(url);

        const originalTotal = filesToCompress.reduce((s, f) => s + f.size, 0);
        const compRatio = originalTotal > 0 ? (((originalTotal - blob.size) / originalTotal) * 100).toFixed(1) : 0;
        statsEl.innerHTML = `Created <strong>${archiveName}</strong> (${formatBytes(blob.size)}) - <strong>${compRatio}% space saved</strong>`;
      } catch (err) {
        statsEl.textContent = `Compression error: ${err.message}`;
      } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Compress & Download
        `;
      }
    });
  }
};

/* ============================================================
   Lightweight standard PKZIP (Zip) Binary Generator
   ============================================================ */
async function createZipArchive(files) {
  let fileEntries = [];
  let offset = 0;

  for (const file of files) {
    const data = new Uint8Array(await file.arrayBuffer());
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = computeCRC32(data);

    // Try Deflate compression via CompressionStream
    let compressedData = data;
    let method = 0; // 0 = stored, 8 = deflated

    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(data);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      const comp = new Uint8Array(buf);
      if (comp.length < data.length) {
        compressedData = comp;
        method = 8;
      }
    } catch {}

    // Local Header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Local header signature
    view.setUint16(4, 20, true);         // Version needed
    view.setUint16(6, 0, true);          // Bit flag
    view.setUint16(8, method, true);     // Compression method
    view.setUint16(10, 0, true);         // Mod time
    view.setUint16(12, 0, true);         // Mod date
    view.setUint32(14, crc, true);        // CRC-32
    view.setUint32(18, compressedData.length, true); // Comp size
    view.setUint32(22, data.length, true);           // Uncomp size
    view.setUint16(26, nameBytes.length, true);      // File name len
    view.setUint16(28, 0, true);                     // Extra field len
    localHeader.set(nameBytes, 30);

    fileEntries.push({
      nameBytes,
      crc,
      method,
      compressedData,
      uncompressedSize: data.length,
      localHeader,
      offset
    });

    offset += localHeader.length + compressedData.length;
  }

  // Central Directory
  let centralDirParts = [];
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    const cd = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(cd.buffer);

    view.setUint32(0, 0x02014b50, true); // Central dir signature
    view.setUint16(4, 20, true);         // Version made by
    view.setUint16(6, 20, true);         // Version needed
    view.setUint16(8, 0, true);          // Bit flag
    view.setUint16(10, entry.method, true); // Compression method
    view.setUint16(12, 0, true);         // Mod time
    view.setUint16(14, 0, true);         // Mod date
    view.setUint32(16, entry.crc, true); // CRC-32
    view.setUint32(20, entry.compressedData.length, true); // Comp size
    view.setUint32(24, entry.uncompressedSize, true);     // Uncomp size
    view.setUint16(28, entry.nameBytes.length, true);     // Name length
    view.setUint16(30, 0, true);         // Extra field length
    view.setUint16(32, 0, true);         // Comment length
    view.setUint16(34, 0, true);         // Disk number
    view.setUint16(36, 0, true);         // Internal attributes
    view.setUint32(38, 0, true);         // External attributes
    view.setUint32(42, entry.offset, true); // Relative offset
    cd.set(entry.nameBytes, 46);

    centralDirParts.push(cd);
    centralDirSize += cd.length;
  }

  // End of Central Directory Record
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true);          // Disk number
  eocdView.setUint16(6, 0, true);          // CD start disk
  eocdView.setUint16(8, fileEntries.length, true);  // Disk records
  eocdView.setUint16(10, fileEntries.length, true); // Total records
  eocdView.setUint32(12, centralDirSize, true);     // Size of CD
  eocdView.setUint32(16, offset, true);             // Offset of CD
  eocdView.setUint16(20, 0, true);                  // Comment len

  let allBlobs = [];
  for (const entry of fileEntries) {
    allBlobs.push(entry.localHeader);
    allBlobs.push(entry.compressedData);
  }
  for (const cd of centralDirParts) {
    allBlobs.push(cd);
  }
  allBlobs.push(eocd);

  return new Blob(allBlobs, { type: 'application/zip' });
}

/* ============================================================
   Standard TAR Archive Generator (POSIX ustar)
   ============================================================ */
async function createTarArchive(files) {
  let chunks = [];

  for (const file of files) {
    const data = new Uint8Array(await file.arrayBuffer());
    const header = new Uint8Array(512);

    // File name
    const nameBytes = new TextEncoder().encode(file.name.slice(0, 99));
    header.set(nameBytes, 0);

    // File mode (644)
    writeOctal(header, 100, 8, 0o644);
    // UID
    writeOctal(header, 108, 8, 0);
    // GID
    writeOctal(header, 116, 8, 0);
    // Size
    writeOctal(header, 124, 12, data.length);
    // Mtime
    writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    // Typeflag ('0' = regular file)
    header[156] = 48;
    // Magic 'ustar\0'
    header.set([117, 115, 116, 97, 114, 0], 257);
    // Version '00'
    header.set([48, 48], 263);

    // Compute Checksum
    header.fill(32, 148, 156);
    let chk = header.reduce((acc, b) => acc + b, 0);
    writeOctal(header, 148, 8, chk);

    chunks.push(header);
    chunks.push(data);

    // Pad file to 512 bytes
    const rem = data.length % 512;
    if (rem > 0) {
      chunks.push(new Uint8Array(512 - rem));
    }
  }

  // End of archive marker (1024 zero bytes)
  chunks.push(new Uint8Array(1024));
  return new Blob(chunks, { type: 'application/x-tar' });
}

function writeOctal(buf, offset, len, val) {
  const str = val.toString(8).padStart(len - 1, '0') + '\0';
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

function computeCRC32(bytes) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}
