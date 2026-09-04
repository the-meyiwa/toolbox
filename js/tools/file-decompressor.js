/* ============================================================
   TOOLBOX — File Decompressor & Archive Extractor
   Inspect and unpack ZIP, TAR, GZ, and TGZ archives in-browser.
   Preview file contents, search inside archives, and extract files.
   ============================================================ */

export default {
  render(container) {
    let extractedEntries = [];

    container.innerHTML = `
      <div class="tool-section">
        <div class="compressor-dropzone" id="decomp-dropzone">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--g500); margin-bottom:8px;">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:4px;">Drag & Drop an archive file to open</div>
          <div style="font-size:0.78rem; color:var(--g500);">Supported formats: .zip, .tar, .gz, .tgz</div>
          <input type="file" id="decomp-file-input" accept=".zip,.tar,.gz,.tgz,application/zip,application/x-tar,application/gzip" style="display:none;">
          <div style="margin-top:12px;">
            <button type="button" class="btn btn-secondary btn-sm" id="decomp-choose-btn">Choose Archive</button>
          </div>
        </div>

        <!-- Archive Explorer -->
        <div id="decomp-explorer" style="display:none; margin-top:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 id="decomp-archive-title" style="margin:0; font-size:1rem; font-weight:600;">Archive Content</h3>
              <span id="decomp-archive-meta" style="font-size:0.78rem; color:var(--g500);"></span>
            </div>
            <div style="display:flex; gap:8px;">
              <input type="text" id="decomp-search" class="tool-input" placeholder="Search files in archive..." style="width:200px; font-size:0.82rem; padding:6px 10px;">
              <button type="button" class="btn btn-primary btn-sm" id="decomp-download-all">Download All Files</button>
            </div>
          </div>

          <!-- File Table -->
          <div style="border:1px solid var(--g200); border-radius:10px; overflow:hidden; background:var(--white);">
            <table class="calc-table" style="margin:0;">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Compressed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="decomp-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- File Preview Modal/Box -->
        <div id="decomp-preview-box" style="display:none; margin-top:16px; padding:14px; background:var(--g50); border:1px solid var(--g200); border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong id="decomp-prev-name" style="font-size:0.88rem;"></strong>
            <button type="button" id="decomp-prev-close" style="background:none; border:none; color:var(--g500); cursor:pointer; font-size:1.1rem;">&times;</button>
          </div>
          <div id="decomp-prev-content" style="max-height:260px; overflow:auto; font-family:var(--mono); font-size:0.82rem; white-space:pre-wrap; background:var(--white); padding:10px; border-radius:6px; border:1px solid var(--g150);"></div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#decomp-dropzone');
    const fileInput = container.querySelector('#decomp-file-input');
    const chooseBtn = container.querySelector('#decomp-choose-btn');
    const explorerEl = container.querySelector('#decomp-explorer');
    const titleEl = container.querySelector('#decomp-archive-title');
    const metaEl = container.querySelector('#decomp-archive-meta');
    const tbodyEl = container.querySelector('#decomp-tbody');
    const searchInput = container.querySelector('#decomp-search');
    const downloadAllBtn = container.querySelector('#decomp-download-all');
    const previewBox = container.querySelector('#decomp-preview-box');
    const prevNameEl = container.querySelector('#decomp-prev-name');
    const prevContentEl = container.querySelector('#decomp-prev-content');
    const prevCloseBtn = container.querySelector('#decomp-prev-close');

    chooseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) processArchive(e.target.files[0]);
    });

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
      if (e.dataTransfer.files?.[0]) processArchive(e.dataTransfer.files[0]);
    });

    prevCloseBtn.addEventListener('click', () => {
      previewBox.style.display = 'none';
    });

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }

    async function processArchive(file) {
      titleEl.textContent = file.name;
      metaEl.textContent = `Reading archive (${formatBytes(file.size)})...`;
      explorerEl.style.display = 'block';

      try {
        const buffer = await file.arrayBuffer();
        extractedEntries = [];

        if (file.name.endsWith('.zip') || isZip(buffer)) {
          extractedEntries = await parseZip(buffer);
        } else if (file.name.endsWith('.tar') || isTar(buffer)) {
          extractedEntries = parseTar(buffer);
        } else if (file.name.endsWith('.gz') || file.name.endsWith('.tgz')) {
          const ds = new DecompressionStream('gzip');
          const writer = ds.writable.getWriter();
          writer.write(new Uint8Array(buffer));
          writer.close();
          const uncompressed = await new Response(ds.readable).arrayBuffer();
          if (file.name.endsWith('.tgz') || isTar(uncompressed)) {
            extractedEntries = parseTar(uncompressed);
          } else {
            const outName = file.name.replace(/\.gz$/, '') || 'extracted_file';
            extractedEntries = [{
              name: outName,
              size: uncompressed.byteLength,
              compressedSize: file.size,
              data: new Uint8Array(uncompressed)
            }];
          }
        } else {
          // Attempt zip fallback
          extractedEntries = await parseZip(buffer);
        }

        metaEl.textContent = `${extractedEntries.length} file${extractedEntries.length === 1 ? '' : 's'} inside archive`;
        renderTable(extractedEntries);
      } catch (err) {
        metaEl.textContent = `Failed to decompress archive: ${err.message}`;
        tbodyEl.innerHTML = `<tr><td colspan="4" style="color:red; padding:16px;">Error parsing archive format.</td></tr>`;
      }
    }

    function renderTable(entries) {
      const q = searchInput.value.toLowerCase().trim();
      const filtered = q ? entries.filter(e => e.name.toLowerCase().includes(q)) : entries;

      if (!filtered.length) {
        tbodyEl.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--g500);">No matching files found.</td></tr>`;
        return;
      }

      tbodyEl.innerHTML = filtered.map((item, idx) => `
        <tr>
          <td><strong style="word-break:break-all;">${item.name}</strong></td>
          <td>${formatBytes(item.size)}</td>
          <td>${formatBytes(item.compressedSize || item.size)}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-secondary btn-sm decomp-preview-btn" data-idx="${idx}">Preview</button>
              <button type="button" class="btn btn-primary btn-sm decomp-download-btn" data-idx="${idx}">Download</button>
            </div>
          </td>
        </tr>
      `).join('');

      tbodyEl.querySelectorAll('.decomp-download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = filtered[parseInt(btn.dataset.idx, 10)];
          if (item?.data) {
            const blob = new Blob([item.data]);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = item.name.split('/').pop() || 'download';
            a.click();
            URL.revokeObjectURL(a.href);
          }
        });
      });

      tbodyEl.querySelectorAll('.decomp-preview-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = filtered[parseInt(btn.dataset.idx, 10)];
          if (item?.data) {
            prevNameEl.textContent = item.name;
            try {
              const text = new TextDecoder('utf-8').decode(item.data.slice(0, 100000));
              prevContentEl.textContent = text;
            } catch {
              prevContentEl.textContent = `[Binary file preview not available - Size: ${formatBytes(item.size)}]`;
            }
            previewBox.style.display = 'block';
            previewBox.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });
    }

    searchInput.addEventListener('input', () => renderTable(extractedEntries));

    downloadAllBtn.addEventListener('click', () => {
      extractedEntries.forEach(item => {
        if (item.data) {
          const blob = new Blob([item.data]);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = item.name.split('/').pop() || 'download';
          a.click();
          URL.revokeObjectURL(a.href);
        }
      });
    });
  }
};

/* ============================================================
   Pure Binary PKZIP (ZIP) Extractor
   ============================================================ */
function isZip(buffer) {
  if (buffer.byteLength < 4) return false;
  const view = new DataView(buffer);
  return view.getUint32(0, true) === 0x04034b50;
}

async function parseZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let entries = [];
  let pos = 0;

  while (pos < bytes.length - 4) {
    const sig = view.getUint32(pos, true);
    if (sig === 0x04034b50) { // Local File Header
      const method = view.getUint16(pos + 8, true);
      const compSize = view.getUint32(pos + 18, true);
      const uncompSize = view.getUint32(pos + 22, true);
      const nameLen = view.getUint16(pos + 26, true);
      const extraLen = view.getUint16(pos + 28, true);

      const nameBytes = bytes.slice(pos + 30, pos + 30 + nameLen);
      const name = new TextDecoder().decode(nameBytes);

      const dataOffset = pos + 30 + nameLen + extraLen;
      const compData = bytes.slice(dataOffset, dataOffset + compSize);

      let decompressed = compData;
      if (method === 8) { // Deflate
        try {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compData);
          writer.close();
          const buf = await new Response(ds.readable).arrayBuffer();
          decompressed = new Uint8Array(buf);
        } catch {}
      }

      if (!name.endsWith('/')) {
        entries.push({
          name,
          size: uncompSize || decompressed.length,
          compressedSize: compSize,
          data: decompressed
        });
      }

      pos = dataOffset + compSize;
    } else if (sig === 0x02014b50 || sig === 0x06054b50) {
      break;
    } else {
      pos++;
    }
  }

  return entries;
}

/* ============================================================
   Pure Binary TAR Extractor (POSIX ustar)
   ============================================================ */
function isTar(buffer) {
  if (buffer.byteLength < 512) return false;
  const bytes = new Uint8Array(buffer);
  const magic = new TextDecoder().decode(bytes.slice(257, 262));
  return magic === 'ustar';
}

function parseTar(buffer) {
  const bytes = new Uint8Array(buffer);
  let entries = [];
  let offset = 0;

  while (offset + 512 <= bytes.length) {
    const header = bytes.slice(offset, offset + 512);
    // Check if header is empty (all zeros)
    if (header.every(b => b === 0)) break;

    const name = new TextDecoder().decode(header.slice(0, 100)).replace(/\0.*$/, '').trim();
    if (!name) break;

    const sizeStr = new TextDecoder().decode(header.slice(124, 136)).replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const typeFlag = String.fromCharCode(header[156] || 48);

    offset += 512;
    if (typeFlag === '0' || typeFlag === '\0') {
      const data = bytes.slice(offset, offset + size);
      entries.push({
        name,
        size,
        compressedSize: size,
        data
      });
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}
