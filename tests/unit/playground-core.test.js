/* Code Playground core: paths, virtual file system and persistence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();

const paths = await import('../../js/lib/playground/paths.js');
const { WorkspaceFS, FsError, renderTree } = await import('../../js/lib/playground/vfs.js');
const store = await import('../../js/lib/playground/store.js');
const { languageOf, langInfo, isRunnable } = await import('../../js/lib/playground/languages.js');

test('paths: normalize, resolve, relative and glob', () => {
  assert.equal(paths.normalize('/workspace/src/../src/./app.js'), 'src/app.js');
  assert.equal(paths.normalize('../../etc/passwd'), 'etc/passwd');
  assert.equal(paths.resolve('src/components', '../utils/x.js'), 'src/utils/x.js');
  assert.equal(paths.resolve('src', '/index.html'), 'index.html');
  assert.equal(paths.resolve('src', '~/a.txt'), 'a.txt');
  assert.equal(paths.relative('src/components', 'src/utils/x.js'), '../utils/x.js');
  assert.equal(paths.extname('.gitignore'), '');
  assert.equal(paths.extname('a/b.test.js'), '.js');
  assert.equal(paths.basename('src/app.js', '.js'), 'app');
  assert.ok(paths.globToRegExp('src/**/*.js').test('src/a/b/c.js'));
  assert.ok(paths.globToRegExp('**/*.{js,ts}').test('x.ts'));
  assert.ok(!paths.globToRegExp('*.js').test('src/x.js'));
  assert.equal(paths.toDisplay('src'), '/workspace/src');
});

test('languages: detection and runnability', () => {
  assert.equal(languageOf('main.cpp'), 'cpp');
  assert.equal(languageOf('src/App.jsx'), 'jsx');
  assert.equal(languageOf('README.md'), 'markdown');
  assert.equal(languageOf('Dockerfile'), 'dockerfile');
  assert.equal(languageOf('logo.PNG'), 'image');
  assert.equal(langInfo('x.py').runner, 'python');
  assert.ok(isRunnable('a.java'));
  assert.ok(!isRunnable('notes.txt'));
});

test('vfs: files, folders and Node-style errors', () => {
  const fs = new WorkspaceFS();
  const events = [];
  fs.onChange((e) => events.push(e.type));
  fs.writeFile('src/app.js', 'console.log(1)');
  fs.mkdir('assets/img');
  assert.ok(fs.isDir('src'));
  assert.ok(fs.isDir('assets/img'));
  assert.deepEqual(fs.readdir('').map((e) => `${e.type}:${e.name}`), ['dir:assets', 'dir:src']);
  assert.equal(fs.readFile('/workspace/src/app.js'), 'console.log(1)');
  assert.throws(() => fs.readFile('nope.js'), (e) => e instanceof FsError && e.code === 'ENOENT');
  assert.throws(() => fs.readFile('src'), (e) => e.code === 'EISDIR');
  assert.throws(() => fs.writeFile('src/app.js/x', '1'), (e) => e.code === 'ENOTDIR');
  assert.throws(() => fs.rm('src'), (e) => e.code === 'ENOTEMPTY');
  fs.rename('src', 'lib');
  assert.ok(fs.isFile('lib/app.js'));
  assert.ok(!fs.exists('src'));
  fs.copy('lib', 'lib2', { recursive: true });
  assert.equal(fs.readFile('lib2/app.js'), 'console.log(1)');
  fs.rm('lib2', { recursive: true });
  assert.ok(!fs.exists('lib2'));
  fs.writeFile('logo.png', new Uint8Array([137, 80, 78, 71]));
  assert.equal(fs.stat('logo.png').binary, true);
  assert.deepEqual(fs.glob('**/*.js'), ['lib/app.js']);
  const tree = renderTree(fs);
  assert.ok(tree.text.includes('lib/'));
  assert.ok(events.includes('create') && events.includes('rename') && events.includes('delete'));
  assert.throws(() => fs.rename('lib', 'lib/inner'), (e) => e.code === 'EINVAL');
});

test('store: workspaces persist incrementally and legacy workspaces migrate', async () => {
  localStorage.clear();
  store.__resetStoreForTests();
  localStorage.setItem('toolbox_cpg_workspaces_v2', JSON.stringify([
    { id: 'ws-old', name: 'Old one', files: [{ id: 'f-1', name: 'main.py', lang: 'python', content: 'print(1)' }, { id: 'f-2', name: 'src/util.py', content: 'x=1' }], activeFileId: 'f-2', updatedAt: 5 },
  ]));
  const list = await store.listWorkspaces();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Old one');
  assert.equal(list[0].activePath, 'src/util.py');
  const loaded = await store.loadFiles('ws-old');
  assert.equal(loaded.files['main.py'], 'print(1)');

  const fs = new WorkspaceFS(loaded);
  const saver = new store.AutoSaver('ws-old', fs, { delay: 5 });
  fs.writeFile('src/new.py', 'y=2');
  fs.rm('main.py');
  fs.rename('src', 'pkg');
  await saver.flush();
  const again = await store.loadFiles('ws-old');
  assert.deepEqual(Object.keys(again.files).sort(), ['pkg/new.py', 'pkg/util.py']);
  saver.dispose();

  await store.deleteWorkspace('ws-old');
  assert.equal((await store.listWorkspaces()).length, 0);
});
