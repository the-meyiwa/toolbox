/* ============================================================
   TOOLBOX — Audio Tag & MP3 Editor
   Edit MP3 ID3 metadata (Title, Artist, Album, Year, Genre, Lyrics)
   and embed custom Album Artwork images directly into audio files.
   ============================================================ */

export default {
  render(container) {
    let currentAudioBytes = null;
    let originalFileName = 'track.mp3';
    let artworkBytes = null;
    let artworkMime = 'image/jpeg';
    let audioUrl = null;

    container.innerHTML = `
      <div class="tool-section">
        <div class="compressor-dropzone" id="tag-dropzone">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--g500); margin-bottom:8px;">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:4px;">Drag & Drop an MP3 or Audio file</div>
          <div style="font-size:0.78rem; color:var(--g500);">Reads and writes ID3v2 tags with embedded album artwork</div>
          <input type="file" id="tag-file-input" accept="audio/mp3,audio/mpeg,.mp3" style="display:none;">
          <div style="margin-top:12px;">
            <button type="button" class="btn btn-secondary btn-sm" id="tag-choose-btn">Choose Audio File</button>
          </div>
        </div>

        <!-- Tag Editor Workspace -->
        <div id="tag-workspace" style="display:none; margin-top:18px;">
          <!-- Audio Player Preview -->
          <div style="padding:14px; background:var(--g50); border:1px solid var(--g200); border-radius:12px; margin-bottom:16px; display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <audio id="tag-audio-player" controls style="flex:1; min-width:240px; height:36px;"></audio>
            <span id="tag-file-info" style="font-size:0.8rem; font-family:var(--mono); color:var(--g600);"></span>
          </div>

          <div style="display:grid; grid-template-columns:220px 1fr; gap:20px;">
            <!-- Album Artwork Column -->
            <div style="display:flex; flex-direction:column; gap:10px; align-items:center;">
              <div id="tag-art-preview" style="width:200px; height:200px; border-radius:12px; border:2px dashed var(--g200); background:var(--g50); display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; position:relative; cursor:pointer;" title="Click to change artwork">
                <span id="tag-art-placeholder" style="font-size:0.75rem; color:var(--g400); text-align:center; padding:10px;">No Cover Art<br><span style="font-size:0.68rem;">Click to upload</span></span>
                <img id="tag-art-img" style="width:100%; height:100%; object-fit:cover; display:none;">
              </div>
              <input type="file" id="tag-art-input" accept="image/jpeg,image/png,image/webp" style="display:none;">
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-secondary btn-sm" id="tag-change-art-btn">Change Artwork</button>
                <button type="button" class="btn btn-secondary btn-sm" id="tag-remove-art-btn" style="display:none;">Remove</button>
              </div>
            </div>

            <!-- Metadata Form Fields -->
            <div style="display:flex; flex-direction:column; gap:10px;">
              <div class="calc-form-grid-2">
                <div>
                  <label class="calc-label">Track Title (TIT2)</label>
                  <input type="text" id="tag-title" class="tool-input" placeholder="e.g. Bohemian Rhapsody">
                </div>
                <div>
                  <label class="calc-label">Artist / Performer (TPE1)</label>
                  <input type="text" id="tag-artist" class="tool-input" placeholder="e.g. Queen">
                </div>
              </div>

              <div class="calc-form-grid-2">
                <div>
                  <label class="calc-label">Album (TALB)</label>
                  <input type="text" id="tag-album" class="tool-input" placeholder="e.g. A Night at the Opera">
                </div>
                <div>
                  <label class="calc-label">Album Artist (TPE2)</label>
                  <input type="text" id="tag-album-artist" class="tool-input" placeholder="e.g. Queen">
                </div>
              </div>

              <div class="calc-form-grid-3">
                <div>
                  <label class="calc-label">Year (TYER)</label>
                  <input type="number" id="tag-year" class="tool-input" placeholder="e.g. 1975">
                </div>
                <div>
                  <label class="calc-label">Track # (TRCK)</label>
                  <input type="text" id="tag-track" class="tool-input" placeholder="e.g. 11/12">
                </div>
                <div>
                  <label class="calc-label">Genre (TCON)</label>
                  <input type="text" id="tag-genre" class="tool-input" placeholder="e.g. Rock">
                </div>
              </div>

              <div>
                <label class="calc-label">Lyrics (USLT)</label>
                <textarea id="tag-lyrics" class="tool-input" rows="4" placeholder="Enter song lyrics here..."></textarea>
              </div>
            </div>
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-primary" id="tag-save-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Save & Download Tagged MP3
            </button>
          </div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#tag-dropzone');
    const fileInput = container.querySelector('#tag-file-input');
    const chooseBtn = container.querySelector('#tag-choose-btn');
    const workspace = container.querySelector('#tag-workspace');
    const audioPlayer = container.querySelector('#tag-audio-player');
    const fileInfo = container.querySelector('#tag-file-info');
    const artPreview = container.querySelector('#tag-art-preview');
    const artInput = container.querySelector('#tag-art-input');
    const artImg = container.querySelector('#tag-art-img');
    const artPlaceholder = container.querySelector('#tag-art-placeholder');
    const changeArtBtn = container.querySelector('#tag-change-art-btn');
    const removeArtBtn = container.querySelector('#tag-remove-art-btn');
    const saveBtn = container.querySelector('#tag-save-btn');

    chooseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) loadAudioFile(e.target.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--black)';
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--g300)';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--g300)';
      if (e.dataTransfer.files?.[0]) loadAudioFile(e.dataTransfer.files[0]);
    });

    artPreview.addEventListener('click', () => artInput.click());
    changeArtBtn.addEventListener('click', () => artInput.click());
    artInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) loadArtworkFile(e.target.files[0]);
    });

    removeArtBtn.addEventListener('click', () => {
      artworkBytes = null;
      artImg.style.display = 'none';
      artPlaceholder.style.display = 'block';
      removeArtBtn.style.display = 'none';
    });

    async function loadArtworkFile(file) {
      artworkMime = file.type || 'image/jpeg';
      artworkBytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(file);
      artImg.src = url;
      artImg.style.display = 'block';
      artPlaceholder.style.display = 'none';
      removeArtBtn.style.display = 'inline-flex';
    }

    async function loadAudioFile(file) {
      originalFileName = file.name;
      currentAudioBytes = new Uint8Array(await file.arrayBuffer());

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(file);
      audioPlayer.src = audioUrl;

      fileInfo.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
      workspace.style.display = 'block';

      // Parse existing ID3v2 tags
      const tags = parseID3v2(currentAudioBytes);
      container.querySelector('#tag-title').value = tags.title || file.name.replace(/\.[^/.]+$/, '');
      container.querySelector('#tag-artist').value = tags.artist || '';
      container.querySelector('#tag-album').value = tags.album || '';
      container.querySelector('#tag-album-artist').value = tags.albumArtist || '';
      container.querySelector('#tag-year').value = tags.year || '';
      container.querySelector('#tag-track').value = tags.track || '';
      container.querySelector('#tag-genre').value = tags.genre || '';
      container.querySelector('#tag-lyrics').value = tags.lyrics || '';

      if (tags.artwork) {
        artworkBytes = tags.artwork.data;
        artworkMime = tags.artwork.mime;
        const blob = new Blob([artworkBytes], { type: artworkMime });
        artImg.src = URL.createObjectURL(blob);
        artImg.style.display = 'block';
        artPlaceholder.style.display = 'none';
        removeArtBtn.style.display = 'inline-flex';
      } else {
        artworkBytes = null;
        artImg.style.display = 'none';
        artPlaceholder.style.display = 'block';
        removeArtBtn.style.display = 'none';
      }
    }

    saveBtn.addEventListener('click', () => {
      if (!currentAudioBytes) return;

      const tags = {
        title: container.querySelector('#tag-title').value.trim(),
        artist: container.querySelector('#tag-artist').value.trim(),
        album: container.querySelector('#tag-album').value.trim(),
        albumArtist: container.querySelector('#tag-album-artist').value.trim(),
        year: container.querySelector('#tag-year').value.trim(),
        track: container.querySelector('#tag-track').value.trim(),
        genre: container.querySelector('#tag-genre').value.trim(),
        lyrics: container.querySelector('#tag-lyrics').value.trim(),
        artwork: artworkBytes ? { data: artworkBytes, mime: artworkMime } : null
      };

      const taggedBuffer = writeID3v2(currentAudioBytes, tags);
      const blob = new Blob([taggedBuffer], { type: 'audio/mpeg' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = originalFileName.endsWith('.mp3') ? originalFileName : `${originalFileName}.mp3`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
};

/* ============================================================
   ID3v2.3 Tag Reader & Writer
   ============================================================ */
function parseID3v2(bytes) {
  let tags = {};
  if (bytes.length < 10) return tags;

  // Header 'ID3'
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const tagSize = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
    let pos = 10;

    while (pos < tagSize + 10 && pos + 10 <= bytes.length) {
      const frameId = new TextDecoder('latin1').decode(bytes.slice(pos, pos + 4));
      if (!frameId || frameId.charCodeAt(0) === 0) break;

      const frameSize = (bytes[pos + 4] << 24) | (bytes[pos + 5] << 16) | (bytes[pos + 6] << 8) | bytes[pos + 7];
      if (frameSize <= 0 || pos + 10 + frameSize > bytes.length) break;

      const frameData = bytes.slice(pos + 10, pos + 10 + frameSize);

      if (frameId === 'TIT2') tags.title = decodeTextFrame(frameData);
      if (frameId === 'TPE1') tags.artist = decodeTextFrame(frameData);
      if (frameId === 'TALB') tags.album = decodeTextFrame(frameData);
      if (frameId === 'TPE2') tags.albumArtist = decodeTextFrame(frameData);
      if (frameId === 'TYER' || frameId === 'TDRC') tags.year = decodeTextFrame(frameData);
      if (frameId === 'TRCK') tags.track = decodeTextFrame(frameData);
      if (frameId === 'TCON') tags.genre = decodeTextFrame(frameData);
      if (frameId === 'USLT') tags.lyrics = decodeLyricsFrame(frameData);
      if (frameId === 'APIC') tags.artwork = decodeApicFrame(frameData);

      pos += 10 + frameSize;
    }
  }

  return tags;
}

function decodeTextFrame(data) {
  if (data.length < 2) return '';
  const encoding = data[0];
  const body = data.slice(1);
  if (encoding === 0) return new TextDecoder('latin1').decode(body).replace(/\0.*$/, '');
  return new TextDecoder('utf-8').decode(body).replace(/\0.*$/, '');
}

function decodeLyricsFrame(data) {
  if (data.length < 5) return '';
  let pos = 4; // Skip encoding(1) + lang(3)
  while (pos < data.length && data[pos] !== 0) pos++; // Skip descriptor
  pos++;
  return new TextDecoder('utf-8').decode(data.slice(pos)).replace(/\0.*$/, '');
}

function decodeApicFrame(data) {
  if (data.length < 5) return null;
  let pos = 1;
  let mime = '';
  while (pos < data.length && data[pos] !== 0) {
    mime += String.fromCharCode(data[pos]);
    pos++;
  }
  pos++; // Skip null
  pos++; // Skip pic type
  while (pos < data.length && data[pos] !== 0) pos++; // Skip desc null
  pos++;
  return { mime: mime || 'image/jpeg', data: data.slice(pos) };
}

function writeID3v2(audioBytes, tags) {
  // Strip existing ID3v2 tag if present
  let rawAudio = audioBytes;
  if (audioBytes[0] === 0x49 && audioBytes[1] === 0x44 && audioBytes[2] === 0x33) {
    const existingSize = ((audioBytes[6] & 0x7F) << 21) | ((audioBytes[7] & 0x7F) << 14) | ((audioBytes[8] & 0x7F) << 7) | (audioBytes[9] & 0x7F);
    rawAudio = audioBytes.slice(10 + existingSize);
  }

  let frames = [];

  if (tags.title) frames.push(buildTextFrame('TIT2', tags.title));
  if (tags.artist) frames.push(buildTextFrame('TPE1', tags.artist));
  if (tags.album) frames.push(buildTextFrame('TALB', tags.album));
  if (tags.albumArtist) frames.push(buildTextFrame('TPE2', tags.albumArtist));
  if (tags.year) frames.push(buildTextFrame('TYER', tags.year));
  if (tags.track) frames.push(buildTextFrame('TRCK', tags.track));
  if (tags.genre) frames.push(buildTextFrame('TCON', tags.genre));
  if (tags.lyrics) frames.push(buildLyricsFrame(tags.lyrics));
  if (tags.artwork) frames.push(buildApicFrame(tags.artwork));

  let totalFramesSize = frames.reduce((acc, f) => acc + f.length, 0);

  // Header 10 bytes
  const header = new Uint8Array(10);
  header[0] = 0x49; header[1] = 0x44; header[2] = 0x33; // 'ID3'
  header[3] = 3; header[4] = 0; // v2.3.0
  header[5] = 0; // Flags

  // Syncsafe size
  header[6] = (totalFramesSize >> 21) & 0x7F;
  header[7] = (totalFramesSize >> 14) & 0x7F;
  header[8] = (totalFramesSize >> 7) & 0x7F;
  header[9] = totalFramesSize & 0x7F;

  return new Uint8Array([...header, ...frames.flatMap(f => Array.from(f)), ...rawAudio]);
}

function buildTextFrame(frameId, text) {
  const encText = new TextEncoder().encode(text);
  const dataLen = 1 + encText.length;
  const frame = new Uint8Array(10 + dataLen);

  for (let i = 0; i < 4; i++) frame[i] = frameId.charCodeAt(i);
  frame[4] = (dataLen >> 24) & 0xFF;
  frame[5] = (dataLen >> 16) & 0xFF;
  frame[6] = (dataLen >> 8) & 0xFF;
  frame[7] = dataLen & 0xFF;
  frame[8] = 0; frame[9] = 0; // Flags

  frame[10] = 3; // UTF-8
  frame.set(encText, 11);
  return frame;
}

function buildLyricsFrame(lyrics) {
  const encLyrics = new TextEncoder().encode(lyrics);
  const dataLen = 1 + 3 + 1 + encLyrics.length; // enc(1) + lang(3) + descNull(1) + lyrics
  const frame = new Uint8Array(10 + dataLen);

  frame.set([85, 83, 76, 84], 0); // 'USLT'
  frame[4] = (dataLen >> 24) & 0xFF;
  frame[5] = (dataLen >> 16) & 0xFF;
  frame[6] = (dataLen >> 8) & 0xFF;
  frame[7] = dataLen & 0xFF;

  frame[10] = 3; // UTF-8
  frame.set([101, 110, 103], 11); // 'eng'
  frame[14] = 0; // Empty desc null
  frame.set(encLyrics, 15);
  return frame;
}

function buildApicFrame(artwork) {
  const mimeBytes = new TextEncoder().encode(artwork.mime || 'image/jpeg');
  const dataLen = 1 + mimeBytes.length + 1 + 1 + 1 + artwork.data.length; // enc(1) + mime + null(1) + picType(1) + descNull(1) + data
  const frame = new Uint8Array(10 + dataLen);

  frame.set([65, 80, 73, 67], 0); // 'APIC'
  frame[4] = (dataLen >> 24) & 0xFF;
  frame[5] = (dataLen >> 16) & 0xFF;
  frame[6] = (dataLen >> 8) & 0xFF;
  frame[7] = dataLen & 0xFF;

  let offset = 10;
  frame[offset++] = 0; // Latin1 for MIME
  frame.set(mimeBytes, offset);
  offset += mimeBytes.length;
  frame[offset++] = 0; // Null
  frame[offset++] = 3; // Cover front
  frame[offset++] = 0; // Empty desc null
  frame.set(artwork.data, offset);

  return frame;
}
