import { openContextMenu, closeContextMenu } from '../lib/context-menu.js';
import { tbConfirm, tbPrompt, tbAlert } from '../lib/dialog.js';

/* ============================================================
   TOOLBOX — Notes
   Full offline notes application with folder organization, rich formatting,
   interactive checklists with tap-to-complete, paper styles (lined, grid),
   search, pinned notes, and multi-format export.
   ============================================================ */

function extractHashtags(text) {
  const matches = (text || '').match(/#[a-zA-Z0-9_\-]+/g) || [];
  return [...new Set(matches.map(t => t.toLowerCase()))];
}

export default {
  render(container) {
    const STORAGE_KEY = 'toolbox_notes_v1';
    const FONT_PREFS_KEY = 'toolbox_notes_font_prefs_v1';
    let notes = loadNotes();
    let activeNoteId = notes.length ? notes[0].id : null;
    let activeFolder = 'all';
    let activeHashtag = null;
    let activePaper = 'blank';
    // Mobile navigation state: 'folders' (default) | 'notes'
    let mobileView = 'folders';
    // Font preferences
    let fontPrefs = (() => {
      try { return JSON.parse(localStorage.getItem(FONT_PREFS_KEY) || '{}'); } catch { return {}; }
    })();
    if (fontPrefs.paper) activePaper = fontPrefs.paper;

    container.innerHTML = `
      <div class="notes-app-wrapper mobile-view-folders" style="display:grid; grid-template-columns:minmax(180px, 220px) minmax(220px, 280px) 1fr; height:calc(100vh - 180px); min-height:560px; background:var(--bg-card); border:1px solid var(--border); border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.04); position:relative;">
        
        <!-- Mobile Drawer Backdrop -->
        <div class="notes-drawer-backdrop" id="notes-drawer-backdrop"></div>

        <!-- 1. FOLDERS SIDEBAR -->
        <div class="notes-sidebar-col" style="background:var(--bg-subtle); border-right:1px solid var(--border); display:flex; flex-direction:column; justify-content:space-between; padding:16px; min-height:0; overflow-y:auto;">
          <div>
            <div style="font-weight:700; font-size:1.05rem; margin-bottom:16px; display:flex; align-items:center; gap:8px; color:var(--text);">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Folders
            </div>
            
            <div class="notes-folder-list" style="display:flex; flex-direction:column; gap:5px;">
              <button type="button" class="notes-folder-btn active" data-folder="all">
                <span>All Notes</span>
                <span class="notes-folder-count" data-count-folder="all">0</span>
              </button>
              <button type="button" class="notes-folder-btn" data-folder="quick">
                <span>Quick Notes</span>
                <span class="notes-folder-count" data-count-folder="quick">0</span>
              </button>
              <button type="button" class="notes-folder-btn" data-folder="work">
                <span>Work</span>
                <span class="notes-folder-count" data-count-folder="work">0</span>
              </button>
              <button type="button" class="notes-folder-btn" data-folder="personal">
                <span>Personal</span>
                <span class="notes-folder-count" data-count-folder="personal">0</span>
              </button>
              <button type="button" class="notes-folder-btn" data-folder="archive">
                <span>Archive</span>
                <span class="notes-folder-count" data-count-folder="archive">0</span>
              </button>
            </div>
          </div>

          <div style="margin-top:20px;">
            <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Hashtags</div>
            <div id="notes-tags-sidebar" style="display:flex; flex-wrap:wrap; gap:5px; max-height:130px; overflow-y:auto;"></div>
          </div>
          <div style="margin-top:16px;">
            <button type="button" class="btn btn-secondary btn-sm" id="notes-new-folder" style="width:100%; font-weight:600;">+ New Folder</button>
          </div>
        </div>

        <!-- 2. NOTE LIST COLUMN (On mobile, accessible ONLY as a side bar drawer) -->
        <div class="notes-list-col" style="background:var(--bg-card); border-right:1px solid var(--border); display:flex; flex-direction:column; min-height:0; overflow:hidden;">
          <!-- Top Bar with Drawer Header & Close Button (mobile), Search & New Note -->
          <div style="padding:10px 12px; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:8px; flex-shrink:0;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span id="notes-drawer-title" style="font-weight:700; font-size:0.85rem; color:var(--text);">All Notes</span>
              <button type="button" class="btn btn-secondary btn-circle notes-drawer-close-btn" id="notes-drawer-close-btn" title="Close notes list" aria-label="Close notes list" style="--circle-size:26px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="text" id="notes-search-input" class="tool-input" placeholder="Search notes..." style="flex:1; font-size:0.8rem; padding:6px 10px;">
              <button type="button" class="btn btn-primary btn-sm" id="notes-add-btn" title="Create New Note" style="padding:5px 10px; font-weight:600; flex-shrink:0;">+ New</button>
            </div>
          </div>

          <!-- Note Cards Scroll List -->
          <div id="notes-cards-list" style="flex:1; overflow-y:auto; min-height:0; display:flex; flex-direction:column;"></div>
        </div>

        <!-- 3. MAIN EDITOR AREA -->
        <div class="notes-editor-col" style="display:flex; flex-direction:column; background:var(--bg-card); position:relative; min-height:0; overflow:hidden;">
          <!-- Editor Toolbar: ONLY Note title and Page type remain -->
          <div class="notes-toolbar-top" style="padding:10px 16px; border-bottom:1px solid var(--border); background:var(--bg-card); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
              <!-- Mobile: Back to Folders Button -->
              <button type="button" class="btn btn-secondary btn-circle notes-btn-to-folders" id="notes-to-folders-btn" title="Back to Folders" aria-label="Back to Folders">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              <!-- Mobile: Side Bar Toggle Button -->
              <button type="button" class="btn btn-secondary btn-circle notes-btn-sidebar-toggle" id="notes-sidebar-toggle-btn" title="Open Notes List" aria-label="Open Notes List">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>

              <!-- Note Title Input -->
              <input type="text" id="note-title-input" placeholder="Untitled Note" style="font-size:1.15rem; font-weight:700; border:none; outline:none; background:transparent; width:100%; color:var(--text); padding:4px 0; min-width:120px;">
            </div>

            <!-- Right: Page Type Switcher & Context Menu Trigger -->
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
              <!-- Page Type Selector -->
              <select id="notes-paper-select" class="tool-select" title="Page Type" aria-label="Page Type" style="height:34px; font-size:0.8rem; padding:0 10px; border-radius:8px; min-width:115px; cursor:pointer;">
                <option value="blank">Blank</option>
                <option value="lined">Ruled Lined</option>
                <option value="grid">Grid</option>
                <option value="dot">Dot Matrix</option>
              </select>

              <!-- Context Menu Trigger Button (...) -->
              <button type="button" class="btn btn-secondary btn-circle" id="notes-context-menu-btn" title="Options & Formatting" aria-label="Options and Formatting">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
              </button>
            </div>
          </div>

          <!-- Note Content Area -->
          <div id="notes-editor-container" class="notes-paper-blank" style="flex:1; overflow-y:auto; min-height:0; padding:20px 28px; display:flex; flex-direction:column; gap:10px;">
            <div id="note-meta-line" style="font-size:0.72rem; color:var(--text-muted); font-family:var(--mono);"></div>
            <div id="note-hashtags-bar" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-height:20px;"></div>
            <div id="note-body-editor" contenteditable="true" style="flex:1; outline:none; font-size:0.95rem; line-height:1.7; min-height:200px; color:var(--text); white-space:pre-wrap;"></div>
          </div>

          <!-- Word Counter Footer -->
          <div class="notes-footer-bar" style="padding:6px 16px; border-top:1px solid var(--border); background:var(--bg-subtle); display:flex; justify-content:space-between; font-size:0.74rem; color:var(--text-muted); font-family:var(--mono); flex-shrink:0;">
            <span id="note-word-count">0 words · 0 characters</span>
            <span id="note-save-status">Saved locally</span>
          </div>
        </div>

      </div>
    `;

    const folderBtns = container.querySelectorAll('.notes-folder-btn');
    const cardsListEl = container.querySelector('#notes-cards-list');
    const searchInput = container.querySelector('#notes-search-input');
    const addBtn = container.querySelector('#notes-add-btn');
    const titleInput = container.querySelector('#note-title-input');
    const bodyEditor = container.querySelector('#note-body-editor');
    const metaLine = container.querySelector('#note-meta-line');
    const wordCountEl = container.querySelector('#note-word-count');
    const saveStatusEl = container.querySelector('#note-save-status');
    const editorContainer = container.querySelector('#notes-editor-container');
    const paperSelect = container.querySelector('#notes-paper-select');
    const contextMenuBtn = container.querySelector('#notes-context-menu-btn');
    const drawerBackdrop = container.querySelector('#notes-drawer-backdrop');
    const notesListCol = container.querySelector('.notes-list-col');
    const toFoldersBtn = container.querySelector('#notes-to-folders-btn');
    const sidebarToggleBtn = container.querySelector('#notes-sidebar-toggle-btn');
    const drawerCloseBtn = container.querySelector('#notes-drawer-close-btn');
    const currentFolderLabel = container.querySelector('#notes-current-folder-label');
    const desktopFolderLabel = container.querySelector('#notes-desktop-folder-label');
    const drawerTitle = container.querySelector('#notes-drawer-title');

    injectNotesCSS();

    function loadNotes() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return [
        {
          id: 'welcome-note',
          title: 'Notes & Checklists',
          body: 'This is a clean, 100% offline note space with checklist support, pinned notes, paper textures, and folder organization.\n\n[x] Completed checklist task\n[ ] Tap to complete task\n[ ] Customize typography and paper style in font settings\n\nAll notes are automatically saved to local storage.',
          folder: 'quick',
          pinned: true,
          hashtags: ['#offline', '#welcome'],
          updatedAt: Date.now()
        }
      ];
    }

    function saveNotes() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        saveStatusEl.textContent = `Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        updateFolderCounts();
      } catch {}
    }

    function getActiveNote() {
      return notes.find(n => n.id === activeNoteId);
    }

    // === Mobile Navigation & Drawer Management ===
    function getFolderDisplayName(f) {
      if (f === 'all') return 'All Notes';
      if (f === 'quick') return 'Quick Notes';
      if (f === 'work') return 'Work';
      if (f === 'personal') return 'Personal';
      if (f === 'archive') return 'Archive';
      return f.charAt(0).toUpperCase() + f.slice(1);
    }

    function updateMobileView() {
      const wrapper = container.querySelector('.notes-app-wrapper');
      if (!wrapper) return;
      wrapper.classList.remove('mobile-view-folders', 'mobile-view-notes');
      wrapper.classList.add(`mobile-view-${mobileView}`);

      const folderName = activeHashtag ? activeHashtag : getFolderDisplayName(activeFolder);
      if (currentFolderLabel) currentFolderLabel.textContent = folderName;
      if (desktopFolderLabel) desktopFolderLabel.textContent = folderName;
      if (drawerTitle) drawerTitle.textContent = folderName;
    }

    function toggleNotesDrawer(open) {
      if (open) {
        notesListCol?.classList.add('is-drawer-open');
        drawerBackdrop?.classList.add('is-active');
      } else {
        notesListCol?.classList.remove('is-drawer-open');
        drawerBackdrop?.classList.remove('is-active');
      }
    }

    toFoldersBtn?.addEventListener('click', () => {
      mobileView = 'folders';
      toggleNotesDrawer(false);
      updateMobileView();
    });

    sidebarToggleBtn?.addEventListener('click', () => {
      toggleNotesDrawer(true);
    });

    drawerCloseBtn?.addEventListener('click', () => {
      toggleNotesDrawer(false);
    });

    drawerBackdrop?.addEventListener('click', () => {
      toggleNotesDrawer(false);
    });

    function updateFolderCounts() {
      const counts = { all: notes.length, quick: 0, work: 0, personal: 0, archive: 0 };
      notes.forEach(n => {
        if (counts[n.folder] !== undefined) counts[n.folder]++;
      });
      container.querySelectorAll('[data-count-folder]').forEach(el => {
        const f = el.dataset.countFolder;
        el.textContent = counts[f] !== undefined ? counts[f] : (notes.filter(n => n.folder === f).length);
      });
    }

    function renderNoteList() {
      renderTagsSidebar();
      updateFolderCounts();
      const q = searchInput.value.toLowerCase().trim();
      let filtered = notes.filter(n => {
        const matchesFolder = activeFolder === 'all' || n.folder === activeFolder;
        const matchesTag = !activeHashtag || (n.hashtags && n.hashtags.includes(activeHashtag));
        const matchesQuery = !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.hashtags && n.hashtags.some(t => t.toLowerCase().includes(q)));
        return matchesFolder && matchesTag && matchesQuery;
      });

      // Sort: pinned first, then newest updated
      filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);

      if (!filtered.length) {
        cardsListEl.innerHTML = `<div style="padding:32px 14px; text-align:center; font-size:0.8rem; color:var(--text-muted);">No notes in this folder.</div>`;
        return;
      }

      cardsListEl.innerHTML = filtered.map(note => `
        <div class="note-card-item ${note.id === activeNoteId ? 'active' : ''}" data-id="${note.id}" style="padding:12px 14px; border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.15s;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
            <strong style="font-size:0.88rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%; color:var(--text);">${note.title || 'New Note'}</strong>
            ${note.pinned ? '<span style="font-size:0.72rem; font-weight:700; color:var(--text-secondary); border:1px solid var(--border); padding:1px 5px; border-radius:4px;">PINNED</span>' : ''}
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:4px;">
            ${(note.body || 'No additional text').replace(/<[^>]*>?/gm, '').slice(0, 60)}
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
            <div style="font-size:0.68rem; color:var(--text-muted); font-family:var(--mono);">
              ${new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </div>
            ${(note.hashtags && note.hashtags.length) ? `
              <div style="display:flex; gap:3px; overflow:hidden;">
                ${note.hashtags.slice(0, 2).map(t => `<span class="note-pill-tag">${escapeHtml(t)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');

      cardsListEl.querySelectorAll('.note-card-item').forEach(card => {
        card.addEventListener('click', () => {
          activeNoteId = card.dataset.id;
          renderActiveNote();
          renderNoteList();
          // On mobile, selecting a note closes the sidebar drawer
          toggleNotesDrawer(false);
        });
      });
    }

    function renderTagsSidebar() {
      const sidebarTagsEl = container.querySelector('#notes-tags-sidebar');
      if (!sidebarTagsEl) return;
      const allTags = new Set();
      notes.forEach(n => {
        (n.hashtags || []).forEach(t => allTags.add(t));
      });

      if (!allTags.size) {
        sidebarTagsEl.innerHTML = '<span style="font-size:0.72rem; color:var(--text-muted);">No tags yet</span>';
        return;
      }

      sidebarTagsEl.innerHTML = Array.from(allTags).map(t => `
        <button type="button" class="note-sidebar-tag ${activeHashtag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">
          ${escapeHtml(t)}
        </button>
      `).join('');

      sidebarTagsEl.querySelectorAll('.note-sidebar-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.dataset.tag;
          activeHashtag = activeHashtag === tag ? null : tag;
          mobileView = 'notes';
          updateMobileView();
          toggleNotesDrawer(false);
          renderNoteList();
        });
      });
    }

    function renderEditorHashtags() {
      const bar = container.querySelector('#note-hashtags-bar');
      if (!bar) return;
      const note = getActiveNote();
      if (!note) {
        bar.innerHTML = '';
        return;
      }
      note.hashtags = note.hashtags || [];
      bar.innerHTML = `
        ${note.hashtags.map(t => `
          <span class="note-editor-tag">
            <span>${escapeHtml(t)}</span>
            <button type="button" class="note-editor-tag-del" data-remove-tag="${escapeHtml(t)}" title="Remove tag">&times;</button>
          </span>
        `).join('')}
        <button type="button" class="note-editor-add-tag-btn" id="note-add-tag-btn" title="Add Hashtag">+ Tag</button>
      `;

      bar.querySelectorAll('[data-remove-tag]').forEach(delBtn => {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetTag = delBtn.dataset.removeTag;
          note.hashtags = note.hashtags.filter(t => t !== targetTag);
          saveNotes();
          renderEditorHashtags();
          renderNoteList();
        });
      });

      bar.querySelector('#note-add-tag-btn')?.addEventListener('click', async () => {
        const rawTag = await tbPrompt('Enter hashtag (e.g. #project, #finance):', '#', { title: 'Add Hashtag' });
        if (!rawTag) return;
        let formatted = rawTag.trim().toLowerCase();
        if (!formatted.startsWith('#')) formatted = '#' + formatted;
        formatted = formatted.replace(/[^a-z0-9_\-#]/g, '');
        if (formatted.length > 1 && !note.hashtags.includes(formatted)) {
          note.hashtags.push(formatted);
          saveNotes();
          renderEditorHashtags();
          renderNoteList();
        }
      });
    }

    function renderActiveNote() {
      const note = getActiveNote();
      if (!note) {
        titleInput.value = '';
        bodyEditor.innerHTML = '';
        metaLine.textContent = '';
        return;
      }

      titleInput.value = note.title || '';
      bodyEditor.innerHTML = formatBodyForDisplay(note.body);
      metaLine.textContent = `Last modified: ${new Date(note.updatedAt).toLocaleString()}`;
      if (note.paper) {
        activePaper = note.paper;
        applyFontPrefs();
      }
      if (paperSelect) paperSelect.value = activePaper || 'blank';
      updateCounts();
      renderEditorHashtags();
    }

    function formatBodyForDisplay(body) {
      if (!body) return '';
      let html = body.replace(/[x]/gi, '<input type="checkbox" checked class="note-chk"> ')
                     .replace(/[ ]/g, '<input type="checkbox" class="note-chk"> ');
      return html;
    }

    function updateCounts() {
      const text = `${titleInput.value} ${bodyEditor.innerText || ''}`.trim();
      const words = text ? text.split(/\s+/).length : 0;
      const chars = text.length;
      wordCountEl.textContent = `${words} words · ${chars} characters`;
    }

    // Handlers
    titleInput.addEventListener('input', () => {
      const note = getActiveNote();
      if (note) {
        const oldText = (note.title || '') + ' ' + (note.body || '');
        const oldAutoTags = extractHashtags(oldText);
        
        note.title = titleInput.value;
        const newText = (note.title || '') + ' ' + (note.body || '');
        const newAutoTags = extractHashtags(newText);
        
        const removedAutoTags = oldAutoTags.filter(t => !newAutoTags.includes(t));
        const addedAutoTags = newAutoTags.filter(t => !oldAutoTags.includes(t));
        
        if (!note.hashtags) note.hashtags = [];
        note.hashtags = note.hashtags.filter(t => !removedAutoTags.includes(t));
        addedAutoTags.forEach(t => { if (!note.hashtags.includes(t)) note.hashtags.push(t); });
        
        note.updatedAt = Date.now();
        saveNotes();
        renderNoteList();
      }
    });

    bodyEditor.addEventListener('input', () => {
      const note = getActiveNote();
      if (note) {
        const oldText = (note.title || '') + ' ' + (note.body || '');
        const oldAutoTags = extractHashtags(oldText);
        
        note.body = bodyEditor.innerText;
        const newText = (note.title || '') + ' ' + (note.body || '');
        const newAutoTags = extractHashtags(newText);
        
        const removedAutoTags = oldAutoTags.filter(t => !newAutoTags.includes(t));
        const addedAutoTags = newAutoTags.filter(t => !oldAutoTags.includes(t));
        
        if (!note.hashtags) note.hashtags = [];
        note.hashtags = note.hashtags.filter(t => !removedAutoTags.includes(t));
        addedAutoTags.forEach(t => { if (!note.hashtags.includes(t)) note.hashtags.push(t); });
        
        note.updatedAt = Date.now();
        saveNotes();
        updateCounts();
        // Since tags might have been added or removed, re-render them and the note list
        if (removedAutoTags.length > 0 || addedAutoTags.length > 0) {
          renderEditorHashtags();
          renderNoteList();
        }
      }
    });

    bodyEditor.addEventListener('click', (e) => {
      if (e.target.classList.contains('note-chk')) {
        const note = getActiveNote();
        if (note) {
          note.body = bodyEditor.innerText;
          note.updatedAt = Date.now();
          saveNotes();
        }
      }
    });

    addBtn.addEventListener('click', () => {
      const newNote = {
        id: `note-${Date.now()}`,
        title: 'New Note',
        body: '',
        folder: activeFolder === 'all' ? 'quick' : activeFolder,
        pinned: false,
        updatedAt: Date.now()
      };
      notes.unshift(newNote);
      activeNoteId = newNote.id;
      saveNotes();
      renderActiveNote();
      renderNoteList();
      // On mobile, close drawer and focus note title
      toggleNotesDrawer(false);
      mobileView = 'notes';
      updateMobileView();
      titleInput.focus();
    });



    folderBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        folderBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFolder = btn.dataset.folder;
        activeHashtag = null;
        // Tapping folder switches to Notes View on mobile
        mobileView = 'notes';
        updateMobileView();
        toggleNotesDrawer(false);
        renderNoteList();
      });
    });

    searchInput.addEventListener('input', renderNoteList);

    // === Apply Persisted Font Preferences ===
    function applyFontPrefs() {
      const fontFamily = fontPrefs.fontFamily || 'var(--sans)';
      const fontSize = fontPrefs.fontSize || '0.95rem';
      const lineHeight = fontPrefs.lineHeight || '1.7';
      const paper = fontPrefs.paper || activePaper || 'blank';
      activePaper = paper;

      if (editorContainer) {
        editorContainer.style.fontFamily = fontFamily;
        editorContainer.style.fontSize = fontSize;
        editorContainer.style.lineHeight = lineHeight;
        editorContainer.className = `notes-paper-${paper}`;
      }
      if (paperSelect) paperSelect.value = paper;
      try { localStorage.setItem(FONT_PREFS_KEY, JSON.stringify(fontPrefs)); } catch {}
    }
    applyFontPrefs();

    function setPageType(paper) {
      activePaper = paper;
      fontPrefs.paper = paper;
      applyFontPrefs();
      const note = getActiveNote();
      if (note) {
        note.paper = paper;
        saveNotes();
      }
    }

    paperSelect?.addEventListener('change', () => {
      setPageType(paperSelect.value);
    });

    // === Font & Style Settings Context Menu Drop-down ===
    // Accessible ONLY by context menu on both desktop AND mobile
    const checkIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';

    function openFontSettingsMenu(anchorEl, clientX, clientY) {
      const rect = anchorEl ? anchorEl.getBoundingClientRect() : null;
      const x = rect ? rect.left : clientX;
      const y = rect ? rect.bottom + 4 : clientY;

      const currentFamily = fontPrefs.fontFamily || 'var(--sans)';
      const currentSize = fontPrefs.fontSize || '0.95rem';
      const currentLine = fontPrefs.lineHeight || '1.7';
      const currentPaper = activePaper;

      openContextMenu({
        x,
        y,
        title: 'Font & Style Settings',
        items: [
          { label: 'Font Family', separator: true },
          {
            label: 'System Sans',
            icon: currentFamily === 'var(--sans)' ? checkIcon : '',
            action: () => { fontPrefs.fontFamily = 'var(--sans)'; applyFontPrefs(); }
          },
          {
            label: 'Editorial Serif',
            icon: currentFamily === 'Georgia, serif' ? checkIcon : '',
            action: () => { fontPrefs.fontFamily = 'Georgia, serif'; applyFontPrefs(); }
          },
          {
            label: 'Monospace',
            icon: currentFamily === 'var(--mono)' ? checkIcon : '',
            action: () => { fontPrefs.fontFamily = 'var(--mono)'; applyFontPrefs(); }
          },
          { label: 'Font Size', separator: true },
          {
            label: 'Small (14px)',
            icon: currentSize === '0.875rem' ? checkIcon : '',
            action: () => { fontPrefs.fontSize = '0.875rem'; applyFontPrefs(); }
          },
          {
            label: 'Normal (16px)',
            icon: currentSize === '0.95rem' ? checkIcon : '',
            action: () => { fontPrefs.fontSize = '0.95rem'; applyFontPrefs(); }
          },
          {
            label: 'Large (18px)',
            icon: currentSize === '1.1rem' ? checkIcon : '',
            action: () => { fontPrefs.fontSize = '1.1rem'; applyFontPrefs(); }
          },
          {
            label: 'Extra Large (22px)',
            icon: currentSize === '1.3rem' ? checkIcon : '',
            action: () => { fontPrefs.fontSize = '1.3rem'; applyFontPrefs(); }
          },
          { label: 'Line Spacing', separator: true },
          {
            label: 'Compact (1.3)',
            icon: currentLine === '1.3' ? checkIcon : '',
            action: () => { fontPrefs.lineHeight = '1.3'; applyFontPrefs(); }
          },
          {
            label: 'Standard (1.7)',
            icon: currentLine === '1.7' ? checkIcon : '',
            action: () => { fontPrefs.lineHeight = '1.7'; applyFontPrefs(); }
          },
          {
            label: 'Relaxed (2.1)',
            icon: currentLine === '2.1' ? checkIcon : '',
            action: () => { fontPrefs.lineHeight = '2.1'; applyFontPrefs(); }
          },
          { label: 'Text Formatting', separator: true },
          {
            label: 'Bold',
            shortcut: 'Ctrl+B',
            icon: '<strong style="font-size:13px; width:14px; display:inline-block; text-align:center;">B</strong>',
            action: () => document.execCommand('bold')
          },
          {
            label: 'Italic',
            shortcut: 'Ctrl+I',
            icon: '<em style="font-size:13px; width:14px; display:inline-block; text-align:center;">I</em>',
            action: () => document.execCommand('italic')
          },
          {
            label: 'Heading',
            icon: '<strong style="font-size:13px; width:14px; display:inline-block; text-align:center;">H</strong>',
            action: () => document.execCommand('formatBlock', false, '<h3>')
          },
          {
            label: 'Interactive Checklist',
            icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
            action: () => document.execCommand('insertHTML', false, '<input type="checkbox" class="note-chk"> Task item<br>')
          },
          {
            label: 'Bullet List',
            icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
            action: () => document.execCommand('insertUnorderedList')
          },
          { label: 'Paper Style', separator: true },
          {
            label: 'Blank Paper',
            icon: currentPaper === 'blank' ? checkIcon : '',
            action: () => setPageType('blank')
          },
          {
            label: 'Ruled Lined Paper',
            icon: currentPaper === 'lined' ? checkIcon : '',
            action: () => setPageType('lined')
          },
          {
            label: 'Grid Paper',
            icon: currentPaper === 'grid' ? checkIcon : '',
            action: () => setPageType('grid')
          },
          {
            label: 'Dot Matrix',
            icon: currentPaper === 'dot' ? checkIcon : '',
            action: () => setPageType('dot')
          },
          { label: 'Note Actions', separator: true },
          {
            label: getActiveNote()?.pinned ? 'Unpin Note' : 'Pin Note',
            icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-2l-2-3V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7l-2 3v2z"/></svg>',
            action: () => {
              const note = getActiveNote();
              if (!note) return;
              note.pinned = !note.pinned;
              saveNotes();
              renderActiveNote();
              renderNoteList();
            }
          },
          {
            label: 'Export as Markdown',
            icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            action: () => {
              const note = getActiveNote();
              if (!note) return;
              const content = `# ${note.title}\n\n${note.body}`;
              const blob = new Blob([content], { type: 'text/markdown' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${note.title || 'note'}.md`;
              a.click();
              URL.revokeObjectURL(a.href);
            }
          },
          {
            label: 'Delete Note',
            icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            action: () => {
              const note = getActiveNote();
              if (!note) return;
              if (confirm(`Delete "${note.title || 'Untitled'}"?`)) {
                notes = notes.filter(n => n.id !== note.id);
                if (notes.length === 0) {
                  notes.push({
                    id: 'note-' + Date.now(),
                    title: 'Untitled Note',
                    body: '',
                    folder: activeFolder === 'all' ? 'quick' : activeFolder,
                    pinned: false,
                    hashtags: [],
                    updatedAt: Date.now()
                  });
                }
                activeNoteId = notes[0].id;
                saveNotes();
                renderActiveNote();
                renderNoteList();
              }
            }
          }
        ]
      });
    }

    // Connect context menu button and body editor right-click to dropdown
    contextMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openFontSettingsMenu(e.currentTarget, 0, 0);
    });

    bodyEditor?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openFontSettingsMenu(null, e.clientX, e.clientY);
    });

    editorContainer?.addEventListener('contextmenu', (e) => {
      if (e.target === editorContainer || e.target === bodyEditor) {
        e.preventDefault();
        openFontSettingsMenu(null, e.clientX, e.clientY);
      }
    });

    // Context Menu Integration for Note Cards
    cardsListEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cardEl = e.target.closest('.note-card-item');
      if (cardEl) {
        const noteId = cardEl.dataset.id;
        const targetNote = notes.find(n => n.id === noteId);
        if (!targetNote) return;

        openContextMenu({
          x: e.clientX,
          y: e.clientY,
          title: targetNote.title || 'Note',
          items: [
            {
              label: 'Open Note',
              icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg>',
              action: () => {
                activeNoteId = targetNote.id;
                renderActiveNote();
                renderNoteList();
                toggleNotesDrawer(false);
              }
            },
            {
              label: targetNote.pinned ? 'Unpin Note' : 'Pin to Top',
              icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-2l-3-3V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v7l-3 3v2z"></path></svg>',
              shortcut: targetNote.pinned ? 'Pinned' : '',
              action: () => {
                targetNote.pinned = !targetNote.pinned;
                saveNotes();
                renderActiveNote();
                renderNoteList();
              }
            },
            {
              label: 'Duplicate Note',
              icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
              action: () => {
                const dup = {
                  ...JSON.parse(JSON.stringify(targetNote)),
                  id: 'note-' + Date.now(),
                  title: targetNote.title + ' (Copy)',
                  updatedAt: Date.now()
                };
                notes.unshift(dup);
                activeNoteId = dup.id;
                saveNotes();
                renderActiveNote();
                renderNoteList();
                toggleNotesDrawer(false);
              }
            },
            {
              label: 'Add Hashtag…',
              icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>',
              action: async () => {
                const raw = await tbPrompt('Enter hashtag for this note:', '#', { title: 'Add Hashtag' });
                if (!raw) return;
                let formatted = raw.trim().toLowerCase();
                if (!formatted.startsWith('#')) formatted = '#' + formatted;
                formatted = formatted.replace(/[^a-z0-9_\-#]/g, '');
                targetNote.hashtags = targetNote.hashtags || [];
                if (formatted.length > 1 && !targetNote.hashtags.includes(formatted)) {
                  targetNote.hashtags.push(formatted);
                  saveNotes();
                  renderEditorHashtags();
                  renderNoteList();
                }
              }
            },
            {
              label: 'Export as Markdown',
              icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
              action: () => {
                const content = `# ${targetNote.title}\n\n${targetNote.body}`;
                const blob = new Blob([content], { type: 'text/markdown' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${targetNote.title || 'note'}.md`;
                a.click();
                URL.revokeObjectURL(a.href);
              }
            },
            { separator: true },
            {
              label: 'Delete Note',
              destructive: true,
              icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
              action: async () => {
                if (!await tbConfirm('Permanently delete "' + (targetNote.title || 'Note') + '"?', { title: 'Delete Note', destructive: true })) return;
                notes = notes.filter(n => n.id !== targetNote.id);
                if (activeNoteId === targetNote.id) {
                  activeNoteId = notes.length ? notes[0].id : null;
                }
                saveNotes();
                renderActiveNote();
                renderNoteList();
              }
            }
          ]
        });
      } else {
        openContextMenu({
          x: e.clientX,
          y: e.clientY,
          title: 'Notes',
          items: [
            {
              label: 'New Note',
              icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
              action: () => addBtn.click()
            }
          ]
        });
      }
    });

    // New folder prompt
    container.querySelector('#notes-new-folder')?.addEventListener('click', async () => {
      const name = await tbPrompt('Enter folder name:', '', { title: 'New Folder' });
      if (name && name.trim()) {
        const folderKey = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
        const folderList = container.querySelector('.notes-folder-list');
        if (folderList) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'notes-folder-btn';
          btn.dataset.folder = folderKey;
          btn.innerHTML = `<span>${escapeHtml(name.trim())}</span><span class="notes-folder-count" data-count-folder="${folderKey}">0</span>`;
          btn.addEventListener('click', () => {
            container.querySelectorAll('.notes-folder-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFolder = folderKey;
            activeHashtag = null;
            mobileView = 'notes';
            updateMobileView();
            toggleNotesDrawer(false);
            renderNoteList();
          });
          folderList.appendChild(btn);
          btn.click();
        }
      }
    });

    // Initialize display
    updateMobileView();
    renderNoteList();
    renderActiveNote();
  }
};

function injectNotesCSS() {
  if (document.getElementById('notes-injected-styles')) return;
  const style = document.createElement('style');
  style.id = 'notes-injected-styles';
  style.textContent = `
    .note-pill-tag {
      font-size: 0.65rem;
      padding: 1px 6px;
      border-radius: 9999px;
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      font-family: var(--mono);
    }
    .note-sidebar-tag {
      font-size: 0.72rem;
      padding: 3px 9px;
      border-radius: 9999px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.12s ease;
      font-family: var(--mono);
    }
    .note-sidebar-tag:hover {
      background: var(--bg-hover);
      color: var(--text);
    }
    .note-sidebar-tag.active {
      background: var(--text);
      color: var(--bg-card);
      border-color: var(--text);
    }
    .note-editor-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 9999px;
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      color: var(--text);
      font-family: var(--mono);
    }
    .note-editor-tag-del {
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.85rem;
      line-height: 1;
      padding: 0;
    }
    .note-editor-tag-del:hover {
      color: #ef4444;
    }
    .note-editor-add-tag-btn {
      border: 1px dashed var(--border);
      background: none;
      color: var(--text-muted);
      font-size: 0.72rem;
      border-radius: 9999px;
      padding: 2px 8px;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .note-editor-add-tag-btn:hover {
      border-color: var(--text);
      color: var(--text);
    }

    .notes-app-wrapper {
      background: var(--bg-card) !important;
      border: 1px solid var(--border) !important;
      color: var(--text) !important;
    }
    .notes-sidebar-col {
      background: var(--bg-subtle) !important;
      border-right: 1px solid var(--border) !important;
      color: var(--text) !important;
    }
    .notes-list-col {
      background: var(--bg-card) !important;
      border-right: 1px solid var(--border) !important;
      color: var(--text) !important;
    }
    .notes-editor-col {
      background: var(--bg-card) !important;
      color: var(--text) !important;
    }
    .notes-toolbar-top {
      background: var(--bg-subtle) !important;
      border-bottom: 1px solid var(--border) !important;
    }
    .notes-footer-bar {
      background: var(--bg-subtle) !important;
      border-top: 1px solid var(--border) !important;
      color: var(--text-muted) !important;
    }

    .notes-folder-btn {
      padding: 8px 12px;
      border: 1px solid transparent;
      background: transparent;
      border-radius: 9999px;
      font-size: 0.84rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-align: left;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .notes-folder-btn:hover { background: var(--bg-hover); color: var(--text); }
    .notes-folder-btn.active {
      background: var(--bg-card) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      font-weight: 700;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    .notes-folder-count {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 9999px;
      background: var(--bg-subtle);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .notes-folder-btn.active .notes-folder-count {
      background: var(--bg-hover);
      color: var(--text);
    }
    
    .note-card-item {
      color: var(--text);
      border-bottom: 1px solid var(--border-subtle);
    }
    .note-card-item:hover { background: var(--bg-hover) !important; }
    .note-card-item.active {
      background: var(--bg-hover) !important;
      border-left: 3px solid var(--text) !important;
    }

    .notes-paper-blank {
      background-color: var(--bg-card) !important;
      color: var(--text) !important;
    }
    .notes-paper-lined {
      background-color: var(--bg-card) !important;
      background-image: repeating-linear-gradient(transparent, transparent 27px, var(--border) 28px) !important;
      line-height: 28px !important;
      color: var(--text) !important;
    }
    .notes-paper-grid {
      background-color: var(--bg-card) !important;
      background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px) !important;
      background-size: 20px 20px !important;
      color: var(--text) !important;
    }
    .notes-paper-dot {
      background-color: var(--bg-card) !important;
      background-image: radial-gradient(var(--border) 1.5px, transparent 1.5px) !important;
      background-size: 18px 18px !important;
      color: var(--text) !important;
    }

    #note-title-input {
      color: var(--text) !important;
    }
    #note-title-input::placeholder {
      color: var(--text-muted) !important;
    }
    #note-body-editor {
      color: var(--text) !important;
    }
    #note-meta-line {
      color: var(--text-muted) !important;
    }

    .note-chk {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      cursor: pointer;
      accent-color: #3b82f6;
      vertical-align: middle;
      margin-right: 6px;
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
