/* ============================================================
   Core shell commands: navigation, files and text utilities.
   Behaviour follows GNU coreutils closely enough that tutorials and
   course notes work as written.
   ============================================================ */

import { parseArgs, ANSI, color, ShellError, ExitSignal } from './shell.js';
import { normalize, basename, dirname, toDisplay, relative, globToRegExp, resolve as resolvePath } from './paths.js';
import { renderTree, sizeOf } from './vfs.js';
import { languageOf, langInfo } from './languages.js';

const fmtSize = (n) => (n < 1024 ? `${n}` : n < 1048576 ? `${(n / 1024).toFixed(1)}K` : `${(n / 1048576).toFixed(1)}M`);
const pad = (s, n) => String(s).padStart(n);

function fmtDate(ms) {
  if (!ms) return '            ';
  const d = new Date(ms);
  const mon = d.toLocaleString('en-US', { month: 'short' });
  const now = new Date();
  const time = d.getFullYear() === now.getFullYear()
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : ` ${d.getFullYear()}`;
  return `${mon} ${String(d.getDate()).padStart(2)} ${time}`;
}

function lsName(e, classify = false) {
  if (e.type === 'dir') return `${ANSI.bblue}${ANSI.bold}${e.name}${ANSI.reset}${classify ? '/' : ''}`;
  const lang = languageOf(e.name);
  if (e.executable) return `${ANSI.bgreen}${e.name}${ANSI.reset}${classify ? '*' : ''}`;
  if (lang === 'image') return `${ANSI.magenta}${e.name}${ANSI.reset}`;
  return e.name;
}

async function readInputOrFiles(ctx, files, cmd) {
  if (!files.length || (files.length === 1 && files[0] === '-')) return [{ name: '-', text: await ctx.stdin.readAll() }];
  const out = [];
  for (const f of files) {
    const p = ctx.resolve(f);
    if (ctx.vfs.isDir(p)) throw new ShellError(`${f}: Is a directory`);
    if (!ctx.vfs.isFile(p)) throw new ShellError(`${f}: No such file or directory`);
    out.push({ name: f, text: ctx.vfs.readFile(p) });
  }
  return out;
}

function splitLines(text) {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export const HELP = [];

/** Register the core command set on a Shell. */
export function registerCoreCommands(shell) {
  const reg = (name, fn, usage, desc, group = 'Files & navigation') => {
    shell.register(name, fn, { usage, desc, group });
  };

  /* ---------------- shell & session ---------------- */

  reg('help', (ctx) => {
    const topic = ctx.args[0];
    if (topic) {
      const c = shell.commands.get(topic);
      if (!c) { ctx.err(`no help topic for '${topic}'`); return 1; }
      ctx.outln(`${color('bold', c.usage || c.name)}\n  ${c.desc || ''}`);
      return 0;
    }
    const groups = new Map();
    for (const c of shell.commands.values()) {
      if (c.hidden) continue;
      if (!groups.has(c.group || 'Other')) groups.set(c.group || 'Other', []);
      groups.get(c.group || 'Other').push(c);
    }
    ctx.outln(color('bold', 'Code Playground terminal') + color('gray', ' — everything runs in your browser. Type "help <command>" for details.'));
    for (const [g, list] of groups) {
      ctx.outln(`\n${color('byellow', g)}`);
      for (const c of list.sort((a, b) => a.name.localeCompare(b.name))) {
        ctx.outln(`  ${color('bcyan', (c.usage || c.name).padEnd(34))} ${c.desc || ''}`);
      }
    }
    ctx.outln(`\n${color('gray', 'Tips: Tab completes names · ↑/↓ history · Ctrl+C stops a program · Ctrl+L clears · pipes, > and && work')}`);
    return 0;
  }, 'help [command]', 'List commands, or show help for one', 'Shell');

  reg('clear', (ctx) => { ctx.host.clearTerminal?.(); return 0; }, 'clear', 'Clear the terminal screen', 'Shell');
  reg('reset', (ctx) => { ctx.host.clearTerminal?.(); return 0; }, 'reset', 'Reset the terminal', 'Shell');

  reg('echo', (ctx) => {
    let args = ctx.args;
    let newline = true;
    let escapes = false;
    while (args[0] && /^-[neE]+$/.test(args[0])) {
      if (args[0].includes('n')) newline = false;
      if (args[0].includes('e')) escapes = true;
      args = args.slice(1);
    }
    let text = args.join(' ');
    if (escapes) text = unescapeC(text);
    ctx.out(text + (newline ? '\n' : ''));
    return 0;
  }, 'echo [-n] [-e] text', 'Print text', 'Shell');

  reg('printf', (ctx) => {
    const [fmt = '', ...rest] = ctx.args;
    ctx.out(sprintf(unescapeC(fmt), rest));
    return 0;
  }, 'printf FORMAT [args]', 'Formatted output (%s %d %f %x)', 'Shell');

  reg('history', (ctx) => {
    if (ctx.args[0] === '-c') { shell.history.length = 0; return 0; }
    shell.history.forEach((h, i) => ctx.outln(`${pad(i + 1, 5)}  ${h}`));
    return 0;
  }, 'history [-c]', 'Show (or clear) command history', 'Shell');

  reg('env', (ctx) => {
    for (const [k, v] of Object.entries(shell.env).sort()) ctx.outln(`${k}=${v}`);
    return 0;
  }, 'env', 'Show environment variables', 'Shell');
  shell.aliases.set('printenv', 'env');

  reg('export', (ctx) => {
    if (!ctx.args.length) { for (const [k, v] of Object.entries(shell.env).sort()) ctx.outln(`declare -x ${k}="${v}"`); return 0; }
    for (const a of ctx.args) {
      const eq = a.indexOf('=');
      if (eq === -1) continue;
      shell.env[a.slice(0, eq)] = a.slice(eq + 1);
    }
    return 0;
  }, 'export NAME=value', 'Set an environment variable', 'Shell');

  reg('unset', (ctx) => { for (const a of ctx.args) delete shell.env[a]; return 0; }, 'unset NAME', 'Remove an environment variable', 'Shell');

  reg('alias', (ctx) => {
    if (!ctx.args.length) { for (const [k, v] of shell.aliases) ctx.outln(`alias ${k}='${v}'`); return 0; }
    for (const a of ctx.args) {
      const eq = a.indexOf('=');
      if (eq === -1) { const v = shell.aliases.get(a); if (v) ctx.outln(`alias ${a}='${v}'`); continue; }
      shell.aliases.set(a.slice(0, eq), a.slice(eq + 1));
    }
    return 0;
  }, "alias name='command'", 'Define a command shortcut', 'Shell');

  reg('which', (ctx) => {
    let status = 0;
    for (const a of ctx.args) {
      if (shell.aliases.has(a)) ctx.outln(`${a}: aliased to ${shell.aliases.get(a)}`);
      else if (shell.commands.has(a)) ctx.outln(`/usr/bin/${a}`);
      else { ctx.stderr.write(`${a} not found\n`); status = 1; }
    }
    return status;
  }, 'which command', 'Show where a command comes from', 'Shell');
  shell.aliases.set('type', 'which');

  reg('true', () => 0, 'true', 'Do nothing, successfully', 'Shell');
  reg('false', () => 1, 'false', 'Do nothing, unsuccessfully', 'Shell');
  reg('exit', (ctx) => { throw new ExitSignal(Number(ctx.args[0] || 0)); }, 'exit [code]', 'Exit with a status code', 'Shell');

  reg('date', (ctx) => {
    const d = new Date();
    if (ctx.args[0] === '-u' || ctx.args[0] === '--utc') ctx.outln(d.toUTCString());
    else if (ctx.args[0]?.startsWith('+')) ctx.outln(strftime(ctx.args[0].slice(1), d));
    else if (ctx.args[0] === '-I' || ctx.args[0] === '--iso-8601') ctx.outln(d.toISOString().slice(0, 10));
    else ctx.outln(d.toString());
    return 0;
  }, 'date [-u|-I|+FORMAT]', 'Print the date and time', 'Shell');

  reg('sleep', async (ctx) => {
    const secs = parseFloat(ctx.args[0] || '0');
    if (!Number.isFinite(secs)) { ctx.err(`invalid time interval '${ctx.args[0]}'`); return 1; }
    await abortableDelay(secs * 1000, ctx.signal);
    return 0;
  }, 'sleep SECONDS', 'Wait for a number of seconds', 'Shell');

  reg('whoami', (ctx) => { ctx.outln(shell.env.USER); return 0; }, 'whoami', 'Print the user name', 'Shell');
  reg('hostname', (ctx) => { ctx.outln('playground'); return 0; }, 'hostname', 'Print the machine name', 'Shell');
  reg('uname', (ctx) => {
    ctx.outln(ctx.args.includes('-a') ? 'Toolbox playground 1.0 browser wasm32 JavaScript/WebAssembly' : 'Toolbox');
    return 0;
  }, 'uname [-a]', 'Print system information', 'Shell');

  reg('seq', (ctx) => {
    const nums = ctx.args.map(Number);
    let [first, step, last] = nums.length === 1 ? [1, 1, nums[0]] : nums.length === 2 ? [nums[0], 1, nums[1]] : nums;
    if (![first, step, last].every(Number.isFinite) || step === 0) { ctx.err('invalid arguments'); return 1; }
    const out = [];
    for (let v = first; step > 0 ? v <= last : v >= last; v += step) { out.push(v); if (out.length > 100000) break; }
    ctx.out(out.join('\n') + (out.length ? '\n' : ''));
    return 0;
  }, 'seq [FIRST [STEP]] LAST', 'Print a sequence of numbers', 'Text');

  /* ---------------- navigation ---------------- */

  reg('pwd', (ctx) => { ctx.outln(shell.displayCwd); return 0; }, 'pwd', 'Print the current folder');

  reg('cd', (ctx) => {
    let target = ctx.args[0];
    if (!target || target === '~') target = '/workspace';
    if (target === '-') { target = toDisplay(shell.prevCwd); ctx.outln(target); }
    const p = ctx.resolve(target);
    if (ctx.vfs.isFile(p)) { ctx.err(`${ctx.args[0]}: Not a directory`); return 1; }
    if (!ctx.vfs.isDir(p)) { ctx.err(`${ctx.args[0]}: No such file or directory`); return 1; }
    shell.prevCwd = shell.cwd;
    shell.cwd = p;
    ctx.host.onCwdChange?.(p);
    return 0;
  }, 'cd [folder]', 'Change folder (cd .., cd -, cd ~)');

  reg('ls', (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { alias: { all: 'a', recursive: 'R', 'human-readable': 'h' } });
    const long = flags.l;
    const all = flags.a || flags.A;
    const one = flags['1'] || ctx.piped;
    const targets = positional.length ? positional : ['.'];
    let status = 0;
    const show = (dirPath, label) => {
      let entries = ctx.vfs.readdir(dirPath).filter((e) => all || !e.name.startsWith('.'));
      if (flags.t) entries = entries.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      if (flags.S) entries = entries.sort((a, b) => b.size - a.size);
      if (flags.r) entries = entries.reverse();
      const exe = (e) => ({ ...e, executable: e.type === 'file' && isExecutable(ctx.vfs, e.path) });
      entries = entries.map(exe);
      if (label) ctx.outln(`${label}:`);
      if (long) {
        const total = entries.reduce((s, e) => s + Math.ceil(e.size / 1024), 0);
        ctx.outln(`total ${total}`);
        for (const e of entries) {
          const perm = e.type === 'dir' ? 'drwxr-xr-x' : e.executable ? '-rwxr-xr-x' : '-rw-r--r--';
          const size = flags.h ? fmtSize(e.size) : String(e.size);
          ctx.outln(`${perm} 1 student student ${pad(size, 7)} ${fmtDate(e.mtime)} ${lsName(e, flags.F)}`);
        }
      } else if (one) {
        for (const e of entries) ctx.outln(ctx.piped ? e.name : lsName(e, flags.F));
      } else if (entries.length) {
        ctx.outln(entries.map((e) => lsName(e, flags.F)).join('  '));
      }
      if (flags.R) {
        for (const e of entries.filter((x) => x.type === 'dir')) { ctx.outln(''); show(e.path, relative(shell.cwd, e.path) || '.'); }
      }
    };
    for (const t of targets) {
      const p = ctx.resolve(t);
      if (ctx.vfs.isFile(p)) {
        const st = ctx.vfs.stat(p);
        if (long) ctx.outln(`-rw-r--r-- 1 student student ${pad(flags.h ? fmtSize(st.size) : st.size, 7)} ${fmtDate(st.mtime)} ${t}`);
        else ctx.outln(t);
        continue;
      }
      if (!ctx.vfs.isDir(p)) { ctx.stderr.write(`ls: cannot access '${t}': No such file or directory\n`); status = 2; continue; }
      show(p, targets.length > 1 ? t : '');
    }
    return status;
  }, 'ls [-la1RhtS] [path]', 'List files');
  shell.aliases.set('dir', 'ls');

  reg('tree', (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['L'] });
    const root = ctx.resolve(positional[0] || '.');
    if (!ctx.vfs.isDir(root)) { ctx.err(`${positional[0]}: not a directory`); return 1; }
    const t = renderTree(ctx.vfs, root, { maxDepth: flags.L ? Number(flags.L) - 1 : 12, showHidden: Boolean(flags.a) });
    ctx.outln(color('bblue', positional[0] || '.'));
    if (t.text) ctx.outln(t.text);
    ctx.outln(`\n${t.dirs} director${t.dirs === 1 ? 'y' : 'ies'}, ${t.files} file${t.files === 1 ? '' : 's'}`);
    return 0;
  }, 'tree [-a] [-L depth] [path]', 'Show the folder tree');

  /* ---------------- files ---------------- */

  reg('cat', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    const inputs = await readInputOrFiles(ctx, positional, 'cat');
    let n = 1;
    for (const { text } of inputs) {
      if (flags.n) {
        for (const l of splitLines(text)) ctx.outln(`${pad(n++, 6)}\t${l}`);
      } else ctx.out(text);
    }
    return 0;
  }, 'cat [-n] file...', 'Print file contents', 'Files & navigation');

  reg('touch', (ctx) => {
    if (!ctx.args.length) { ctx.err('missing file operand'); return 1; }
    for (const f of ctx.args) {
      const p = ctx.resolve(f);
      if (ctx.vfs.isFile(p)) ctx.vfs.writeFile(p, ctx.vfs.readRaw(p), { mtime: Date.now() }) || ctx.vfs.emit({ type: 'change', path: p });
      else ctx.vfs.writeFile(p, '');
    }
    return 0;
  }, 'touch file...', 'Create empty files (or update their time)');

  reg('mkdir', (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { alias: { parents: 'p' } });
    if (!positional.length) { ctx.err('missing operand'); return 1; }
    let status = 0;
    for (const d of positional) {
      const p = ctx.resolve(d);
      try {
        if (!flags.p && !ctx.vfs.isDir(dirname(p))) throw new ShellError(`cannot create directory '${d}': No such file or directory`);
        if (!flags.p && ctx.vfs.exists(p)) throw new ShellError(`cannot create directory '${d}': File exists`);
        ctx.vfs.mkdir(p, { recursive: true });
      } catch (err) { ctx.err(err.message.replace(/^E[A-Z]+: /, '')); status = 1; }
    }
    return status;
  }, 'mkdir [-p] folder...', 'Create folders');

  reg('rmdir', (ctx) => {
    let status = 0;
    for (const d of ctx.args) {
      const p = ctx.resolve(d);
      if (!ctx.vfs.isDir(p)) { ctx.err(`failed to remove '${d}': No such file or directory`); status = 1; continue; }
      if (ctx.vfs.readdir(p).length) { ctx.err(`failed to remove '${d}': Directory not empty`); status = 1; continue; }
      ctx.vfs.rm(p, { recursive: true });
    }
    return status;
  }, 'rmdir folder', 'Remove an empty folder');

  reg('rm', (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { alias: { recursive: 'r', force: 'f' } });
    const recursive = flags.r || flags.R;
    if (!positional.length) { if (flags.f) return 0; ctx.err('missing operand'); return 1; }
    let status = 0;
    for (const f of positional) {
      const p = ctx.resolve(f);
      if (!p) { ctx.err("refusing to remove the workspace root; use 'rm -r *' to empty it"); status = 1; continue; }
      if (!ctx.vfs.exists(p)) { if (!flags.f) { ctx.err(`cannot remove '${f}': No such file or directory`); status = 1; } continue; }
      if (ctx.vfs.isDir(p) && !recursive) { ctx.err(`cannot remove '${f}': Is a directory`); status = 1; continue; }
      ctx.vfs.rm(p, { recursive: true });
      if (flags.v) ctx.outln(`removed '${f}'`);
    }
    return status;
  }, 'rm [-rf] path...', 'Delete files or folders');

  reg('mv', (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    if (positional.length < 2) { ctx.err('missing destination file operand'); return 1; }
    const dest = ctx.resolve(positional[positional.length - 1]);
    const sources = positional.slice(0, -1);
    const destIsDir = ctx.vfs.isDir(dest);
    if (sources.length > 1 && !destIsDir) { ctx.err(`target '${positional[positional.length - 1]}' is not a directory`); return 1; }
    let status = 0;
    for (const s of sources) {
      const src = ctx.resolve(s);
      if (!ctx.vfs.exists(src)) { ctx.err(`cannot stat '${s}': No such file or directory`); status = 1; continue; }
      const target = destIsDir ? normalize(`${dest}/${basename(src)}`) : dest;
      if (flags.n && ctx.vfs.exists(target)) continue;
      try {
        ctx.vfs.rename(src, target, { overwrite: true });
        ctx.host.onRename?.(src, target);
      } catch (err) { ctx.err(err.message.replace(/^E[A-Z]+: /, '')); status = 1; }
    }
    return status;
  }, 'mv source... dest', 'Move or rename');

  reg('cp', (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { alias: { recursive: 'r' } });
    if (positional.length < 2) { ctx.err('missing destination file operand'); return 1; }
    const dest = ctx.resolve(positional[positional.length - 1]);
    const sources = positional.slice(0, -1);
    let status = 0;
    for (const s of sources) {
      const src = ctx.resolve(s);
      if (!ctx.vfs.exists(src)) { ctx.err(`cannot stat '${s}': No such file or directory`); status = 1; continue; }
      if (ctx.vfs.isDir(src) && !(flags.r || flags.R || flags.a)) { ctx.err(`-r not specified; omitting directory '${s}'`); status = 1; continue; }
      try { ctx.vfs.copy(src, dest, { recursive: true, overwrite: !flags.n }); } catch (err) { ctx.err(err.message.replace(/^E[A-Z]+: /, '')); status = 1; }
    }
    return status;
  }, 'cp [-r] source... dest', 'Copy files or folders');

  reg('stat', (ctx) => {
    let status = 0;
    for (const f of ctx.args) {
      try {
        const st = ctx.vfs.stat(ctx.resolve(f));
        ctx.outln(`  File: ${f}\n  Size: ${st.size}\t${st.type === 'dir' ? 'directory' : st.binary ? 'binary file' : 'regular file'}\nModify: ${st.mtime ? new Date(st.mtime).toISOString() : '-'}`);
      } catch { ctx.err(`cannot stat '${f}': No such file or directory`); status = 1; }
    }
    return status;
  }, 'stat file', 'Show file details');

  reg('du', (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    const target = ctx.resolve(positional[0] || '.');
    const files = ctx.vfs.isFile(target) ? [target] : ctx.vfs.listFiles(target);
    const total = files.reduce((s, f) => s + ctx.vfs.stat(f).size, 0);
    ctx.outln(`${flags.h ? fmtSize(total) : Math.ceil(total / 1024)}\t${positional[0] || '.'}`);
    return 0;
  }, 'du [-h] [path]', 'Disk usage of a folder');

  reg('find', (ctx) => {
    const args = ctx.args.slice();
    const start = args[0] && !args[0].startsWith('-') ? args.shift() : '.';
    let nameRe = null;
    let type = null;
    let nameCase = true;
    let maxDepth = Infinity;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-name' || args[i] === '-iname') { nameRe = globToRegExp(args[++i] || '*'); nameCase = args[i - 1] === '-name'; }
      else if (args[i] === '-type') type = args[++i];
      else if (args[i] === '-maxdepth') maxDepth = Number(args[++i]);
    }
    if (nameRe && !nameCase) nameRe = new RegExp(nameRe.source, 'i');
    const root = ctx.resolve(start);
    if (!ctx.vfs.exists(root)) { ctx.err(`'${start}': No such file or directory`); return 1; }
    const all = ctx.vfs.isFile(root) ? [root] : [root, ...ctx.vfs.listDirs().filter((d) => d.startsWith(root ? `${root}/` : '')), ...ctx.vfs.listFiles(root)];
    const shown = new Set();
    for (const p of all.sort()) {
      if (shown.has(p)) continue;
      shown.add(p);
      const depth = p === root ? 0 : (root ? p.slice(root.length + 1) : p).split('/').length;
      if (depth > maxDepth) continue;
      const isDir = ctx.vfs.isDir(p);
      if (type === 'f' && isDir) continue;
      if (type === 'd' && !isDir) continue;
      if (nameRe && !nameRe.test(basename(p) || '.')) continue;
      const rel = p === root ? start : `${start === '.' ? '.' : start.replace(/\/$/, '')}/${root ? p.slice(root.length + 1) : p}`;
      ctx.outln(rel);
    }
    return 0;
  }, 'find [path] [-name "*.js"] [-type f|d]', 'Search for files by name');

  reg('open', (ctx) => {
    if (!ctx.args.length) { ctx.err('usage: open <file>'); return 1; }
    for (const f of ctx.args) {
      const p = ctx.resolve(f);
      if (!ctx.vfs.isFile(p)) { if (!ctx.vfs.exists(p)) ctx.vfs.writeFile(p, ''); else { ctx.err(`${f}: is a directory`); return 1; } }
      ctx.host.openFile?.(p);
    }
    return 0;
  }, 'open file (alias: code)', 'Open a file in the editor (creates it if missing)');
  shell.aliases.set('code', 'open');
  shell.aliases.set('edit', 'open');
  shell.aliases.set('nano', 'open');
  shell.aliases.set('vim', 'open');
  shell.aliases.set('vi', 'open');

  reg('download', async (ctx) => {
    if (!ctx.args.length) { ctx.err('usage: download <file|folder>'); return 1; }
    for (const f of ctx.args) {
      const p = ctx.resolve(f);
      if (!ctx.vfs.exists(p)) { ctx.err(`${f}: No such file or directory`); return 1; }
      await ctx.host.download?.(p);
      ctx.outln(`Downloading ${f}${ctx.vfs.isDir(p) ? '.zip' : ''}…`);
    }
    return 0;
  }, 'download path', 'Save a file (or a folder as .zip) to your computer');

  /* ---------------- text utilities ---------------- */

  const headTail = (which) => async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['n', 'c'] });
    const n = Math.abs(parseInt(flags.n ?? '10', 10));
    const inputs = await readInputOrFiles(ctx, positional, which);
    for (const [i, { name, text }] of inputs.entries()) {
      if (inputs.length > 1) ctx.outln(`${i ? '\n' : ''}==> ${name} <==`);
      if (flags.c) { const c = Number(flags.c); ctx.out(which === 'head' ? text.slice(0, c) : text.slice(-c)); continue; }
      const lines = splitLines(text);
      const pick = which === 'head' ? lines.slice(0, n) : lines.slice(Math.max(0, lines.length - n));
      if (pick.length) ctx.outln(pick.join('\n'));
    }
    return 0;
  };
  reg('head', headTail('head'), 'head [-n N] [file]', 'First lines of a file', 'Text');
  reg('tail', headTail('tail'), 'tail [-n N] [file]', 'Last lines of a file', 'Text');

  reg('wc', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    const inputs = await readInputOrFiles(ctx, positional, 'wc');
    const only = flags.l || flags.w || flags.c || flags.m;
    let tl = 0; let tw = 0; let tc = 0;
    for (const { name, text } of inputs) {
      const l = (text.match(/\n/g) || []).length;
      const w = (text.match(/\S+/g) || []).length;
      const c = sizeOf(text);
      tl += l; tw += w; tc += c;
      const cols = [];
      if (!only || flags.l) cols.push(pad(l, 7));
      if (!only || flags.w) cols.push(pad(w, 7));
      if (!only || flags.c || flags.m) cols.push(pad(c, 7));
      ctx.outln(`${cols.join(' ')}${name === '-' ? '' : ` ${name}`}`);
    }
    if (inputs.length > 1) ctx.outln(`${[!only || flags.l ? pad(tl, 7) : null, !only || flags.w ? pad(tw, 7) : null, !only || flags.c ? pad(tc, 7) : null].filter(Boolean).join(' ')} total`);
    return 0;
  }, 'wc [-lwc] [file]', 'Count lines, words and bytes', 'Text');

  reg('grep', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['e', 'A', 'B', 'C', 'm', 'include'], alias: { 'ignore-case': 'i', 'line-number': 'n', recursive: 'r', count: 'c', 'invert-match': 'v', 'files-with-matches': 'l' } });
    const pattern = flags.e ?? positional.shift();
    if (pattern === undefined) { ctx.err('usage: grep [-inrvclwoE] PATTERN [file...]'); return 2; }
    let re;
    try {
      const src = flags.F ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : (flags.E || flags.P || ctx.name === 'egrep') ? pattern : breToJs(pattern);
      re = new RegExp(flags.w ? `\\b(?:${src})\\b` : src, flags.i ? 'gi' : 'g');
    } catch (err) { ctx.err(`invalid regular expression: ${err.message}`); return 2; }
    const recursive = flags.r || flags.R;
    let targets = [];
    if (!positional.length && !recursive) targets = [{ name: '-', text: await ctx.stdin.readAll() }];
    else {
      const roots = positional.length ? positional : ['.'];
      for (const r of roots) {
        const p = ctx.resolve(r);
        if (ctx.vfs.isDir(p)) {
          if (!recursive) { ctx.stderr.write(`grep: ${r}: Is a directory\n`); continue; }
          const inc = flags.include ? globToRegExp(flags.include) : null;
          for (const f of ctx.vfs.listFiles(p)) {
            if (f.split('/').some((s) => s === 'node_modules' || s === '.git')) continue;
            if (inc && !inc.test(basename(f))) continue;
            if (langInfo(f).binary) continue;
            targets.push({ name: relative(shell.cwd, f), text: ctx.vfs.readFile(f) });
          }
        } else if (ctx.vfs.isFile(p)) targets.push({ name: r, text: ctx.vfs.readFile(p) });
        else ctx.stderr.write(`grep: ${r}: No such file or directory\n`);
      }
    }
    const showName = targets.length > 1 || recursive;
    let found = false;
    const after = Number(flags.A ?? flags.C ?? 0);
    const before = Number(flags.B ?? flags.C ?? 0);
    const max = flags.m ? Number(flags.m) : Infinity;
    for (const { name, text } of targets) {
      const lines = splitLines(text);
      let count = 0;
      const printed = new Set();
      for (let i = 0; i < lines.length && count < max; i++) {
        re.lastIndex = 0;
        const hit = re.test(lines[i]);
        if (hit === Boolean(flags.v)) continue;
        count++;
        found = true;
        if (flags.c || flags.l || flags.q) continue;
        for (let k = Math.max(0, i - before); k <= Math.min(lines.length - 1, i + after); k++) {
          if (printed.has(k)) continue;
          printed.add(k);
          const prefix = `${showName ? `${color('magenta', name)}${color('cyan', k === i ? ':' : '-')}` : ''}${flags.n ? `${color('green', k + 1)}${color('cyan', k === i ? ':' : '-')}` : ''}`;
          const body = flags.o && k === i
            ? (lines[k].match(re) || []).join('\n')
            : k === i && !flags.v && !ctx.piped ? lines[k].replace(re, (m) => `${ANSI.bold}${ANSI.bred}${m}${ANSI.reset}`) : lines[k];
          ctx.outln(prefix + body);
        }
      }
      if (flags.c) ctx.outln(`${showName ? `${name}:` : ''}${count}`);
      if (flags.l && count) ctx.outln(name);
    }
    return found ? 0 : 1;
  }, 'grep [-inrvcwlo] PATTERN [file|folder]', 'Search text with a regular expression', 'Text');
  shell.aliases.set('egrep', 'grep -E');
  shell.aliases.set('fgrep', 'grep -F');
  shell.aliases.set('rg', 'grep -rn');

  reg('sort', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['k', 't'] });
    const inputs = await readInputOrFiles(ctx, positional, 'sort');
    let lines = inputs.flatMap((x) => splitLines(x.text));
    const key = (l) => {
      if (!flags.k) return l;
      const fields = flags.t ? l.split(flags.t) : l.trim().split(/\s+/);
      return fields[Number(flags.k) - 1] ?? '';
    };
    lines.sort((a, b) => {
      const ka = key(a); const kb = key(b);
      if (flags.n) return (parseFloat(ka) || 0) - (parseFloat(kb) || 0);
      return flags.f ? ka.toLowerCase().localeCompare(kb.toLowerCase()) : ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    if (flags.r) lines.reverse();
    if (flags.u) lines = [...new Set(lines)];
    if (lines.length) ctx.outln(lines.join('\n'));
    return 0;
  }, 'sort [-rnuf] [-k N] [file]', 'Sort lines', 'Text');

  reg('uniq', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    const inputs = await readInputOrFiles(ctx, positional, 'uniq');
    const lines = inputs.flatMap((x) => splitLines(x.text));
    const groups = [];
    for (const l of lines) {
      const last = groups[groups.length - 1];
      if (last && last.line === l) last.n++;
      else groups.push({ line: l, n: 1 });
    }
    for (const g of groups) {
      if (flags.d && g.n < 2) continue;
      if (flags.u && g.n > 1) continue;
      ctx.outln(flags.c ? `${pad(g.n, 7)} ${g.line}` : g.line);
    }
    return 0;
  }, 'uniq [-cdu] [file]', 'Collapse repeated lines', 'Text');

  reg('cut', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['d', 'f', 'c'] });
    const inputs = await readInputOrFiles(ctx, positional, 'cut');
    const ranges = parseRanges(flags.f || flags.c || '');
    if (!ranges.length) { ctx.err('you must specify a list of fields (-f) or characters (-c)'); return 1; }
    const delim = flags.d ?? '\t';
    for (const l of inputs.flatMap((x) => splitLines(x.text))) {
      if (flags.c) ctx.outln([...l].filter((_, i) => inRanges(i + 1, ranges)).join(''));
      else ctx.outln(l.split(delim).filter((_, i) => inRanges(i + 1, ranges)).join(delim));
    }
    return 0;
  }, 'cut -d , -f 1,3 [file]', 'Pick columns from each line', 'Text');

  reg('tr', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    const text = await ctx.stdin.readAll();
    const expand = (s) => unescapeC(s).replace(/(.)-(.)/g, (_, a, b) => {
      let out = '';
      for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out += String.fromCharCode(c);
      return out;
    }).replace(/\[:upper:\]/g, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').replace(/\[:lower:\]/g, 'abcdefghijklmnopqrstuvwxyz').replace(/\[:digit:\]/g, '0123456789');
    const set1 = expand(positional[0] || '');
    const set2 = expand(positional[1] || '');
    if (flags.d) { ctx.out([...text].filter((c) => !set1.includes(c)).join('')); return 0; }
    let out = [...text].map((c) => { const i = set1.indexOf(c); return i === -1 ? c : (set2[Math.min(i, set2.length - 1)] ?? c); }).join('');
    if (flags.s) out = out.replace(new RegExp(`([${escapeClass(set2 || set1)}])\\1+`, 'g'), '$1');
    ctx.out(out);
    return 0;
  }, "tr 'a-z' 'A-Z'", 'Translate or delete characters', 'Text');

  reg('sed', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['e'] });
    const script = flags.e ?? positional.shift();
    if (!script) { ctx.err('usage: sed [-i] s/find/replace/g [file]'); return 1; }
    const apply = (text) => applySed(script, text, Boolean(flags.n));
    if (flags.i) {
      for (const f of positional) {
        const p = ctx.resolve(f);
        ctx.vfs.writeFile(p, apply(ctx.vfs.readFile(p)));
      }
      return 0;
    }
    const inputs = await readInputOrFiles(ctx, positional, 'sed');
    for (const { text } of inputs) ctx.out(apply(text));
    return 0;
  }, 'sed [-i] s/find/replace/g [file]', 'Find and replace in text or files', 'Text');

  reg('diff', (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    if (positional.length !== 2) { ctx.err('usage: diff [-u] file1 file2'); return 2; }
    const [a, b] = positional.map((f) => ctx.vfs.readFile(ctx.resolve(f)));
    const hunks = unifiedDiff(a, b, positional[0], positional[1]);
    if (!hunks) return 0;
    ctx.out(colorizeDiff(hunks, ctx.piped));
    return flags.q ? 1 : 1;
  }, 'diff [-u] file1 file2', 'Compare two files line by line', 'Text');

  reg('rev', async (ctx) => {
    const inputs = await readInputOrFiles(ctx, ctx.args, 'rev');
    for (const l of inputs.flatMap((x) => splitLines(x.text))) ctx.outln([...l].reverse().join(''));
    return 0;
  }, 'rev [file]', 'Reverse each line', 'Text');

  reg('base64', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    const inputs = await readInputOrFiles(ctx, positional, 'base64');
    const text = inputs.map((x) => x.text).join('');
    try {
      if (flags.d) ctx.out(decodeURIComponent(escape(atob(text.replace(/\s+/g, '')))));
      else ctx.outln(btoa(unescape(encodeURIComponent(text))));
    } catch { ctx.err('invalid input'); return 1; }
    return 0;
  }, 'base64 [-d] [file]', 'Encode or decode base64', 'Text');

  reg('xargs', async (ctx) => {
    const input = await ctx.stdin.readAll();
    const items = input.split(/\s+/).filter(Boolean);
    const cmd = ctx.args.length ? ctx.args : ['echo'];
    const line = [...cmd, ...items].map(quoteArg).join(' ');
    return shell.execute(line, { stdout: ctx.stdout, stderr: ctx.stderr, stdin: ctx.stdin, signal: ctx.signal });
  }, 'xargs command', 'Build a command from input', 'Text');

  reg('tee', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    const text = await ctx.stdin.readAll();
    for (const f of positional) {
      const p = ctx.resolve(f);
      ctx.vfs.writeFile(p, (flags.a && ctx.vfs.isFile(p) ? ctx.vfs.readFile(p) : '') + text);
    }
    ctx.out(text);
    return 0;
  }, 'tee [-a] file', 'Copy input to a file and to the screen', 'Text');

  reg('calc', (ctx) => {
    const expr = ctx.args.join(' ');
    if (!/^[\d\s+\-*/%().^eE,a-z]*$/i.test(expr)) { ctx.err('only arithmetic is allowed'); return 1; }
    try {
      // eslint-disable-next-line no-new-func
      const v = Function('with (Math) { return (' + expr.replace(/\^/g, '**') + '); }')();
      ctx.outln(String(v));
      return 0;
    } catch (err) { ctx.err(err.message); return 1; }
  }, 'calc 2*(3+4)', 'Evaluate arithmetic (Math functions allowed)', 'Shell');
  shell.aliases.set('bc', 'calc');
  shell.aliases.set('expr', 'calc');
}

/* ---------------- helpers ---------------- */

export function isExecutable(vfs, p) {
  const name = basename(p);
  if (/\.(sh|out|exe)$/.test(name)) return true;
  if (name.includes('.')) return false;
  try {
    const head = vfs.readFile(p).slice(0, 64);
    return head.startsWith('#!') || head.startsWith('\u007fTBX');
  } catch { return false; }
}

export function quoteArg(a) {
  return /^[\w@%+=:,./-]+$/.test(a) ? a : `'${String(a).replace(/'/g, "'\\''")}'`;
}

function escapeClass(s) { return s.replace(/[\]\\^-]/g, '\\$&'); }

export function unescapeC(s) {
  return String(s).replace(/\\([nrtabfv0\\'"]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/g, (_, e) => {
    const map = { n: '\n', r: '\r', t: '\t', a: '\x07', b: '\b', f: '\f', v: '\v', 0: '\0', '\\': '\\', "'": "'", '"': '"' };
    if (e[0] === 'x' || e[0] === 'u') return String.fromCharCode(parseInt(e.slice(1), 16));
    return map[e];
  });
}

export function sprintf(fmt, args) {
  let i = 0;
  let out = '';
  // Repeat the format while there are arguments left, like coreutils printf.
  do {
    out += fmt.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([sdifxXoceEgG%])/g, (m, fl, w, prec, conv) => {
      if (conv === '%') return '%';
      const a = args[i++] ?? '';
      let s;
      switch (conv) {
        case 'd': case 'i': s = String(Math.trunc(Number(a) || 0)); break;
        case 'f': s = (Number(a) || 0).toFixed(prec === undefined ? 6 : Number(prec)); break;
        case 'e': case 'E': s = (Number(a) || 0).toExponential(prec === undefined ? 6 : Number(prec)); if (conv === 'E') s = s.toUpperCase(); break;
        case 'g': case 'G': s = String(Number((Number(a) || 0).toPrecision(prec === undefined ? 6 : Number(prec)))); break;
        case 'x': s = (Math.trunc(Number(a)) >>> 0).toString(16); break;
        case 'X': s = (Math.trunc(Number(a)) >>> 0).toString(16).toUpperCase(); break;
        case 'o': s = (Math.trunc(Number(a)) >>> 0).toString(8); break;
        case 'c': s = String(a).charAt(0); break;
        default: s = String(a); if (prec !== undefined) s = s.slice(0, Number(prec));
      }
      if (fl.includes('+') && /^[dif]$/.test(conv) && Number(a) >= 0) s = `+${s}`;
      if (w) s = fl.includes('-') ? s.padEnd(Number(w)) : s.padStart(Number(w), fl.includes('0') && /^[difx]$/i.test(conv) ? '0' : ' ');
      return s;
    });
  } while (i > 0 && i < args.length && /%[^%]/.test(fmt));
  return out;
}

function parseRanges(spec) {
  return String(spec).split(',').filter(Boolean).map((r) => {
    const [a, b] = r.split('-');
    const lo = a === '' ? 1 : Number(a);
    const hi = b === undefined ? lo : b === '' ? Infinity : Number(b);
    return [lo, hi];
  });
}
function inRanges(n, ranges) { return ranges.some(([a, b]) => n >= a && n <= b); }

/** Minimal sed: s/// (with g, i, number), d, p, with optional /regex/ or line address. */
export function applySed(script, text, quiet = false) {
  const commands = script.split(/;\s*(?=[\d/$]*[sdp])/).map((s) => s.trim()).filter(Boolean);
  const lines = text.split('\n');
  const trailing = text.endsWith('\n');
  if (trailing) lines.pop();
  const out = [];
  lines.forEach((line, idx) => {
    let deleted = false;
    let cur = line;
    for (const c of commands) {
      let m = /^(?:(\d+|\$)|\/((?:\\.|[^/])*)\/)?\s*([sdp])(.*)$/s.exec(c);
      if (!m) continue;
      const [, lineAddr, reAddr, op, rest] = m;
      if (lineAddr && !(lineAddr === '$' ? idx === lines.length - 1 : Number(lineAddr) === idx + 1)) continue;
      if (reAddr && !new RegExp(reAddr).test(cur)) continue;
      if (op === 'd') { deleted = true; break; }
      if (op === 'p') { out.push(cur); continue; }
      if (op === 's') {
        const delim = rest[0];
        const parts = splitUnescaped(rest.slice(1), delim);
        if (parts.length < 2) continue;
        const [find, repl, fl = ''] = parts;
        const re = new RegExp(find, `${fl.includes('g') ? 'g' : ''}${fl.includes('i') || fl.includes('I') ? 'i' : ''}`);
        cur = cur.replace(re, repl.replace(/\\(\d)/g, '$$$1').replace(/&/g, '$$&'));
      }
    }
    if (!deleted && !quiet) out.push(cur);
  });
  return out.join('\n') + (trailing && out.length ? '\n' : '');
}

function splitUnescaped(s, delim) {
  const parts = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === delim) { cur += delim; i++; continue; }
    if (s[i] === delim) { parts.push(cur); cur = ''; continue; }
    cur += s[i];
  }
  parts.push(cur);
  return parts;
}

/** Line diff (Myers-lite via LCS), returns unified diff text or '' when equal. */
export function unifiedDiff(a, b, nameA = 'a', nameB = 'b', context = 3) {
  if (a === b) return '';
  const A = a.split('\n');
  const B = b.split('\n');
  const ops = diffLines(A, B);
  const hunks = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === '=') { i++; continue; }
    let start = Math.max(0, i - context);
    let end = i;
    while (end < ops.length) {
      if (ops[end].type !== '=') { end++; continue; }
      let run = 0;
      while (end + run < ops.length && ops[end + run].type === '=') run++;
      if (run > context * 2 || end + run >= ops.length) { end = Math.min(ops.length, end + context); break; }
      end += run;
    }
    hunks.push(ops.slice(start, end));
    i = end;
  }
  let out = `--- ${nameA}\n+++ ${nameB}\n`;
  for (const h of hunks) {
    const aStart = (h.find((o) => o.a !== undefined)?.a ?? 0) + 1;
    const bStart = (h.find((o) => o.b !== undefined)?.b ?? 0) + 1;
    const aLen = h.filter((o) => o.type !== '+').length;
    const bLen = h.filter((o) => o.type !== '-').length;
    out += `@@ -${aStart},${aLen} +${bStart},${bLen} @@\n`;
    for (const o of h) out += `${o.type === '=' ? ' ' : o.type}${o.line}\n`;
  }
  return out;
}

export function diffLines(A, B) {
  const n = A.length;
  const m = B.length;
  // For very large files fall back to a simple prefix/suffix diff.
  if (n * m > 4_000_000) {
    let p = 0;
    while (p < n && p < m && A[p] === B[p]) p++;
    let s = 0;
    while (s < n - p && s < m - p && A[n - 1 - s] === B[m - 1 - s]) s++;
    const ops = [];
    for (let k = 0; k < p; k++) ops.push({ type: '=', line: A[k], a: k, b: k });
    for (let k = p; k < n - s; k++) ops.push({ type: '-', line: A[k], a: k });
    for (let k = p; k < m - s; k++) ops.push({ type: '+', line: B[k], b: k });
    for (let k = 0; k < s; k++) ops.push({ type: '=', line: A[n - s + k], a: n - s + k, b: m - s + k });
    return ops;
  }
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0; let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ type: '=', line: A[i], a: i, b: j }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: '-', line: A[i], a: i }); i++; }
    else { ops.push({ type: '+', line: B[j], b: j }); j++; }
  }
  while (i < n) { ops.push({ type: '-', line: A[i], a: i }); i++; }
  while (j < m) { ops.push({ type: '+', line: B[j], b: j }); j++; }
  return ops;
}

export function colorizeDiff(text, plain = false) {
  if (plain) return text;
  return text.split('\n').map((l) => {
    if (l.startsWith('+++') || l.startsWith('---')) return color('bold', l);
    if (l.startsWith('@@')) return color('cyan', l);
    if (l.startsWith('+')) return color('green', l);
    if (l.startsWith('-')) return color('red', l);
    return l;
  }).join('\n');
}

export function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener?.('abort', () => { clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
  });
}

export { resolvePath };

/** Basic regular expression (grep's default) → JavaScript: in BRE, \\| \\( \\) \\{ \\} \\+ \\? are operators and the bare characters are literal. */
export function breToJs(p) {
  let out = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '\\' && i + 1 < p.length) {
      const n = p[++i];
      out += '|(){}+?'.includes(n) ? n : `\\${n}`;
    } else if ('|(){}+?'.includes(c)) out += `\\${c}`;
    else if (c === '[') {
      // copy bracket expressions verbatim
      const end = p.indexOf(']', i + (p[i + 1] === ']' ? 2 : p[i + 1] === '^' && p[i + 2] === ']' ? 3 : 1));
      if (end === -1) { out += '\\['; continue; }
      out += p.slice(i, end + 1).replace(/\[:(alpha|digit|alnum|space|upper|lower|punct|xdigit):\]/g, (m, k) => ({ alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', space: '\\s', upper: 'A-Z', lower: 'a-z', punct: '!-/:-@\\[-`{-~', xdigit: '0-9a-fA-F' })[k]);
      i = end;
    } else out += c;
  }
  return out;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function strftime(fmt, d = new Date()) {
  const p2 = (n) => String(n).padStart(2, '0');
  return fmt.replace(/%([a-zA-Z%])/g, (m, k) => {
    switch (k) {
      case 'Y': return String(d.getFullYear());
      case 'y': return p2(d.getFullYear() % 100);
      case 'm': return p2(d.getMonth() + 1);
      case 'd': return p2(d.getDate());
      case 'e': return String(d.getDate()).padStart(2, ' ');
      case 'H': return p2(d.getHours());
      case 'I': return p2(((d.getHours() + 11) % 12) + 1);
      case 'M': return p2(d.getMinutes());
      case 'S': return p2(d.getSeconds());
      case 'p': return d.getHours() < 12 ? 'AM' : 'PM';
      case 's': return String(Math.floor(d.getTime() / 1000));
      case 'N': return String(d.getMilliseconds() * 1e6).padStart(9, '0');
      case 'A': return DAYS[d.getDay()];
      case 'a': return DAYS[d.getDay()].slice(0, 3);
      case 'B': return MONTHS[d.getMonth()];
      case 'b': case 'h': return MONTHS[d.getMonth()].slice(0, 3);
      case 'j': return String(Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5)).padStart(3, '0');
      case 'u': return String(d.getDay() || 7);
      case 'w': return String(d.getDay());
      case 'F': return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      case 'T': return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
      case 'D': return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${p2(d.getFullYear() % 100)}`;
      case 'R': return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
      case 'Z': return (d.toTimeString().match(/\(([^)]+)\)/)?.[1] || '').replace(/[^A-Z]/g, '') || 'UTC';
      case 'z': { const o = -d.getTimezoneOffset(); return `${o >= 0 ? '+' : '-'}${p2(Math.floor(Math.abs(o) / 60))}${p2(Math.abs(o) % 60)}`; }
      case 'n': return '\n';
      case 't': return '\t';
      case '%': return '%';
      default: return m;
    }
  });
}
