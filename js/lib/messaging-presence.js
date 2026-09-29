/** Short-lived typing state only; drafts never leave the composer. */
export function activeTypers(rows, ownId, now = Date.now()) {
  return [...new Set((Array.isArray(rows) ? rows : []).filter(r => r.user_id && r.user_id !== ownId && Date.parse(r.expires_at) > now && Date.parse(r.expires_at) <= now + 10000).map(r => r.user_id))];
}

export function createTypingSession({ publish, read, onChange, ownId, isVisible = () => true, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let closed = false, typing = false, lastSent = -Infinity, stopTimer = null, pollTimer = null, queue = Promise.resolve();
  const send = value => {
    queue = queue.catch(() => {}).then(() => publish(value)).catch(() => {});
    return queue;
  };
  const stop = () => { cancel(stopTimer); if (typing) { typing = false; void send(false); } };
  const poll = async () => {
    if (closed) return;
    if (isVisible()) {
      try { const rows = await read(); if (!closed) onChange(activeTypers(rows, ownId, now())); }
      catch { if (!closed) onChange([]); }
    } else { stop(); onChange([]); }
    if (!closed) pollTimer = schedule(poll, 1800);
  };
  void poll();
  return {
    input(hasText) {
      if (closed) return;
      if (!hasText || !isVisible()) { stop(); return; }
      const first = !typing; typing = true;
      if (first || now() - lastSent >= 1500) { lastSent = now(); void send(true); }
      cancel(stopTimer); stopTimer = schedule(stop, 2500);
    },
    stop,
    close() { if (closed) return; stop(); closed = true; cancel(pollTimer); onChange([]); },
  };
}
