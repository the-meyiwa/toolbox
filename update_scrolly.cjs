const fs = require('fs');
const target = fs.readFileSync('replace_target.txt', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

const newSection = \          <section class="support-section cinematic-pipeline-section">
            <h2 class="support-heading">Architecture Pipeline</h2>
            
            <div class="scrolly-container" id="scrolly-container">
              <div class="scrolly-graphic" id="scrolly-graphic">
                <!-- Primitives injected via JS based on active step -->
                <div id="sg-0" class="sg-scene active-scene">
                  <div class="pdetail-badge">01 INGEST</div>
                  <div style="margin-top:20px; display:flex; gap:10px;">
                    <div class="scrolly-primitive file-primitive">raw_data.csv</div>
                    <div class="scrolly-primitive file-primitive">drag_drop.json</div>
                  </div>
                </div>
                <div id="sg-1" class="sg-scene">
                  <div class="pdetail-badge">02 COMPUTE</div>
                  <div class="scrolly-primitive console-primitive">
                    > initializing WASM runtime...<br>> executing pyodide.runPython()<br>> compute success [24ms]
                  </div>
                </div>
                <div id="sg-2" class="sg-scene">
                  <div class="pdetail-badge">03 VIRTUAL FS</div>
                  <div class="scrolly-primitive tree-primitive">
                    &#128193; /root<br>
                    &nbsp;&nbsp;&#128193; /memfs<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&#128196; computed_output.json
                  </div>
                </div>
                <div id="sg-3" class="sg-scene">
                  <div class="pdetail-badge">04 HANDOFF</div>
                  <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    <div class="scrolly-primitive handoff-primitive active-handoff">Open in Code Runner &rarr;</div>
                    <div class="scrolly-primitive handoff-primitive">Save to Files</div>
                  </div>
                </div>
              </div>

              <div class="scrolly-steps">
                <div class="scrolly-step" data-step="0">
                  <h4 class="pdetail-title">01 Ingest: Universal Memory Pipes</h4>
                  <p class="pdetail-desc">Raw files, pasted tokens, and filesystem artifacts enter the client through memory-safe ArrayBuffers and Blob streams without network transmission.</p>
                </div>
                <div class="scrolly-step" data-step="1">
                  <h4 class="pdetail-title">02 Compute: WASM Micro-Runtimes</h4>
                  <p class="pdetail-desc">Python via Pyodide, SQLite3 Relational Engine, Lua, and QuickJS execute inside client WebAssembly threads with strict boundary isolation.</p>
                </div>
                <div class="scrolly-step" data-step="2">
                  <h4 class="pdetail-title">03 Virtual FS: Storage Sovereignty</h4>
                  <p class="pdetail-desc">Fast in-memory synchronous index backed by IndexedDB and OPFS. Supports nested folders, metadata tagging, PKZIP compression, and instant search.</p>
                </div>
                <div class="scrolly-step" data-step="3">
                  <h4 class="pdetail-title">04 Handoff: Seamless Artifact Pipeline</h4>
                  <p class="pdetail-desc">Transformations in one tool feed directly into another with zero interim downloads or file clutter. Data flows through the application intelligently.</p>
                </div>
              </div>
            </div>
            
            <style>
              .scrolly-container { display: flex; position: relative; align-items: flex-start; gap: 40px; margin-top: 24px; }
              .scrolly-graphic { position: sticky; top: 120px; width: 50%; height: 350px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--g150); box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: center; overflow: hidden; }
              .scrolly-steps { width: 50%; padding-bottom: 30vh; margin-top: 40px; }
              .scrolly-step { min-height: 45vh; opacity: 0.3; transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); transform: translateY(10px); }
              .scrolly-step.is-active { opacity: 1; transform: translateY(0); }
              .sg-scene { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity 0.5s ease, transform 0.5s ease; transform: scale(0.95) translateY(10px); pointer-events: none; }
              .sg-scene.active-scene { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
              
              /* Primitives styling */
              .scrolly-primitive { border-radius: 8px; font-size: 0.8rem; padding: 12px; border: 1px solid var(--g200); background: var(--bg-card); }
              .file-primitive { border: 1px dashed var(--g300); color: var(--text); }
              .console-primitive { background: var(--text); color: var(--bg-card); font-family: monospace; width: 80%; }
              .tree-primitive { text-align: left; font-family: monospace; border: none; background: transparent; }
              .handoff-primitive { color: var(--g500); }
              .active-handoff { color: var(--accent); border-color: var(--accent); font-weight: bold; background: rgba(var(--accent-rgb, 0,0,0), 0.05); }

              @media (max-width: 768px) {
                .scrolly-container { flex-direction: column; gap: 20px; }
                .scrolly-graphic { width: 100%; top: 70px; height: 220px; z-index: 10; margin-bottom: -10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                .scrolly-steps { width: 100%; padding-bottom: 20vh; margin-top: 0; }
                .scrolly-step { min-height: 35vh; }
              }
            </style>
            
            <script>
              window.addEventListener('DOMContentLoaded', () => {
                const steps = document.querySelectorAll('.scrolly-step');
                const scenes = document.querySelectorAll('.sg-scene');
                if(!steps.length) return;
                
                const observer = new IntersectionObserver((entries) => {
                  entries.forEach(entry => {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
                      const stepIdx = entry.target.getAttribute('data-step');
                      steps.forEach(s => s.classList.remove('is-active'));
                      entry.target.classList.add('is-active');
                      scenes.forEach(s => s.classList.remove('active-scene'));
                      const activeScene = document.getElementById('sg-' + stepIdx);
                      if (activeScene) activeScene.classList.add('active-scene');
                    }
                  });
                }, { rootMargin: '-30% 0px -40% 0px', threshold: [0, 0.1, 0.5, 1] });
                
                steps.forEach(step => observer.observe(step));
              });
            </script>
          </section>
\;

const updated = html.replace(target, newSection);
if (updated.length === html.length) {
  console.log('Target not found for replacement.');
} else {
  fs.writeFileSync('index.html', updated, 'utf8');
  console.log('Successfully updated index.html with scrollytelling');
}
