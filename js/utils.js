import { renderMath } from './lib/math-renderer.js';

export function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const prev = btn.textContent;
    btn.textContent = 'Copied';
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
    btn.textContent = 'Copied';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove('copied');
    }, 1200);
  });
}

const ENTITY_MAP = {
  '&nbsp;': ' ',
  '&ensp;': ' ',
  '&emsp;': ' ',
  '&thinsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
  '&middot;': '·',
  '&bull;': '•',
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

  // 0. Unwrap double-encoded entities (e.g. &amp;#x20; -> &#x20;, &amp;nbsp; -> &nbsp;)
  text = text.replace(/&amp;(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, '&$1;');

  // 1. Decode HTML entities for symbols and spaces
  text = text.replace(/&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, (match) => {
    const lowerMatch = match.toLowerCase();
    if (ENTITY_MAP[match]) return ENTITY_MAP[match];
    if (ENTITY_MAP[lowerMatch]) return ENTITY_MAP[lowerMatch];
    if (lowerMatch.startsWith('&#x')) {
      const hex = lowerMatch.slice(3, -1);
      const code = parseInt(hex, 16);
      if (!isNaN(code)) {
        if (code === 38 || code === 60 || code === 62) return match; // Preserve &, <, > for XSS safety
        if (code >= 32) return String.fromCodePoint(code);
      }
    } else if (match.startsWith('&#')) {
      const dec = match.slice(2, -1);
      const code = parseInt(dec, 10);
      if (!isNaN(code)) {
        if (code === 38 || code === 60 || code === 62) return match; // Preserve &, <, > for XSS safety
        if (code >= 32) return String.fromCodePoint(code);
      }
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
 * Closes unbalanced markdown delimiters (code fences, bold, display math) so
 * partial/streamed LLM output never leaves a stray "**", "```", or "$$" visible.
 * Runs outside already-matched code blocks to avoid corrupting real code.
 */
export function balanceMarkdownDelimiters(text) {
  if (!text) return '';
  return processWithCodeBlocksPreserved(text, (t) => {
    const fenceCount = (t.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) t += '\n```';

    const balancePair = (str, marker) => {
      const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const count = (str.match(new RegExp(escaped, 'g')) || []).length;
      return count % 2 !== 0 ? str + marker : str;
    };
    t = balancePair(t, '**');
    t = balancePair(t, '__');
    t = balancePair(t, '$$');
    return t;
  });
}

const SANITIZE_DISALLOWED_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'svg', 'math', 'template'
]);

/**
 * Strips dangerous tags/attributes from markdown-rendered HTML before it is
 * assigned to innerHTML. Uses an inert <template> so scripts/styles/images
 * never execute or load during sanitization.
 */
export function sanitizeRenderedHtml(html) {
  if (!html) return '';
  if (typeof document === 'undefined') return html;
  const template = document.createElement('template');
  template.innerHTML = html;

  const clean = (root) => {
    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (SANITIZE_DISALLOWED_TAGS.has(tag)) {
        node.remove();
        return;
      }
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value || '';
        if (name.startsWith('on')) {
          node.removeAttribute(attr.name);
        } else if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        } else if (name === 'style' && /expression\s*\(|javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      });
      if (tag === 'a' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
      }
      clean(node);
    });
  };
  clean(template.content);
  return template.innerHTML;
}

/**
 * Extracts LaTeX math segments ($$...$$, \[...\], $...$, \(...\)) outside of
 * code blocks and replaces each with an opaque placeholder token, rendering
 * the real math to safe HTML up front via the existing math-renderer engine.
 * This lets markdown parsing run on math-free text (so marked cannot mangle
 * LaTeX or leave raw "$$H_2O$$"-style text visible), then `restore()` swaps
 * the placeholders back in after markdown parsing + sanitization.
 */
export function extractMathSegments(text) {
  if (!text) return { text: '', restore: (html) => html };
  const stash = [];
  const store = (html) => {
    // U+E000/U+E001 (Private Use Area) survive control-character stripping,
    // HTML escaping and markdown parsing untouched, unlike NUL-based tokens.
    const token = `\uE000MATHSEG${stash.length}\uE001`;
    stash.push(html);
    return token;
  };
  const masked = processWithCodeBlocksPreserved(text, (t) => {
    let out = t.replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => store(renderMath(eq, { displayMode: true })));
    out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => store(renderMath(eq, { displayMode: true })));
    out = out.replace(/\$([^\$\n]+?)\$/g, (_, eq) => store(renderMath(eq, { displayMode: false })));
    out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => store(renderMath(eq, { displayMode: false })));
    return out;
  });
  return {
    text: masked,
    restore(html) {
      return html.replace(/\uE000MATHSEG(\d+)\uE001/g, (_, idx) => (stash[Number(idx)] !== undefined ? stash[Number(idx)] : ''));
    }
  };
}

export function cleanAssistantOutput(text) {
  if (!text) return '';
  let cleaned = String(text);

  // 1. Remove raw action execution tags like [Completed Actions: ...]
  cleaned = cleaned.replace(/\[Completed Actions:[\s\S]*?\]/gi, '');

  // 2. Remove raw tool execution log lines like "Executing tool ..." or "Action result: ..."
  cleaned = cleaned.replace(/^Executing tool\s+.*$/gim, '');
  cleaned = cleaned.replace(/^Action result:\s+.*$/gim, '');

  // 3. Remove raw JSON blocks if they are leaked tool call arguments or raw responses
  cleaned = cleaned.replace(/```(?:json)?\s*\{[\s\S]*?"(?:operation|query|tool|action|name)":[\s\S]*?\}\s*```/gi, '');

  // 4. Remove emojis strictly according to Toolbox design guidelines
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '');

  // 5. Decode escaped HTML entities and normalize symbols
  cleaned = cleaned
    .replace(/&#x20;/gi, ' ')
    .replace(/&#32;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"');
  cleaned = sanitizeUserFacingText(cleaned);

  // 6. Clean up multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Lightweight in-app toast notification with zero emojis and clean SVG icons.
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



