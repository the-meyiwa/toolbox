/* ============================================================
   Spaces View — The Shared Desk.

   "Local by default. Shared by intention."
   Main view coordinator for spaces directory, creation, join,
   and the Space Desk workspace.
   ============================================================ */

import { SpaceEngine, listJoinedSpaces, removeJoinedSpace, getUserProfile, saveUserProfile, prewarmSignaling } from '../lib/space-engine.js';
import {
  mountDeskOverview,
  mountArtifactsView,
  mountDiscussionView,
  mountTasksView,
  mountLiveSessionsView,
  mountChallengesView,
  mountMembersView,
} from '../lib/space-activities.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {HTMLElement} host
 * @param {string|null} rawPath — e.g. "X7K2MP" or "X7K2MP/artifacts"
 * @returns {() => void} teardown
 */
export function renderSpaces(host, rawPath = null) {
  prewarmSignaling();
  let engine = new SpaceEngine();
  let currentTab = 'desk'; // 'desk' | 'artifacts' | 'discussion' | 'tasks' | 'live' | 'challenges' | 'members'
  let unmountActivity = null;
  let viewState = 'directory'; // 'directory' | 'create' | 'join' | 'connecting' | 'room'

  let targetCode = null;
  if (rawPath) {
    const parts = rawPath.split('/');
    targetCode = parts[0] ? parts[0].toUpperCase() : null;
    if (parts[1]) currentTab = parts[1];
  }

  const teardown = () => {
    unmountActivity?.();
    unmountActivity = null;
    engine.leave();
  };

  const render = () => {
    unmountActivity?.();
    unmountActivity = null;

    if (viewState === 'directory') {
      renderDirectory();
    } else if (viewState === 'create') {
      renderCreateForm();
    } else if (viewState === 'join') {
      renderJoinForm();
    } else if (viewState === 'connecting') {
      host.innerHTML = `
        <div class="sp-landing fade-in">
          <div class="sp-connecting-card">
            <div class="sp-pulse-ring"></div>
            <h2 class="sp-landing-title" style="margin-top:16px;">Connecting to Space…</h2>
            <p class="sp-landing-desc">Establishing peer-to-peer data channels.</p>
            <div class="sp-connecting-hint">Code: <strong>${escapeHtml(engine.roomCode || targetCode || '')}</strong></div>
          </div>
        </div>
      `;
    } else if (viewState === 'room') {
      renderRoom();
    }
  };

  /* --------------- Directory / Landing --------------- */

  function renderDirectory() {
    const joined = listJoinedSpaces();
    const profile = getUserProfile();

    host.innerHTML = `
      <div class="sp-directory fade-in">
        <!-- Hero Header -->
        <header class="sp-dir-hero">
          <div class="sp-dir-eyebrow">Toolbox Collaboration</div>
          <h1 class="sp-dir-title">Spaces</h1>
          <p class="sp-dir-sub">Persistent, real-time shared desks for groups. Local by default, shared by intention.</p>
          <div class="sp-dir-actions">
            <button class="btn btn-primary" data-act="go-create">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Create a Space
            </button>
            <button class="btn btn-secondary" data-act="go-join">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
              Join with Code
            </button>
          </div>
        </header>

        <!-- Privacy & Security Tag Strip -->
        <div class="sp-privacy-card">
          <div class="sp-privacy-pill">
            <span class="sp-dot-live"></span>
            <strong>Peer-to-Peer</strong>
          </div>
          <div class="sp-privacy-text">
            Everything in Personal Toolbox remains 100% on your device. Data is only transmitted when you explicitly click <em>"Share to Space"</em>.
          </div>
        </div>

        ${joined.length ? `
          <div class="sp-section-head" style="margin-top:36px;">
            <div>
              <h2 class="sp-section-title">Your Spaces</h2>
              <span class="sp-section-sub">Spaces saved on this browser</span>
            </div>
            <span class="sp-badge">${joined.length} Space${joined.length === 1 ? '' : 's'}</span>
          </div>
          <div class="sp-spaces-grid">
            ${joined.map(s => `
              <div class="sp-card" data-code="${s.id}">
                <div class="sp-card-top">
                  <span class="sp-code-badge" title="Room Code">${s.id}</span>
                  <span class="sp-role-pill is-${s.role}">${s.role}</span>
                </div>
                <h3 class="sp-card-name">${escapeHtml(s.name)}</h3>
                <p class="sp-card-desc">${escapeHtml(s.description || 'Collaborative project desk')}</p>
                <div class="sp-card-footer">
                  <button class="btn btn-primary btn-sm" data-open-space="${s.id}">
                    Enter Desk
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                  <button class="sp-card-remove-btn" data-remove-space="${s.id}" title="Remove from list">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="sp-empty-directory">
            <div class="sp-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h3 class="sp-empty-title">No spaces joined yet</h3>
            <p class="sp-empty-desc">Create a space for your team or study group, or enter a room code from a colleague to get started.</p>
            <div style="display:flex; gap:10px; margin-top:8px;">
              <button class="btn btn-primary btn-sm" data-act="go-create">Create Space</button>
              <button class="btn btn-secondary btn-sm" data-act="go-join">Join with Code</button>
            </div>
          </div>
        `}
      </div>
    `;
  }

  /* --------------- Create Form --------------- */

  function renderCreateForm() {
    const profile = getUserProfile();

    host.innerHTML = `
      <div class="sp-landing fade-in">
        <div class="sp-form-card">
          <div class="sp-form-card-head">
            <button class="sp-back-btn" data-act="go-directory">← Back</button>
            <span class="sp-badge">New Space</span>
          </div>
          <h2 class="sp-landing-title">Create a Space</h2>
          <p class="sp-landing-desc">Set up a shared desk for your team, study room, or project.</p>
          <form class="sp-create-form" id="form-create">
            <div class="sp-form-group">
              <label class="sp-form-label">Space Name</label>
              <input type="text" class="tool-input" id="sp-create-name" placeholder="e.g. Engineering, Biology Lab, Study Group" required autocomplete="off">
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Description (Optional)</label>
              <input type="text" class="tool-input" id="sp-create-desc" placeholder="What will you be working on?" autocomplete="off">
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Your Display Name</label>
              <input type="text" class="tool-input" id="sp-create-user" value="${escapeHtml(profile.name || '')}" placeholder="e.g. Nifemi, Alex" required autocomplete="off">
            </div>
            <div class="sp-form-actions">
              <button type="submit" class="btn btn-primary">Create Space →</button>
              <button type="button" class="btn btn-secondary" data-act="go-directory">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /* --------------- Join Form --------------- */

  function renderJoinForm() {
    const profile = getUserProfile();

    host.innerHTML = `
      <div class="sp-landing fade-in">
        <div class="sp-form-card">
          <div class="sp-form-card-head">
            <button class="sp-back-btn" data-act="go-directory">← Back</button>
            <span class="sp-badge">Join</span>
          </div>
          <h2 class="sp-landing-title">Join a Space</h2>
          <p class="sp-landing-desc">Enter the 6-character room code shared by your peer.</p>
          <form class="sp-join-form" id="form-join">
            <div class="sp-form-group">
              <label class="sp-form-label">Room Code</label>
              <input type="text" class="tool-input sp-input-code" id="sp-join-code" value="${escapeHtml(targetCode || '')}" required maxlength="6" placeholder="X7K2MP" autocomplete="off" spellcheck="false">
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Your Display Name</label>
              <input type="text" class="tool-input" id="sp-join-user" value="${escapeHtml(profile.name || '')}" placeholder="e.g. Dorcas, Jordan" required autocomplete="off">
            </div>
            <div class="sp-form-actions">
              <button type="submit" class="btn btn-primary">Enter Space →</button>
              <button type="button" class="btn btn-secondary" data-act="go-directory">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /* --------------- Space Room (Desk) --------------- */

  function renderRoom() {
    const onlineCount = engine.onlineMembers.size;

    host.innerHTML = `
      <div class="sp-room fade-in">
        <!-- Room Topbar -->
        <header class="sp-room-header">
          <div class="sp-room-title-area">
            <div class="sp-title-row">
              <button class="sp-back-btn" data-act="go-directory" title="Back to Spaces directory">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Spaces
              </button>
              <div class="sp-title-group">
                <h2 class="sp-room-title">${escapeHtml(engine.spaceName)}</h2>
                <button class="sp-code-pill" data-act="copy-code" title="Click to copy room code">
                  <span>${engine.roomCode}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <span class="sp-role-pill is-${engine.role}">${engine.role}</span>
              </div>
            </div>
            <div class="sp-room-sub">
              <span class="sp-online-tag">
                <span class="sp-dot-live"></span>
                ${onlineCount} active peer${onlineCount === 1 ? '' : 's'}
              </span>
              <span class="sp-sub-sep">·</span>
              <span>Encrypted P2P Session</span>
            </div>
          </div>

          <div class="sp-room-header-actions">
            <button class="btn btn-secondary btn-sm" data-act="copy-invite">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              Share Invite
            </button>
            <button class="btn btn-secondary btn-sm sp-leave-btn" data-act="leave-room">
              Leave Desk
            </button>
          </div>
        </header>

        <!-- Navigation Tabs (Segmented Bar) -->
        <nav class="sp-room-nav">
          <button class="sp-nav-tab ${currentTab === 'desk' ? 'is-active' : ''}" data-tab="desk">
            <span class="sp-tab-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </span>
            Desk
          </button>
          <button class="sp-nav-tab ${currentTab === 'artifacts' ? 'is-active' : ''}" data-tab="artifacts">
            <span class="sp-tab-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </span>
            Artifacts &amp; Files
          </button>
          <button class="sp-nav-tab ${currentTab === 'discussion' ? 'is-active' : ''}" data-tab="discussion">
            <span class="sp-tab-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </span>
            Discussion
          </button>
          <button class="sp-nav-tab ${currentTab === 'tasks' ? 'is-active' : ''}" data-tab="tasks">
            <span class="sp-tab-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            </span>
            Tasks
          </button>
          <button class="sp-nav-tab ${currentTab === 'live' ? 'is-active' : ''}" data-tab="live">
            <span class="sp-tab-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </span>
            Live Sessions
          </button>
          <button class="sp-nav-tab ${currentTab === 'challenges' ? 'is-active' : ''}" data-tab="challenges">
            <span class="sp-tab-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
            </span>
            Challenges
          </button>
          <button class="sp-nav-tab ${currentTab === 'members' ? 'is-active' : ''}" data-tab="members">
            <span class="sp-tab-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </span>
            Members
          </button>
        </nav>

        <!-- Main Tab Content Area -->
        <div class="sp-room-content"></div>
      </div>
    `;

    mountTab();
  }

  function mountTab() {
    unmountActivity?.();
    unmountActivity = null;

    const content = host.querySelector('.sp-room-content');
    if (!content) return;

    if (currentTab === 'desk') {
      unmountActivity = mountDeskOverview(content, engine);
    } else if (currentTab === 'artifacts') {
      unmountActivity = mountArtifactsView(content, engine);
    } else if (currentTab === 'discussion') {
      unmountActivity = mountDiscussionView(content, engine);
    } else if (currentTab === 'tasks') {
      unmountActivity = mountTasksView(content, engine);
    } else if (currentTab === 'live') {
      unmountActivity = mountLiveSessionsView(content, engine);
    } else if (currentTab === 'challenges') {
      unmountActivity = mountChallengesView(content, engine);
    } else if (currentTab === 'members') {
      unmountActivity = mountMembersView(content, engine);
    }
  }

  /* --------------- Interaction Wiring --------------- */

  const onClick = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;

    if (act === 'go-create') {
      viewState = 'create';
      render();
      return;
    }

    if (act === 'go-join') {
      viewState = 'join';
      render();
      return;
    }

    if (act === 'go-directory') {
      if (viewState === 'room') {
        engine.leave();
        engine = new SpaceEngine();
      }
      history.replaceState(null, '', '#spaces');
      viewState = 'directory';
      render();
      return;
    }

    if (act === 'leave-room') {
      engine.leave();
      engine = new SpaceEngine();
      history.replaceState(null, '', '#spaces');
      viewState = 'directory';
      render();
      return;
    }

    if (act === 'copy-code' || act === 'copy-invite') {
      const link = window.location.origin + window.location.pathname + '#spaces/' + engine.roomCode;
      navigator.clipboard.writeText(link);
      const btn = e.target.closest('[data-act]');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<span style="color:#059669; font-weight:600;">Copied link!</span>`;
      setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
      return;
    }

    // Open space from directory
    const openSpaceBtn = e.target.closest('[data-open-space]');
    if (openSpaceBtn) {
      const code = openSpaceBtn.dataset.openSpace;
      const profile = getUserProfile();
      const name = profile.name || 'User';
      viewState = 'connecting';
      render();
      try {
        await engine.join({ roomCode: code, displayName: name });
        history.replaceState(null, '', '#spaces/' + code);
        viewState = 'room';
      } catch (err) {
        console.error('Failed to open space', err);
        viewState = 'directory';
      }
      render();
      return;
    }

    // Remove space bookmark
    const removeSpaceBtn = e.target.closest('[data-remove-space]');
    if (removeSpaceBtn) {
      const code = removeSpaceBtn.dataset.removeSpace;
      if (confirm(`Remove ${code} from your saved spaces list?`)) {
        removeJoinedSpace(code);
        renderDirectory();
      }
      return;
    }

    // Tab switching
    const navTab = e.target.closest('[data-tab]');
    if (navTab && viewState === 'room') {
      const tab = navTab.dataset.tab;
      if (tab !== currentTab) {
        currentTab = tab;
        history.replaceState(null, '', `#spaces/${engine.roomCode}/${tab}`);
        Array.from(host.querySelectorAll('.sp-nav-tab')).forEach(t => t.classList.toggle('is-active', t.dataset.tab === tab));
        mountTab();
      }
      return;
    }

    // Cross-tab jumps from desk shortcuts
    const goTabBtn = e.target.closest('[data-go-tab]');
    if (goTabBtn && viewState === 'room') {
      const tab = goTabBtn.dataset.goTab;
      currentTab = tab;
      history.replaceState(null, '', `#spaces/${engine.roomCode}/${tab}`);
      Array.from(host.querySelectorAll('.sp-nav-tab')).forEach(t => t.classList.toggle('is-active', t.dataset.tab === tab));
      mountTab();
      return;
    }
  };

  const onSubmit = async (e) => {
    if (e.target.id === 'form-create' && viewState === 'create') {
      e.preventDefault();
      const spaceName = host.querySelector('#sp-create-name').value;
      const description = host.querySelector('#sp-create-desc').value;
      const displayName = host.querySelector('#sp-create-user').value;

      saveUserProfile({ name: displayName });
      viewState = 'connecting';
      render();
      try {
        const code = await engine.create({ spaceName, description, displayName });
        history.replaceState(null, '', '#spaces/' + code);
        viewState = 'room';
      } catch (err) {
        console.error('Failed to create space', err);
        viewState = 'create';
      }
      render();
      return;
    }

    if (e.target.id === 'form-join' && viewState === 'join') {
      e.preventDefault();
      const code = host.querySelector('#sp-join-code').value.toUpperCase().trim();
      const displayName = host.querySelector('#sp-join-user').value.trim();

      saveUserProfile({ name: displayName });
      viewState = 'connecting';
      render();
      try {
        await engine.join({ roomCode: code, displayName });
        history.replaceState(null, '', '#spaces/' + code);
        viewState = 'room';
      } catch (err) {
        console.error('Failed to join space', err);
        viewState = 'join';
      }
      render();
      return;
    }
  };

  host.addEventListener('click', onClick);
  host.addEventListener('submit', onSubmit);

  const updateHeaderInfo = () => {
    if (viewState === 'room') {
      const titleEl = host.querySelector('.sp-room-title');
      if (titleEl && engine.spaceName) titleEl.textContent = engine.spaceName;
      const tagEl = host.querySelector('.sp-online-tag');
      if (tagEl) {
        const count = engine.onlineMembers.size;
        tagEl.innerHTML = `<span class="sp-dot-live"></span> ${count} active peer${count === 1 ? '' : 's'}`;
      }
    }
  };

  engine.on('meta-update', updateHeaderInfo);
  engine.on('peer-update', updateHeaderInfo);

  engine.on('disconnected', () => {
    if (viewState === 'room') {
      engine = new SpaceEngine();
      viewState = 'directory';
      render();
    }
  });

  // Auto-connect if target code is provided in URL
  if (targetCode) {
    const profile = getUserProfile();
    if (profile.name) {
      viewState = 'connecting';
      render();
      engine.join({ roomCode: targetCode, displayName: profile.name })
        .then(() => {
          viewState = 'room';
          render();
        })
        .catch(err => {
          console.error(err);
          viewState = 'join';
          render();
        });
    } else {
      viewState = 'join';
      render();
    }
  } else {
    render();
  }

  return () => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('submit', onSubmit);
    teardown();
  };
}
