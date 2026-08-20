/* Text Diff — a real line diff, not a line-by-line line-up.

   Comparing position for position looked right until someone inserted a
   line at the top, at which point every line below it was reported as
   changed. This finds the longest common subsequence instead, so an
   insertion shows up as one insertion. */

/** Diff two arrays of lines into { type: 'same'|'add'|'del', text } steps. */
export function diffLines(a, b) {
  // Matching heads and tails are the cheap part; strip them before the
  // expensive bit so pasting two near-identical files stays instant.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;

  let tail = 0;
  while (tail < a.length - head && tail < b.length - head
         && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);

  const steps = [
    ...a.slice(0, head).map(text => ({ type: 'same', text })),
    ...middle(midA, midB),
    ...a.slice(a.length - tail).map(text => ({ type: 'same', text })),
  ];
  return steps;
}

/* Two very large, very different blocks would need a matrix too big to be
   worth building, so past that point the middle is reported wholesale. */
const MAX_CELLS = 4_000_000;

function middle(a, b) {
  if (!a.length) return b.map(text => ({ type: 'add', text }));
  if (!b.length) return a.map(text => ({ type: 'del', text }));

  if ((a.length + 1) * (b.length + 1) > MAX_CELLS) {
    return [...a.map(text => ({ type: 'del', text })), ...b.map(text => ({ type: 'add', text }))];
  }

  // lcs[i][j] = length of the longest common subsequence of a[i…] and b[j…]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const steps = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { steps.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { steps.push({ type: 'del', text: a[i] }); i++; }
    else { steps.push({ type: 'add', text: b[j] }); j++; }
  }
  while (i < a.length) steps.push({ type: 'del', text: a[i++] });
  while (j < b.length) steps.push({ type: 'add', text: b[j++] });
  return steps;
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label" for="diff-a">Original</label>
          <textarea class="tool-textarea" id="diff-a" placeholder="Paste the original text…" rows="14"></textarea>
        </div>
        <div class="tool-section">
          <label class="tool-label" for="diff-b">Modified</label>
          <textarea class="tool-textarea" id="diff-b" placeholder="Paste the changed text…" rows="14"></textarea>
        </div>
      </div>
      <div class="tool-controls" style="margin-top:16px;">
        <label class="tool-checkbox"><input type="checkbox" id="diff-ignore-ws"> Ignore leading and trailing spaces</label>
      </div>
      <div class="tool-section" style="margin-top:16px;">
        <label class="tool-label">Differences</label>
        <div class="tool-output diff-out" id="diff-output">
          <span id="diff-result" class="diff-empty">Paste text into both boxes to see what changed.</span>
        </div>
      </div>
      <div id="diff-stats" style="font-size:0.78rem; color:var(--g500); margin-top:8px;"></div>
    `;

    const aEl = container.querySelector('#diff-a');
    const bEl = container.querySelector('#diff-b');
    const ignoreWs = container.querySelector('#diff-ignore-ws');
    const result = container.querySelector('#diff-result');
    const stats = container.querySelector('#diff-stats');

    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function compare() {
      const rawA = aEl.value;
      const rawB = bEl.value;

      if (!rawA && !rawB) {
        result.className = 'diff-empty';
        result.textContent = 'Paste text into both boxes to see what changed.';
        stats.textContent = '';
        return;
      }

      const prepare = (t) => t.split('\n').map(l => (ignoreWs.checked ? l.trim() : l));
      const steps = diffLines(prepare(rawA), prepare(rawB));

      const added = steps.filter(s => s.type === 'add').length;
      const removed = steps.filter(s => s.type === 'del').length;
      const same = steps.length - added - removed;

      if (!added && !removed) {
        result.className = 'diff-empty';
        result.textContent = 'The two texts are identical.';
        stats.textContent = `${same} line${same === 1 ? '' : 's'}, all unchanged`;
        return;
      }

      result.className = '';
      result.innerHTML = steps.map(({ type, text }) => {
        const mark = type === 'add' ? '+' : type === 'del' ? '−' : ' ';
        const cls = type === 'add' ? 'diff-add' : type === 'del' ? 'diff-del' : 'diff-same';
        return `<span class="${cls}">${mark} ${escapeHtml(text)}</span>`;
      }).join('\n');

      stats.textContent = `${added} added · ${removed} removed · ${same} unchanged`;
    }

    container.addEventListener('input', compare);
    container.addEventListener('change', compare);
    compare();
    aEl.focus();

    /* Incoming work fills whichever side is still empty, so sending two
       artifacts here in turn sets up the comparison rather than
       overwriting the first one. */
    this._write = (text) => {
      const target = aEl.value.trim() ? bEl : aEl;
      target.value = text;
      compare();
      target.focus();
    };
  },

  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._write = null; },
};
