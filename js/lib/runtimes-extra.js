/* ============================================================
   Additional local runtimes.

   Kept in their own module because their worker sources are full of
   nested template literals, which are painful to maintain inline
   alongside the original three.

   Both of these run entirely on the device.
   ============================================================ */

const LUA_URL = 'https://cdn.jsdelivr.net/npm/wasmoon@1.16.0/+esm';

/* A module worker, because wasmoon ships as an ES module. */
const LUA_WORKER = [
  `import { LuaFactory } from '${LUA_URL}';`,
  `function post(type, level, text) { self.postMessage({ type, level, text }); }`,
  `let enginePromise = null;`,
  `function boot() {`,
  `  if (!enginePromise) {`,
  `    post('status', null, 'Downloading the Lua runtime…');`,
  `    enginePromise = new LuaFactory().createEngine();`,
  `  }`,
  `  return enginePromise;`,
  `}`,
  `self.addEventListener('message', async (e) => {`,
  `  let lua;`,
  `  try { lua = await boot(); }`,
  `  catch (err) {`,
  `    post('out', 'error', 'Could not start Lua: ' + (err && err.message ? err.message : err));`,
  `    post('done', null, null);`,
  `    return;`,
  `  }`,
  // Lua's print goes nowhere useful by default; route it to the console panel.
  `  lua.global.set('print', function () {`,
  `    const parts = [];`,
  `    for (let i = 0; i < arguments.length; i++) {`,
  `      const a = arguments[i];`,
  `      parts.push(a === null || a === undefined ? 'nil' : String(a));`,
  `    }`,
  `    post('out', 'log', parts.join('\\t'));`,
  `  });`,
  `  const startedAt = Date.now();`,
  `  post('running', null, null);`,
  `  try {`,
  `    const result = await lua.doString(e.data.code);`,
  `    if (result !== undefined && result !== null) post('out', 'return', String(result));`,
  `  } catch (err) {`,
  `    post('out', 'error', String(err && err.message ? err.message : err));`,
  `  }`,
  `  post('done', null, Date.now() - startedAt);`,
  `});`,
].join('\n');

const LUA_SAMPLE = [
  '-- Lua: small, fast, and embedded in half the games you have played.',
  'local invoices = {',
  '  { client = "Northwind", amount = 24500, paid = true },',
  '  { client = "Contoso",   amount = 81200, paid = true },',
  '  { client = "Fabrikam",  amount = 12750, paid = false },',
  '}',
  '',
  'local outstanding = 0',
  'for _, inv in ipairs(invoices) do',
  '  if not inv.paid then outstanding = outstanding + inv.amount end',
  'end',
  '',
  'print("invoices:", #invoices)',
  'print("outstanding:", outstanding)',
  '',
  'for i = 1, 5 do print(i .. " squared is " .. i * i) end',
].join('\n');

const WEB_SAMPLE = [
  '<!-- Edit anything; the preview updates as you type.',
  '     Pick a CSS framework from the dropdown above. -->',
  '<div class="container py-4">',
  '  <h1 class="h4 mb-3">Invoice summary</h1>',
  '',
  '  <table class="table table-sm align-middle">',
  '    <thead>',
  '      <tr><th>Client</th><th class="text-end">Amount</th><th>Status</th></tr>',
  '    </thead>',
  '    <tbody id="rows"></tbody>',
  '  </table>',
  '',
  '  <button id="pay" class="btn btn-primary btn-sm">Mark all paid</button>',
  '  <p id="total" class="mt-3 fw-semibold"></p>',
  '</div>',
  '',
  '<style>',
  '  body { font-family: system-ui, sans-serif; padding: 8px; }',
  '  .paid { color: #198754; }',
  '  .due  { color: #dc3545; }',
  '</style>',
  '',
  '<script>',
  '  const invoices = [',
  '    { client: "Northwind", amount: 24500, paid: true  },',
  '    { client: "Contoso",   amount: 81200, paid: true  },',
  '    { client: "Fabrikam",  amount: 12750, paid: false },',
  '  ];',
  '',
  '  function render() {',
  '    document.getElementById("rows").innerHTML = invoices.map(function (i) {',
  '      return "<tr><td>" + i.client + "</td>" +',
  '             "<td class=\'text-end\'>" + i.amount.toLocaleString() + "</td>" +',
  '             "<td class=\'" + (i.paid ? "paid" : "due") + "\'>" +',
  '             (i.paid ? "Paid" : "Outstanding") + "</td></tr>";',
  '    }).join("");',
  '',
  '    var due = invoices.filter(function (i) { return !i.paid; })',
  '                      .reduce(function (s, i) { return s + i.amount; }, 0);',
  '    document.getElementById("total").textContent = "Outstanding: " + due.toLocaleString();',
  '  }',
  '',
  '  document.getElementById("pay").onclick = function () {',
  '    invoices.forEach(function (i) { i.paid = true; });',
  '    render();',
  '  };',
  '',
  '  render();',
  '</script>',
].join('\n');

/** CSS frameworks the web sandbox can pull in, so "does my Bootstrap
    layout work" is answerable without setting up a project. */
export const WEB_FRAMEWORKS = {
  none: { name: 'No framework', css: '', js: '' },
  bootstrap: {
    name: 'Bootstrap 5',
    css: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    js: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  },
  tailwind: { name: 'Tailwind (play CDN)', css: '', js: 'https://cdn.tailwindcss.com' },
  bulma: { name: 'Bulma', css: 'https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css', js: '' },
  pico: { name: 'Pico CSS', css: 'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css', js: '' },
};

/** Assemble a full document for the sandboxed preview frame. */
export function buildPreviewDocument(source, frameworkId = 'none') {
  const fw = WEB_FRAMEWORKS[frameworkId] ?? WEB_FRAMEWORKS.none;
  const css = fw.css ? `<link rel="stylesheet" href="${fw.css}">` : '';
  const js = fw.js ? `<script src="${fw.js}"><\/script>` : '';
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    css, js,
    '</head><body>',
    source,
    '</body></html>',
  ].join('\n');
}

export const EXTRA_LANGUAGES = {
  lua: {
    name: 'Lua',
    mono: 'lua',
    worker: LUA_WORKER,
    moduleWorker: true,
    weight: '~400 KB, cached after the first run',
    note: 'Runs on your device. The runtime downloads once, then works offline.',
    sample: LUA_SAMPLE,
  },

  web: {
    name: 'HTML, CSS & JS',
    mono: 'html',
    // Web code produces a page, not console output, so this one renders
    // into a sandboxed iframe instead of a worker.
    preview: true,
    weight: null,
    note: 'Renders in a sandboxed frame on your device. Nothing is uploaded.',
    sample: WEB_SAMPLE,
  },
};
