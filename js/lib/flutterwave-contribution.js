/* ============================================================
   TOOLBOX — Flutterwave Contribution Integration
   Enables supporters to contribute to Toolbox development
   via Flutterwave Standard Inline checkout with customizable
   amounts and CAD, GBP, USD, NGN multi-currency support.
   ============================================================ */

const STORAGE_KEY_FLW_PUBLIC = 'toolbox_flutterwave_public_key';
// Creator's Flutterwave public key (Production)
const DEFAULT_FLW_KEY = 'FLWPUBK-cb3d7945751843f1c06e13b27c4089e7-X';

let flwScriptPromise = null;

function loadFlutterwaveScript() {
  if (typeof window.FlutterwaveCheckout === 'function') {
    return Promise.resolve();
  }
  if (flwScriptPromise) return flwScriptPromise;

  flwScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="checkout.flutterwave.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (err) => reject(err));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Flutterwave checkout script'));
    document.head.appendChild(script);
  });

  return flwScriptPromise;
}

const CURRENCY_CONFIG = {
  NGN: { symbol: '₦', defaultAmount: 5000, min: 100 },
  USD: { symbol: '$', defaultAmount: 10, min: 1 },
  CAD: { symbol: '$', defaultAmount: 15, min: 1 },
  GBP: { symbol: '£', defaultAmount: 10, min: 1 },
};

export function initFlutterwaveContribution() {
  const container = document.getElementById('contribute-section');
  if (!container) return;

  const currencySelect = container.querySelector('#contrib-currency');
  const amountInput = container.querySelector('#contrib-amount-input');
  const currSymbolSpan = container.querySelector('#contrib-curr-symbol');
  const nameInput = container.querySelector('#contrib-name');
  const emailInput = container.querySelector('#contrib-email');
  const checkoutBtn = container.querySelector('#contrib-flutterwave-btn');
  const statusMsg = container.querySelector('#contrib-status-msg');

  if (!checkoutBtn || !amountInput) return;

  function syncCurrency() {
    const curr = currencySelect?.value || 'NGN';
    const cfg = CURRENCY_CONFIG[curr] || CURRENCY_CONFIG.NGN;
    if (currSymbolSpan) {
      currSymbolSpan.textContent = cfg.symbol;
    }
    if (!amountInput.value) {
      amountInput.value = cfg.defaultAmount;
    }
  }

  if (currencySelect) {
    currencySelect.addEventListener('change', () => {
      syncCurrency();
    });
  }

  syncCurrency();

  // Handle Checkout Click
  checkoutBtn.addEventListener('click', async () => {
    const rawAmt = parseFloat(amountInput.value);
    const curr = currencySelect?.value || 'NGN';
    const cfg = CURRENCY_CONFIG[curr] || CURRENCY_CONFIG.NGN;

    if (isNaN(rawAmt) || rawAmt < (cfg.min || 1)) {
      showStatus(`Please enter a contribution amount of at least ${cfg.symbol}${cfg.min || 1}.`, 'error');
      amountInput.focus();
      return;
    }

    const email = (emailInput?.value || '').trim() || 'supporter@toolbox.dev';
    const name = (nameInput?.value || '').trim() || 'Toolbox Supporter';
    const pubKey = localStorage.getItem(STORAGE_KEY_FLW_PUBLIC) || DEFAULT_FLW_KEY;

    checkoutBtn.disabled = true;
    const origBtnHtml = checkoutBtn.innerHTML;
    checkoutBtn.innerHTML = `
      <svg class="animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      <span>Connecting to Flutterwave…</span>
    `;

    try {
      await loadFlutterwaveScript();

      if (typeof window.FlutterwaveCheckout !== 'function') {
        throw new Error('Flutterwave inline checkout is unavailable in this environment.');
      }

      const txRef = 'TBX-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);

      window.FlutterwaveCheckout({
        public_key: pubKey,
        tx_ref: txRef,
        amount: rawAmt,
        currency: curr,
        payment_options: 'card,ussd,banktransfer,qr,mobilemoney',
        customer: {
          email: email,
          name: name,
        },
        customizations: {
          title: 'Toolbox Development Contribution',
          description: `Contribution of ${cfg.symbol}${rawAmt.toLocaleString()} to Toolbox open development`,
          logo: window.location.origin + '/assets/logo.svg',
        },
        callback: function(paymentData) {
          console.log('[Flutterwave] Payment successful:', paymentData);
          showStatus(`Thank you so much, ${name}! Your contribution of ${cfg.symbol}${rawAmt.toLocaleString()} (${paymentData.transaction_id || txRef}) was successful.`, 'success');
        },
        onclose: function() {
          checkoutBtn.disabled = false;
          checkoutBtn.innerHTML = origBtnHtml;
        }
      });
    } catch (err) {
      console.error('[Flutterwave] Checkout initialization failed:', err);
      showStatus(`Unable to load checkout: ${err.message}. Please try again later.`, 'error');
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = origBtnHtml;
    }
  });

  function showStatus(msg, type = 'info') {
    if (!statusMsg) return;
    statusMsg.style.display = 'block';
    statusMsg.textContent = msg;
    if (type === 'error') {
      statusMsg.style.background = 'rgba(239, 68, 68, 0.12)';
      statusMsg.style.color = '#ef4444';
      statusMsg.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    } else {
      statusMsg.style.background = 'rgba(16, 185, 129, 0.12)';
      statusMsg.style.color = '#10b981';
      statusMsg.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    }
  }
}
