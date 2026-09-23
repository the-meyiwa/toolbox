/* ============================================================
   TOOLBOX — First-run username step
   Shown once after sign-up, before the optional Mail setup. It asks
   for a username only; the display name can be changed later in
   Preferences. The auto-generated handle is prefilled so keeping it
   is a single click.
   ============================================================ */

import { getCurrentUser, getSupabaseConfig, isUsernameAvailable, persistUserProfile } from '../lib/supabase.js';

const SESSION_KEY = 'toolbox_supabase_session';
const OWNER_HANDLE = 'madselkie';
const PATTERN = /^[a-z0-9_]{3,20}$/;

/** True only for an account whose handle was auto-derived and never confirmed. */
export function needsUsernameChoice(user = getCurrentUser()) {
  if (!user?.token) return false;
  if (user.username === OWNER_HANDLE) return false;
  const meta = user.user_metadata || {};
  if (user.usernameChosen || meta.username_chosen) return false;
  // Anyone who has ever changed their handle has, by definition, chosen it.
  if (user.username_changed_at || meta.username_changed_at) return false;
  return true;
}

function suggestionFor(user) {
  let s = String(user?.username || user?.email?.split('@')[0] || '')
    .toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
  if (s.length < 3) s = (s + 'user').slice(0, 4) + String(Math.floor(1000 + Math.random() * 9000));
  return s.slice(0, 20);
}

function localProblem(value) {
  if (!value) return 'Choose a username.';
  if (value.length < 3) return 'At least 3 characters.';
  if (value.length > 20) return '20 characters at most.';
  if (!PATTERN.test(value)) return 'Use lowercase letters, numbers and _ only.';
  if (value === OWNER_HANDLE) return 'That username is reserved.';
  const local = isUsernameAvailable(value);
  if (!local.available) return 'That username is taken.';
  return '';
}

/** Ask Supabase whether another account already holds this handle. null = could not tell. */
async function takenRemotely(value, user) {
  if (!user?.token || user.token.startsWith('tok_')) return false;
  try {
    const { url, anonKey } = getSupabaseConfig();
    if (!url) return null;
    const res = await fetch(`${url}/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(value)}&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${user.token}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.some((row) => row.id !== user.id);
  } catch { return null; }
}

function markChosen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!raw) return;
    raw.usernameChosen = true;
    raw.user_metadata = { ...(raw.user_metadata || {}), username_chosen: true };
    localStorage.setItem(SESSION_KEY, JSON.stringify(raw));
    window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: raw } }));
    // Remember it on the account too, so another device doesn't ask again.
    const { url, anonKey } = getSupabaseConfig();
    if (url && raw.token && !raw.token.startsWith('tok_')) {
      fetch(`${url}/auth/v1/user`, {
        method: 'PUT',
        headers: { apikey: anonKey, Authorization: `Bearer ${raw.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { username: raw.username, username_chosen: true } }),
      }).catch(() => {});
    }
  } catch { /* The flag is a convenience; a missing one only means asking again. */ }
}

let open = null;

/** Resolves once a username is saved. */
export function openUsernameOnboarding() {
  if (open) return open;
  const user = getCurrentUser();
  const suggested = suggestionFor(user);

  open = new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'custom-dialog-backdrop username-onboarding';
    backdrop.setAttribute('role', 'presentation');
    backdrop.innerHTML = `
      <form class="custom-dialog-window uo-window" role="dialog" aria-modal="true" aria-labelledby="uo-title" aria-describedby="uo-desc" novalidate>
        <h2 id="uo-title" class="custom-dialog-title">Pick a username</h2>
        <p id="uo-desc" class="custom-dialog-message uo-desc">This is how people find you in Messages and Spaces. You can change your display name any time in Preferences.</p>
        <label class="uo-label" for="uo-input">Username</label>
        <div class="uo-field">
          <span class="uo-at" aria-hidden="true">@</span>
          <input id="uo-input" class="tool-input uo-input" type="text" name="username" maxlength="20"
            autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"
            inputmode="text" aria-describedby="uo-status uo-rules" value="${suggested}">
        </div>
        <p id="uo-status" class="uo-status" role="status" aria-live="polite"></p>
        <p id="uo-rules" class="uo-rules">3–20 characters: lowercase letters, numbers and _</p>
        <div class="custom-dialog-footer uo-footer">
          <button type="submit" class="btn btn-primary uo-submit"></button>
        </div>
      </form>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('is-open'));

    const form = backdrop.querySelector('form');
    const input = backdrop.querySelector('#uo-input');
    const status = backdrop.querySelector('#uo-status');
    const submit = backdrop.querySelector('.uo-submit');
    let seq = 0;
    let remoteState = { value: null, taken: null };
    let saving = false;

    const setStatus = (text, tone = '') => {
      status.textContent = text;
      status.dataset.tone = tone;
      input.setAttribute('aria-invalid', tone === 'error' ? 'true' : 'false');
    };

    const refresh = () => {
      const value = input.value.trim().toLowerCase();
      const problem = localProblem(value);
      submit.textContent = value === suggested ? `Keep @${suggested}` : (value && !problem ? `Use @${value}` : 'Continue');
      if (problem) { setStatus(value ? problem : '', value ? 'error' : ''); submit.disabled = true; return; }
      if (remoteState.value === value && remoteState.taken === true) { setStatus(`@${value} is taken.`, 'error'); submit.disabled = true; return; }
      if (remoteState.value === value && remoteState.taken === false) setStatus(`@${value} is available.`, 'ok');
      else setStatus('Checking availability…');
      submit.disabled = saving;
    };

    let timer = 0;
    const check = () => {
      clearTimeout(timer);
      const value = input.value.trim().toLowerCase();
      if (localProblem(value)) return;
      const mine = ++seq;
      timer = setTimeout(async () => {
        const taken = await takenRemotely(value, user);
        if (mine !== seq) return;
        remoteState = { value, taken: taken === null ? false : taken };
        refresh();
      }, 280);
    };

    input.addEventListener('input', () => {
      // Normalise as they type: lowercase, spaces become _, anything else is dropped.
      const cleaned = input.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20);
      if (cleaned !== input.value) {
        const pos = Math.min(cleaned.length, input.selectionStart ?? cleaned.length);
        input.value = cleaned;
        input.setSelectionRange(pos, pos);
      }
      refresh();
      check();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = input.value.trim().toLowerCase();
      if (saving || localProblem(value)) { refresh(); return; }
      saving = true; submit.disabled = true;
      const label = submit.textContent;
      submit.textContent = 'Saving…';
      try {
        if (await takenRemotely(value, user)) {
          remoteState = { value, taken: true };
          throw Object.assign(new Error(`@${value} is taken.`), { inline: true });
        }
        await persistUserProfile({ username: value });
        markChosen();
        finish();
      } catch (error) {
        saving = false;
        submit.textContent = label;
        submit.disabled = false;
        const taken = error.inline || /taken/i.test(error.message || '');
        if (taken) remoteState = { value, taken: true };
        setStatus(taken ? `@${value} is taken.` : (error.message || 'Your username could not be saved. Try again.'), 'error');
        if (taken) submit.disabled = true;
        input.focus();
      }
    });

    // A username is required, so there is no dismiss; keep focus inside.
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); input.focus(); }
      if (e.key === 'Tab') {
        const items = [input, submit].filter((el) => !el.disabled);
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);

    function finish() {
      window.removeEventListener('keydown', onKeyDown, true);
      backdrop.classList.remove('is-open');
      backdrop.classList.add('is-closing');
      setTimeout(() => {
        backdrop.remove();
        try { previousFocus?.focus?.(); } catch {}
        open = null;
        resolve(input.value.trim().toLowerCase());
      }, 180);
    }

    refresh();
    check();
    input.focus();
    input.select();
  });
  return open;
}
