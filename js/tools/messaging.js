import { getCurrentUser } from '../lib/supabase.js';
import { openSettings } from '../lib/settings-ui.js';
import { searchToolboxUsers, avatarMarkup } from '../lib/user-directory.js';
import { listConversations, listMessages, listConversationParticipants, startDirectConversation, sendMessage, updateMessagePayload, uploadMessageFile, listOnlineToolboxFiles, approveParticipantRequest, MESSAGE_MAX_LENGTH } from '../lib/messaging-service.js';
import { list as listOfflineFiles, get as getOfflineFile } from '../lib/artifacts.js';
import { tbPrompt } from '../lib/dialog.js';

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
    let messagesFingerprint = '', conversationsFingerprint = '';
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
        <form class="messages-compose" id="messages-compose" hidden>
          <input type="file" id="messages-file" hidden><input type="file" id="messages-media" accept="image/*,video/*,audio/*" hidden>
          <div class="messages-action-wrap">
            <button type="button" class="messages-plus" id="messages-attach" aria-label="Add to conversation" aria-haspopup="menu" aria-expanded="false"><span></span><span></span></button>
            <div class="messages-action-menu" id="messages-action-menu" role="menu" hidden>
              <button type="button" role="menuitem" data-message-action="poll"><span class="menu-action-icon">▥</span><span><strong>Polls</strong><small>Ask the group</small></span></button>
              <button type="button" role="menuitem" data-message-action="media"><span class="menu-action-icon">▧</span><span><strong>Media</strong><small>Photos, video or audio</small></span></button>
              <button type="button" role="menuitem" data-message-action="files"><span class="menu-action-icon">⌑</span><span><strong>Toolbox files</strong><small>Online or offline</small></span></button>
              <button type="button" role="menuitem" data-message-action="participant"><span class="menu-action-icon">＋</span><span><strong>Participant</strong><small>Invite with group approval</small></span></button>
            </div>
            <div class="messages-file-source" id="messages-file-source" role="menu" hidden><button type="button" data-file-source="online">Online files</button><button type="button" data-file-source="offline">Offline files</button></div>
          </div>
          <button type="button" id="messages-game" aria-label="Start a tic-tac-toe game">⌗</button><textarea id="messages-input" rows="1" maxlength="${MESSAGE_MAX_LENGTH}" placeholder="Message"></textarea><button class="messages-send" type="submit" aria-label="Send">↑</button>
        </form>
        <div class="messages-picker" id="messages-picker" hidden></div>
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
    const renderPoll = message => {
      const pollState = message.payload || {};
      return `<div class="message-poll" data-poll="${message.id}"><strong>${esc(pollState.question || 'Poll')}</strong><div>${(pollState.options || []).map((option,index) => {
        const voters = option.voters || []; const voted = voters.includes(user.id);
        return `<button type="button" data-poll-option="${index}" class="${voted ? 'selected' : ''}"><span>${esc(option.text)}</span><small>${voters.length}</small></button>`;
      }).join('')}</div></div>`;
    };
    const renderParticipantRequest = message => {
      const request = message.payload || {}; const approvals = request.approvals || []; const approved = approvals.includes(user.id);
      return `<div class="message-participant-request" data-participant-request="${message.id}"><div><strong>Add ${esc(request.target_name || 'participant')}?</strong><small>Everyone currently in this chat must agree.</small></div><button type="button" ${approved ? 'disabled' : ''}>${approved ? 'Agreed' : 'Agree'} · ${approvals.length}/${request.required_count || '?'}</button></div>`;
    };
    const renderMessages = ({ initial = false, stickToBottom = true } = {}) => {
      if (!active) return;
      messagesFingerprint=JSON.stringify(messages.map(item=>[item.id,item.kind,item.body,item.payload,item.created_at]));
      const previousHeight = stream.scrollHeight;
      const previousTop = stream.scrollTop;
      const wasNearBottom = previousHeight - previousTop - stream.clientHeight < 72;
      stream.innerHTML = messages.length ? messages.map(message => { const mine=message.sender_id===user.id; const content=message.kind==='file' ? `<a class="message-file" href="${esc(message.payload?.url)}" target="_blank" rel="noopener"><span>↗</span><span><strong>${esc(message.payload?.name)}</strong><small>${fileSize(message.payload?.size||0)}</small></span></a>` : message.kind==='game' ? renderGame(message) : message.kind==='poll' ? renderPoll(message) : message.kind==='participant_request' ? renderParticipantRequest(message) : `<p>${esc(message.body).replace(/\n/g,'<br>')}</p>`; return `<div class="message-row ${mine?'mine':''}"><div class="message-bubble">${content}<time>${time(message.created_at)}</time></div></div>`; }).join('') : `<div class="messages-empty"><span>◌</span><h3>Start the conversation</h3><p>Messages disappear 24 hours after they are sent.</p></div>`;
      stream.classList.toggle('messages-stream-settled', !initial);
      if (initial || (stickToBottom && wasNearBottom)) stream.scrollTop=stream.scrollHeight;
      else stream.scrollTop=previousTop + (stream.scrollHeight - previousHeight);
      container.querySelectorAll('[data-game] [data-cell]').forEach(button => button.onclick=async()=>{ const card=button.closest('[data-game]'); const msg=messages.find(m=>m.id===card.dataset.game); const board=[...(msg.payload.board||Array(9).fill(''))]; if(board[button.dataset.cell]||msg.payload.winner)return; board[button.dataset.cell]=msg.payload.turn||'X'; const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; const winner=wins.some(line=>line.every(i=>board[i]===board[button.dataset.cell]))?board[button.dataset.cell]:''; msg.payload={board,turn:board[button.dataset.cell]==='X'?'O':'X',winner}; renderMessages(); await updateMessagePayload(msg.id,msg.payload); });
      container.querySelectorAll('[data-poll-option]').forEach(button => button.onclick=async()=>{ const card=button.closest('[data-poll]'); const msg=messages.find(m=>m.id===card.dataset.poll); const options=(msg.payload.options||[]).map(option=>({...option,voters:(option.voters||[]).filter(id=>id!==user.id)})); options[Number(button.dataset.pollOption)].voters.push(user.id); msg.payload={...msg.payload,options}; renderMessages(); await updateMessagePayload(msg.id,msg.payload); });
      container.querySelectorAll('[data-participant-request] button').forEach(button => button.onclick=async()=>{ button.disabled=true; try{await approveParticipantRequest(button.closest('[data-participant-request]').dataset.participantRequest);await refreshMessages();await refreshConversations();}catch(error){button.disabled=false;alert(error.message);}});
    };
    const refreshMessages = async ({ initial = false } = {}) => { if(!active||stopped)return; const conversationId=active.conversation_id; try { const next=await listMessages(conversationId); if(!active||active.conversation_id!==conversationId)return; const fingerprint=JSON.stringify(next.map(item=>[item.id,item.kind,item.body,item.payload,item.created_at])); if(fingerprint===messagesFingerprint)return; messages=next;messagesFingerprint=fingerprint;renderMessages({initial,stickToBottom:true}); } catch(error){ if(initial)stream.innerHTML=`<div class="messages-error">${esc(error.message)}</div>`; } };
    const openConversation = async item => { const changed=active?.conversation_id!==item.conversation_id; active=item;if(changed){messages=[];messagesFingerprint='';stream.classList.remove('messages-stream-settled');} const p=person(item); $('#messages-chat-person').innerHTML=`${avatarMarkup(p,36)}<span><strong>${esc(p.name||p.username)}</strong><small>@${esc(p.username||'toolbox-user')}</small></span>`; form.hidden=false; sidebar.classList.add('has-chat'); renderConversations(); await refreshMessages({initial:changed}); input.focus(); };
    const refreshConversations = async () => { try { const next=await listConversations();const fingerprint=JSON.stringify(next);if(fingerprint!==conversationsFingerprint){conversations=next;conversationsFingerprint=fingerprint;renderConversations();} if(active){active=conversations.find(i=>i.conversation_id===active.conversation_id)||active;} } catch(error){ if(!conversations.length)$('#messages-conversations').innerHTML=`<div class="messages-error">${esc(error.message)}</div>`; } };
    let searchTimer=0;
    $('#messages-search').oninput = event => { clearTimeout(searchTimer); const q=event.target.value.trim(); if(!q){results.hidden=true;return;} searchTimer=setTimeout(async()=>{ results.hidden=false; results.innerHTML='<div class="messages-list-empty">Searching…</div>'; try { const users=await searchToolboxUsers(q); results.innerHTML=users.length?users.map(p=>`<button class="messages-person" data-user="${p.id}">${avatarMarkup(p,38)}<span><strong>${esc(p.name)}</strong><small>@${esc(p.username||'toolbox-user')}</small></span></button>`).join(''):'<div class="messages-list-empty">No Toolbox users found.</div>'; results.querySelectorAll('[data-user]').forEach(button=>button.onclick=async()=>{ const p=users.find(x=>x.id===button.dataset.user); const id=await startDirectConversation(p.id); await refreshConversations(); const item=conversations.find(x=>x.conversation_id===id)||{conversation_id:id,...Object.fromEntries(Object.entries(p).map(([k,v])=>[`other_${k}`,v]))}; results.hidden=true; $('#messages-search').value=''; openConversation(item); }); } catch(error){results.innerHTML=`<div class="messages-error">${esc(error.message)}</div>`;} },260); };
    $('#messages-new').onclick=()=>$('#messages-search').focus(); $('#messages-back').onclick=()=>sidebar.classList.remove('has-chat');
    form.onsubmit=async event=>{event.preventDefault(); if(!active||!input.value.trim())return; const value=input.value; input.value=''; try{messages.push(await sendMessage(active.conversation_id,value));renderMessages();await refreshConversations();}catch(error){input.value=value;alert(error.message);}};
    input.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}};
    const plusButton=$('#messages-attach'), actionMenu=$('#messages-action-menu'), sourceMenu=$('#messages-file-source'), picker=$('#messages-picker');
    const closeActions=()=>{actionMenu.hidden=true;sourceMenu.hidden=true;plusButton.classList.remove('open');plusButton.setAttribute('aria-expanded','false');};
    const toggleActions=()=>{const opening=actionMenu.hidden;closeActions();if(opening){actionMenu.hidden=false;plusButton.classList.add('open');plusButton.setAttribute('aria-expanded','true');actionMenu.querySelector('button')?.focus();}};
    plusButton.onclick=toggleActions;
    const sendSelectedFile=async file=>{if(!file||!active)return;const payload=await uploadMessageFile(file);messages.push(await sendMessage(active.conversation_id,file.name,'file',payload));renderMessages();};
    $('#messages-file').onchange=async event=>{try{await sendSelectedFile(event.target.files[0]);}catch(error){alert(error.message);}event.target.value='';};
    $('#messages-media').onchange=async event=>{try{await sendSelectedFile(event.target.files[0]);}catch(error){alert(error.message);}event.target.value='';};
    const showFilePicker=async mode=>{
      picker.hidden=false;picker.innerHTML='<div class="messages-picker-card"><div class="messages-picker-head"><strong>Select a file</strong><button type="button" aria-label="Close">×</button></div><div class="messages-picker-list">Loading…</div></div>';
      picker.querySelector('.messages-picker-head button').onclick=()=>{picker.hidden=true;};
      try{
        const files=mode==='online' ? await listOnlineToolboxFiles() : listOfflineFiles();
        const listEl=picker.querySelector('.messages-picker-list');
        listEl.innerHTML=files.length ? files.map(file=>`<button type="button" data-picker-file="${esc(file.id)}"><span>⌑</span><span><strong>${esc(file.name)}</strong><small>${esc(file.kind||'Toolbox file')}</small></span></button>`).join('') : `<p>No ${mode} Toolbox files are available.</p>`;
        listEl.querySelectorAll('[data-picker-file]').forEach(button=>button.onclick=async()=>{const meta=files.find(file=>file.id===button.dataset.pickerFile);try{if(mode==='online'){const url=meta.storage_url||meta.payload?.url;if(!url)throw new Error('This online file has no downloadable copy.');messages.push(await sendMessage(active.conversation_id,meta.name,'file',{name:meta.name,size:meta.payload?.size||0,type:meta.kind,url}));}else{const saved=getOfflineFile(meta.id);const file=new File([saved?.text||''],meta.name,{type:'text/plain'});await sendSelectedFile(file);}picker.hidden=true;renderMessages();}catch(error){alert(error.message);}});
      }catch(error){picker.querySelector('.messages-picker-list').innerHTML=`<p>${esc(error.message)}</p>`;}
    };
    actionMenu.querySelector('[data-message-action="media"]').onclick=()=>{closeActions();$('#messages-media').click();};
    actionMenu.querySelector('[data-message-action="files"]').onclick=()=>{sourceMenu.hidden=!sourceMenu.hidden;};
    sourceMenu.querySelectorAll('[data-file-source]').forEach(button=>button.onclick=()=>{const mode=button.dataset.fileSource;closeActions();showFilePicker(mode);});
    actionMenu.querySelector('[data-message-action="poll"]').onclick=async()=>{closeActions();if(!active)return;const question=await tbPrompt('What would you like to ask?', '', {title:'Create a poll',placeholder:'Poll question'});if(!question)return;const raw=await tbPrompt('Separate each option with a comma.', '', {title:'Poll options',placeholder:'Yes, No, Maybe'});const options=String(raw||'').split(',').map(value=>value.trim()).filter(Boolean).slice(0,6);if(options.length<2)return alert('Add at least two poll options.');messages.push(await sendMessage(active.conversation_id,question,'poll',{question,options:options.map(text=>({text,voters:[]}))}));renderMessages();};
    actionMenu.querySelector('[data-message-action="participant"]').onclick=async()=>{
      closeActions();if(!active)return;
      picker.hidden=false;picker.innerHTML=`<div class="messages-picker-card"><div class="messages-picker-head"><div><strong>Add a participant</strong><small>Search Toolbox by name or username</small></div><button type="button" aria-label="Close">×</button></div><div class="messages-participant-search"><span>⌕</span><input type="search" placeholder="Search people" autocomplete="off" aria-label="Search Toolbox users"></div><div class="messages-picker-list"><p>Start typing to find someone.</p></div></div>`;
      const search=picker.querySelector('input'),listEl=picker.querySelector('.messages-picker-list');let inviteTimer=0,participants=[];
      picker.querySelector('.messages-picker-head button').onclick=()=>{clearTimeout(inviteTimer);picker.hidden=true;};
      try{participants=await listConversationParticipants(active.conversation_id);}catch{const p=person(active);participants=[{id:user.id},p].filter(item=>item.id);}
      const existing=new Set(participants.map(item=>item.id));
      const renderPeople=users=>{const choices=users.filter(item=>!existing.has(item.id));listEl.innerHTML=choices.length?choices.map(profile=>`<button type="button" data-participant="${profile.id}">${avatarMarkup(profile,38)}<span><strong>${esc(profile.name)}</strong><small>@${esc(profile.username||'toolbox-user')}</small></span></button>`).join(''):'<p>No eligible users found.</p>';listEl.querySelectorAll('[data-participant]').forEach(button=>button.onclick=async()=>{const target=choices.find(item=>item.id===button.dataset.participant);button.disabled=true;try{const sent=await sendMessage(active.conversation_id,`Add ${target.name}`,'participant_request',{target_id:target.id,target_name:target.name,approvals:[user.id],required_count:Math.max(2,participants.length)});messages.push(sent);messagesFingerprint='';picker.hidden=true;renderMessages();}catch(error){button.disabled=false;listEl.innerHTML=`<div class="messages-error">${esc(error.message)}</div>`;}});};
      search.oninput=()=>{clearTimeout(inviteTimer);const query=search.value.trim();if(query.length<2){listEl.innerHTML='<p>Type at least two characters.</p>';return;}listEl.innerHTML='<div class="messages-list-empty">Searching…</div>';inviteTimer=setTimeout(async()=>{try{renderPeople(await searchToolboxUsers(query));}catch(error){listEl.innerHTML=`<div class="messages-error">${esc(error.message)}</div>`;}},220);};
      requestAnimationFrame(()=>search.focus());
    };
    const outsideHandler=event=>{if(!event.target.closest('.messages-action-wrap'))closeActions();};document.addEventListener('pointerdown',outsideHandler);
    actionMenu.onkeydown=event=>{const items=[...actionMenu.querySelectorAll('[role="menuitem"]')];const index=items.indexOf(document.activeElement);if(event.key==='Escape'){closeActions();plusButton.focus();}if(event.key==='ArrowDown'){event.preventDefault();items[(index+1)%items.length].focus();}if(event.key==='ArrowUp'){event.preventDefault();items[(index-1+items.length)%items.length].focus();}};
    $('#messages-game').onclick=async()=>{if(!active)return;try{messages.push(await sendMessage(active.conversation_id,'Tic-tac-toe','game',{board:Array(9).fill(''),turn:'X',winner:''}));renderMessages();}catch(error){alert(error.message);}};
    refreshConversations(); poll=setInterval(()=>{refreshConversations();refreshMessages();},5000);
    this._cleanup=()=>{stopped=true;clearInterval(poll);clearTimeout(searchTimer);document.removeEventListener('pointerdown',outsideHandler);};
  },
  destroy(){this._cleanup?.();this._cleanup=null;}
};
