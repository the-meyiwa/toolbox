/* Code Playground git: local version control behaves like git. */
import test from 'node:test';
import assert from 'node:assert/strict';

const { Shell, BufferStream } = await import('../../js/lib/playground/shell.js');
const { registerCoreCommands } = await import('../../js/lib/playground/commands-core.js');
const { WorkspaceFS } = await import('../../js/lib/playground/vfs.js');
const { GitStore, registerGit, blobHash, merge3, parseGitHubUrl } = await import('../../js/lib/playground/git.js');

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function setup(files) {
  const vfs = new WorkspaceFS({ files });
  const shell = new Shell({ vfs });
  registerCoreCommands(shell);
  const meta = {};
  const objects = new Map();
  const store = new GitStore({ vfs, getMeta: () => meta, saveMeta: async () => {}, putObjects: async (o) => { for (const [k, v] of Object.entries(o)) objects.set(k, v); }, getObject: async (h) => objects.get(h) });
  registerGit(shell, store, { getAuthor: () => ({ name: 'Ada', email: 'ada@example.com' }), prompt: async () => 'y' });
  const run = async (line) => {
    const out = new BufferStream(); const err = new BufferStream();
    const code = await shell.execute(line, { stdout: out, stderr: err });
    return { code, out: strip(out.toString()), err: strip(err.toString()) };
  };
  return { vfs, shell, store, run, meta };
}

test('git blob hashes match real git', async () => {
  // `printf 'hello\n' | git hash-object --stdin` = ce013625030ba8dba906f756967f9e9ca394464a
  assert.equal(await blobHash('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a');
  assert.deepEqual(parseGitHubUrl('https://github.com/ada/calc.git'), { owner: 'ada', repo: 'calc' });
  assert.deepEqual(parseGitHubUrl('git@github.com:ada/calc'), { owner: 'ada', repo: 'calc' });
});

test('git: init, add, commit, status, log, diff', async () => {
  const { run, vfs } = setup({ 'app.js': 'console.log(1)\n', 'README.md': '# App\n', 'node_modules/x/index.js': 'x' });
  assert.equal((await run('git status')).code, 128);
  assert.ok((await run('git init')).out.includes('Initialized empty Git repository'));
  let st = (await run('git status')).out;
  assert.ok(st.includes('No commits yet') && st.includes('Untracked files') && st.includes('app.js'));
  assert.ok(!st.includes('node_modules'), 'node_modules is always ignored');
  await run('git add .');
  st = (await run('git status')).out;
  assert.ok(st.includes('new file:   app.js'));
  const c1 = await run('git commit -m "First commit"');
  assert.equal(c1.code, 0);
  assert.ok(c1.out.includes('(root-commit)') && c1.out.includes('First commit'));
  assert.ok((await run('git status')).out.includes('nothing to commit, working tree clean'));
  vfs.writeFile('app.js', 'console.log(2)\n');
  const d = (await run('git diff')).out;
  assert.ok(d.includes('-console.log(1)') && d.includes('+console.log(2)'));
  assert.equal((await run('git commit -m nothing')).code, 1, 'unstaged changes are not committed');
  await run('git commit -am "Second"');
  const log = (await run('git log --oneline')).out.trim().split('\n');
  assert.equal(log.length, 2);
  assert.ok(log[0].includes('Second') && log[0].includes('HEAD -> main'));
  assert.ok((await run('git show HEAD~1:app.js')).out.includes('console.log(1)'));
});

test('git: branches, checkout safety, fast-forward and conflicting merge', async () => {
  const { run, vfs } = setup({ 'a.txt': 'line1\nline2\nline3\n' });
  await run('git init && git add -A && git commit -m base');
  await run('git checkout -b feature');
  vfs.writeFile('a.txt', 'line1\nFEATURE\nline3\n');
  await run('git commit -am feature-change');
  await run('git switch main');
  assert.equal(vfs.readFile('a.txt'), 'line1\nline2\nline3\n');
  vfs.writeFile('a.txt', 'line1\nMAIN\nline3\n');
  const blocked = await run('git checkout feature');
  assert.equal(blocked.code, 1);
  assert.ok(blocked.err.includes('would be overwritten'));
  await run('git commit -am main-change');
  const m = await run('git merge feature');
  assert.equal(m.code, 1);
  assert.ok(m.out.includes('CONFLICT'));
  assert.ok(/<<<<<<< HEAD\nMAIN\n=======\nFEATURE\n>>>>>>> /.test(vfs.readFile('a.txt')));
  assert.equal((await run('git commit -am try')).code, 1, 'refuses to commit conflict markers');
  vfs.writeFile('a.txt', 'line1\nMAIN+FEATURE\nline3\n');
  await run('git add a.txt');
  assert.equal((await run('git commit -m merged')).code, 0);
  const log = (await run('git log -n 1')).out;
  assert.ok(log.includes('Merge:'));
  // fast-forward
  await run('git checkout -b ff && git checkout main');
  const br = (await run('git branch')).out;
  assert.ok(br.includes('* main') && br.includes('feature') && br.includes('ff'));
});

test('git: stash, restore, reset', async () => {
  const { run, vfs } = setup({ 'n.txt': 'one\n' });
  await run('git init && git add . && git commit -m one');
  vfs.writeFile('n.txt', 'two\n');
  await run('git stash');
  assert.equal(vfs.readFile('n.txt'), 'one\n');
  await run('git stash pop');
  assert.equal(vfs.readFile('n.txt'), 'two\n');
  await run('git restore n.txt');
  assert.equal(vfs.readFile('n.txt'), 'one\n');
  vfs.writeFile('n.txt', 'three\n');
  await run('git commit -am three');
  await run('git reset --hard HEAD~1');
  assert.equal(vfs.readFile('n.txt'), 'one\n');
  assert.equal((await run('git log --oneline')).out.trim().split('\n').length, 1);
});

test('git: merge3 keeps independent edits and marks overlaps', () => {
  const base = 'a\nb\nc\nd\n';
  assert.equal(merge3(base, 'A\nb\nc\nd\n', 'a\nb\nc\nD\n').text, 'A\nb\nc\nD\n');
  const r = merge3(base, 'a\nX\nc\nd\n', 'a\nY\nc\nd\n');
  assert.ok(r.conflict);
});
