/* ============================================================
   TOOLBOX — Speaker Cleaner & Water Ejector
   Acoustic speaker cleaner generating 165Hz resonant water ejection waves,
   deep sub-bass frequency sweeps, and acoustic pulse bursts to clear water
   and dust particles from smartphone and laptop speaker grilles.
   ============================================================ */

export default {
  audioCtx: null,
  oscillator: null,
  gainNode: null,
  timerInterval: null,

  render(container) {
    let isPlaying = false;
    let currentMode = 'water-165';
    let timeLeft = 30;

    container.innerHTML = `
      <div class="tool-section">
        <div style="text-align:center; padding:24px 16px; background:var(--white); border:1px solid var(--g200); border-radius:18px; box-shadow:0 6px 24px rgba(0,0,0,0.03);">
          
          <!-- Animated Speaker Icon / Water Droplets -->
          <div style="position:relative; width:120px; height:120px; margin:0 auto 16px; display:flex; align-items:center; justify-content:center; background:var(--g50); border-radius:50%; border:3px solid var(--g200);" id="sc-circle">
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="sc-speaker-icon" style="color:var(--black); transition:transform 0.1s;">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
            <div id="sc-wave-ring" style="position:absolute; inset:-8px; border-radius:50%; border:2px solid #3b82f6; opacity:0; pointer-events:none; transition:all 0.3s;"></div>
          </div>

          <h2 style="margin:0 0 6px; font-size:1.4rem; font-weight:700;">Speaker Cleaner & Water Ejector</h2>
          <p style="margin:0 0 20px; font-size:0.86rem; color:var(--g500); max-width:480px; margin-inline:auto;">
            Emits targeted low-frequency resonant sound waves (165 Hz) that physically vibrate the speaker diaphragm to dislodge water droplets and clear dust.
          </p>

          <!-- Instructions Notice -->
          <div style="background:var(--g50); border:1px solid var(--g200); border-radius:12px; padding:12px 16px; max-width:480px; margin:0 auto 20px; text-align:left; font-size:0.8rem; line-height:1.5;">
            <strong>How to use:</strong>
            <ol style="margin:6px 0 0; padding-left:20px; color:var(--g700);">
              <li>Turn your device's volume to <strong>maximum (100%)</strong>.</li>
              <li>Position your device with speakers facing <strong>downwards</strong>.</li>
              <li>Press <strong>Start Cleaning</strong> and let the 30-second cycle run.</li>
            </ol>
          </div>

          <!-- Mode Selector Chips -->
          <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:20px;">
            <button type="button" class="btn btn-primary btn-sm sc-mode-btn" data-mode="water-165">165 Hz Water Ejector</button>
            <button type="button" class="btn btn-secondary btn-sm sc-mode-btn" data-mode="sweep">80–280 Hz Sonic Sweep</button>
            <button type="button" class="btn btn-secondary btn-sm sc-mode-btn" data-mode="pulse">Pulsed Burst (Dust Clear)</button>
            <button type="button" class="btn btn-secondary btn-sm sc-mode-btn" data-mode="custom">Custom Tuner</button>
          </div>

          <!-- Custom Frequency Slider (Hidden by default) -->
          <div id="sc-custom-controls" style="display:none; max-width:400px; margin:0 auto 20px; padding:14px; background:var(--g50); border:1px solid var(--g200); border-radius:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.82rem; font-weight:600;">
              <span>Frequency:</span>
              <span id="sc-freq-val" style="font-family:var(--mono); color:#3b82f6;">165 Hz</span>
            </div>
            <input type="range" id="sc-freq-slider" min="50" max="1000" step="1" value="165" style="width:100%;">
          </div>

          <!-- Main Start/Stop Action Button -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <button type="button" class="btn btn-primary btn-lg" id="sc-toggle-btn" style="min-width:220px; height:52px; font-size:1.05rem; font-weight:700; border-radius:9999px;">
              Start Cleaning (30s)
            </button>
            <span id="sc-timer-lbl" style="font-size:0.85rem; font-family:var(--mono); font-weight:600; color:var(--g500);">30s remaining</span>
          </div>

        </div>
      </div>
    `;

    const toggleBtn = container.querySelector('#sc-toggle-btn');
    const timerLbl = container.querySelector('#sc-timer-lbl');
    const waveRing = container.querySelector('#sc-wave-ring');
    const speakerIcon = container.querySelector('#sc-speaker-icon');
    const customControls = container.querySelector('#sc-custom-controls');
    const freqSlider = container.querySelector('#sc-freq-slider');
    const freqVal = container.querySelector('#sc-freq-val');
    const modeBtns = container.querySelectorAll('.sc-mode-btn');

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => {
          b.classList.toggle('btn-primary', b === btn);
          b.classList.toggle('btn-secondary', b !== btn);
        });
        currentMode = btn.dataset.mode;
        customControls.style.display = currentMode === 'custom' ? 'block' : 'none';
        if (isPlaying) {
          stopSound();
          startSound();
        }
      });
    });

    freqSlider.addEventListener('input', () => {
      freqVal.textContent = `${freqSlider.value} Hz`;
      if (this.oscillator && currentMode === 'custom') {
        this.oscillator.frequency.setValueAtTime(parseFloat(freqSlider.value), this.audioCtx.currentTime);
      }
    });

    toggleBtn.addEventListener('click', () => {
      if (isPlaying) {
        stopSound();
      } else {
        startSound();
      }
    });

    const startSound = () => {
      try {
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        this.oscillator = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();

        let baseFreq = 165;
        this.oscillator.type = 'sine';

        if (currentMode === 'water-165') {
          baseFreq = 165;
          this.oscillator.frequency.setValueAtTime(165, this.audioCtx.currentTime);
        } else if (currentMode === 'sweep') {
          this.oscillator.frequency.setValueAtTime(80, this.audioCtx.currentTime);
          this.oscillator.frequency.linearRampToValueAtTime(280, this.audioCtx.currentTime + 3);
          // Loop sweep
          setInterval(() => {
            if (isPlaying && currentMode === 'sweep' && this.oscillator) {
              this.oscillator.frequency.setValueAtTime(80, this.audioCtx.currentTime);
              this.oscillator.frequency.linearRampToValueAtTime(280, this.audioCtx.currentTime + 3);
            }
          }, 3000);
        } else if (currentMode === 'pulse') {
          baseFreq = 165;
          this.oscillator.type = 'sawtooth';
          this.oscillator.frequency.setValueAtTime(165, this.audioCtx.currentTime);
        } else if (currentMode === 'custom') {
          baseFreq = parseFloat(freqSlider.value);
          this.oscillator.frequency.setValueAtTime(baseFreq, this.audioCtx.currentTime);
        }

        this.gainNode.gain.setValueAtTime(0.85, this.audioCtx.currentTime);
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        this.oscillator.start();

        isPlaying = true;
        timeLeft = 30;
        toggleBtn.textContent = 'Stop Cleaning';
        toggleBtn.style.background = '#ef4444';
        waveRing.style.opacity = '1';
        waveRing.style.transform = 'scale(1.15)';

        // 30s Countdown timer
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
          timeLeft--;
          timerLbl.textContent = `${timeLeft}s remaining`;
          speakerIcon.style.transform = timeLeft % 2 === 0 ? 'scale(1.08)' : 'scale(0.95)';
          if (timeLeft <= 0) {
            stopSound();
            timerLbl.textContent = 'Cleaning cycle complete.';
          }
        }, 1000);
      } catch (err) {
        console.error(err);
      }
    };

    const stopSound = () => {
      if (this.oscillator) {
        try {
          this.oscillator.stop();
          this.oscillator.disconnect();
        } catch {}
        this.oscillator = null;
      }
      clearInterval(this.timerInterval);
      isPlaying = false;
      toggleBtn.textContent = 'Start Cleaning (30s)';
      toggleBtn.style.background = '';
      waveRing.style.opacity = '0';
      waveRing.style.transform = 'scale(1)';
      speakerIcon.style.transform = 'scale(1)';
      timerLbl.textContent = '30s remaining';
    };
  },

  destroy() {
    if (this.oscillator) {
      try { this.oscillator.stop(); } catch {}
      this.oscillator = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }
    clearInterval(this.timerInterval);
  }
};
