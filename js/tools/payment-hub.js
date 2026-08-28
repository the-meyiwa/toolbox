/* ============================================================
   Payment Hub (VolTix Receive Money) — Multi-Rail Payment Receiver.

   Generate payment links, create virtual bank accounts, process
   card checkouts, and accept crypto/lightning payments with live
   transaction state tracking, idempotency, and receipt generation.
   ============================================================ */

import { paymentGateway, getAllTransactions } from '../lib/payment-engine.js';
import { currencySelect, money, escapeHtml } from '../lib/biz.js';
import { copyText } from '../utils.js';

export default {
  render(container, { analytics, artifact } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      <div class="biz-explain" style="margin-bottom:14px; font-size:0.84rem; display:flex; align-items:center; gap:8px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <span>VolTix Money-Receiving Engine: Provider-agnostic payment receiving via Dedicated Virtual Bank Accounts, Cards &amp; Crypto rails.</span>
      </div>

      <div style="display:grid; grid-template-columns:minmax(320px, 1fr) minmax(360px, 1.2fr); gap:16px; align-items:start;" class="pay-hub-grid">
        <!-- Create Payment Request Form -->
        <div class="tool-section" style="background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:18px;">
          <h3 style="font-size:1.05rem; font-weight:700; margin:0 0 14px; color:var(--black);">Request Payment / Receive Money</h3>

          <div class="biz-field" style="margin-bottom:12px;">
            <label class="tool-label" for="pay-amount">Amount &amp; Currency</label>
            <div style="display:grid; grid-template-columns:1fr 120px; gap:8px;">
              <input type="number" class="tool-input" id="pay-amount" placeholder="0.00" value="150.00" min="1" step="any">
              ${currencySelect('pay-currency', 'USD')}
            </div>
          </div>

          <div class="biz-field" style="margin-bottom:12px;">
            <label class="tool-label" for="pay-desc">Description / Purpose</label>
            <input type="text" class="tool-input" id="pay-desc" value="Website Development &amp; Consulting" placeholder="e.g. Invoice #1024 or Project Retainer">
          </div>

          <div class="biz-field" style="margin-bottom:12px;">
            <label class="tool-label" for="pay-email">Customer Email</label>
            <input type="email" class="tool-input" id="pay-email" value="client@example.com" placeholder="client@company.com">
          </div>

          <div class="biz-field" style="margin-bottom:14px;">
            <label class="tool-label">Payment Method Rail</label>
            <div class="btn-group t3d-seg" id="pay-rail-grp" style="width:100%;">
              <button class="btn btn-sm is-active" data-rail="virtual-account" style="flex:1;">🏦 Virtual Account</button>
              <button class="btn btn-sm" data-rail="card" style="flex:1;">💳 Card</button>
              <button class="btn btn-sm" data-rail="crypto" style="flex:1;">⚡ Crypto / Lightning</button>
            </div>
          </div>

          <button class="btn btn-primary" id="pay-create-btn" style="width:100%;">Generate Checkout &amp; Account</button>
        </div>

        <!-- Active Checkout / Payment Stage -->
        <div class="tool-section" style="background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:18px;">
          <div id="pay-active-stage">
            <div style="text-align:center; padding:32px 16px; color:var(--g500);">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 10px; opacity:0.6;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              <div style="font-weight:600; color:var(--g700); margin-bottom:4px;">No Active Payment Session</div>
              <p style="font-size:0.84rem; margin:0;">Fill the form on the left to generate an active receiving account or checkout.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction History / Settlement Ledger -->
      <div class="tool-section" style="margin-top:20px; background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <h3 style="font-size:1.05rem; font-weight:700; margin:0; color:var(--black);">Transaction Ledger</h3>
          <span id="pay-ledger-count" style="font-size:0.8rem; color:var(--g600);"></span>
        </div>
        <div id="pay-ledger-wrap" style="overflow-x:auto;"></div>
      </div>
    `;

    const amountIn    = container.querySelector('#pay-amount');
    const currencyIn  = container.querySelector('#pay-currency');
    const descIn      = container.querySelector('#pay-desc');
    const emailIn     = container.querySelector('#pay-email');
    const railGrp     = container.querySelector('#pay-rail-grp');
    const createBtn   = container.querySelector('#pay-create-btn');
    const stageEl     = container.querySelector('#pay-active-stage');
    const ledgerWrap  = container.querySelector('#pay-ledger-wrap');
    const ledgerCount = container.querySelector('#pay-ledger-count');

    let currentRail = 'virtual-account';
    let activeTx = null;

    railGrp.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rail]');
      if (!btn) return;
      for (const b of railGrp.querySelectorAll('.btn')) b.classList.toggle('is-active', b === btn);
      currentRail = btn.dataset.rail;
    });

    async function handleCreateSession() {
      const amount = parseFloat(amountIn.value);
      if (!amount || amount <= 0) {
        alert('Please specify a valid payment amount.');
        return;
      }

      createBtn.disabled = true;
      createBtn.textContent = 'Generating…';

      try {
        const tx = await paymentGateway.initiate({
          amount: amount,
          currency: currencyIn.value,
          customerEmail: emailIn.value,
          description: descIn.value,
          rail: currentRail,
        });

        activeTx = tx;
        renderActiveStage(tx);
        renderLedger();
        analytics?.started();
      } catch (err) {
        alert('Could not initiate payment: ' + err.message);
      } finally {
        createBtn.disabled = false;
        createBtn.textContent = 'Generate Checkout & Account';
      }
    }

    createBtn.addEventListener('click', handleCreateSession);

    function renderActiveStage(tx) {
      if (!tx) return;

      const isSuccess = tx.status === 'SUCCEEDED';
      const statusBadge = isSuccess
        ? `<span style="font-size:0.75rem; font-weight:700; background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:999px;">PAID / SETTLED</span>`
        : `<span style="font-size:0.75rem; font-weight:700; background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:999px;">AWAITING PAYMENT</span>`;

      let railSpecificHtml = '';

      if (tx.rail === 'virtual-account') {
        railSpecificHtml = `
          <div style="background:var(--g50); border:1px solid var(--g200); border-radius:8px; padding:12px; margin:12px 0;">
            <div style="font-size:0.78rem; color:var(--g600); margin-bottom:2px;">Bank Name</div>
            <div style="font-weight:700; font-size:0.95rem; color:var(--black); margin-bottom:8px;">${escapeHtml(tx.details.bankName)}</div>

            <div style="font-size:0.78rem; color:var(--g600); margin-bottom:2px;">Account Number</div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <span style="font-family:var(--mono); font-size:1.15rem; font-weight:700; letter-spacing:0.05em; color:var(--black);">${tx.details.accountNumber}</span>
              <button class="btn btn-secondary btn-sm" id="pay-copy-acct" style="font-size:0.75rem; padding:2px 8px;">Copy</button>
            </div>

            <div style="font-size:0.78rem; color:var(--g600); margin-bottom:2px;">Account Name</div>
            <div style="font-size:0.85rem; color:var(--g800); margin-bottom:8px;">${escapeHtml(tx.details.accountName)}</div>

            <div style="font-size:0.78rem; color:var(--g600); margin-bottom:2px;">Reference / Memo</div>
            <div style="font-family:var(--mono); font-size:0.85rem; color:var(--g800);">${tx.reference}</div>
          </div>
          <p style="font-size:0.78rem; color:var(--g600); margin:0 0 12px;">${tx.details.instructions}</p>
        `;
      } else if (tx.rail === 'card') {
        railSpecificHtml = `
          <div style="background:var(--g50); border:1px solid var(--g200); border-radius:8px; padding:12px; margin:12px 0;">
            <div style="margin-bottom:8px;">
              <label class="tool-label" style="font-size:0.78rem;">Card Number</label>
              <input type="text" class="tool-input" id="crd-num" placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242" style="font-family:var(--mono);">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
              <div>
                <label class="tool-label" style="font-size:0.78rem;">Expiry</label>
                <input type="text" class="tool-input" id="crd-exp" placeholder="12/28" value="12/28" style="font-family:var(--mono);">
              </div>
              <div>
                <label class="tool-label" style="font-size:0.78rem;">CVC</label>
                <input type="text" class="tool-input" id="crd-cvc" placeholder="123" value="123" style="font-family:var(--mono);">
              </div>
            </div>
            <button class="btn btn-primary" id="crd-pay-btn" style="width:100%; margin-top:4px;" ${isSuccess ? 'disabled' : ''}>
              ${isSuccess ? '✓ Card Charged Successfully' : `Pay ${money(tx.amount, tx.currency)}`}
            </button>
          </div>
        `;
      } else if (tx.rail === 'crypto') {
        railSpecificHtml = `
          <div style="background:var(--g50); border:1px solid var(--g200); border-radius:8px; padding:12px; margin:12px 0;">
            <div style="font-size:0.78rem; color:var(--g600); margin-bottom:4px;">Supported: USDT, USDC &amp; Lightning</div>
            <div style="font-size:0.78rem; color:var(--g600); margin-bottom:2px;">Deposit Address (EVM / Polygon / Arbitrum):</div>
            <div style="font-family:var(--mono); font-size:0.75rem; word-break:break-all; background:var(--white); padding:6px 8px; border:1px solid var(--g200); border-radius:4px; margin-bottom:8px;">
              ${tx.details.walletAddress}
            </div>
            <div style="font-size:0.78rem; color:var(--g600); margin-bottom:2px;">Lightning Invoice:</div>
            <div style="font-family:var(--mono); font-size:0.75rem; word-break:break-all; background:var(--white); padding:6px 8px; border:1px solid var(--g200); border-radius:4px; margin-bottom:8px;">
              ${tx.details.lightningInvoice}
            </div>
          </div>
        `;
      }

      stageEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div>
            <div style="font-size:0.8rem; color:var(--g600); font-family:var(--mono);">${tx.reference}</div>
            <h4 style="font-size:1.3rem; font-weight:800; margin:2px 0 0; color:var(--black);">${money(tx.amount, tx.currency)}</h4>
          </div>
          ${statusBadge}
        </div>

        <div style="font-size:0.85rem; color:var(--g800); margin-bottom:8px;"><strong>For:</strong> ${escapeHtml(tx.description)}</div>

        ${railSpecificHtml}

        <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
          ${!isSuccess ? `
            <button class="btn btn-secondary btn-sm" id="pay-simulate-btn" style="background:#f0fdf4; border-color:#86efac; color:#166534;">
              ⚡ Simulate Bank Inflow / Settlement
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" id="pay-download-receipt">
              📄 Download Receipt (PDF / Text)
            </button>
          `}
          <button class="btn btn-secondary btn-sm" id="pay-copy-link">Copy Payment Link</button>
        </div>
      `;

      const copyAcctBtn = stageEl.querySelector('#pay-copy-acct');
      if (copyAcctBtn) {
        copyAcctBtn.addEventListener('click', (e) => {
          copyText(tx.details.accountNumber, e.target);
        });
      }

      const crdPayBtn = stageEl.querySelector('#crd-pay-btn');
      if (crdPayBtn && !isSuccess) {
        crdPayBtn.addEventListener('click', async () => {
          try {
            crdPayBtn.disabled = true;
            crdPayBtn.textContent = 'Processing Card…';
            const cardProvider = paymentGateway.getProvider('card');
            const updated = await cardProvider.processCard(tx.reference, {
              cardNumber: stageEl.querySelector('#crd-num').value,
              expMonth: '12',
              expYear: '28',
              cvc: stageEl.querySelector('#crd-cvc').value,
            });
            activeTx = updated;
            renderActiveStage(updated);
            renderLedger();
            analytics?.completed({ amount: tx.amount });
          } catch (err) {
            alert('Card processing error: ' + err.message);
            crdPayBtn.disabled = false;
            crdPayBtn.textContent = `Pay ${money(tx.amount, tx.currency)}`;
          }
        });
      }

      const simBtn = stageEl.querySelector('#pay-simulate-btn');
      if (simBtn) {
        simBtn.addEventListener('click', async () => {
          simBtn.disabled = true;
          simBtn.textContent = 'Settling…';
          const p = paymentGateway.getProvider(tx.rail);
          if (p.simulatePayment) await p.simulatePayment(tx.reference);
          else if (p.simulateConfirmation) await p.simulateConfirmation(tx.reference);
          activeTx = await paymentGateway.verify(tx.reference);
          renderActiveStage(activeTx);
          renderLedger();
          analytics?.completed({ amount: tx.amount });
        });
      }

      const copyLinkBtn = stageEl.querySelector('#pay-copy-link');
      if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', (e) => {
          const url = `${window.location.origin}${window.location.pathname}#payment-hub?ref=${tx.reference}`;
          copyText(url, e.target);
        });
      }

      const receiptBtn = stageEl.querySelector('#pay-download-receipt');
      if (receiptBtn) {
        receiptBtn.addEventListener('click', () => {
          const text = `========================================
VOLTIX PAYMENT RECEIPT
========================================
Reference:   ${tx.reference}
Date:        ${new Date(tx.paidAt || tx.createdAt).toUTCString()}
Status:      ${tx.status}
Amount:      ${money(tx.amount, tx.currency)}
Payer:       ${tx.customerEmail}
Description: ${tx.description}
Rail:        ${tx.rail.toUpperCase()}
========================================
Thank you for your payment.
`;
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `receipt_${tx.reference}.txt`;
          a.click();
        });
      }
    }

    function renderLedger() {
      const list = getAllTransactions();
      ledgerCount.textContent = `${list.length} total transaction${list.length === 1 ? '' : 's'}`;

      if (!list.length) {
        ledgerWrap.innerHTML = `<p style="font-size:0.84rem; color:var(--g500); margin:8px 0;">No transactions recorded yet.</p>`;
        return;
      }

      ledgerWrap.innerHTML = `
        <table class="inv-table" style="font-size:0.82rem; width:100%; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--g200); text-align:left;">
              <th style="padding:6px 8px;">Date</th>
              <th style="padding:6px 8px;">Reference</th>
              <th style="padding:6px 8px;">Description</th>
              <th style="padding:6px 8px;">Rail</th>
              <th style="padding:6px 8px; text-align:right;">Amount</th>
              <th style="padding:6px 8px; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(t => {
              const isPaid = t.status === 'SUCCEEDED';
              return `
                <tr style="border-bottom:1px solid var(--g100); cursor:pointer;" data-tx-ref="${t.reference}">
                  <td style="padding:6px 8px; color:var(--g600);">${new Date(t.createdAt).toLocaleDateString()}</td>
                  <td style="padding:6px 8px; font-family:var(--mono); font-weight:600;">${t.reference}</td>
                  <td style="padding:6px 8px;">${escapeHtml(t.description || '—')}</td>
                  <td style="padding:6px 8px; text-transform:capitalize;">${t.rail.replace('-', ' ')}</td>
                  <td style="padding:6px 8px; text-align:right; font-weight:700;">${money(t.amount, t.currency)}</td>
                  <td style="padding:6px 8px; text-align:center;">
                    <span style="font-size:0.72rem; font-weight:700; padding:1px 6px; border-radius:999px; background:${isPaid ? '#dcfce7' : '#fef3c7'}; color:${isPaid ? '#15803d' : '#b45309'};">
                      ${t.status}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      ledgerWrap.querySelectorAll('[data-tx-ref]').forEach(tr => {
        tr.addEventListener('click', async () => {
          const ref = tr.dataset.txRef;
          try {
            const tx = await paymentGateway.verify(ref);
            activeTx = tx;
            renderActiveStage(tx);
          } catch {}
        });
      });
    }

    renderLedger();

    // Check if deep-linked via URL query e.g. #payment-hub?ref=VA-...
    const hash = window.location.hash || '';
    if (hash.includes('ref=')) {
      const match = hash.match(/ref=([A-Z0-9_-]+)/);
      if (match && match[1]) {
        paymentGateway.verify(match[1]).then(tx => {
          if (tx) {
            activeTx = tx;
            renderActiveStage(tx);
          }
        }).catch(() => {});
      }
    }
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
