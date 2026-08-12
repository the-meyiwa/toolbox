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
