/* ============================================================
   Spaces — real-time collaboration rooms.

   No accounts, no sign-in. One person creates a room, gets a code,
   others join with just a display name. Everything is peer-to-peer
   via WebRTC — the data never touches a server.
   ============================================================ */

import { SpaceEngine } from '../lib/space-engine.js';
import { mountChat, mountPolls, mountNotepad } from '../lib/space-activities.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {HTMLElement} host
 * @param {string|null} joinCode — pre-filled room code from the URL
 * @returns {() => void} teardown
 */
export function renderSpaces(host, joinCode = null) {
  let engine = new SpaceEngine();
  let currentTab = 'chat';
  let unmountActivity = null;
  let viewState = 'landing';
  let roomCode = joinCode ? joinCode.toUpperCase() : null;

  const teardown = () => {
    unmountActivity?.();
    engine.leave();
  };

  const render = () => {
    unmountActivity?.();
    unmountActivity = null;

    if (viewState === 'landing') {
      host.innerHTML = `
        <div class="sp-landing">
          <h1 class="sp-landing-title">Spaces</h1>
          <p class="sp-landing-desc">Temporary rooms to chat, poll, and collaborate — right here in Toolbox. No accounts, no sign-up. Create a room, share the code, done.</p>
          <div class="sp-landing-actions">
            <button class="btn btn-primary" data-act="go-create">Create a space</button>
            <button class="btn btn-secondary" data-act="go-join">Join a space</button>
          </div>
        </div>
      `;
    } else if (viewState === 'create') {
      host.innerHTML = `
        <div class="sp-landing">
          <h2 class="sp-landing-title">Create a space</h2>
          <form class="sp-create-form" id="form-create">
            <div class="sp-form-group">
              <label class="sp-form-label">Space name</label>
              <input type="text" class="tool-input" id="sp-create-name" placeholder="e.g. Study group" required>
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Your display name</label>
              <input type="text" class="tool-input" id="sp-create-user" placeholder="What should people call you?" required>
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">
                <input type="checkbox" id="sp-create-public" checked> Public — anyone with the code can join
              </label>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button type="submit" class="btn btn-primary">Create</button>
              <button type="button" class="btn btn-secondary" data-act="go-landing">Cancel</button>
            </div>
          </form>
        </div>
      `;
    } else if (viewState === 'join') {
      host.innerHTML = `
        <div class="sp-landing">
          <h2 class="sp-landing-title">Join a space</h2>
          <form class="sp-join-form" id="form-join">
            <div class="sp-form-group">
              <label class="sp-form-label">Room code</label>
              <input type="text" class="tool-input" id="sp-join-code" value="${escapeHtml(roomCode || '')}" required maxlength="6" placeholder="e.g. X7K2MP" style="text-transform:uppercase; letter-spacing:0.15em; font-family:var(--mono);">
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Your display name</label>
              <input type="text" class="tool-input" id="sp-join-user" placeholder="What should people call you?" required>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button type="submit" class="btn btn-primary">Join</button>
              <button type="button" class="btn btn-secondary" data-act="go-landing">Cancel</button>
            </div>
          </form>
        </div>
      `;
    } else if (viewState === 'connecting') {
      host.innerHTML = `<div class="sp-landing"><p class="biz-hint">Connecting…</p></div>`;
    } else if (viewState === 'created-host') {
      host.innerHTML = `
        <div class="sp-landing">
          <h2 class="sp-landing-title">Space ready</h2>
          <p class="sp-code-hint">Share this code with others to join:</p>
          <div class="sp-code-display">${engine.roomCode}</div>
          <div class="sp-link-copy">
            <button class="btn btn-secondary btn-sm" data-act="copy-link">Copy invite link</button>
            <button class="btn btn-primary" data-act="enter-room">Enter Room →</button>
          </div>
        </div>
      `;
    } else if (viewState === 'room') {
      host.innerHTML = `
        <div class="sp-room">
          <header class="sp-room-header">
            <div>
              <h3>${escapeHtml(engine.spaceName)}</h3>
              <span class="biz-hint" id="sp-participant-count"></span>
            </div>
            <button class="btn btn-secondary btn-sm" data-act="leave">Leave</button>
          </header>
          <div class="sp-room-body">
            <aside class="sp-participants"></aside>
            <div class="sp-activities">
              <div class="sp-activity-tabs">
                <button class="btn btn-sm sp-activity-tab ${currentTab === 'chat' ? 'is-active' : ''}" data-tab="chat">Chat</button>
                <button class="btn btn-sm sp-activity-tab ${currentTab === 'polls' ? 'is-active' : ''}" data-tab="polls">Polls</button>
                <button class="btn btn-sm sp-activity-tab ${currentTab === 'notepad' ? 'is-active' : ''}" data-tab="notepad">Notepad</button>
              </div>
              <div class="sp-activity-content"></div>
            </div>
          </div>
        </div>
      `;
      mountCurrentActivity();
      renderParticipants();
    }
  };

  const renderParticipants = () => {
    const list = host.querySelector('.sp-participants');
    if (!list) return;
    const participants = Array.from(engine.participants.values());
    const countEl = host.querySelector('#sp-participant-count');
    if (countEl) countEl.textContent = `${participants.length} participant${participants.length === 1 ? '' : 's'}`;
    list.innerHTML = participants.map(p => `
      <div class="sp-participant">
        <span class="sp-participant-dot" style="background:${p.color}"></span>
        <span class="sp-participant-name">${escapeHtml(p.name)}</span>
        ${p.isSelf ? '<span class="sp-participant-you">(you)</span>' : ''}
      </div>
    `).join('');
  };

  const mountCurrentActivity = () => {
    unmountActivity?.();
    const content = host.querySelector('.sp-activity-content');
    if (!content) return;
    if (currentTab === 'chat') {
      unmountActivity = mountChat(content, engine);
    } else if (currentTab === 'polls') {
      unmountActivity = mountPolls(content, engine);
    } else if (currentTab === 'notepad') {
      unmountActivity = mountNotepad(content, engine);
    }
  };

  /* --------------- interactions --------------- */

  const onClick = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'go-create') {
      viewState = 'create';
      render();
    } else if (act === 'go-join') {
      viewState = 'join';
      render();
    } else if (act === 'go-landing') {
      viewState = 'landing';
      render();
    } else if (act === 'copy-link') {
      navigator.clipboard.writeText(window.location.origin + window.location.pathname + '#spaces/' + engine.roomCode);
      const btn = e.target.closest('[data-act]');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy invite link'; }, 2000);
    } else if (act === 'enter-room') {
      viewState = 'room';
      render();
    } else if (act === 'leave') {
      engine.leave();
      engine = new SpaceEngine();
      viewState = 'landing';
      history.replaceState(null, '', '#spaces');
      render();
    }

    const tab = e.target.closest('[data-tab]')?.dataset.tab;
    if (tab && tab !== currentTab) {
      currentTab = tab;
      Array.from(host.querySelectorAll('.sp-activity-tab')).forEach(t =>
        t.classList.toggle('is-active', t.dataset.tab === tab));
      mountCurrentActivity();
    }
  };

  const onSubmit = async (e) => {
    if (e.target.id === 'form-create' && viewState === 'create') {
      e.preventDefault();
      const spaceName = host.querySelector('#sp-create-name').value;
      const displayName = host.querySelector('#sp-create-user').value;
      const isPublic = host.querySelector('#sp-create-public').checked;
      viewState = 'connecting';
      render();
      try {
        await engine.create({ spaceName, displayName, isPublic });
        history.replaceState(null, '', '#spaces/' + engine.roomCode);
        viewState = 'created-host';
      } catch (err) {
        console.error('Failed to create space', err);
        viewState = 'create';
      }
      render();
    } else if (e.target.id === 'form-join' && viewState === 'join') {
      e.preventDefault();
      const code = host.querySelector('#sp-join-code').value.toUpperCase();
      const displayName = host.querySelector('#sp-join-user').value;
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
    }
  };

  host.addEventListener('click', onClick);
  host.addEventListener('submit', onSubmit);

  engine.on('peer-update', () => {
    if (viewState === 'room') renderParticipants();
  });

  engine.on('disconnected', () => {
    if (viewState === 'room') {
      engine = new SpaceEngine();
      viewState = 'landing';
      render();
    }
  });

  // If arrived via invite link (#spaces/X7K2MP), go straight to join form
  if (roomCode) {
    viewState = 'join';
  }

  render();

  return () => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('submit', onSubmit);
    teardown();
  };
}
