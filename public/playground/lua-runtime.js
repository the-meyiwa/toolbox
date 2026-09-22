/* ============================================================
   Toolbox Code Playground — Lua 5.4 worker (wasmoon, module worker)

   print / io.write go to the terminal; io.read() is interactive via the
   same synchronous input bridge Python uses. require('module') loads
   other .lua files from the workspace.

   page → worker  { type:'run', code, entry, files, wasmoonUrl, syncBase }
   worker → page  { type:'stdout'|'stderr', data } { type:'sync-request', id, kind }
                  { type:'error', message, line } { type:'exit', code }
   ============================================================ */

let factoryPromise = null;
let syncBase = '/__pg_sync/';
let syncOk = null;

const send = (m) => self.postMessage(m);

function probe() {
  if (syncOk !== null) return syncOk;
  try {
    const x = new XMLHttpRequest();
    x.open('GET', `${syncBase}ping`, false);
    x.send(null);
    syncOk = x.status === 200 && x.responseText === 'pong';
  } catch { syncOk = false; }
  return syncOk;
}

function readLine() {
  if (!probe()) return null;
  const id = `lua-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  send({ type: 'sync-request', id, kind: 'stdin', payload: {} });
  for (let i = 0; i < 50; i++) {
    try {
      const x = new XMLHttpRequest();
      x.open('GET', `${syncBase}read?id=${encodeURIComponent(id)}`, false);
      x.send(null);
      if (x.status === 200) {
        const r = JSON.parse(x.responseText);
        return !r || r.eof || r.value == null ? null : String(r.value);
      }
    } catch { /* retry */ }
  }
  return null;
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type !== 'run') return;
  if (msg.syncBase) syncBase = msg.syncBase;
  let lua;
  try {
    if (!factoryPromise) {
      send({ type: 'status', text: 'Downloading the Lua runtime (first run only)…' });
      factoryPromise = import(msg.wasmoonUrl).then((m) => new m.LuaFactory());
    }
    const factory = await factoryPromise;
    // Make workspace modules available to require().
    for (const [path, content] of Object.entries(msg.files || {})) {
      if (path.endsWith('.lua')) await factory.mountFile(`/workspace/${path}`, content);
    }
    lua = await factory.createEngine({ injectObjects: true });
  } catch (err) {
    send({ type: 'stderr', data: `Could not start Lua: ${err?.message || err}\n` });
    send({ type: 'exit', code: 1 });
    return;
  }
  const out = (s) => send({ type: 'stdout', data: s });
  lua.global.set('print', (...args) => out(`${args.map((a) => (a === null || a === undefined ? 'nil' : typeof a === 'object' ? String(a) : String(a))).join('\t')}\n`));
  lua.global.set('__pg_write', (s) => out(String(s)));
  lua.global.set('__pg_read', () => readLine());
  try {
    await lua.doString(`
      package.path = "/workspace/?.lua;/workspace/?/init.lua;" .. package.path
      local w = __pg_write
      local r = __pg_read
      io.write = function(...) for _, v in ipairs({...}) do w(tostring(v)) end return io end
      io.read = function(fmt)
        local line = r()
        if line == nil then return nil end
        if fmt == "n" or fmt == "*n" or fmt == "*number" then return tonumber(line) end
        return line
      end
      io.lines = function() return function() return r() end end
    `);
    const result = await lua.doString(msg.code);
    if (result !== undefined && result !== null) out(`${String(result)}\n`);
    send({ type: 'exit', code: 0 });
  } catch (err) {
    const text = String(err?.message || err);
    const m = /\[string "[^"]*"\]:(\d+):|:(\d+):/.exec(text);
    send({ type: 'stderr', data: `\x1b[31mlua: ${text.replace(/\[string "[^"]*"\]/, msg.entry || 'main.lua')}\x1b[0m\n` });
    send({ type: 'error', message: text, line: m ? Number(m[1] || m[2]) : null, file: msg.entry });
    send({ type: 'exit', code: 1 });
  } finally {
    try { lua?.global.close(); } catch { /* ignore */ }
  }
};
send({ type: 'ready' });
