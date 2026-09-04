export function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const prev = btn.textContent;
    btn.textContent = 'Copied ✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove('copied');
    }, 1200);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const prev = btn.textContent;
    btn.textContent = 'Copied ✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove('copied');
    }, 1200);
  });
}

const ENTITY_MAP = {
  '&rarr;': '→',
  '&larr;': '←',
  '&harr;': '↔',
  '&uarr;': '↑',
  '&darr;': '↓',
  '&rArr;': '⇒',
  '&lArr;': '⇐',
  '&deg;': '°',
  '&times;': '×',
  '&divide;': '÷',
  '&plusmn;': '±',
  '&le;': '≤',
  '&ge;': '≥',
  '&ne;': '≠',
  '&approx;': '≈',
  '&asymp;': '≈',
  '&infin;': '∞',
  '&bull;': '•',
  '&trade;': '™',
  '&copy;': '©',
  '&reg;': '®',
  '&pound;': '£',
  '&yen;': '¥',
  '&euro;': '€',
  '&sect;': '§',
  '&para;': '¶',
  '&micro;': 'µ',
  '&alpha;': 'α',
  '&beta;': 'β',
  '&gamma;': 'γ',
  '&delta;': 'δ',
  '&Delta;': 'Δ',
  '&pi;': 'π',
  '&omega;': 'ω',
  '&Omega;': 'Ω',
  '&theta;': 'θ',
  '&lambda;': 'λ',
  '&sigma;': 'σ',
  '&Sigma;': 'Σ',
  '&sum;': '∑',
  '&radic;': '√',
  '&sub;': '⊂',
  '&sup;': '⊃',
  '&isin;': '∈',
  '&notin;': '∉',
  '&empty;': '∅',
  '&ang;': '∠'
};

function normalizeSymbolsInText(text) {
  if (!text) return '';

  // 1. Decode HTML entities for symbols
  text = text.replace(/&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, (match) => {
    if (ENTITY_MAP[match]) return ENTITY_MAP[match];
    if (match.startsWith('&#x') || match.startsWith('&#X')) {
      const hex = match.slice(3, -1);
      const code = parseInt(hex, 16);
      if (!isNaN(code) && code >= 32) return String.fromCodePoint(code);
    } else if (match.startsWith('&#')) {
      const dec = match.slice(2, -1);
      const code = parseInt(dec, 10);
      if (!isNaN(code) && code >= 32) return String.fromCodePoint(code);
    }
    return match;
  });

  // 2. Decode raw string literal unicode escapes like \u2192, \u00b0
  text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    } catch {
      return `\\u${hex}`;
    }
  });

  // 3. Remove stray backslashes escaping currency and symbols outside code
  text = text.replace(/\\([₦$€£¥°±×÷≤≥≠≈→←↔↑↓•])/g, '$1');

  // 4. Normalize pseudo-symbols in plain text
  text = text.replace(/(^|\s)\+\/-(\s|$)/g, '$1±$2');
  text = text.replace(/(^|\s)\+-(\s|$)/g, '$1±$2');
  text = text.replace(/(^|\s)(?:--?>)(\s|$)/g, '$1→$2');
  text = text.replace(/(^|\s)(?:<--?)(\s|$)/g, '$1←$2');
  text = text.replace(/(^|\s)=>>?(\s|$)/g, '$1⇒$2');
  text = text.replace(/(^|\s)!=(\s|$)/g, '$1≠$2');
  text = text.replace(/(^|\s)<=(\s|$)/g, '$1≤$2');
  text = text.replace(/(^|\s)>=(\s|$)/g, '$1≥$2');
  text = text.replace(/(^|\s)~=(\s|$)/g, '$1≈$2');

  return text;
}

function processWithCodeBlocksPreserved(text, processor) {
  if (!text) return '';
  const codeBlocks = [];
  // Mask triple backtick code blocks
  let masked = text.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__TBX_CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });
  // Mask single inline backticks
  masked = masked.replace(/`[^`\n]+`/g, (match) => {
    const placeholder = `__TBX_CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // Process outside code blocks
  masked = processor(masked);

  // Restore code blocks
  return masked.replace(/__TBX_CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[Number(idx)] || '');
}

export function sanitizeUserFacingText(t, { preserveWhitespace = true, preserveMarkdown = true } = {}) {
  if (t === null || t === undefined) return '';
  if (typeof t !== 'string') {
    try {
      t = String(t);
    } catch {
      return '';
    }
  }

  // 1. Remove Zero-Width & Invisible Characters
  let res = t.replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u2060-\u2064\u206A-\u206F\uFFF9-\uFFFB]/g, '');

  // 2. Remove Non-Printable Control Characters (preserve \t, \n, \r)
  res = res.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

  // 3. Normalize CRLF line breaks
  res = res.replace(/\r\n?/g, '\n');

  // 4. Normalize unusual Unicode spaces to standard ASCII spaces
  res = res.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // 5. Trim trailing whitespace per line
  res = res.replace(/[ \t]+$/gm, '');

  // 6. Clean and normalize symbol representations and escapes
  res = processWithCodeBlocksPreserved(res, normalizeSymbolsInText);

  if (!preserveWhitespace) {
    res = res.replace(/[ \t]{2,}/g, ' ').trim();
  }

  return res;
}

export function cleanText(t) {
  if (!t) return t;
  return t
    // Zero-Width & Invisible Characters
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u2060-\u2064\u206A-\u206F\uFFF9-\uFFFB]/g, '')
    // Non-Printable Control Characters (preserve \t, \n, \r)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Unusual Unicode Whitespaces
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Smart Quotes, Dashes & Ellipses (keep backticks intact)
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...')
    // Trailing Line Whitespace
    .replace(/[ \t]+$/gm, '')
    // Normalize Line Endings (CRLF → LF)
    .replace(/\r\n?/g, '\n');
}

/**
 * Display a minimalist Swiss notification toast with zero emojis
 * @param {string} message 
 * @param {'info'|'success'|'error'|'warning'} type 
 * @param {number} duration 
 */
export function showToast(message, type = 'info', duration = 3500) {
  if (typeof document === 'undefined') return { dismiss: () => {} };

  let container = document.getElementById('toolbox-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toolbox-toast-container';
    container.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; display:flex; flex-direction:column; gap:8px; pointer-events:none; max-width:calc(100vw - 48px); width:380px;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toolbox-toast toolbox-toast-${type}`;
  toast.style.cssText = [
    'background: #000000;',
    'color: #ffffff;',
    'border: 1px solid rgba(255, 255, 255, 0.18);',
    'border-radius: 10px;',
    'padding: 12px 16px;',
    'font-size: 0.85rem;',
    'font-weight: 500;',
    'line-height: 1.4;',
    'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);',
    'display: flex;',
    'align-items: center;',
    'gap: 10px;',
    'pointer-events: auto;',
    'opacity: 0;',
    'transform: translateY(12px);',
    'transition: opacity 0.22s ease, transform 0.22s ease;',
    'cursor: pointer;'
  ].join(' ');

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else if (type === 'warning') {
    iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  } else {
    iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  textSpan.style.cssText = 'flex:1; word-break:break-word;';

  toast.innerHTML = iconSvg;
  toast.appendChild(textSpan);
  container.appendChild(toast);

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
  } else {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }

  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };

  const timer = setTimeout(dismiss, duration);
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });

  return { dismiss };
}


