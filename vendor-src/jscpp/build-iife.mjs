import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
const s = mkdtempSync(join(tmpdir(), "jscpp-iife-"));
writeFileSync(join(s, "entry.js"), `module.exports = require(${JSON.stringify(resolve("lib/commonjs.js"))});`);
writeFileSync(join(s, "stream.js"), "class Stream {}\nmodule.exports = { Stream };\n");
writeFileSync(join(s, "util.js"), "module.exports = { inspect: (v) => String(v), format: (...a) => a.map(String).join(' ') };\n");
await build({
  entryPoints: [join(s, "entry.js")], bundle: true, format: "iife", globalName: "JSCPP", platform: "browser",
  minify: true, target: "es2019", define: { "process.env.NODE_ENV": '"production"' },
  alias: { stream: join(s, "stream.js"), util: join(s, "util.js") },
  // Browsers have no setImmediate; the step loop yields through it.
  banner: { js: "var setImmediate=globalThis.setImmediate||function(f){return setTimeout(f,0)};" },
  outfile: process.argv[2], logLevel: "warning",
});
