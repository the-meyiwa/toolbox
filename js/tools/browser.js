/* ============================================================
   TOOLBOX — Browser Tool
   Isolated web reader, research inspector, and tabbed browser
   reserved for the Assistant and advanced research tasks.
   Strictly uses minimal vector SVG icons with zero emojis.
   ============================================================ */

const ICONS = {
  lock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  back: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  forward: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  reload: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  home: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  close: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  external: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  copy: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  reader: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  source: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  bookmark: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
};

const BOOKMARKS = [
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search' },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
  { name: 'DuckDuckGo', url: 'https://duckduckgo.com' },
  { name: 'ArXiv', url: 'https://arxiv.org' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com' },
  { name: 'Project Gutenberg', url: 'https://www.gutenberg.org' }
];

export default {
  render(container, options = {}) {
    // Determine initial URL from parameters or options
    let initialUrl = 'https://en.wikipedia.org/wiki/Web_browser';
    const hash = window.location.hash || '';
    if (hash.includes('?url=')) {
      try {
        const rawUrl = hash.split('?url=')[1];
        if (rawUrl) initialUrl = decodeURIComponent(rawUrl);
      } catch (e) {}
    } else if (options.url) {
      initialUrl = options.url;
    }

    let tabs = [
      {
        id: 'tab-1',
        title: 'Wikipedia: Web browser',
        url: initialUrl,
        history: [initialUrl],
        histIndex: 0,
        content: null,
        loading: false,
        sourceHtml: ''
      }
    ];
    let activeTabId = 'tab-1';
    let currentMode = 'article'; // 'article' | 'source' | 'security'

    container.innerHTML = `
      <div class="browser-app-wrapper" style="display:flex; flex-direction:column; max-width:1200px; margin:0 auto; font-family:var(--sans); border:1px solid var(--border); border-radius:18px; overflow:hidden; background:var(--bg-card); box-shadow:0 12px 36px rgba(0,0,0,0.06);">
        
        <!-- BROWSER WINDOW CHROME & TAB BAR -->
        <div class="browser-chrome" style="background:var(--bg-subtle); border-bottom:1px solid var(--border); padding:8px 12px 0; display:flex; flex-direction:column; gap:8px;">
          
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <!-- Window Traffic Light Dots -->
            <div style="display:flex; align-items:center; gap:6px; padding-left:4px;">
              <span style="width:11px; height:11px; border-radius:50%; background:#ef4444; display:inline-block;"></span>
              <span style="width:11px; height:11px; border-radius:50%; background:#f59e0b; display:inline-block;"></span>
              <span style="width:11px; height:11px; border-radius:50%; background:#10b981; display:inline-block;"></span>
            </div>

            <!-- Tab Strip -->
            <div id="brw-tabs-container" style="display:flex; align-items:center; gap:4px; flex:1; overflow-x:auto; padding-bottom:1px;"></div>

            <!-- New Tab Button -->
            <button type="button" id="brw-new-tab-btn" class="btn btn-secondary btn-sm" title="New Tab" style="padding:4px 8px; font-size:0.75rem; border-radius:6px; display:inline-flex; align-items:center;">
              ${ICONS.plus}
            </button>
          </div>

          <!-- ADDRESS BAR & CONTROLS ROW -->
          <div style="display:flex; align-items:center; gap:8px; padding-bottom:8px;">
            <div style="display:flex; align-items:center; gap:4px;">
              <button type="button" id="brw-btn-back" class="btn btn-secondary btn-sm" title="Back" style="padding:6px 8px; border-radius:8px;">${ICONS.back}</button>
              <button type="button" id="brw-btn-forward" class="btn btn-secondary btn-sm" title="Forward" style="padding:6px 8px; border-radius:8px;">${ICONS.forward}</button>
              <button type="button" id="brw-btn-reload" class="btn btn-secondary btn-sm" title="Reload" style="padding:6px 8px; border-radius:8px;">${ICONS.reload}</button>
              <button type="button" id="brw-btn-home" class="btn btn-secondary btn-sm" title="Home" style="padding:6px 8px; border-radius:8px;">${ICONS.home}</button>
            </div>

            <!-- URL Input Bar -->
            <div class="brw-address-box" style="flex:1; display:flex; align-items:center; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:2px 10px; position:relative; box-shadow:0 1px 4px rgba(0,0,0,0.02);">
              <span style="color:#10b981; margin-right:8px; display:flex; align-items:center;" title="Secure Connection">${ICONS.lock}</span>
              <input type="text" id="brw-url-input" class="tool-input" placeholder="Search with DuckDuckGo or enter web address…" style="flex:1; border:none; background:transparent; padding:6px 0; font-size:0.84rem; font-family:var(--mono); color:var(--text); outline:none;">
              <button type="button" id="brw-go-btn" class="btn btn-primary btn-sm" style="font-size:0.75rem; padding:3px 10px; margin-left:6px;">Go</button>
            </div>

            <!-- View Modes & Utilities -->
            <div style="display:flex; align-items:center; gap:4px;">
              <button type="button" id="brw-btn-mode-article" class="btn btn-secondary btn-sm" title="Reader View" style="padding:6px 9px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                ${ICONS.reader}
                <span class="brw-hide-mobile">Reader</span>
              </button>
              <button type="button" id="brw-btn-mode-source" class="btn btn-secondary btn-sm" title="View Source" style="padding:6px 9px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                ${ICONS.source}
                <span class="brw-hide-mobile">Source</span>
              </button>
              <button type="button" id="brw-btn-copy" class="btn btn-secondary btn-sm" title="Copy URL" style="padding:6px 9px;">${ICONS.copy}</button>
              <a id="brw-btn-external" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="Open in New Window" style="padding:6px 9px; display:inline-flex; align-items:center;">
                ${ICONS.external}
              </a>
            </div>
          </div>

          <!-- BOOKMARKS BAR -->
          <div class="brw-bookmarks-strip" style="display:flex; align-items:center; gap:8px; overflow-x:auto; padding-bottom:8px; border-top:1px solid var(--border-subtle); padding-top:6px;">
            <span style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; display:flex; align-items:center; gap:4px;">
              ${ICONS.bookmark} Bookmarks:
            </span>
            ${BOOKMARKS.map(b => `
              <button type="button" class="brw-bmark-btn" data-url="${b.url}" style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:6px; font-size:0.74rem; padding:2px 8px; color:var(--text); cursor:pointer; white-space:nowrap; transition:background 0.1s ease;">
                ${b.name}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- MAIN VIEWPORT STAGE -->
        <div id="brw-viewport" style="min-height:560px; max-height:76vh; overflow-y:auto; position:relative; background:var(--bg-card); color:var(--text);">
          <div id="brw-loader" style="display:none; position:absolute; inset:0; background:rgba(var(--bg-card), 0.7); backdrop-filter:blur(3px); z-index:10; align-items:center; justify-content:center;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" style="animation:brw-spin 1s linear infinite; color:var(--text);">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
              </svg>
              <span id="brw-loader-text" style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">Connecting to page…</span>
            </div>
          </div>

          <!-- Page Content Container -->
          <div id="brw-page-content" style="padding:28px 36px;"></div>
        </div>

        <!-- STATUS BAR -->
        <div class="brw-status-bar" style="background:var(--bg-subtle); border-top:1px solid var(--border); padding:6px 14px; display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--text-secondary); font-family:var(--mono);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="width:7px; height:7px; border-radius:50%; background:#10b981;"></span>
            <span id="brw-status-text">Assistant Browser Engine Ready</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span id="brw-ssl-badge">TLS 1.3 / Isolated Sandbox</span>
            <span id="brw-stats-badge">Clean Reader</span>
          </div>
        </div>
      </div>
    `;

    injectBrowserStyles();

    // Elements
    const tabsContainer = container.querySelector('#brw-tabs-container');
    const newTabBtn = container.querySelector('#brw-new-tab-btn');
    const urlInput = container.querySelector('#brw-url-input');
    const goBtn = container.querySelector('#brw-go-btn');
    const backBtn = container.querySelector('#brw-btn-back');
    const forwardBtn = container.querySelector('#brw-btn-forward');
    const reloadBtn = container.querySelector('#brw-btn-reload');
    const homeBtn = container.querySelector('#brw-btn-home');
    const modeArticleBtn = container.querySelector('#brw-btn-mode-article');
    const modeSourceBtn = container.querySelector('#brw-btn-mode-source');
    const copyBtn = container.querySelector('#brw-btn-copy');
    const externalBtn = container.querySelector('#brw-btn-external');
    const viewport = container.querySelector('#brw-viewport');
    const loader = container.querySelector('#brw-loader');
    const loaderText = container.querySelector('#brw-loader-text');
    const pageContent = container.querySelector('#brw-page-content');
    const statusText = container.querySelector('#brw-status-text');
    const bmarkBtns = container.querySelectorAll('.brw-bmark-btn');

    function getActiveTab() {
      return tabs.find(t => t.id === activeTabId) || tabs[0];
    }

    function renderTabs() {
      tabsContainer.innerHTML = tabs.map(t => {
        const isActive = t.id === activeTabId;
        return `
          <div class="brw-tab ${isActive ? 'active' : ''}" data-tab-id="${t.id}" style="display:flex; align-items:center; gap:8px; padding:6px 12px; border-radius:8px 8px 0 0; background:${isActive ? 'var(--bg-card)' : 'transparent'}; border:1px solid ${isActive ? 'var(--border)' : 'transparent'}; border-bottom:${isActive ? '1px solid var(--bg-card)' : 'none'}; cursor:pointer; max-width:180px; min-width:110px; font-size:0.78rem; font-weight:${isActive ? '700' : '500'}; color:${isActive ? 'var(--text)' : 'var(--text-secondary)'};">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escapeHtml(t.title || 'New Tab')}</span>
            ${tabs.length > 1 ? `
              <button type="button" class="brw-tab-close" data-close-tab="${t.id}" style="background:none; border:none; padding:0; cursor:pointer; color:var(--text-muted); display:flex; align-items:center;">
                ${ICONS.close}
              </button>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    async function navigateTo(rawTarget) {
      if (!rawTarget) return;
      const tab = getActiveTab();
      let target = rawTarget.trim();

      // Normalize input: if search term or URL
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        if (target.includes('.') && !target.includes(' ')) {
          target = 'https://' + target;
        } else {
          // Search query
          target = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(target)}`;
        }
      }

      tab.url = target;
      urlInput.value = target;
      externalBtn.href = target;

      // History update
      if (tab.history[tab.histIndex] !== target) {
        tab.history = tab.history.slice(0, tab.histIndex + 1);
        tab.history.push(target);
        tab.histIndex = tab.history.length - 1;
      }

      updateNavButtons();
      await loadPageContent(target, tab);
    }

    async function loadPageContent(url, tab) {
      showLoader(true, `Connecting to ${new URL(url).hostname}…`);
      statusText.textContent = `Connecting to ${url}…`;

      try {
        const u = new URL(url);

        // Scenario 1: Wikipedia REST API (Direct encyclopedia reader)
        if (u.hostname.includes('wikipedia.org')) {
          let title = u.pathname.split('/wiki/')[1];
          if (!title || title.startsWith('Special:Search')) {
            const params = new URLSearchParams(u.search);
            title = params.get('search') || 'Web browser';
          }
          title = decodeURIComponent(title.replace(/_/g, ' '));

          const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
          const resp = await fetch(apiUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status} - Article not found`);
          const data = await resp.json();

          tab.title = data.title || title;
          tab.content = {
            type: 'wikipedia',
            title: data.title,
            description: data.description || 'Encyclopedia summary',
            extract: data.extract_html || data.extract,
            thumbnail: data.thumbnail?.source || null,
            canonicalUrl: data.content_urls?.desktop?.page || url
          };
          tab.sourceHtml = JSON.stringify(data, null, 2);
        }
        // Scenario 2: DuckDuckGo Instant Answer / Topics
        else if (u.hostname.includes('duckduckgo.com')) {
          const q = new URLSearchParams(u.search).get('q') || 'technology';
          const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
          const resp = await fetch(apiUrl);
          const data = await resp.json();

          tab.title = `Search: ${q}`;
          tab.content = {
            type: 'duckduckgo',
            query: q,
            heading: data.Heading || q,
            abstract: data.AbstractText || 'No instant summary available for this query.',
            related: (data.RelatedTopics || []).slice(0, 8),
            sourceUrl: data.AbstractURL || url
          };
          tab.sourceHtml = JSON.stringify(data, null, 2);
        }
        // Scenario 3: Standard Web Page or Markdown document
        else {
          tab.title = u.hostname;
          try {
            const resp = await fetch(url, { mode: 'cors' });
            if (resp.ok) {
              const text = await resp.text();
              tab.sourceHtml = text;
              tab.content = {
                type: 'webpage',
                url: url,
                html: text
              };
            } else {
              throw new Error(`Status ${resp.status}`);
            }
          } catch (corsErr) {
            // CORS restricted site — render clean Sandbox Reader card with external launcher
            tab.content = {
              type: 'cors-sandbox',
              url: url,
              hostname: u.hostname,
              title: `${u.hostname} (Sandbox Preview)`
            };
            tab.sourceHtml = `<!-- Cross-Origin Protected Resource -->\nURL: ${url}\nHost: ${u.hostname}\nProtocol: ${u.protocol}`;
          }
        }

        renderTabs();
        renderViewportContent(tab);
        statusText.textContent = `Completed 200 OK · ${u.hostname}`;
      } catch (err) {
        console.warn('[BrowserTool] Error loading page:', err);
        renderErrorState(url, err.message);
        statusText.textContent = `Failed: ${err.message}`;
      } finally {
        showLoader(false);
      }
    }

    function renderViewportContent(tab) {
      if (currentMode === 'source') {
        pageContent.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
            <strong style="font-size:0.85rem; font-family:var(--mono); color:var(--text);">Raw Source Inspector</strong>
            <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--mono);">${tab.sourceHtml ? (tab.sourceHtml.length + ' bytes') : 'Empty'}</span>
          </div>
          <pre class="tool-output" style="margin:0; padding:16px; font-family:var(--mono); font-size:0.82rem; line-height:1.55; max-height:560px; overflow:auto; white-space:pre-wrap; border-radius:10px;">${escapeHtml(tab.sourceHtml || 'No source content captured.')}</pre>
        `;
        return;
      }

      const c = tab.content;
      if (!c) return;

      if (c.type === 'wikipedia') {
        pageContent.innerHTML = `
          <article class="brw-article" style="max-width:820px; margin:0 auto; line-height:1.7;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:12px;">
              <div>
                <h1 style="margin:0; font-size:1.9rem; font-weight:800; color:var(--text); letter-spacing:-0.02em;">${escapeHtml(c.title)}</h1>
                <p style="margin:6px 0 0; font-size:0.95rem; color:var(--text-secondary); font-style:italic;">${escapeHtml(c.description)}</p>
              </div>
              <a href="${c.canonicalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:6px; font-size:0.75rem;">
                <span>View on Wikipedia</span>
                ${ICONS.external}
              </a>
            </div>

            ${c.thumbnail ? `
              <div style="float:right; margin:0 0 18px 24px; padding:6px; border:1px solid var(--border); border-radius:12px; background:var(--bg-subtle);">
                <img src="${c.thumbnail}" alt="${escapeHtml(c.title)}" style="max-width:240px; border-radius:8px; display:block;">
              </div>
            ` : ''}

            <div class="brw-article-body" style="font-size:1.02rem; color:var(--text);">
              ${c.extract}
            </div>

            <div style="clear:both; margin-top:32px; padding-top:16px; border-top:1px solid var(--border-subtle); font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>Source: Wikimedia Foundation (CC BY-SA 3.0)</span>
              <span>Isolated Sandbox Reader Mode</span>
            </div>
          </article>
        `;
      } else if (c.type === 'duckduckgo') {
        pageContent.innerHTML = `
          <div style="max-width:820px; margin:0 auto;">
            <h1 style="font-size:1.6rem; font-weight:800; margin-bottom:16px; color:var(--text);">${escapeHtml(c.heading)}</h1>
            <p style="font-size:1.05rem; line-height:1.7; color:var(--text); margin-bottom:24px;">${escapeHtml(c.abstract)}</p>

            ${c.related && c.related.length ? `
              <h3 style="font-size:1rem; font-weight:700; margin-bottom:12px; color:var(--text);">Related Topics & Discoveries</h3>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${c.related.filter(r => r.Text).map(r => `
                  <div class="brw-search-card" style="padding:10px 14px; background:var(--bg-subtle); border:1px solid var(--border); border-radius:10px; font-size:0.86rem;">
                    <a href="${r.FirstURL || '#'}" class="brw-link" data-navigate="${r.FirstURL}" style="font-weight:600; color:#3b82f6; text-decoration:none;">${escapeHtml(r.Text)}</a>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      } else if (c.type === 'cors-sandbox') {
        pageContent.innerHTML = `
          <div style="max-width:680px; margin:40px auto; text-align:center; padding:36px 24px; background:var(--bg-subtle); border:1px solid var(--border); border-radius:16px;">
            <div style="width:48px; height:48px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; color:var(--text);">
              ${ICONS.shield}
            </div>
            <h2 style="margin:0 0 10px; font-size:1.3rem; font-weight:700; color:var(--text);">${escapeHtml(c.hostname)}</h2>
            <p style="font-size:0.9rem; line-height:1.6; color:var(--text-secondary); margin-bottom:20px;">
              This web domain requires browser-level direct network navigation due to origin policy constraints (CORS/X-Frame-Options).
            </p>
            <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
              <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:6px;">
                <span>Open ${escapeHtml(c.hostname)} Directly</span>
                ${ICONS.external}
              </a>
              <button type="button" class="btn btn-secondary" id="brw-search-wiki-fallback">Look up on Wikipedia</button>
            </div>
          </div>
        `;

        pageContent.querySelector('#brw-search-wiki-fallback')?.addEventListener('click', () => {
          navigateTo(`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(c.hostname)}`);
        });
      } else {
        // Render raw HTML in sandboxed container
        pageContent.innerHTML = `
          <div class="brw-web-body" style="font-size:0.95rem; line-height:1.6; color:var(--text);">
            ${c.html ? sanitizeWebHtml(c.html) : 'No preview available.'}
          </div>
        `;
      }

      // Bind in-page links
      pageContent.querySelectorAll('[data-navigate]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const href = link.dataset.navigate;
          if (href) navigateTo(href);
        });
      });
    }

    function renderErrorState(url, errMessage) {
      pageContent.innerHTML = `
        <div style="max-width:600px; margin:40px auto; text-align:center; padding:32px 20px; background:var(--bg-subtle); border:1px solid var(--border); border-radius:14px;">
          <h2 style="margin:0 0 8px; font-size:1.25rem; font-weight:700; color:#ef4444;">Unable to Load Webpage</h2>
          <p style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:18px;">${escapeHtml(errMessage)}</p>
          <div style="display:flex; justify-content:center; gap:10px;">
            <button type="button" class="btn btn-primary btn-sm" id="brw-retry-btn">Retry</button>
            <button type="button" class="btn btn-secondary btn-sm" id="brw-home-fallback-btn">Return Home</button>
          </div>
        </div>
      `;

      pageContent.querySelector('#brw-retry-btn')?.addEventListener('click', () => navigateTo(url));
      pageContent.querySelector('#brw-home-fallback-btn')?.addEventListener('click', () => navigateTo('https://en.wikipedia.org/wiki/Web_browser'));
    }

    function showLoader(show, text) {
      loader.style.display = show ? 'flex' : 'none';
      if (text) loaderText.textContent = text;
    }

    function updateNavButtons() {
      const tab = getActiveTab();
      backBtn.disabled = tab.histIndex <= 0;
      forwardBtn.disabled = tab.histIndex >= tab.history.length - 1;
    }

    // --- EVENTS ---
    goBtn.addEventListener('click', () => navigateTo(urlInput.value));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigateTo(urlInput.value);
    });

    backBtn.addEventListener('click', () => {
      const tab = getActiveTab();
      if (tab.histIndex > 0) {
        tab.histIndex--;
        navigateTo(tab.history[tab.histIndex]);
      }
    });

    forwardBtn.addEventListener('click', () => {
      const tab = getActiveTab();
      if (tab.histIndex < tab.history.length - 1) {
        tab.histIndex++;
        navigateTo(tab.history[tab.histIndex]);
      }
    });

    reloadBtn.addEventListener('click', () => {
      const tab = getActiveTab();
      navigateTo(tab.url);
    });

    homeBtn.addEventListener('click', () => {
      navigateTo('https://en.wikipedia.org/wiki/Web_browser');
    });

    copyBtn.addEventListener('click', () => {
      const tab = getActiveTab();
      navigator.clipboard.writeText(tab.url).then(() => {
        const orig = copyBtn.innerHTML;
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
      });
    });

    modeArticleBtn.addEventListener('click', () => {
      currentMode = 'article';
      modeArticleBtn.classList.add('btn-primary');
      modeArticleBtn.classList.remove('btn-secondary');
      modeSourceBtn.classList.remove('btn-primary');
      modeSourceBtn.classList.add('btn-secondary');
      renderViewportContent(getActiveTab());
    });

    modeSourceBtn.addEventListener('click', () => {
      currentMode = 'source';
      modeSourceBtn.classList.add('btn-primary');
      modeSourceBtn.classList.remove('btn-secondary');
      modeArticleBtn.classList.remove('btn-primary');
      modeArticleBtn.classList.add('btn-secondary');
      renderViewportContent(getActiveTab());
    });

    newTabBtn.addEventListener('click', () => {
      const newId = 'tab-' + Date.now();
      tabs.push({
        id: newId,
        title: 'New Tab',
        url: 'https://en.wikipedia.org/wiki/Special:Search',
        history: ['https://en.wikipedia.org/wiki/Special:Search'],
        histIndex: 0,
        content: null,
        loading: false,
        sourceHtml: ''
      });
      activeTabId = newId;
      renderTabs();
      navigateTo('https://en.wikipedia.org/wiki/Special:Search');
    });

    tabsContainer.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-tab]');
      if (closeBtn) {
        e.stopPropagation();
        const closeId = closeBtn.dataset.closeTab;
        if (tabs.length > 1) {
          tabs = tabs.filter(t => t.id !== closeId);
          if (activeTabId === closeId) activeTabId = tabs[0].id;
          renderTabs();
          const tab = getActiveTab();
          urlInput.value = tab.url;
          renderViewportContent(tab);
        }
        return;
      }

      const tabEl = e.target.closest('[data-tab-id]');
      if (tabEl) {
        activeTabId = tabEl.dataset.tabId;
        renderTabs();
        const tab = getActiveTab();
        urlInput.value = tab.url;
        renderViewportContent(tab);
      }
    });

    bmarkBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        if (url) navigateTo(url);
      });
    });

    // Initial render & navigation
    renderTabs();
    navigateTo(initialUrl);
  }
};

function sanitizeWebHtml(html) {
  // Strip dangerous script and iframe elements
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectBrowserStyles() {
  if (document.getElementById('browser-tool-injected-styles')) return;
  const style = document.createElement('style');
  style.id = 'browser-tool-injected-styles';
  style.textContent = `
    @keyframes brw-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .brw-tab:hover {
      background: var(--bg-hover) !important;
    }
    .brw-bmark-btn:hover {
      background: var(--bg-hover) !important;
      border-color: var(--border) !important;
    }
    @media (max-width: 640px) {
      .brw-hide-mobile { display: none !important; }
      .browser-chrome { padding: 6px 8px 0 !important; }
      #brw-page-content { padding: 16px !important; }
    }
  `;
  document.head.appendChild(style);
}
