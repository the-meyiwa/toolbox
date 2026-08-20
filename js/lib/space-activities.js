/* ============================================================
   Spaces — real-time collaboration rooms
   ============================================================ */

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function mountChat(container, engine) {
  container.innerHTML = `
    <div class="sp-chat">
      <div class="sp-chat-messages"></div>
      <div class="sp-typing"></div>
      <form class="sp-chat-input-row">
        <input type="text" class="tool-input sp-chat-input" placeholder="Type a message..." autocomplete="off">
        <button type="submit" class="btn btn-primary sp-chat-send">Send</button>
      </form>
    </div>
  `;

  const messagesDiv = container.querySelector('.sp-chat-messages');
  const input = container.querySelector('.sp-chat-input');
  const form = container.querySelector('form');
  const typingDiv = container.querySelector('.sp-typing');

  const renderMessages = () => {
    const msgs = engine.chat.toArray();
    const myId = engine.provider.awareness.clientID;
    
    messagesDiv.innerHTML = msgs.map(m => `
      <div class="sp-chat-msg ${m.from === myId ? 'is-self' : ''}">
        <div class="sp-chat-msg-name">${escapeHtml(m.name)}</div>
        <div class="sp-chat-msg-text">${escapeHtml(m.text)}</div>
        <div class="sp-chat-msg-time">${formatTime(m.time)}</div>
      </div>
    `).join('');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  const renderTyping = () => {
    const typing = Array.from(engine.participants.values())
      .filter(p => p.typing && !p.isSelf)
      .map(p => p.name);
      
    if (typing.length === 0) {
      typingDiv.textContent = '';
    } else if (typing.length === 1) {
      typingDiv.textContent = `${typing[0]} is typing...`;
    } else {
      typingDiv.textContent = 'Several people are typing...';
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
      engine.sendChat(input.value);
      input.value = '';
      engine.setTyping(false);
    }
  });

  let typingTimeout;
  input.addEventListener('input', () => {
    engine.setTyping(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => engine.setTyping(false), 2000);
  });

  const onUpdate = () => renderMessages();
  const onPeer = () => renderTyping();
  
  engine.on('chat-update', onUpdate);
  engine.on('peer-update', onPeer);
  
  renderMessages();
  renderTyping();

  return () => {
    engine.off('chat-update', onUpdate);
    engine.off('peer-update', onPeer);
    clearTimeout(typingTimeout);
    engine.setTyping(false);
  };
}

export function mountPolls(container, engine) {
  container.innerHTML = `
    <div class="sp-poll-container">
      <div class="sp-poll-list"></div>
      <div class="sp-poll-create">
        <button class="btn btn-secondary btn-sm sp-poll-create-btn">Create a poll</button>
        <form class="sp-poll-form hidden" style="display:none">
          <div class="sp-form-group">
            <label class="sp-form-label">Question</label>
            <input type="text" class="tool-input sp-poll-q" required>
          </div>
          <div class="sp-poll-options-inputs">
            <input type="text" class="tool-input sp-poll-opt" placeholder="Option 1" required>
            <input type="text" class="tool-input sp-poll-opt" placeholder="Option 2" required>
          </div>
          <button type="button" class="btn btn-secondary btn-sm sp-poll-add-opt">Add option</button>
          <button type="submit" class="btn btn-primary btn-sm">Post Poll</button>
        </form>
      </div>
    </div>
  `;

  const listDiv = container.querySelector('.sp-poll-list');
  const createBtn = container.querySelector('.sp-poll-create-btn');
  const form = container.querySelector('.sp-poll-form');
  const optsDiv = container.querySelector('.sp-poll-options-inputs');
  const addOptBtn = container.querySelector('.sp-poll-add-opt');

  createBtn.addEventListener('click', () => {
    form.style.display = 'block';
    createBtn.style.display = 'none';
  });

  addOptBtn.addEventListener('click', () => {
    if (optsDiv.children.length < 6) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'tool-input sp-poll-opt';
      inp.placeholder = `Option ${optsDiv.children.length + 1}`;
      inp.required = true;
      optsDiv.appendChild(inp);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = container.querySelector('.sp-poll-q').value;
    const opts = Array.from(optsDiv.querySelectorAll('input')).map(i => i.value).filter(v => v.trim());
    if (q && opts.length >= 2) {
      engine.createPoll(q, opts);
      form.reset();
      form.style.display = 'none';
      createBtn.style.display = 'block';
    }
  });

  listDiv.addEventListener('click', (e) => {
    const opt = e.target.closest('.sp-poll-option');
    if (opt) {
      const pollId = opt.closest('.sp-poll').dataset.id;
      const idx = parseInt(opt.dataset.idx, 10);
      engine.votePoll(pollId, idx);
    }
  });

  const renderPolls = () => {
    const polls = Array.from(engine.polls.keys()).map(k => ({id: k, ...engine.polls.get(k)}));
    const myId = engine.provider.awareness.clientID;

    listDiv.innerHTML = polls.map(p => {
      const myVote = p.votes[myId];
      const hasVoted = myVote !== undefined;
      const voteCounts = p.options.map((_, i) => Object.values(p.votes).filter(v => v === i).length);
      const totalVotes = Object.keys(p.votes).length;

      return `
        <div class="sp-poll" data-id="${p.id}">
          <div class="sp-poll-question">${escapeHtml(p.question)}</div>
          <div class="sp-poll-options">
            ${p.options.map((opt, i) => {
              if (hasVoted) {
                const count = voteCounts[i];
                const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                return `
                  <div class="sp-poll-bar">
                    <div class="sp-poll-bar-fill" style="width: ${pct}%"></div>
                    <span class="sp-poll-bar-label">${escapeHtml(opt)}</span>
                    <span class="sp-poll-bar-count">${count}</span>
                  </div>`;
              } else {
                return `<button class="sp-poll-option" data-idx="${i}">${escapeHtml(opt)}</button>`;
              }
            }).join('')}
          </div>
          <div class="biz-hint">Created by ${escapeHtml(p.createdBy)}</div>
        </div>
      `;
    }).join('');
  };

  const onUpdate = () => renderPolls();
  engine.on('poll-update', onUpdate);
  renderPolls();

  return () => {
    engine.off('poll-update', onUpdate);
  };
}

export function mountNotepad(container, engine) {
  container.innerHTML = `
    <div class="sp-notepad">
      <textarea class="tool-input sp-notepad-area" placeholder="Shared notepad..."></textarea>
    </div>
  `;
  const area = container.querySelector('.sp-notepad-area');
  
  let isEditing = false;
  
  const updateArea = () => {
    if (!isEditing) {
      area.value = engine.notepad.toString();
    }
  };

  engine.notepad.observe(updateArea);
  updateArea();

  area.addEventListener('focus', () => { isEditing = true; });
  area.addEventListener('blur', () => { isEditing = false; });
  area.addEventListener('input', () => {
    if (isEditing) {
      const ytext = engine.notepad;
      ytext.delete(0, ytext.length);
      ytext.insert(0, area.value);
    }
  });

  return () => {
    engine.notepad.unobserve(updateArea);
  };
}
