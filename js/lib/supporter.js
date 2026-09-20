import { getCurrentUser } from './supabase.js';

let state = { supporter:false };
let accountId = null;
let refreshSequence = 0;
export const getSupporterState = () => accountId === getCurrentUser()?.id ? state : { supporter:false };
export async function supporterRequest(path, body = null, authenticated = true) {
  const user = getCurrentUser();
  const response = await fetch(`/api/supporter/${path}`, {
    method:body ? 'POST' : 'GET',
    headers:{ 'Content-Type':'application/json', ...(authenticated && user?.token ? { Authorization:`Bearer ${user.token}` } : {}) },
    ...(body ? { body:JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Supporter services are unavailable. Please try again later.');
  return data;
}
export async function refreshSupporterState() {
  const sequence = ++refreshSequence;
  const user = getCurrentUser();
  if (!user) { state = { supporter:false }; accountId = null; paintSupporterProfile(); return; }
  const data = await supporterRequest('status');
  if (getCurrentUser()?.id !== user.id || sequence !== refreshSequence) return;
  state = data; accountId = user.id;
  paintSupporterProfile();
  window.dispatchEvent(new CustomEvent('toolbox:supporterchange'));
}
export function paintSupporterProfile() {
  const current = getSupporterState();
  // Decorate only avatars explicitly bound to the current account.
  document.querySelectorAll('[data-supporter-account]').forEach(element => {
    const eligible = current.supporter && element.dataset.supporterAccount === accountId;
    element.dataset.supporterStyle = eligible ? current.profileStyle : 'classic';
    element.querySelector('.supporter-avatar-badge')?.remove();
    if (eligible) {
      const badge = document.createElement('span');
      badge.className = 'supporter-avatar-badge';
      badge.textContent = 'S'; badge.title = 'Toolbox Supporter'; badge.setAttribute('aria-label','Toolbox Supporter');
      element.appendChild(badge);
    }
  });
}
export function initSupporterProfile() {
  const refresh = () => {
    state = { supporter:false }; accountId = null; paintSupporterProfile();
    if (getCurrentUser()) refreshSupporterState().catch(() => {});
  };
  window.addEventListener('toolbox:authchange', refresh);
  refresh();
}
