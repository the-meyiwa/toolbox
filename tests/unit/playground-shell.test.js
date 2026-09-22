/* Code Playground shell: parsing, expansion, pipes, redirection and core commands. */
import test from 'node:test';
import assert from 'node:assert/strict';

const { Shell, BufferStream, tokenize, parse, parseArgs } = await import('../../js/lib/playground/shell.js');
const { registerCoreCommands, applySed, unifiedDiff, sprintf } = await import('../../js/lib/playground/commands-core.js');
const { WorkspaceFS } = await import('../../js/lib/playground/vfs.js');

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function makeShell(files = {}) {
  const vfs = new WorkspaceFS({ files });
  const shell = new Shell({ vfs, host: {} });
  registerCoreCommands(shell);
  const run = async (line, stdin) => {
    const out = new BufferStream();
    const err = new BufferStream();
    const { StringInput } = await import('../../js/lib/playground/shell.js');
    const code = await shell.execute(line, { stdout: out, stderr: err, stdin: stdin ? new StringInput(stdin) : undefined });
    return { code, out: strip(out.toString()), err: strip(err.toString()) };
  };
  return { vfs, shell, run };
}

test('shell parser: quotes, operators and redirects', () => {
  const t = tokenize(`echo "a b" 'c $d' e\\ f > out.txt && ls | wc -l; x=1`);
  const words = t.filter((x) => x.type === 'word').map((w) => w.parts.map((p) => p.text).join(''));
  assert.deepEqual(words.slice(0, 4), ['echo', 'a b', 'c $d', 'e f']);
  const list = parse(t);
  assert.equal(list.length, 3);
  assert.equal(list[0].op, '&&');
  assert.equal(list[1].pipeline.length, 2);
  assert.throws(() => parse(tokenize('| ls')));
  assert.throws(() => tokenize('echo "oops'));
  const { flags, positional } = parseArgs(['-rf', '--name=x', '-n', '5', 'a', '--', '-z'], { string: ['n'] });
  assert.deepEqual(flags, { r: true, f: true, name: 'x', n: '5' });
  assert.deepEqual(positional, ['a', '-z']);
});

test('shell: navigation, files, globbing and redirection', async () => {
  const { run, vfs, shell } = makeShell({ 'src/a.js': 'one\ntwo\n', 'src/b.js': 'three\n', 'README.md': '# hi\n' });
  assert.equal((await run('pwd')).out, '/workspace\n');
  assert.equal((await run('cd src && pwd')).out, '/workspace/src\n');
  assert.equal(shell.cwd, 'src');
  assert.equal((await run('ls *.js')).out.trim().split(/\s+/).join(' '), 'a.js b.js');
  await run('cd ..');
  assert.equal((await run('cat src/*.js | wc -l')).out.trim(), '3');
  await run('echo "hello world" > notes/today.txt');
  assert.equal(vfs.exists('notes/today.txt'), false, 'redirect into a missing folder must fail');
  await run('mkdir -p notes && echo "hello world" > notes/today.txt && echo again >> notes/today.txt');
  assert.equal(vfs.readFile('notes/today.txt'), 'hello world\nagain\n');
  assert.equal((await run('grep -n again notes/today.txt')).out, '2:again\n');
  assert.equal((await run('grep -rl three .')).out, 'src/b.js\n');
  const missing = await run('cat nope.txt');
  assert.equal(missing.code, 1);
  assert.ok(missing.err.includes('No such file'));
  assert.equal((await run('false || echo fallback')).out, 'fallback\n');
  assert.equal((await run('true && echo $?')).out, '0\n');
  await run('export NAME=Ada');
  assert.equal((await run('echo "Hi $NAME, ${NAME}!"')).out, 'Hi Ada, Ada!\n');
  assert.equal((await run("echo 'no $NAME'")).out, 'no $NAME\n');
  assert.equal((await run('echo $(echo nested)')).out, 'nested\n');
  await run('mv src lib && cp -r lib lib2 && rm -r lib2');
  assert.ok(vfs.isFile('lib/a.js') && !vfs.exists('lib2'));
  assert.equal((await run('seq 3 | sort -r | head -n 2')).out, '3\n2\n');
  assert.equal((await run('printf "%s=%d\\n" a 1 b 2')).out, 'a=1\nb=2\n');
  assert.equal((await run('echo banana | tr a-z A-Z')).out, 'BANANA\n');
  assert.equal((await run('echo a,b,c | cut -d , -f 2')).out, 'b\n');
  const nf = await run('pythn');
  assert.equal(nf.code, 127);
  assert.ok(nf.err.includes('command not found'));
  assert.equal((await run('find . -name "*.js"')).out, './lib/a.js\n./lib/b.js\n');
  const tree = (await run('tree')).out;
  assert.ok(tree.includes('└── ') && tree.includes('directories'));
  const comp = shell.complete('cat li', 6);
  assert.deepEqual(comp.candidates, ['lib/']);
  assert.ok(shell.complete('gr', 2).candidates.includes('grep'));
});

test('text helpers: sed, diff, printf', () => {
  assert.equal(applySed('s/cat/dog/g', 'cat cat\nbird\n'), 'dog dog\nbird\n');
  assert.equal(applySed('2d', 'a\nb\nc\n'), 'a\nc\n');
  assert.equal(applySed('s/(\\w+) (\\w+)/\\2 \\1/', 'hello world\n'), 'world hello\n');
  const d = unifiedDiff('a\nb\nc', 'a\nB\nc', 'x', 'y');
  assert.ok(d.includes('-b') && d.includes('+B') && d.includes('@@'));
  assert.equal(sprintf('%05.1f|%-4s|%x', ['3.14159', 'ab', '255']), '003.1|ab  |ff');
});
