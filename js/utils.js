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


