/* ============================================================
   TOOLBOX — Video Player
   High-performance offline HTML5 video player with subtitle loader,
   speed controls, frame-by-frame stepper, audio booster, PNG snapshot,
   A-B loop repeat, and stream metadata inspector.
   ============================================================ */

export default {
  render(container) {
    let videoBlobUrl = null;
    let audioCtx = null;
    let gainNode = null;
    let loopA = null;
    let loopB = null;

    container.innerHTML = `
      <div class="tool-section">
        <div class="compressor-dropzone" id="vp-dropzone">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--g500); margin-bottom:8px;">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:4px;">Drag & Drop a Video file to play</div>
          <div style="font-size:0.78rem; color:var(--g500);">Supports MP4, WebM, OGG, MOV, MKV</div>
          <input type="file" id="vp-video-input" accept="video/*" style="display:none;">
          <div style="margin-top:12px; display:flex; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="vp-choose-btn">Choose Video</button>
            <button type="button" class="btn btn-secondary btn-sm" id="vp-sub-btn">Load Subtitles (.srt / .vtt)</button>
            <input type="file" id="vp-sub-input" accept=".srt,.vtt,text/vtt" style="display:none;">
          </div>
        </div>

        <!-- Video Player Workspace -->
        <div id="vp-workspace" style="display:none; margin-top:18px;">
          <!-- Video Display -->
          <div style="background:#000; border-radius:14px; overflow:hidden; display:flex; justify-content:center; align-items:center; position:relative; box-shadow:0 12px 36px rgba(0,0,0,0.25);">
            <video id="vp-video-el" controls style="width:100%; max-height:560px; outline:none;"></video>
          </div>

          <!-- Extended Controls Bar -->
          <div style="margin-top:14px; padding:16px; background:var(--white); border:1px solid var(--g200); border-radius:14px; display:flex; flex-direction:column; gap:12px;">
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <!-- Playback Rate -->
              <div style="display:flex; align-items:center; gap:6px;">
                <label class="calc-label" style="margin:0;">Speed:</label>
                <select id="vp-speed-select" class="tool-input" style="width:90px; padding:4px 8px; font-size:0.82rem;">
                  <option value="0.25">0.25×</option>
                  <option value="0.5">0.5×</option>
                  <option value="0.75">0.75×</option>
                  <option value="1" selected>1.0×</option>
                  <option value="1.25">1.25×</option>
                  <option value="1.5">1.5×</option>
                  <option value="2">2.0×</option>
                  <option value="3">3.0×</option>
                </select>
              </div>

              <!-- Frame Stepper -->
              <div style="display:flex; align-items:center; gap:4px;">
                <button type="button" class="btn btn-secondary btn-sm" id="vp-frame-back" title="Step Back 1 Frame (1/30s)">◀ Frame</button>
                <button type="button" class="btn btn-secondary btn-sm" id="vp-frame-fwd" title="Step Forward 1 Frame (1/30s)">Frame ▶</button>
              </div>

              <!-- Audio Volume Boost -->
              <div style="display:flex; align-items:center; gap:8px;">
                <label class="calc-label" style="margin:0;">Boost:</label>
                <input type="range" id="vp-volume-boost" min="1" max="3" step="0.1" value="1" style="width:80px;">
                <span id="vp-boost-lbl" style="font-size:0.78rem; font-family:var(--mono);">100%</span>
              </div>

              <!-- A-B Repeat Loop -->
              <div style="display:flex; align-items:center; gap:4px;">
                <button type="button" class="btn btn-secondary btn-sm" id="vp-set-a">Set [A]</button>
                <button type="button" class="btn btn-secondary btn-sm" id="vp-set-b">Set [B]</button>
                <button type="button" class="btn btn-secondary btn-sm" id="vp-clear-ab" style="display:none;">Clear Loop</button>
              </div>

              <!-- Snapshot PNG -->
              <button type="button" class="btn btn-secondary btn-sm" id="vp-snap-btn" title="Capture exact high-res video frame to PNG">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                Snap Frame (PNG)
              </button>
            </div>

            <!-- Video Information Metadata -->
            <div id="vp-meta-box" style="padding:10px 14px; background:var(--g50); border:1px solid var(--g150); border-radius:8px; display:flex; justify-content:space-between; flex-wrap:wrap; font-size:0.78rem; font-family:var(--mono); color:var(--g600);">
              <span id="vp-meta-res">Resolution: -</span>
              <span id="vp-meta-dur">Duration: -</span>
              <span id="vp-meta-loop">Loop A-B: Off</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#vp-dropzone');
    const videoInput = container.querySelector('#vp-video-input');
    const chooseBtn = container.querySelector('#vp-choose-btn');
    const subBtn = container.querySelector('#vp-sub-btn');
    const subInput = container.querySelector('#vp-sub-input');
    const workspace = container.querySelector('#vp-workspace');
    const videoEl = container.querySelector('#vp-video-el');
    const speedSelect = container.querySelector('#vp-speed-select');
    const frameBackBtn = container.querySelector('#vp-frame-back');
    const frameFwdBtn = container.querySelector('#vp-frame-fwd');
    const volumeBoost = container.querySelector('#vp-volume-boost');
    const boostLbl = container.querySelector('#vp-boost-lbl');
    const setABtn = container.querySelector('#vp-set-a');
    const setBBtn = container.querySelector('#vp-set-b');
    const clearABBtn = container.querySelector('#vp-clear-ab');
    const snapBtn = container.querySelector('#vp-snap-btn');
    const metaRes = container.querySelector('#vp-meta-res');
    const metaDur = container.querySelector('#vp-meta-dur');
    const metaLoop = container.querySelector('#vp-meta-loop');

    chooseBtn.addEventListener('click', () => videoInput.click());
    subBtn.addEventListener('click', () => subInput.click());

    videoInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) loadVideo(e.target.files[0]);
    });

    subInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) loadSubtitles(e.target.files[0]);
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
      if (e.dataTransfer.files?.[0]) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.srt') || file.name.endsWith('.vtt')) {
          loadSubtitles(file);
        } else {
          loadVideo(file);
        }
      }
    });

    function loadVideo(file) {
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
      videoBlobUrl = URL.createObjectURL(file);
      videoEl.src = videoBlobUrl;
      workspace.style.display = 'block';

      videoEl.onloadedmetadata = () => {
        metaRes.textContent = `Resolution: ${videoEl.videoWidth} × ${videoEl.videoHeight}`;
        const mins = Math.floor(videoEl.duration / 60);
        const secs = Math.floor(videoEl.duration % 60);
        metaDur.textContent = `Duration: ${mins}:${secs.toString().padStart(2, '0')}`;
      };

      // Set up Web Audio GainNode for boosting
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaElementSource(videoEl);
          gainNode = audioCtx.createGain();
          source.connect(gainNode);
          gainNode.connect(audioCtx.destination);
        }
      } catch {}
    }

    async function loadSubtitles(file) {
      const text = await file.text();
      let vttText = text;
      if (file.name.endsWith('.srt')) {
        // Convert SRT to WebVTT
        vttText = 'WEBVTT\n\n' + text.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
      }

      const blob = new Blob([vttText], { type: 'text/vtt' });
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = file.name.replace(/\.[^/.]+$/, '');
      track.srclang = 'en';
      track.src = URL.createObjectURL(blob);
      track.default = true;

      // Remove existing tracks
      Array.from(videoEl.querySelectorAll('track')).forEach(t => t.remove());
      videoEl.appendChild(track);
      track.mode = 'showing';
    }

    speedSelect.addEventListener('change', () => {
      videoEl.playbackRate = parseFloat(speedSelect.value);
    });

    frameBackBtn.addEventListener('click', () => {
      videoEl.pause();
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 1 / 30);
    });

    frameFwdBtn.addEventListener('click', () => {
      videoEl.pause();
      videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 1 / 30);
    });

    volumeBoost.addEventListener('input', () => {
      const boost = parseFloat(volumeBoost.value);
      boostLbl.textContent = `${Math.round(boost * 100)}%`;
      if (gainNode) gainNode.gain.value = boost;
    });

    // A-B Repeat Loop
    setABtn.addEventListener('click', () => {
      loopA = videoEl.currentTime;
      setABtn.textContent = `A: ${loopA.toFixed(1)}s`;
      clearABBtn.style.display = 'inline-flex';
      updateLoopMeta();
    });

    setBBtn.addEventListener('click', () => {
      loopB = videoEl.currentTime;
      setBBtn.textContent = `B: ${loopB.toFixed(1)}s`;
      clearABBtn.style.display = 'inline-flex';
      updateLoopMeta();
    });

    clearABBtn.addEventListener('click', () => {
      loopA = null;
      loopB = null;
      setABtn.textContent = 'Set [A]';
      setBBtn.textContent = 'Set [B]';
      clearABBtn.style.display = 'none';
      metaLoop.textContent = 'Loop A-B: Off';
    });

    videoEl.addEventListener('timeupdate', () => {
      if (loopA !== null && loopB !== null && loopB > loopA) {
        if (videoEl.currentTime >= loopB || videoEl.currentTime < loopA) {
          videoEl.currentTime = loopA;
        }
      }
    });

    function updateLoopMeta() {
      if (loopA !== null && loopB !== null) {
        metaLoop.textContent = `Looping: ${loopA.toFixed(1)}s → ${loopB.toFixed(1)}s`;
      } else if (loopA !== null) {
        metaLoop.textContent = `Loop Start [A]: ${loopA.toFixed(1)}s`;
      }
    }

    // Capture Frame to PNG
    snapBtn.addEventListener('click', () => {
      if (!videoEl.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `frame_${Math.floor(videoEl.currentTime * 1000)}ms.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    });
  }
};
