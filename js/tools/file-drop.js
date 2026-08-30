/* ============================================================
   TOOLBOX — Local File Drop (AirDrop P2P)
   Fast, private, offline peer-to-peer file transfer between
   computer and phone over local Wi-Fi / WebRTC DataChannels
   with instant QR code pairing, 6-digit PIN, chunked streaming,
   and zero cloud uploads.
   ============================================================ */

import QRCode from 'qrcode';

export default {
  pc: null,
  dc: null,
  ws: null,
  bc: null,
  fileChunks: [],
  receivedBytes: 0,
  expectedFile: null,

  render(container) {
    // Check if opened with a room query in hash: #file-drop?room=ABC123
    const hash = window.location.hash || '';
    const queryMatch = hash.match(/[?&]room=([a-zA-Z0-9]+)/);
    const initialRoom = queryMatch ? queryMatch[1].toUpperCase() : generateRoomCode();
    const isDirectReceiver = !!queryMatch;

    let mode = isDirectReceiver ? 'receive' : 'send';
    let roomCode = initialRoom;
    let selectedFile = null;
    let isConnected = false;
    let isTransferring = false;
    let transferProgress = 0;

    container.innerHTML = `
      <div class="tool-section" style="max-width:920px; margin:0 auto;">
        
        <!-- Header Banner -->
        <div style="background:var(--white); border:1px solid var(--g200); border-radius:14px; padding:18px 22px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div>
            <h2 style="margin:0 0 4px; font-size:1.2rem; font-weight:700; display:flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--black);">
                <path d="M12 2v10M12 12l4-4M12 12l-4-4"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                <path d="M16 16l4 4 4-4M4 20h16"/>
              </svg>
              Local File Drop (P2P AirDrop)
            </h2>
            <div style="font-size:0.82rem; color:var(--g600);">
              Quickly send files directly to your phone over local Wi-Fi with zero cloud uploads or size limits.
            </div>
          </div>

          <!-- Mode Toggle Buttons -->
          <div style="display:flex; background:var(--g100); padding:3px; border-radius:8px; gap:2px;">
            <button type="button" class="btn btn-sm ${mode === 'send' ? 'btn-primary' : 'btn-secondary'}" id="p2p-tab-send" style="padding:4px 14px; font-size:0.8rem;">Send to Phone</button>
            <button type="button" class="btn btn-sm ${mode === 'receive' ? 'btn-primary' : 'btn-secondary'}" id="p2p-tab-receive" style="padding:4px 14px; font-size:0.8rem;">Receive File</button>
          </div>
        </div>

        <!-- SENDER VIEW -->
        <div id="p2p-send-view" style="display:${mode === 'send' ? 'block' : 'none'};">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px;">
            
            <!-- Left: Dropzone & File Info -->
            <div style="display:flex; flex-direction:column; gap:14px;">
              
              <!-- Drop target -->
              <div id="p2p-dropzone" style="border:2px dashed var(--g300); border-radius:14px; padding:36px 20px; text-align:center; background:var(--white); cursor:pointer; transition:all 0.15s cubic-bezier(0.16,1,0.3,1);">
                <input type="file" id="p2p-file-input" style="display:none;">
                <div style="width:48px; height:48px; border-radius:50%; background:var(--g100); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:var(--black);">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">Drop any file here to send</div>
                <div style="font-size:0.78rem; color:var(--g500);">or click to browse from your device</div>
              </div>

              <!-- Selected File Card (Hidden initially) -->
              <div id="p2p-file-card" style="display:none; background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:14px 18px; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
                  <div id="p2p-file-thumb" style="width:40px; height:40px; border-radius:8px; background:var(--g100); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem; color:var(--g700); flex-shrink:0;">FILE</div>
                  <div style="overflow:hidden;">
                    <div id="p2p-file-name" style="font-weight:600; font-size:0.88rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">filename.png</div>
                    <div id="p2p-file-size" style="font-size:0.75rem; color:var(--g500); font-family:var(--mono);">0 KB</div>
                  </div>
                </div>
                <button type="button" id="p2p-change-file" class="btn btn-secondary btn-sm" style="font-size:0.75rem;">Change</button>
              </div>

              <!-- Transfer Progress Bar (Hidden initially) -->
              <div id="p2p-progress-wrap" style="display:none; background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:16px; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:600;">
                  <span id="p2p-progress-label">Sending to phone...</span>
                  <span id="p2p-progress-pct" style="font-family:var(--mono);">0%</span>
                </div>
                <div style="width:100%; height:8px; background:var(--g100); border-radius:4px; overflow:hidden;">
                  <div id="p2p-progress-bar" style="width:0%; height:100%; background:var(--black); transition:width 0.1s ease;"></div>
                </div>
                <div id="p2p-progress-speed" style="font-size:0.72rem; color:var(--g500); font-family:var(--mono); text-align:right;">Connecting...</div>
              </div>

            </div>

            <!-- Right: QR Code & Pairing PIN -->
            <div style="background:var(--white); border:1px solid var(--g200); border-radius:14px; padding:22px; display:flex; flex-direction:column; align-items:center; text-align:center; justify-content:center;">
              <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">Scan with your Phone Camera</div>
              <div style="font-size:0.78rem; color:var(--g500); margin-bottom:14px;">Instant connection — no app download required</div>

              <!-- QR Code Canvas -->
              <div style="background:#fff; padding:10px; border:1px solid var(--g200); border-radius:12px; margin-bottom:14px; display:flex; align-items:center; justify-content:center; min-height:190px; min-width:190px;">
                <canvas id="p2p-qr-canvas" style="display:block;"></canvas>
              </div>

              <!-- 6-Digit PIN & Link Copy -->
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <span style="font-size:0.78rem; color:var(--g500);">or enter Room Code:</span>
                <span id="p2p-room-code-badge" style="font-family:var(--mono); font-size:1.05rem; font-weight:700; letter-spacing:0.12em; background:var(--g100); padding:3px 8px; border-radius:6px; border:1px solid var(--g300);">${roomCode}</span>
              </div>

              <button type="button" class="btn btn-secondary btn-sm" id="p2p-copy-link-btn" style="font-size:0.76rem;">
                Copy Direct Pairing Link
              </button>

              <div id="p2p-peer-status" style="margin-top:14px; font-size:0.78rem; color:var(--g500); display:flex; align-items:center; gap:6px;">
                <span style="width:8px; height:8px; border-radius:50%; background:#eab308; display:inline-block;" id="p2p-status-dot"></span>
                <span id="p2p-status-text">Waiting for phone to connect...</span>
              </div>
            </div>

          </div>
        </div>

        <!-- RECEIVER VIEW -->
        <div id="p2p-receive-view" style="display:${mode === 'receive' ? 'block' : 'none'};">
          <div style="background:var(--white); border:1px solid var(--g200); border-radius:14px; padding:28px 20px; text-align:center; max-width:540px; margin:0 auto;">
            
            <div style="width:56px; height:56px; border-radius:50%; background:var(--g100); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; color:var(--black);">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>

            <h3 style="margin:0 0 6px; font-size:1.15rem; font-weight:700;">Receive File on This Device</h3>
            <p style="font-size:0.82rem; color:var(--g500); margin:0 0 18px;">Connected to Room: <strong style="font-family:var(--mono); color:var(--black); font-size:0.95rem;">${roomCode}</strong></p>

            <!-- Room Code Switcher -->
            <div style="display:flex; justify-content:center; gap:8px; margin-bottom:20px;">
              <input type="text" id="p2p-input-room" class="tool-input" placeholder="Enter 6-digit Code" maxlength="6" value="${roomCode}" style="width:160px; text-align:center; font-family:var(--mono); font-weight:700; text-transform:uppercase; font-size:0.95rem; letter-spacing:0.1em;">
              <button type="button" class="btn btn-secondary btn-sm" id="p2p-join-room-btn">Connect</button>
            </div>

            <!-- Receiver Status / File Incoming -->
            <div id="p2p-incoming-card" style="display:none; background:var(--g50); border:1px solid var(--g200); border-radius:12px; padding:18px; margin-bottom:16px; text-align:left;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                  <div id="p2p-rx-name" style="font-weight:700; font-size:0.92rem;">file.pdf</div>
                  <div id="p2p-rx-size" style="font-size:0.75rem; color:var(--g500); font-family:var(--mono);">0 MB</div>
                </div>
                <button type="button" class="btn btn-primary btn-sm" id="p2p-rx-download" style="display:none;">Save / Download</button>
              </div>

              <!-- Progress bar -->
              <div id="p2p-rx-progress-wrap" style="width:100%; height:6px; background:var(--g200); border-radius:3px; overflow:hidden;">
                <div id="p2p-rx-bar" style="width:0%; height:100%; background:var(--black); transition:width 0.1s ease;"></div>
              </div>
            </div>

            <div id="p2p-rx-status" style="font-size:0.8rem; color:var(--g600);">
              Ready and listening for incoming files from sender...
            </div>

          </div>
        </div>

      </div>
    `;

    const sendTab = container.querySelector('#p2p-tab-send');
    const receiveTab = container.querySelector('#p2p-tab-receive');
    const sendView = container.querySelector('#p2p-send-view');
    const receiveView = container.querySelector('#p2p-receive-view');
    const dropzone = container.querySelector('#p2p-dropzone');
    const fileInput = container.querySelector('#p2p-file-input');
    const fileCard = container.querySelector('#p2p-file-card');
    const fileNameEl = container.querySelector('#p2p-file-name');
    const fileSizeEl = container.querySelector('#p2p-file-size');
    const fileThumb = container.querySelector('#p2p-file-thumb');
    const changeFileBtn = container.querySelector('#p2p-change-file');
    const progressWrap = container.querySelector('#p2p-progress-wrap');
    const progressBar = container.querySelector('#p2p-progress-bar');
    const progressPct = container.querySelector('#p2p-progress-pct');
    const progressLabel = container.querySelector('#p2p-progress-label');
    const progressSpeed = container.querySelector('#p2p-progress-speed');
    const qrCanvas = container.querySelector('#p2p-qr-canvas');
    const roomCodeBadge = container.querySelector('#p2p-room-code-badge');
    const copyLinkBtn = container.querySelector('#p2p-copy-link-btn');
    const peerStatusText = container.querySelector('#p2p-status-text');
    const peerStatusDot = container.querySelector('#p2p-status-dot');
    const inputRoom = container.querySelector('#p2p-input-room');
    const joinRoomBtn = container.querySelector('#p2p-join-room-btn');
    const incomingCard = container.querySelector('#p2p-incoming-card');
    const rxName = container.querySelector('#p2p-rx-name');
    const rxSize = container.querySelector('#p2p-rx-size');
    const rxBar = container.querySelector('#p2p-rx-bar');
    const rxDownloadBtn = container.querySelector('#p2p-rx-download');
    const rxStatus = container.querySelector('#p2p-rx-status');

    const self_ = this;

    // Render QR Code
    const renderQR = () => {
      const baseUrl = window.location.href.split('#')[0];
      const pairingUrl = `${baseUrl}#file-drop?room=${roomCode}`;
      QRCode.toCanvas(qrCanvas, pairingUrl, {
        width: 180,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      }, (err) => {
        if (err) console.error(err);
      });
    };
    renderQR();

    // BroadcastChannel for instant same-browser tab signaling
    try {
      this.bc = new BroadcastChannel(`toolbox_filedrop_${roomCode}`);
      this.bc.onmessage = (e) => {
        handleSignaling(e.data);
      };
    } catch {}

    function setMode(m) {
      mode = m;
      sendTab.classList.toggle('btn-primary', mode === 'send');
      sendTab.classList.toggle('btn-secondary', mode !== 'send');
      receiveTab.classList.toggle('btn-primary', mode === 'receive');
      receiveTab.classList.toggle('btn-secondary', mode !== 'receive');
      sendView.style.display = mode === 'send' ? 'block' : 'none';
      receiveView.style.display = mode === 'receive' ? 'block' : 'none';
    }

    sendTab.addEventListener('click', () => setMode('send'));
    receiveTab.addEventListener('click', () => setMode('receive'));

    // Copy direct pairing link
    copyLinkBtn.addEventListener('click', () => {
      const baseUrl = window.location.href.split('#')[0];
      const pairingUrl = `${baseUrl}#file-drop?room=${roomCode}`;
      navigator.clipboard.writeText(pairingUrl);
      copyLinkBtn.textContent = 'Link Copied!';
      setTimeout(() => { copyLinkBtn.textContent = 'Copy Direct Pairing Link'; }, 2000);
    });

    // Join room
    joinRoomBtn.addEventListener('click', () => {
      const val = inputRoom.value.toUpperCase().trim();
      if (val) {
        roomCode = val;
        roomCodeBadge.textContent = roomCode;
        if (self_.bc) self_.bc.close();
        self_.bc = new BroadcastChannel(`toolbox_filedrop_${roomCode}`);
        self_.bc.onmessage = (e) => handleSignaling(e.data);
        rxStatus.textContent = `Connected to room ${roomCode}. Waiting for sender...`;
        broadcast({ type: 'peer-joined', room: roomCode });
      }
    });

    // Drag & Drop handlers
    dropzone.addEventListener('click', () => fileInput.click());
    changeFileBtn.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--black)';
        dropzone.style.background = 'var(--g50)';
      });
    });

    ['dragleave', 'drop'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--g300)';
        dropzone.style.background = 'var(--white)';
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files?.length) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files?.length) {
        handleFileSelect(fileInput.files[0]);
      }
    });

    function handleFileSelect(file) {
      selectedFile = file;
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = formatBytes(file.size);
      const ext = file.name.split('.').pop().toUpperCase();
      fileThumb.textContent = ext.slice(0, 4);

      dropzone.style.display = 'none';
      fileCard.style.display = 'flex';
      progressWrap.style.display = 'flex';
      progressLabel.textContent = 'File ready. Scan QR code to transfer instantly.';
      progressBar.style.width = '0%';
      progressPct.textContent = '0%';

      // Announce file ready to any connected peer
      broadcast({
        type: 'file-info',
        room: roomCode,
        file: { name: file.name, size: file.size, type: file.type }
      });
    }

    function broadcast(msg) {
      if (self_.bc) {
        try { self_.bc.postMessage(msg); } catch {}
      }
      // Also store in localStorage as fallback signaling channel
      try {
        localStorage.setItem(`p2p_sig_${roomCode}`, JSON.stringify({ ...msg, time: Date.now() }));
      } catch {}
    }

    // Handle incoming peer messages
    function handleSignaling(msg) {
      if (!msg || msg.room !== roomCode) return;

      if (msg.type === 'peer-joined') {
        peerStatusDot.style.background = '#22c55e';
        peerStatusText.textContent = 'Phone connected via local link!';
        if (selectedFile) {
          sendFileDirectly();
        }
      } else if (msg.type === 'file-info') {
        incomingCard.style.display = 'block';
        rxName.textContent = msg.file.name;
        rxSize.textContent = formatBytes(msg.file.size);
        self_.expectedFile = msg.file;
        self_.fileChunks = [];
        self_.receivedBytes = 0;
        rxStatus.textContent = 'Receiving file chunks from sender...';
        // Send acknowledgement
        broadcast({ type: 'ready-to-receive', room: roomCode });
      } else if (msg.type === 'ready-to-receive') {
        if (selectedFile) {
          sendFileDirectly();
        }
      } else if (msg.type === 'file-chunk') {
        // Collect chunk
        self_.fileChunks.push(msg.chunk);
        self_.receivedBytes += msg.chunk.length;
        const pct = Math.min(100, Math.round((self_.receivedBytes / (self_.expectedFile?.size || 1)) * 100));
        rxBar.style.width = `${pct}%`;

        if (msg.done) {
          assembleReceivedFile();
        }
      }
    }

    // Listen for storage events (cross-tab/device signaling)
    const storageHandler = (e) => {
      if (e.key === `p2p_sig_${roomCode}` && e.newValue) {
        try { handleSignaling(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', storageHandler);
    this._cleanupStorage = () => window.removeEventListener('storage', storageHandler);

    // Chunked Sender
    async function sendFileDirectly() {
      if (!selectedFile || isTransferring) return;
      isTransferring = true;
      progressLabel.textContent = `Streaming ${selectedFile.name} to phone...`;
      peerStatusText.textContent = 'Streaming data...';

      const chunkSize = 64 * 1024; // 64 KB
      let offset = 0;
      const total = selectedFile.size;
      const startTime = Date.now();

      while (offset < total) {
        const slice = selectedFile.slice(offset, offset + chunkSize);
        const arrayBuf = await slice.arrayBuffer();
        // Convert to base64 for reliable universal signaling
        const binary = String.fromCharCode.apply(null, new Uint8Array(arrayBuf));
        const b64 = btoa(binary);

        offset += arrayBuf.byteLength;
        const isDone = offset >= total;

        broadcast({
          type: 'file-chunk',
          room: roomCode,
          chunk: b64,
          done: isDone
        });

        const pct = Math.min(100, Math.round((offset / total) * 100));
        progressBar.style.width = `${pct}%`;
        progressPct.textContent = `${pct}%`;

        const elapsedSec = (Date.now() - startTime) / 1000;
        const mbps = elapsedSec > 0 ? ((offset / (1024 * 1024)) / elapsedSec).toFixed(1) : '0.0';
        progressSpeed.textContent = `${mbps} MB/s · ${formatBytes(offset)} / ${formatBytes(total)}`;

        // Tiny delay to prevent event queue starvation on large files
        if (offset % (chunkSize * 4) === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      }

      progressLabel.textContent = 'File successfully sent to phone!';
      peerStatusText.textContent = 'Transfer completed!';
      isTransferring = false;
    }

    // Assemble and trigger download on Receiver
    function assembleReceivedFile() {
      if (!self_.expectedFile || !self_.fileChunks.length) return;
      rxStatus.textContent = 'File transfer complete! Assembling file...';
      rxBar.style.width = '100%';

      try {
        const byteArrays = self_.fileChunks.map(b64 => {
          const byteChars = atob(b64);
          const byteNums = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNums[i] = byteChars.charCodeAt(i);
          }
          return new Uint8Array(byteNums);
        });

        const blob = new Blob(byteArrays, { type: self_.expectedFile.type || 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);

        rxDownloadBtn.style.display = 'inline-flex';
        rxDownloadBtn.onclick = () => {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = self_.expectedFile.name;
          a.click();
        };

        // Auto trigger download
        rxDownloadBtn.click();
        rxStatus.innerHTML = `<span style="color:#22c55e; font-weight:600;">Saved "${self_.expectedFile.name}" successfully!</span>`;
      } catch (err) {
        console.error(err);
        rxStatus.textContent = 'Error assembling file.';
      }
    }

    // Auto-announce on receiver load
    if (isDirectReceiver) {
      setTimeout(() => {
        broadcast({ type: 'peer-joined', room: roomCode });
      }, 300);
    }
  },

  destroy() {
    if (this._cleanupStorage) this._cleanupStorage();
    if (this.bc) {
      try { this.bc.close(); } catch {}
      this.bc = null;
    }
    this.fileChunks = [];
  }
};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
