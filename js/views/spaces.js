/* ============================================================
   Spaces View — The Shared Desk.

   "Local by default. Shared by intention."
   Main view coordinator for spaces directory, creation, join,
   and the Space Desk workspace.
   ============================================================ */

import { SpaceEngine, listJoinedSpaces, removeJoinedSpace, getUserProfile, saveUserProfile } from '../lib/space-engine.js';
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
        <div class="sp-landing">
          <div class="sp-loading-spinner"></div>
          <h2 class="sp-landing-title">Connecting to Space…</h2>
          <p class="sp-landing-desc">Establishing peer-to-peer data channels.</p>
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
      <div class="sp-directory">
        <header class="sp-dir-header">
          <div>
            <h1 class="sp-dir-title">Spaces</h1>
            <p class="sp-dir-sub">Collaborative shared desks for groups. Local by default, shared by intention.</p>
          </div>
          <div class="sp-dir-actions">
            <button class="btn btn-primary" data-act="go-create">+ Create a Space</button>
            <button class="btn btn-secondary" data-act="go-join">Join with Code</button>
          </div>
        </header>

        <!-- Privacy Assurance Banner -->
        <div class="sp-privacy-card">
          <div class="sp-privacy-icon">🔒</div>
          <div>
            <strong>Peer-to-Peer &amp; Intentional Sharing</strong>
            <p>Tools in Toolbox run 100% locally. Data is only shared with a Space when you explicitly click "Share to Space".</p>
          </div>
        </div>

        ${joined.length ? `
          <div class="sp-section-head" style="margin-top:28px;">
            <h2 class="sp-section-title">Your Spaces</h2>
            <span class="sp-section-sub">${joined.length} joined on this device</span>
          </div>
          <div class="sp-spaces-grid">
            ${joined.map(s => `
              <div class="sp-card" data-code="${s.id}">
                <div class="sp-card-top">
                  <span class="sp-code-badge">${s.id}</span>
                  <span class="sp-role-pill is-${s.role}">${s.role}</span>
                </div>
                <h3 class="sp-card-name">${escapeHtml(s.name)}</h3>
                <p class="sp-card-desc">${escapeHtml(s.description || 'Collaborative workspace')}</p>
                <div class="sp-card-footer">
                  <button class="btn btn-primary btn-sm" data-open-space="${s.id}">Open Desk →</button>
                  <button class="btn btn-secondary btn-sm" data-remove-space="${s.id}" title="Remove from list">✕</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="sp-empty-directory">
            <h3 style="font-family:var(--pixel); font-size:1.4rem;">No spaces joined yet</h3>
            <p style="color:var(--g600); margin:8px 0 20px;">Create a new space for your study group or project, or enter a 6-character room code to join an existing one.</p>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-primary" data-act="go-create">Create a Space</button>
              <button class="btn btn-secondary" data-act="go-join">Join with Code</button>
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
      <div class="sp-landing">
        <h2 class="sp-landing-title">Create a Space</h2>
        <p class="sp-landing-desc">Set up a shared desk for your team, study group, or project.</p>
        <form class="sp-create-form" id="form-create">
          <div class="sp-form-group">
            <label class="sp-form-label">Space Name</label>
            <input type="text" class="tool-input" id="sp-create-name" placeholder="e.g. Design Systems, Study Group" required autocomplete="off">
          </div>
          <div class="sp-form-group">
            <label class="sp-form-label">Description (Optional)</label>
            <input type="text" class="tool-input" id="sp-create-desc" placeholder="What is this space for?" autocomplete="off">
          </div>
          <div class="sp-form-group">
            <label class="sp-form-label">Your Display Name</label>
            <input type="text" class="tool-input" id="sp-create-user" value="${escapeHtml(profile.name || '')}" placeholder="What should others call you?" required autocomplete="off">
          </div>
          <div style="display:flex; gap:10px; margin-top:12px;">
            <button type="submit" class="btn btn-primary">Create Space</button>
            <button type="button" class="btn btn-secondary" data-act="go-directory">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  /* --------------- Join Form --------------- */

  function renderJoinForm() {
    const profile = getUserProfile();

    host.innerHTML = `
      <div class="sp-landing">
        <h2 class="sp-landing-title">Join a Space</h2>
        <p class="sp-landing-desc">Enter the 6-character room code shared by the host.</p>
        <form class="sp-join-form" id="form-join">
          <div class="sp-form-group">
            <label class="sp-form-label">Room Code</label>
            <input type="text" class="tool-input sp-input-code" id="sp-join-code" value="${escapeHtml(targetCode || '')}" required maxlength="6" placeholder="e.g. X7K2MP" autocomplete="off">
          </div>
          <div class="sp-form-group">
            <label class="sp-form-label">Your Display Name</label>
            <input type="text" class="tool-input" id="sp-join-user" value="${escapeHtml(profile.name || '')}" placeholder="What should others call you?" required autocomplete="off">
          </div>
          <div style="display:flex; gap:10px; margin-top:12px;">
            <button type="submit" class="btn btn-primary">Join Space</button>
            <button type="button" class="btn btn-secondary" data-act="go-directory">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  /* --------------- Space Room (Desk) --------------- */

  function renderRoom() {
    const onlineCount = engine.onlineMembers.size;

    host.innerHTML = `
      <div class="sp-room">
        <!-- Room Header -->
        <header class="sp-room-header">
          <div class="sp-room-title-area">
            <div class="sp-title-row">
              <button class="sp-back-btn" data-act="go-directory" title="Back to Spaces directory">←</button>
              <h2 class="sp-room-title">${escapeHtml(engine.spaceName)}</h2>
              <span class="sp-code-pill" data-act="copy-code" title="Click to copy room code">${engine.roomCode}</span>
              <span class="sp-role-pill is-${engine.role}">${engine.role}</span>
            </div>
            <div class="sp-room-sub">
              <span class="sp-online-tag">● ${onlineCount} online</span>
              <span>· Peer-to-Peer collaboration</span>
            </div>
          </div>
          <div class="sp-room-header-actions">
            <button class="btn btn-secondary btn-sm" data-act="copy-invite">Invite</button>
            <button class="btn btn-secondary btn-sm sp-leave-btn" data-act="leave-room">Leave Desk</button>
          </div>
        </header>

        <!-- Room Sub-nav Tabs -->
        <nav class="sp-room-nav">
          <button class="sp-nav-tab ${currentTab === 'desk' ? 'is-active' : ''}" data-tab="desk">Desk Overview</button>
          <button class="sp-nav-tab ${currentTab === 'artifacts' ? 'is-active' : ''}" data-tab="artifacts">Shared Artifacts</button>
          <button class="sp-nav-tab ${currentTab === 'discussion' ? 'is-active' : ''}" data-tab="discussion">Discussion</button>
          <button class="sp-nav-tab ${currentTab === 'tasks' ? 'is-active' : ''}" data-tab="tasks">Tasks</button>
          <button class="sp-nav-tab ${currentTab === 'live' ? 'is-active' : ''}" data-tab="live">Live Sessions</button>
          <button class="sp-nav-tab ${currentTab === 'challenges' ? 'is-active' : ''}" data-tab="challenges">Challenges</button>
          <button class="sp-nav-tab ${currentTab === 'members' ? 'is-active' : ''}" data-tab="members">Members</button>
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
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
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
      if (confirm(`Remove ${code} from your list?`)) {
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
