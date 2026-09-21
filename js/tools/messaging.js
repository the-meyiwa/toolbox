import { getCurrentUser } from '../lib/supabase.js';
import { openSettings } from '../lib/settings-ui.js';
import { searchToolboxUsers, avatarMarkup } from '../lib/user-directory.js';
import { listConversations, listMessages, startDirectConversation, sendMessage, updateMessagePayload, uploadMessageFile, MESSAGE_MAX_LENGTH } from '../lib/messaging-service.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const time = value => new Date(value).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
const fileSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;

export default {
  _cleanup: null,
  render(container) {
    this.destroy();
    const user = getCurrentUser();
    if (!user) {
      container.innerHTML = `<div class="msg-setup-gate"><div class="msg-setup-icon">✦</div><h2>Messages needs your Toolbox account</h2><p>Sign in and finish your profile to become searchable, message other Toolbox users, share files and play games.</p><button class="btn btn-primary" id="msg-setup">Set up Messages in Settings</button></div>`;
      container.querySelector('#msg-setup').onclick = () => openSettings('profile');
      return;
    }
    if (!user.username) {
      container.innerHTML = `<div class="msg-setup-gate"><div class="msg-setup-icon">@</div><h2>Choose your Messages identity</h2><p>Add a unique username and avatar before people can find you.</p><button class="btn btn-primary" id="msg-setup">Complete Messages setup</button></div>`;
      container.querySelector('#msg-setup').onclick = () => openSettings('profile');
      return;
    }

    let active = null, conversations = [], messages = [], poll = 0, stopped = false;
    container.innerHTML = `<div class="messages-v2">
      <aside class="messages-v2-sidebar" id="msg-sidebar">
        <div class="messages-v2-head"><div><span class="messages-eyebrow">TOOLBOX</span><h2>Messages</h2></div><button class="msg-round-btn" id="messages-new" aria-label="Find someone">＋</button></div>
        <div class="messages-search"><span>⌕</span><input id="messages-search" class="msg-search-input" placeholder="Find a Toolbox user" autocomplete="off"></div>
        <div id="messages-results" class="messages-results" hidden></div>
        <div id="messages-conversations" class="messages-conversations"></div>
      </aside>
      <section class="messages-v2-chat">
        <header class="messages-chat-head" id="messages-chat-head"><button class="msg-mobile-back" id="messages-back">‹</button><div id="messages-chat-person"></div><span class="messages-expiry">Clears after 24 hours</span></header>
        <div class="messages-stream" id="messages-stream"><div class="messages-empty"><span>✦</span><h3>Your conversations, kept light.</h3><p>Find any Toolbox user to start a private 24-hour chat.</p></div></div>
        <form class="messages-compose" id="messages-compose" hidden><input type="file" id="messages-file" hidden><button type="button" id="messages-attach" aria-label="Share a file">＋</button><button type="button" id="messages-game" aria-label="Start a game">⌗</button><textarea id="messages-input" rows="1" maxlength="${MESSAGE_MAX_LENGTH}" placeholder="Message"></textarea><button class="messages-send" type="submit" aria-label="Send">↑</button></form>
      </section>
    </div>`;
    const $ = selector => container.querySelector(selector);
    const sidebar = $('.messages-v2-sidebar'), stream = $('#messages-stream'), form = $('#messages-compose'), input = $('#messages-input'), results = $('#messages-results');

    const person = profile => ({ id:profile.other_id || profile.id, email:profile.other_email || profile.email, username:profile.other_username || profile.username, name:profile.other_name || profile.name, avatarUrl:profile.other_avatar_url || profile.avatarUrl, profilePicture:profile.other_profile_picture || profile.profilePicture });
    const renderConversations = () => {
      $('#messages-conversations').innerHTML = conversations.length ? conversations.map(item => { const p=person(item); return `<button class="messages-person ${active?.conversation_id===item.conversation_id?'active':''}" data-conversation="${item.conversation_id}">${avatarMarkup(p,42)}<span><strong>${esc(p.name || p.username)}</strong><small>@${esc(p.username || 'toolbox-user')}</small></span></button>`; }).join('') : `<div class="messages-list-empty">No conversations yet.<br>Search above to find someone.</div>`;
      container.querySelectorAll('[data-conversation]').forEach(button => button.onclick=()=>openConversation(conversations.find(item=>item.conversation_id===button.dataset.conversation)));
    };
    const renderGame = message => {
      const state = message.payload || {}; const board = state.board || Array(9).fill('');
      return `<div class="message-game" data-game="${message.id}"><div><strong>Tic-tac-toe</strong><small>${esc(state.winner ? `${state.winner} won` : `${state.turn || 'X'} to play`)}</small></div><div class="message-game-board">${board.map((cell,index)=>`<button data-cell="${index}" ${cell||state.winner?'disabled':''}>${cell}</button>`).join('')}</div></div>`;
    };
    const renderMessages = () => {
      if (!active) return;
      stream.innerHTML = messages.length ? messages.map(message => { const mine=message.sender_id===user.id; const content=message.kind==='file' ? `<a class="message-file" href="${esc(message.payload?.url)}" target="_blank" rel="noopener"><span>↗</span><span><strong>${esc(message.payload?.name)}</strong><small>${fileSize(message.payload?.size||0)}</small></span></a>` : message.kind==='game' ? renderGame(message) : `<p>${esc(message.body).replace(/\n/g,'<br>')}</p>`; return `<div class="message-row ${mine?'mine':''}"><div class="message-bubble">${content}<time>${time(message.created_at)}</time></div></div>`; }).join('') : `<div class="messages-empty"><span>◌</span><h3>Start the conversation</h3><p>Messages disappear 24 hours after they are sent.</p></div>`;
      stream.scrollTop=stream.scrollHeight;
      container.querySelectorAll('[data-game] [data-cell]').forEach(button => button.onclick=async()=>{ const card=button.closest('[data-game]'); const msg=messages.find(m=>m.id===card.dataset.game); const board=[...(msg.payload.board||Array(9).fill(''))]; if(board[button.dataset.cell]||msg.payload.winner)return; board[button.dataset.cell]=msg.payload.turn||'X'; const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; const winner=wins.some(line=>line.every(i=>board[i]===board[button.dataset.cell]))?board[button.dataset.cell]:''; msg.payload={board,turn:board[button.dataset.cell]==='X'?'O':'X',winner}; renderMessages(); await updateMessagePayload(msg.id,msg.payload); });
    };
    const refreshMessages = async () => { if(!active||stopped)return; try { messages=await listMessages(active.conversation_id); renderMessages(); } catch(error){ stream.innerHTML=`<div class="messages-error">${esc(error.message)}</div>`; } };
    const openConversation = async item => { active=item; const p=person(item); $('#messages-chat-person').innerHTML=`${avatarMarkup(p,36)}<span><strong>${esc(p.name||p.username)}</strong><small>@${esc(p.username||'toolbox-user')}</small></span>`; form.hidden=false; sidebar.classList.add('has-chat'); renderConversations(); await refreshMessages(); input.focus(); };
    const refreshConversations = async () => { try { conversations=await listConversations(); renderConversations(); if(active){active=conversations.find(i=>i.conversation_id===active.conversation_id)||active;} } catch(error){ $('#messages-conversations').innerHTML=`<div class="messages-error">${esc(error.message)}</div>`; } };
    let searchTimer=0;
    $('#messages-search').oninput = event => { clearTimeout(searchTimer); const q=event.target.value.trim(); if(!q){results.hidden=true;return;} searchTimer=setTimeout(async()=>{ results.hidden=false; results.innerHTML='<div class="messages-list-empty">Searching…</div>'; try { const users=await searchToolboxUsers(q); results.innerHTML=users.length?users.map(p=>`<button class="messages-person" data-user="${p.id}">${avatarMarkup(p,38)}<span><strong>${esc(p.name)}</strong><small>@${esc(p.username||'toolbox-user')}</small></span></button>`).join(''):'<div class="messages-list-empty">No Toolbox users found.</div>'; results.querySelectorAll('[data-user]').forEach(button=>button.onclick=async()=>{ const p=users.find(x=>x.id===button.dataset.user); const id=await startDirectConversation(p.id); await refreshConversations(); const item=conversations.find(x=>x.conversation_id===id)||{conversation_id:id,...Object.fromEntries(Object.entries(p).map(([k,v])=>[`other_${k}`,v]))}; results.hidden=true; $('#messages-search').value=''; openConversation(item); }); } catch(error){results.innerHTML=`<div class="messages-error">${esc(error.message)}</div>`;} },260); };
    $('#messages-new').onclick=()=>$('#messages-search').focus(); $('#messages-back').onclick=()=>sidebar.classList.remove('has-chat');
    form.onsubmit=async event=>{event.preventDefault(); if(!active||!input.value.trim())return; const value=input.value; input.value=''; try{messages.push(await sendMessage(active.conversation_id,value));renderMessages();await refreshConversations();}catch(error){input.value=value;alert(error.message);}};
    input.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}};
    $('#messages-attach').onclick=()=>$('#messages-file').click(); $('#messages-file').onchange=async event=>{const file=event.target.files[0];if(!file||!active)return;try{const payload=await uploadMessageFile(file);messages.push(await sendMessage(active.conversation_id,file.name,'file',payload));renderMessages();}catch(error){alert(error.message);}event.target.value='';};
    $('#messages-game').onclick=async()=>{if(!active)return;try{messages.push(await sendMessage(active.conversation_id,'Tic-tac-toe','game',{board:Array(9).fill(''),turn:'X',winner:''}));renderMessages();}catch(error){alert(error.message);}};
    refreshConversations(); poll=setInterval(()=>{refreshConversations();refreshMessages();},5000);
    this._cleanup=()=>{stopped=true;clearInterval(poll);clearTimeout(searchTimer);};
  },
  destroy(){this._cleanup?.();this._cleanup=null;}
};
