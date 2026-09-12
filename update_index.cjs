const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const startTag = '<section class="support-section showcase-pipeline-section">';
const startIdx = html.indexOf(startTag);
if(startIdx === -1) throw new Error('start not found');

const endStr = '<!-- Interaction & Craft -->';
const endIdx = html.indexOf(endStr);
if(endIdx === -1) throw new Error('end not found');

const newSection = \
          <!-- Cinematic Scrollytelling Pipeline -->
          <section class="support-section cinematic-pipeline-section">
            <h2 class="support-heading">Architecture Pipeline</h2>
            
            <div class="scrolly-container" id="scrolly-container">
              <div class="scrolly-graphic" id="scrolly-graphic">
                <!-- Primitives injected via JS based on active step -->
                <div id="sg-0" class="sg-scene active-scene">
                  <div class="pdetail-badge">01 INGEST</div>
                  <div style="margin-top:20px; display:flex; gap:10px;">
                    <div class="file-card" style="padding:12px; border:1px solid var(--g200); border-radius:8px;">raw_data.csv</div>
                    <div class="file-card" style="padding:12px; border:1px solid var(--g200); border-radius:8px;">drag_drop.json</div>
                  </div>
                </div>
                <div id="sg-1" class="sg-scene">
                  <div class="pdetail-badge">02 COMPUTE</div>
                  <div class="console-window" style="margin-top:20px; background:var(--black); color:var(--white); padding:12px; font-family:monospace; border-radius:8px; font-size:0.75rem;">
                    > initializing WASM runtime...<br>> executing pyodide.runPython()<br>> compute success [24ms]
                  </div>
                </div>
                <div id="sg-2" class="sg-scene">
                  <div class="pdetail-badge">03 VIRTUAL FS</div>
                  <div class="tree-view" style="margin-top:20px; text-align:left; font-family:monospace; font-size:0.8rem;">
                    &#128193; /root<br>
                    &nbsp;&nbsp;&#128193; /memfs<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&#128196; computed_output.json
                  </div>
                </div>
                <div id="sg-3" class="sg-scene">
                  <div class="pdetail-badge">04 HANDOFF</div>
                  <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    <div style="padding:12px; border:1px solid var(--accent); color:var(--accent); border-radius:8px; font-weight:bold;">Open in Code Runner &rarr;</div>
                    <div style="padding:12px; border:1px solid var(--g300); border-radius:8px;">Save to Files</div>
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
              .scrolly-graphic { position: sticky; top: 120px; width: 50%; height: 350px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--g150); display: flex; align-items: center; justify-content: center; overflow: hidden; }
              .scrolly-steps { width: 50%; padding-bottom: 30vh; margin-top: 40px; }
              .scrolly-step { min-height: 45vh; opacity: 0.3; transition: opacity 0.4s ease, transform 0.4s ease; transform: translateY(10px); }
              .scrolly-step.is-active { opacity: 1; transform: translateY(0); }
              .sg-scene { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity 0.5s ease, transform 0.5s ease; transform: scale(0.95); pointer-events: none; }
              .sg-scene.active-scene { opacity: 1; transform: scale(1); pointer-events: auto; }
              @media (max-width: 768px) {
                .scrolly-container { flex-direction: column; gap: 20px; }
                .scrolly-graphic { width: 100%; top: 70px; height: 220px; z-index: 10; margin-bottom: -10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                .scrolly-steps { width: 100%; padding-bottom: 20vh; margin-top: 0; }
                .scrolly-step { min-height: 35vh; }
              }
            </style>
            
            <script>
              // This is a simple Intersection Observer to drive the scrollytelling.
              // We could put it in app.js, but since it's specific to this view, an inline script is fine if it binds on load.
              // Alternatively, we wait for the page to render.
              window.addEventListener('DOMContentLoaded', () => {
                const steps = document.querySelectorAll('.scrolly-step');
                const scenes = document.querySelectorAll('.sg-scene');
                
                const observer = new IntersectionObserver((entries) => {
                  entries.forEach(entry => {
                    if (entry.isIntersecting) {
                      const stepIdx = entry.target.getAttribute('data-step');
                      
                      // Update steps
                      steps.forEach(s => s.classList.remove('is-active'));
                      entry.target.classList.add('is-active');
                      
                      // Update scenes
                      scenes.forEach(s => s.classList.remove('active-scene'));
                      const activeScene = document.getElementById('sg-' + stepIdx);
                      if (activeScene) activeScene.classList.add('active-scene');
                    }
                  });
                }, { rootMargin: '-40% 0px -40% 0px' });
                
                steps.forEach(step => observer.observe(step));
              });
            </script>
          </section>
\;

const updated = html.substring(0, startIdx) + newSection + '\n' + html.substring(endIdx);
fs.writeFileSync('index.html', updated, 'utf8');
console.log('Successfully updated index.html');
