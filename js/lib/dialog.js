/* ============================================================
   TOOLBOX — Accessible Custom Dialog System
   Replaces browser-native alert(), confirm(), and prompt()
   with fully themed, keyboard accessible modal dialogs.
   ============================================================ */

let activeDialog = null;
let lastFocusedElement = null;

/**
 * Core dialog display function
 * @param {Object} options
 * @param {string} [options.title] - Dialog header title
 * @param {string} options.message - Body message/prompt
 * @param {'alert'|'confirm'|'prompt'} [options.type='alert'] - Type of dialog
 * @param {string} [options.confirmText] - Label for primary button
 * @param {string} [options.cancelText] - Label for cancel button
 * @param {boolean} [options.destructive=false] - If true, highlights confirm as danger action
 * @param {string} [options.defaultValue=''] - Default value for prompt input
 * @param {string} [options.placeholder=''] - Placeholder for prompt input
 * @returns {Promise<boolean|string|null>}
 */
export function showDialog(options = {}) {
  const {
    title = (options.type === 'confirm' ? 'Confirm Action' : (options.type === 'prompt' ? 'Input Required' : 'Toolbox')),
    message = '',
    type = 'alert',
    confirmText = (type === 'confirm' ? (options.destructive ? 'Delete' : 'Confirm') : (type === 'prompt' ? 'OK' : 'OK')),
    cancelText = 'Cancel',
    destructive = false,
    defaultValue = '',
    placeholder = ''
  } = options;

  if (activeDialog) {
    activeDialog.close(null);
  }

  lastFocusedElement = document.activeElement;

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'custom-dialog-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const dialogId = 'tb-dialog-' + Date.now();
    const titleId = dialogId + '-title';
    const descId = dialogId + '-desc';

    backdrop.innerHTML = `
      <div class="custom-dialog-window ${destructive ? 'is-destructive' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" aria-describedby="${descId}">
        <div class="custom-dialog-header">
          <h3 id="${titleId}" class="custom-dialog-title">${escapeHtml(title)}</h3>
        </div>
        <div id="${descId}" class="custom-dialog-body">
          <p class="custom-dialog-message">${escapeHtml(message)}</p>
          ${type === 'prompt' ? `
            <div class="custom-dialog-input-wrap">
              <input type="text" class="custom-dialog-input tool-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" spellcheck="false">
            </div>
          ` : ''}
        </div>
        <div class="custom-dialog-footer">
          ${type !== 'alert' ? `
            <button type="button" class="btn btn-secondary custom-dialog-btn custom-dialog-cancel">${escapeHtml(cancelText)}</button>
          ` : ''}
          <button type="button" class="btn ${destructive ? 'btn-danger' : 'btn-primary'} custom-dialog-btn custom-dialog-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const dialogWindow = backdrop.querySelector('.custom-dialog-window');
    const inputEl = backdrop.querySelector('.custom-dialog-input');
    const confirmBtn = backdrop.querySelector('.custom-dialog-confirm');
    const cancelBtn = backdrop.querySelector('.custom-dialog-cancel');

    // Trigger open animation
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
    });

    const close = (result) => {
      window.removeEventListener('keydown', onKeyDown, true);
      backdrop.classList.remove('is-open');
      backdrop.classList.add('is-closing');
      setTimeout(() => {
        backdrop.remove();
        if (activeDialog?.backdrop === backdrop) {
          activeDialog = null;
        }
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
          try { lastFocusedElement.focus(); } catch {}
        }
        resolve(result);
      }, 160);
    };

    activeDialog = { backdrop, close };

    // Focus management
    if (type === 'prompt' && inputEl) {
      inputEl.focus();
      inputEl.select();
    } else if (destructive && cancelBtn) {
      cancelBtn.focus(); // Default to cancel for destructive actions
    } else if (confirmBtn) {
      confirmBtn.focus();
    }

    // Keyboard handlers (Escape, Enter, Tab focus trap)
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(type === 'prompt' ? null : false);
        return;
      }

      if (e.key === 'Enter') {
        if (e.target && e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        e.stopPropagation();
        if (type === 'prompt') {
          close(inputEl ? inputEl.value : '');
        } else {
          close(true);
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusable = dialogWindow.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);

    // Button click handlers
    confirmBtn?.addEventListener('click', () => {
      if (type === 'prompt') {
        close(inputEl ? inputEl.value : '');
      } else {
        close(true);
      }
    });

    cancelBtn?.addEventListener('click', () => {
      close(type === 'prompt' ? null : false);
    });

    // Backdrop click dismisses non-destructive
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        close(type === 'prompt' ? null : false);
      }
    });
  });
}

export function tbAlert(message, title = 'Toolbox') {
  return showDialog({ title, message, type: 'alert' });
}

export function tbConfirm(message, options = {}) {
  const {
    title = 'Confirm Action',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    destructive = false
  } = (typeof options === 'string' ? { title: options } : options);

  return showDialog({
    title,
    message,
    type: 'confirm',
    confirmText,
    cancelText,
    destructive
  });
}

export function tbPrompt(message, defaultValue = '', options = {}) {
  const {
    title = 'Input Required',
    confirmText = 'OK',
    cancelText = 'Cancel',
    placeholder = ''
  } = (typeof options === 'string' ? { title: options } : options);

  return showDialog({
    title,
    message,
    type: 'prompt',
    defaultValue,
    placeholder,
    confirmText,
    cancelText
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global exposure & fallback override
if (typeof window !== 'undefined') {
  window.tbAlert = tbAlert;
  window.tbConfirm = tbConfirm;
  window.tbPrompt = tbPrompt;
  window.showToolboxDialog = showDialog;

  // Safe window.alert override to native styled alert
  window.alert = (msg) => {
    tbAlert(String(msg));
  };
}
