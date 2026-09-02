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

