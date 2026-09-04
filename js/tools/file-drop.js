/* ============================================================
   TOOLBOX — Local File Drop (AirDrop P2P)
   Fast, private, offline peer-to-peer file transfer between
   computer and phone over local Wi-Fi / WebRTC DataChannels
   with instant QR code pairing, 6-digit PIN, chunked streaming,
   and zero cloud uploads.
   ============================================================ */

import QRCode from 'qrcode';
import { sendP2PSignal, pollP2PSignals, getCurrentUser } from '../lib/supabase.js';
import { fs } from '../lib/filesystem.js';

export default {
  pc: null,
  dc: null,
  ws: null,
  bc: null,
  fileChunks: [],
  receivedBytes: 0,
  expectedFile: null,

  render(container) {
    const user = getCurrentUser();
    if (user) {
      container.innerHTML = `
        <div class="tool-section" style="max-width:540px; margin:48px auto; text-align:center; padding:36px 24px; background:var(--white); border:1px solid var(--border); border-radius:16px;">
          <div style="width:52px; height:52px; border-radius:12px; background:var(--g100); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; color:var(--black);">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h2 style="font-size:1.2rem; font-weight:700; margin-bottom:8px; color:var(--black);">Files Synchronized</h2>
          <p style="font-size:0.86rem; color:var(--g600); line-height:1.5; margin-bottom:24px;">
            You are signed in. Your files are automatically synchronized across your devices via Files, eliminating the need for Local File Drop.
          </p>
          <a href="#files" class="btn btn-primary" style="padding:8px 20px;">Go to Files</a>
        </div>
      `;
      return;
    }

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
              Local File Drop
            </h2>
            <div style="font-size:0.82rem; color:var(--g600);">
              Quickly send files directly to your phone or nearby devices over local Wi-Fi with zero cloud uploads or size limits.
            </div>
          </div>

          <!-- Mode Toggle Buttons -->
          <div style="display:flex; background:var(--g100); padding:3px; border-radius:9999px; gap:2px;">
            <button type="button" class="btn btn-sm ${mode === 'send' ? 'btn-primary' : 'btn-secondary'}" id="p2p-tab-send" style="padding:5px 16px; font-size:0.8rem; border-radius:9999px;">Send to Phone</button>
            <button type="button" class="btn btn-sm ${mode === 'receive' ? 'btn-primary' : 'btn-secondary'}" id="p2p-tab-receive" style="padding:5px 16px; font-size:0.8rem; border-radius:9999px;">Receive File</button>
          </div>
        </div>

        <!-- SENDER VIEW -->
        <div id="p2p-send-view" style="display:${mode === 'send' ? 'block' : 'none'};">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px;">
            
            <!-- Left: Dropzone & File Info -->
            <div style="display:flex; flex-direction:column; gap:14px;">
              
              <!-- Drop target -->
              <div id="p2p-dropzone" style="border:2px dashed var(--g300); border-radius:14px; padding:36px 20px; text-align:center; background:var(--white); cursor:pointer; transition:all 0.15s cubic-bezier(0.16,1,0.3,1);">
                <input type="file" id="p2p-file-input" multiple style="display:none;">
                <div style="width:48px; height:48px; border-radius:50%; background:var(--g100); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:var(--black);">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">Drop files here to send</div>
                <div style="font-size:0.78rem; color:var(--g500);">or click to browse from your device (single or multiple files)</div>
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
                <div style="display:flex; gap:8px;">
                  <button type="button" id="p2p-change-file" class="btn btn-secondary btn-sm" style="font-size:0.75rem;">Change</button>
                  <button type="button" id="p2p-cancel-transfer" class="btn btn-secondary btn-sm" style="font-size:0.75rem; display:none;">Cancel</button>
                </div>
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
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                <div>
                  <div id="p2p-rx-name" style="font-weight:700; font-size:0.92rem;">file.pdf</div>
                  <div id="p2p-rx-size" style="font-size:0.75rem; color:var(--g500); font-family:var(--mono);">0 MB</div>
                </div>
                <div style="display:flex; gap:6px;">
                  <button type="button" class="btn btn-primary btn-sm" id="p2p-rx-download" style="display:none;">Download</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="p2p-rx-save-fs" style="display:none;">Save to Offline Files</button>
                </div>
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
    const clientId = `client_${Math.random().toString(36).substr(2, 9)}`;
    let lastPollTime = new Date().toISOString();
    let pollInterval = null;

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

    // Start WebRTC DataChannel Setup
    function setupWebRTC() {
      if (self_.pc) self_.pc.close();
      
      self_.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      });

      self_.pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal('ice', e.candidate);
        }
      };

      self_.pc.ondatachannel = (e) => {
        self_.dc = e.channel;
        setupDataChannel();
      };

      self_.pc.onconnectionstatechange = () => {
        if (self_.pc.connectionState === 'connected') {
          peerStatusDot.style.background = '#22c55e';
          peerStatusText.textContent = 'WebRTC DataChannel connected!';
          rxStatus.textContent = 'Securely connected via P2P.';
          isConnected = true;
          
          if (mode === 'send' && selectedFile) {
            sendFileViaRTC();
          }
        }
      };
    }

    function setupDataChannel() {
      if (!self_.dc) return;
      
      self_.dc.binaryType = 'arraybuffer';
      
      self_.dc.onmessage = (e) => {
        if (typeof e.data === 'string') {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'file-info') {
              incomingCard.style.display = 'block';
              rxName.textContent = msg.file.name;
              rxSize.textContent = formatBytes(msg.file.size);
              self_.expectedFile = msg.file;
              self_.fileChunks = [];
              self_.receivedBytes = 0;
              rxStatus.textContent = 'Receiving secure data stream...';
            } else if (msg.type === 'file-done') {
              assembleReceivedFile();
            }
          } catch {}
        } else {
          // Binary chunk
          self_.fileChunks.push(e.data);
          self_.receivedBytes += e.data.byteLength;
          const pct = Math.min(100, Math.round((self_.receivedBytes / (self_.expectedFile?.size || 1)) * 100));
          rxBar.style.width = `${pct}%`;
        }
      };
    }

    async function startAsSender() {
      setupWebRTC();
      self_.dc = self_.pc.createDataChannel('fileTransfer');
      setupDataChannel();
      
      const offer = await self_.pc.createOffer();
      await self_.pc.setLocalDescription(offer);
      await sendSignal('offer', offer);
    }

    async function sendSignal(type, payload) {
      await sendP2PSignal(roomCode, clientId, type, payload);
      // Fallback local signaling
      if (self_.bc) try { self_.bc.postMessage({ type, payload, senderId: clientId }); } catch {}
      try { localStorage.setItem(`p2p_sig_${roomCode}`, JSON.stringify({ type, payload, senderId: clientId, time: Date.now() })); } catch {}
    }

    async function handleSignaling(msg) {
      if (!msg || msg.senderId === clientId) return;

      if (msg.type === 'peer-joined' && mode === 'send') {
        peerStatusText.textContent = 'Phone seen! Negotiating connection...';
        startAsSender();
      } else if (msg.type === 'offer' && mode === 'receive') {
        setupWebRTC();
        await self_.pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        const answer = await self_.pc.createAnswer();
        await self_.pc.setLocalDescription(answer);
        await sendSignal('answer', answer);
      } else if (msg.type === 'answer' && mode === 'send') {
        await self_.pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
      } else if (msg.type === 'ice') {
        try {
          if (self_.pc) await self_.pc.addIceCandidate(new RTCIceCandidate(msg.payload));
        } catch {}
      }
    }

    // Polling Supabase Database
    const startPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        const signals = await pollP2PSignals(roomCode, lastPollTime);
        if (signals.length) {
          lastPollTime = signals[signals.length - 1].created_at;
          signals.forEach(s => {
            if (s.sender_id !== clientId) handleSignaling({ type: s.message_type, payload: s.payload, senderId: s.sender_id });
          });
        }
      }, 2000);
    };

    startPolling();

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
        sendSignal('peer-joined', {});
        startPolling();
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

    const cancelTransferBtn = container.querySelector('#p2p-cancel-transfer');
    const rxSaveFsBtn = container.querySelector('#p2p-rx-save-fs');

    let fileQueue = [];
    let isCancelled = false;
    let peerTimeoutTimer = null;

    // Start a 45-second timeout for peer connection notification
    if (mode === 'send') {
      peerTimeoutTimer = setTimeout(() => {
        if (!isConnected) {
          peerStatusText.textContent = 'Connection taking longer than usual. Ensure devices share local Wi-Fi, or enter Room Code manually.';
        }
      }, 45000);
    }

    cancelTransferBtn.addEventListener('click', () => {
      isCancelled = true;
      isTransferring = false;
      progressLabel.textContent = 'Transfer cancelled.';
      cancelTransferBtn.style.display = 'none';
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files?.length) {
        handleFileSelect(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files?.length) {
        handleFileSelect(Array.from(fileInput.files));
      }
    });

    function handleFileSelect(files) {
      if (!files || !files.length) return;
      fileQueue = files;
      isCancelled = false;
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);

      if (files.length === 1) {
        selectedFile = files[0];
        fileNameEl.textContent = selectedFile.name;
        fileSizeEl.textContent = formatBytes(selectedFile.size);
        const ext = selectedFile.name.split('.').pop().toUpperCase();
        fileThumb.textContent = ext.slice(0, 4);
      } else {
        selectedFile = files[0];
        fileNameEl.textContent = `${files.length} files (${files[0].name}, ...)`;
        fileSizeEl.textContent = `Total: ${formatBytes(totalSize)}`;
        fileThumb.textContent = 'ZIP';
      }

      dropzone.style.display = 'none';
      fileCard.style.display = 'flex';
      cancelTransferBtn.style.display = 'none';
      progressWrap.style.display = 'flex';
      progressLabel.textContent = 'Files ready. Scan QR code or connect room to transfer.';
      progressBar.style.width = '0%';
      progressPct.textContent = '0%';

      // If WebRTC is ready, send info right away
      if (isConnected && self_.dc && self_.dc.readyState === 'open') {
        sendFileQueueViaRTC();
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
    this._cleanupPoll = () => {
      if (pollInterval) clearInterval(pollInterval);
      if (peerTimeoutTimer) clearTimeout(peerTimeoutTimer);
    };

    // WebRTC Chunked Multi-File Sender
    async function sendFileQueueViaRTC() {
      if (!fileQueue.length || isTransferring || !self_.dc || self_.dc.readyState !== 'open') return;
      isTransferring = true;
      isCancelled = false;
      cancelTransferBtn.style.display = 'inline-flex';

      for (let i = 0; i < fileQueue.length; i++) {
        if (isCancelled) break;
        const curFile = fileQueue[i];
        const filePrefix = fileQueue.length > 1 ? `[${i + 1}/${fileQueue.length}] ` : '';
        progressLabel.textContent = `${filePrefix}Streaming ${curFile.name} over WebRTC...`;

        self_.dc.send(JSON.stringify({
          type: 'file-info',
          file: {
            name: curFile.name,
            size: curFile.size,
            type: curFile.type,
            index: i + 1,
            totalFiles: fileQueue.length
          }
        }));

        const chunkSize = 16384; // 16 KB for WebRTC DataChannel
        let offset = 0;
        const total = curFile.size;
        const startTime = Date.now();

        while (offset < total && !isCancelled) {
          if (self_.dc.bufferedAmount > chunkSize * 64) {
            await new Promise(r => setTimeout(r, 50));
            continue;
          }

          const slice = curFile.slice(offset, offset + chunkSize);
          const arrayBuf = await slice.arrayBuffer();

          try {
            self_.dc.send(arrayBuf);
          } catch (err) {
            console.error('DataChannel error', err);
            break;
          }

          offset += arrayBuf.byteLength;
          const pct = Math.min(100, Math.round((offset / Math.max(1, total)) * 100));
          progressBar.style.width = `${pct}%`;
          progressPct.textContent = `${pct}%`;

          const elapsedSec = (Date.now() - startTime) / 1000;
          const mbps = elapsedSec > 0 ? ((offset / (1024 * 1024)) / elapsedSec).toFixed(1) : '0.0';
          progressSpeed.textContent = `${mbps} MB/s · ${formatBytes(offset)} / ${formatBytes(total)}`;

          if (offset % (chunkSize * 10) === 0) {
            await new Promise(r => setTimeout(r, 5));
          }
        }

        if (!isCancelled) {
          self_.dc.send(JSON.stringify({ type: 'file-done', name: curFile.name }));
          await new Promise(r => setTimeout(r, 100)); // Allow receiver assembly buffer
        }
      }

      cancelTransferBtn.style.display = 'none';
      if (!isCancelled) {
        progressLabel.textContent = fileQueue.length > 1 ? `All ${fileQueue.length} files sent successfully!` : 'File successfully sent!';
        progressBar.style.width = '100%';
        progressPct.textContent = '100%';
      }
      isTransferring = false;
    }

    // Assemble and trigger download on Receiver
    async function assembleReceivedFile() {
      if (!self_.expectedFile || !self_.fileChunks.length) return;
      rxStatus.textContent = `Assembling "${self_.expectedFile.name}"...`;
      rxBar.style.width = '100%';

      try {
        const blob = new Blob(self_.fileChunks, { type: self_.expectedFile.type || 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        const fileName = self_.expectedFile.name;

        rxDownloadBtn.style.display = 'inline-flex';
        rxDownloadBtn.onclick = () => {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = fileName;
          a.click();
        };

        rxSaveFsBtn.style.display = 'inline-flex';
        rxSaveFsBtn.onclick = async () => {
          rxSaveFsBtn.disabled = true;
          rxSaveFsBtn.textContent = 'Saving...';
          try {
            await fs.writeFile('/Downloads/' + fileName, blob);
            rxSaveFsBtn.textContent = 'Saved to Offline Files!';
            rxStatus.innerHTML = `<span style="color:#22c55e; font-weight:600;">Saved "${fileName}" to Offline Files (/Downloads/${fileName})</span>`;
          } catch (err) {
            rxSaveFsBtn.textContent = 'Save Failed';
            console.error('Failed to save to fs:', err);
          }
        };

        // Auto trigger download
        rxDownloadBtn.click();
        const countInfo = self_.expectedFile.totalFiles > 1 ? ` [${self_.expectedFile.index}/${self_.expectedFile.totalFiles}]` : '';
        rxStatus.innerHTML = `<span style="color:#22c55e; font-weight:600;">Received "${fileName}"${countInfo}! Ready to download or save to Offline Files.</span>`;
      } catch (err) {
        console.error(err);
        rxStatus.textContent = 'Error assembling file.';
      }
    }

    // Auto-announce on receiver load
    if (isDirectReceiver) {
      setTimeout(() => {
        sendSignal('peer-joined', {});
      }, 300);
    }
  },

  destroy() {
    if (this._cleanupStorage) this._cleanupStorage();
    if (this._cleanupPoll) this._cleanupPoll();
    if (this.bc) {
      try { this.bc.close(); } catch {}
      this.bc = null;
    }
    if (this.dc) {
      try { this.dc.close(); } catch {}
      this.dc = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
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
