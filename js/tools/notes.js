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
    let notes = loadNotes();
    let activeNoteId = notes.length ? notes[0].id : null;
    let activeFolder = 'all';
    let activeHashtag = null;
    let activePaper = 'blank';

    container.innerHTML = `
      <div class="notes-app-wrapper" style="display:grid; grid-template-columns:minmax(180px, 220px) minmax(220px, 280px) 1fr; height:720px; max-height:85vh; min-height:500px; background:var(--bg-card); border:1px solid var(--border); border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.04);">
        
        <!-- 1. FOLDERS SIDEBAR -->
        <div class="notes-sidebar-col" style="background:var(--bg-subtle); border-right:1px solid var(--border); display:flex; flex-direction:column; justify-content:space-between; padding:14px; min-height:0; overflow-y:auto;">
          <div>
            <div style="font-weight:700; font-size:0.95rem; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Notes
            </div>
            
            <div class="notes-folder-list" style="display:flex; flex-direction:column; gap:4px;">
              <button type="button" class="notes-folder-btn active" data-folder="all">All Notes</button>
              <button type="button" class="notes-folder-btn" data-folder="quick">Quick Notes</button>
              <button type="button" class="notes-folder-btn" data-folder="work">Work</button>
              <button type="button" class="notes-folder-btn" data-folder="personal">Personal</button>
              <button type="button" class="notes-folder-btn" data-folder="archive">Archive</button>
            </div>
          </div>

          <div style="margin-top:16px;">
            <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Hashtags</div>
            <div id="notes-tags-sidebar" style="display:flex; flex-wrap:wrap; gap:4px; max-height:120px; overflow-y:auto;"></div>
          </div>
          <div style="margin-top:12px;">
            <button type="button" class="btn btn-secondary btn-sm" id="notes-new-folder" style="width:100%;">+ New Folder</button>
          </div>
        </div>

        <!-- 2. NOTE LIST COLUMN -->
        <div class="notes-list-col" style="background:var(--bg-card); border-right:1px solid var(--border); display:flex; flex-direction:column; min-height:0; overflow:hidden;">
          <!-- Top Bar with Search & New Note -->
          <div style="padding:12px; border-bottom:1px solid var(--border); display:flex; gap:8px; align-items:center; flex-shrink:0;">
            <input type="text" id="notes-search-input" class="tool-input" placeholder="Search notes..." style="flex:1; font-size:0.8rem; padding:6px 10px;">
            <button type="button" class="btn btn-primary btn-sm" id="notes-add-btn" title="Create New Note" style="padding:6px 12px; font-weight:600; flex-shrink:0;">+ New</button>
          </div>

          <!-- Note Cards Scroll List -->
          <div id="notes-cards-list" style="flex:1; overflow-y:auto; min-height:0; display:flex; flex-direction:column;"></div>
        </div>

        <!-- 3. MAIN EDITOR AREA -->
        <div class="notes-editor-col" style="display:flex; flex-direction:column; background:var(--bg-card); position:relative; min-height:0; overflow:hidden;">
          <!-- Editor Toolbar -->
          <div class="notes-toolbar-top" style="padding:8px 14px; border-bottom:1px solid var(--border); background:var(--bg-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
              <button type="button" class="notes-tool-btn" id="tool-bold" title="Bold"><strong>B</strong></button>
              <button type="button" class="notes-tool-btn" id="tool-italic" title="Italic"><em>I</em></button>
              <button type="button" class="notes-tool-btn" id="tool-heading" title="Heading"><strong>H</strong></button>
              <button type="button" class="notes-tool-btn" id="tool-checklist" title="Interactive Checklist">Checklist</button>
              <button type="button" class="notes-tool-btn" id="tool-bullet" title="Bullet List">Bullet List</button>
            </div>

            <!-- Paper Background Style & Export Dropdown -->
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <select id="notes-paper-select" class="tool-input" style="font-size:0.76rem; padding:4px 8px; width:100px;">
                <option value="blank">Blank Paper</option>
                <option value="lined">Ruled Lined</option>
                <option value="grid">Grid Paper</option>
                <option value="dot">Dot Matrix</option>
              </select>
              <button type="button" class="btn btn-secondary btn-sm" id="notes-pin-btn" title="Pin Note">Pin</button>
              <button type="button" class="btn btn-secondary btn-sm" id="notes-export-btn" title="Export Note">Export</button>
              <button type="button" class="btn btn-secondary btn-sm" id="notes-delete-btn" title="Delete Note" style="color:#ef4444;">Delete</button>
            </div>
          </div>

          <!-- Note Content Area -->
          <div id="notes-editor-container" class="notes-paper-blank" style="flex:1; overflow-y:auto; min-height:0; padding:24px 32px; display:flex; flex-direction:column; gap:12px;">
            <input type="text" id="note-title-input" placeholder="Title" style="font-size:1.5rem; font-weight:700; border:none; outline:none; background:transparent; width:100%; color:var(--text);">
            <div id="note-meta-line" style="font-size:0.75rem; color:var(--text-muted); font-family:var(--mono);"></div>
            <div id="note-hashtags-bar" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-height:24px;"></div>
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
    const paperSelect = container.querySelector('#notes-paper-select');
    const editorContainer = container.querySelector('#notes-editor-container');
    const pinBtn = container.querySelector('#notes-pin-btn');
    const deleteBtn = container.querySelector('#notes-delete-btn');
    const exportBtn = container.querySelector('#notes-export-btn');

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
          body: 'This is a clean, 100% offline note space with checklist support, pinned notes, paper textures, and folder organization.\n\n[x] Completed checklist task\n[ ] Tap to complete task\n[ ] Switch paper background to Ruled or Grid\n\nAll notes are automatically saved to local storage.',
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
      } catch {}
    }

    function getActiveNote() {
      return notes.find(n => n.id === activeNoteId);
    }

    function renderNoteList() {
      renderTagsSidebar();
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
        cardsListEl.innerHTML = `<div style="padding:32px 14px; text-align:center; font-size:0.8rem; color:var(--g400);">No notes in this folder.</div>`;
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

      titleInput.value = note.title;
      bodyEditor.innerHTML = formatBodyForDisplay(note.body);
      metaLine.textContent = `Last modified: ${new Date(note.updatedAt).toLocaleString()}`;
      pinBtn.textContent = note.pinned ? 'Unpin' : 'Pin';
      updateCounts();
      renderEditorHashtags();
    }

    function formatBodyForDisplay(body) {
      if (!body) return '';
      let html = body.replace(/\[x\]/gi, '<input type="checkbox" checked class="note-chk"> ')
                     .replace(/\[ \]/g, '<input type="checkbox" class="note-chk"> ');
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
        note.title = titleInput.value;
        const autoTags = extractHashtags(note.title + ' ' + (note.body || ''));
        autoTags.forEach(t => { if (!note.hashtags.includes(t)) note.hashtags.push(t); });
        note.updatedAt = Date.now();
        saveNotes();
        renderNoteList();
      }
    });

    bodyEditor.addEventListener('input', () => {
      const note = getActiveNote();
      if (note) {
        note.body = bodyEditor.innerText;
        const autoTags = extractHashtags(note.title + ' ' + (note.body || ''));
        autoTags.forEach(t => { if (!note.hashtags.includes(t)) note.hashtags.push(t); });
        note.updatedAt = Date.now();
        saveNotes();
        renderNoteList();
        updateCounts();
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
      titleInput.focus();
    });

    pinBtn.addEventListener('click', () => {
      const note = getActiveNote();
      if (note) {
        note.pinned = !note.pinned;
        pinBtn.textContent = note.pinned ? 'Unpin' : 'Pin';
        saveNotes();
        renderNoteList();
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!await tbConfirm('Are you sure you want to delete this note?', { title: 'Delete Note', destructive: true })) return;
      notes = notes.filter(n => n.id !== activeNoteId);
      activeNoteId = notes.length ? notes[0].id : null;
      saveNotes();
      renderActiveNote();
      renderNoteList();
    });

    folderBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        folderBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFolder = btn.dataset.folder;
        renderNoteList();
      });
    });

    searchInput.addEventListener('input', renderNoteList);

    paperSelect.addEventListener('change', () => {
      activePaper = paperSelect.value;
      editorContainer.className = `notes-paper-${activePaper}`;
    });

    // Formatting buttons
    container.querySelector('#tool-bold')?.addEventListener('click', () => document.execCommand('bold'));
    container.querySelector('#tool-italic')?.addEventListener('click', () => document.execCommand('italic'));
    container.querySelector('#tool-heading')?.addEventListener('click', () => document.execCommand('formatBlock', false, '<h3>'));
    container.querySelector('#tool-bullet')?.addEventListener('click', () => document.execCommand('insertUnorderedList'));
    container.querySelector('#tool-checklist')?.addEventListener('click', () => {
      document.execCommand('insertHTML', false, '<input type="checkbox" class="note-chk"> Task item<br>');
    });

    exportBtn.addEventListener('click', () => {
      const note = getActiveNote();
      if (!note) return;
      const content = `# ${note.title}\n\n${note.body}`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${note.title || 'note'}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    
    // Context Menu Integration for Notes
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
                  renderActiveNote();
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
        // Right clicked blank area
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
          btn.textContent = name.trim();
          btn.addEventListener('click', () => {
            container.querySelectorAll('.notes-folder-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFolder = folderKey;
            renderNoteList();
          });
          folderList.appendChild(btn);
          btn.click();
        }
      }
    });

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
      padding: 2px 8px;
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
      background: var(--black);
      color: var(--white);
      border-color: var(--black);
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
      padding: 8px 10px;
      border: 1px solid transparent;
      background: transparent;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-align: left;
      cursor: pointer;
      transition: all 0.15s;
    }
    .notes-folder-btn:hover { background: var(--bg-hover); color: var(--text); }
    .notes-folder-btn.active {
      background: var(--bg-card) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
      font-weight: 700;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
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

    .notes-tool-btn {
      padding: 5px 9px;
      font-size: 0.78rem;
      background: var(--bg-card) !important;
      color: var(--text) !important;
      border: 1px solid var(--border) !important;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, border-color 0.15s;
    }
    .notes-tool-btn:hover {
      background: var(--bg-hover) !important;
      border-color: var(--border-subtle) !important;
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