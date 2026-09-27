/* ============================================================
   TOOLBOX — Assistant memory in Preferences → Assistant
   Shows the facts the Assistant keeps about the person (stored on
   this device by ai-provider.js) and lets them add, edit, delete or
   clear them.
   ============================================================ */

// Same storage as ai-provider.js (not imported, so opening Preferences doesn't load the whole Assistant).
const STORAGE_AI_MEMORY = 'toolbox_assistant_memory_v1';
function getAssistantMemory() {
  try { const v = JSON.parse(localStorage.getItem(STORAGE_AI_MEMORY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function clearAssistantMemory() { save([]); }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function save(list) {
  try { localStorage.setItem(STORAGE_AI_MEMORY, JSON.stringify(list)); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent('toolbox:assistant-memory', { detail: { memory: list } }));
}

// Concepts the Assistant learned from the web (same storage as assistant/knowledge-library.js).
const STORAGE_KNOWLEDGE = 'toolbox_knowledge_library_v1';
function getLearned() {
  try { const v = JSON.parse(localStorage.getItem(STORAGE_KNOWLEDGE) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveLearned(list) {
  try { localStorage.setItem(STORAGE_KNOWLEDGE, JSON.stringify(list)); } catch { /* storage blocked */ }
}
function learnedHtml() {
  const list = getLearned();
  if (!list.length) return '';
  const link = (src) => (/^https?:\/\//.test(src) ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(new URL(src).hostname.replace(/^www\./, ''))}</a>` : esc(src));
  return `
    <div class="amem-head amem-learned-head">
      <div>
        <h3 class="amem-title">What the Assistant has learned</h3>
        <p class="amem-hint">Concepts it studied on the web, with their sources. It uses them in later answers. ${list.length} saved.</p>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-act="clear-learned">Clear all</button>
    </div>
    <ul class="amem-list amem-learned">
      ${list.map((c, i) => ({ c, i })).reverse().slice(0, 60).map(({ c, i }) => `
        <li class="amem-item amem-concept" data-ci="${i}">
          <div><strong>${esc(c.term)}</strong>${c.topic ? ` <span class="amem-topic">${esc(c.topic)}</span>` : ''}<p>${esc(c.summary)}</p><small>${link(c.source)} · ${esc(c.learnedAt || '')}</small></div>
          <button type="button" class="btn btn-ghost btn-sm" data-act="forget-concept" aria-label="Forget this concept">Forget</button>
        </li>`).join('')}
    </ul>`;
}

export function renderAssistantMemory(container) {
  if (!container) return;
  const paint = () => {
    const list = getAssistantMemory();
    container.innerHTML = `
      <div class="amem">
        <div class="amem-head">
          <div>
            <h3 class="amem-title">What the Assistant remembers</h3>
            <p class="amem-hint">Facts it uses in every chat, like your company name or how you like quotes done. Stored on this device only. You can also just tell it "remember …" or "forget …".</p>
          </div>
          ${list.length ? '<button type="button" class="btn btn-secondary btn-sm" data-act="clear">Clear all</button>' : ''}
        </div>
        <ul class="amem-list">
          ${list.length ? list.map((f, i) => `
            <li class="amem-item" data-i="${i}">
              <input class="tool-input amem-text" value="${esc(f.text)}" aria-label="Remembered fact ${i + 1}" maxlength="240">
              <button type="button" class="btn btn-ghost btn-sm" data-act="del" aria-label="Delete this fact">Delete</button>
            </li>`).join('') : '<li class="amem-empty">Nothing yet.</li>'}
        </ul>
        <form class="amem-add">
          <input class="tool-input" name="fact" placeholder="Add a fact, e.g. Quotes include 7.5% VAT" maxlength="240" aria-label="New fact">
          <button type="submit" class="btn btn-primary btn-sm">Add</button>
        </form>
        ${learnedHtml()}
      </div>`;
  };
  paint();
  container.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'clear') { clearAssistantMemory(); paint(); }
    if (act === 'forget-concept') {
      const i = Number(e.target.closest('[data-ci]').dataset.ci);
      const list = getLearned(); list.splice(i, 1); saveLearned(list); paint();
    }
    if (act === 'clear-learned') { saveLearned([]); paint(); }
    if (act === 'del') {
      const i = Number(e.target.closest('[data-i]').dataset.i);
      const list = getAssistantMemory(); list.splice(i, 1); save(list); paint();
    }
  });
  container.addEventListener('change', (e) => {
    const li = e.target.closest('.amem-item');
    if (!li || !e.target.classList.contains('amem-text')) return;
    const list = getAssistantMemory();
    const text = e.target.value.trim();
    if (text) list[Number(li.dataset.i)] = { ...list[Number(li.dataset.i)], text, at: Date.now() };
    else list.splice(Number(li.dataset.i), 1);
    save(list); paint();
  });
  container.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input[name="fact"]');
    const text = input.value.trim();
    if (!text) return;
    if (/\b(password|passcode|cvv|card number|account number|bvn|nin)\b|\b\d{10,19}\b/i.test(text)) {
      input.setCustomValidity('Passwords, card, account and ID numbers are not stored.'); input.reportValidity(); input.setCustomValidity(''); return;
    }
    const list = getAssistantMemory(); list.push({ text, at: Date.now() }); save(list); paint();
  });
}
