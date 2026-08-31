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

export function cleanText(t) {
  if (!t) return t;
  return t
    // Zero-Width & Invisible Characters
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u2060-\u2064\u206A-\u206F\uFFF9-\uFFFB]/g, '')
    // Non-Printable Control Characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Unusual Unicode Whitespaces
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Smart Quotes, Dashes & Ellipses
    .replace(/[‘’‚‛`]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...')
    // Repeated Spaces & Tabs
    .replace(/[ \t]{2,}/g, ' ')
    // Trailing Line Whitespace
    .replace(/[ \t]+$/gm, '')
    // Normalize Line Endings (CRLF → LF)
    .replace(/\r\n?/g, '\n');
}
