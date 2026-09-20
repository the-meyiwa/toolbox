import { getCurrentUser } from './supabase.js';
import { getSupporterState, refreshSupporterState, supporterRequest } from './supporter.js';

let scriptPromise;
const CLAIM_KEY = 'toolbox_contribution_claim';
function loadCheckout() {
  if (typeof window.FlutterwaveCheckout === 'function') return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { script.remove(); scriptPromise = null; reject(new Error('Checkout could not load. Please try again.')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export function renderContributionSettings(container, onSignIn) {
  if (!container) return;
  const user = getCurrentUser();
  container.innerHTML = `
    <h3 class="settings-section-title">Become a Supporter</h3>
    <p class="supporter-intro">If Toolbox has been useful to you, you can help fund the next round of careful improvements.</p>
    <div id="supporter-account-controls"></div>
    <form id="contribute-section" class="contribution-form">
      <div class="contribution-fields">
        <label>Amount<input id="contrib-amount-input" class="tool-input" type="number" min="100" step="0.01" value="5000" required></label>
        <label>Currency<select id="contrib-currency" class="tool-select"><option value="NGN">NGN (₦)</option><option value="USD">USD ($)</option><option value="CAD">CAD ($)</option><option value="GBP">GBP (£)</option></select></label>
      </div>
      ${user ? `<p class="supporter-account">Contributing as ${escape(user.email)}.</p>` : `<label class="contribution-email">Email for the payment receipt<input id="contrib-email" class="tool-input" type="email" autocomplete="email" required placeholder="you@example.com"></label><p class="supporter-note">Signing in after your contribution lets Toolbox remember it and attach any thank-you benefits to your profile.</p>`}
      <div class="contribution-actions"><button class="btn btn-primary" id="contrib-flutterwave-btn" type="submit" disabled>Contribute securely</button></div>
      <p class="supporter-note">One-time payment processed securely by Flutterwave.</p>
    </form>
    <p id="contrib-status-msg" class="supporter-status" role="status" aria-live="polite"></p>
    <div id="contrib-after-payment"></div>`;

  const status = container.querySelector('#contrib-status-msg');
  const button = container.querySelector('#contrib-flutterwave-btn');
  const amount = container.querySelector('#contrib-amount-input');
  const currency = container.querySelector('#contrib-currency');
  const email = container.querySelector('#contrib-email');
  const after = container.querySelector('#contrib-after-payment');
  const isCurrent = () => container.contains(status);
  let ready = false, busy = false;
  const report = text => { if (isCurrent()) status.textContent = text; };
  const unlock = () => { busy = false; if (isCurrent()) { button.disabled = !ready; amount.disabled = currency.disabled = false; if (email) email.disabled = false; } };

  async function claimRememberedContribution() {
    if (!user) return;
    const reference = localStorage.getItem(CLAIM_KEY);
    if (!reference) return;
    try {
      await supporterRequest('claim', { reference });
      localStorage.removeItem(CLAIM_KEY);
      await refreshSupporterState();
      renderMemberControls(container, report);
      report('Your contribution is now remembered on this Toolbox account. Thank you.');
    } catch { /* A delayed payment may be claimed on the next visit. */ }
  }

  container.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || busy || !isCurrent()) return;
    busy = true; button.disabled = true; amount.disabled = currency.disabled = true; if (email) email.disabled = true;
    report('Preparing secure checkout…');
    try {
      await loadCheckout();
      const intent = await supporterRequest('intent', { amount:Number(amount.value), currency:currency.value, email:email?.value.trim() || user?.email }, false);
      window.FlutterwaveCheckout({
        public_key:intent.public_key, tx_ref:intent.tx_ref, amount:intent.amount, currency:intent.currency,
        customer:intent.customer,
        customizations:{ title:'Support Toolbox', description:'A one-time contribution to Toolbox' },
        callback: async payment => {
          report('Confirming your contribution…');
          try {
            await supporterRequest('verify', { reference:intent.tx_ref, transactionId:payment.transaction_id }, false);
            if (user) {
              await supporterRequest('claim', { reference:intent.tx_ref });
              await refreshSupporterState();
              renderMemberControls(container, report);
              report('Thank you for supporting Toolbox. Your contribution is linked to your profile.');
            } else {
              localStorage.setItem(CLAIM_KEY, intent.tx_ref);
              report('Thank you for supporting Toolbox.');
              after.innerHTML = '<div class="contribution-thanks"><strong>Want Toolbox to remember this?</strong><span>Sign in and this contribution will be linked to your profile. This is optional.</span><button type="button" class="btn btn-secondary">Sign in to remember it</button></div>';
              after.querySelector('button').addEventListener('click', onSignIn);
            }
          } catch (error) { report(error.message); }
          finally { unlock(); }
        },
        onclose: unlock,
      });
      report('Complete your contribution in the Flutterwave checkout.');
    } catch (error) { report(error.message); unlock(); }
  });

  (async () => {
    try {
      const configuration = await supporterRequest('configuration', null, false);
      ready = configuration.ready; button.disabled = !ready;
      if (!ready) report('Contributions are temporarily unavailable on this deployment.');
      if (user) {
        await Promise.allSettled([refreshSupporterState(), claimRememberedContribution()]);
        renderMemberControls(container, report);
      }
    } catch (error) { report(error.message); }
  })();
}

function renderMemberControls(container, report) {
  const state = getSupporterState();
  const controls = container.querySelector('#supporter-account-controls');
  if (!controls || !state.supporter) { if (controls) controls.innerHTML = ''; return; }
  controls.innerHTML = `<div class="supporter-member"><span class="supporter-badge">Toolbox Supporter</span>
    <p class="supporter-note">Thank you. Your profile styles and early-access preference live here.</p>
    <label>Profile style<select class="tool-select" id="supporter-style">${['classic','etched','halo','orbit'].map(style => `<option value="${style}" ${state.profileStyle === style ? 'selected' : ''}>${style[0].toUpperCase()+style.slice(1)}</option>`).join('')}</select></label>
    <label class="supporter-toggle"><input type="checkbox" id="supporter-early" ${state.earlyAccess ? 'checked' : ''}>Enable early-access previews</label>
    <button type="button" class="btn btn-secondary" id="supporter-save">Save supporter preferences</button></div>`;
  controls.querySelector('#supporter-save').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    try {
      await supporterRequest('preferences', { profileStyle:controls.querySelector('#supporter-style').value, earlyAccess:controls.querySelector('#supporter-early').checked });
      await refreshSupporterState(); renderMemberControls(container, report); report('Supporter preferences saved.');
    } catch (error) { report(error.message); event.currentTarget.disabled = false; }
  });
}
