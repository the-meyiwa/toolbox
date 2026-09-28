/* ============================================================
   The Code Playground's C/C++ interpreter: the real worker
   (public/playground/cpp-runtime.js) running the vendored JSCPP
   bundle, driven through its message protocol. Guards the fixes in
   vendor-src/jscpp/toolbox-fixes.patch and the worker's own input
   handling.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { interpreterBlockers } from '../../js/lib/playground/cpp.js';

const root = new URL('../../', import.meta.url);
const WORKER = fs.readFileSync(new URL('public/playground/cpp-runtime.js', root), 'utf8');
const BUNDLE = fs.readFileSync(new URL('public/vendor/jscpp/JSCPP.min.js', root), 'utf8');

function run(code, stdin = '') {
  return new Promise((resolve) => {
    let out = ''; let err = '';
    // Only host timers and console: passing host Array or Object would mix realms and break instanceof.
    const ctx = { console, setTimeout, clearTimeout };
    ctx.self = ctx; ctx.globalThis = ctx;
    ctx.importScripts = () => vm.runInContext(BUNDLE, ctx);
    const timer = setTimeout(() => resolve({ out, err: `${err} [timeout]` }), 20000);
    ctx.postMessage = (m) => {
      if (m.type === 'stdout') out += m.data;
      if (m.type === 'error') err += `[${m.kind}] ${m.message}`;
      if (m.type === 'exit') { clearTimeout(timer); resolve({ out, err, code: m.code }); }
    };
    vm.createContext(ctx);
    vm.runInContext(WORKER, ctx);
    ctx.onmessage({ data: { type: 'run', code, jscppUrl: 'bundle', interactive: false, stdinText: stdin, maxTimeout: 15000 } });
  });
}

const H = '#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\nusing namespace std;\n';
const CASES = [
  ['vector(n) filled from cin, then sorted', H + 'int main(){int n;cin>>n;vector<int> v(n);for(int i=0;i<n;i++)cin>>v[i];sort(v.begin(),v.end());for(int x:v)cout<<x<<" ";cout<<endl;return 0;}', '4\n3 1 4 2\n', '1 2 3 4 \n'],
  ['vector(n, value)', H + 'int main(){vector<int> v(3,7);cout<<v.size()<<v[2]<<endl;return 0;}', '', '37\n'],
  ['while (cin >> x) ends at end of input', H + 'int main(){int x,s=0;while(cin>>x)s+=x;cout<<s<<endl;return 0;}', '1 2 3\n4\n', '10\n'],
  ['getline does not echo its input', H + 'int main(){string s;getline(cin,s);cout<<"Hi "<<s<<"!"<<endl;return 0;}', 'Ada Lovelace\n', 'Hi Ada Lovelace!\n'],
  ['classes, constructors and new with arguments', H + 'class A{public:int x;A(int v){x=v;}int dbl(){return x*2;}};\nint main(){A a(4);cout<<a.dbl()<<endl;A* p=new A(5);cout<<p->dbl()<<endl;delete p;return 0;}', '', '8\n10\n'],
  ['single inheritance', H + 'class A{public:int f(){return 1;}};\nclass B:public A{public:int g(){return f()+1;}};\nint main(){B b;cout<<b.g()<<endl;return 0;}', '', '2\n'],
  ['C: scanf read-to-end loop', '#include <stdio.h>\nint main(){int n,s=0;while(scanf("%d",&n)==1)s+=n;printf("%d\\n",s);return 0;}', '1 2 3 4\n', '10\n'],
  ['C: linked list with malloc', '#include <stdio.h>\n#include <stdlib.h>\nstruct Node{int v;struct Node *next;};\nint main(){struct Node *h=NULL;for(int i=1;i<=3;i++){struct Node *n=malloc(sizeof(struct Node));n->v=i;n->next=h;h=n;}for(struct Node *p=h;p;p=p->next)printf("%d ",p->v);printf("\\n");return 0;}', '', '3 2 1 \n'],
  ['C: fgets from stdin', '#include <stdio.h>\nint main(){char line[64];fgets(line,64,stdin);printf("got %s",line);return 0;}', 'hello\n', 'got hello\n'],
];

for (const [name, code, stdin, want] of CASES) {
  test(`JSCPP: ${name}`, async () => {
    const r = await run(code, stdin);
    assert.equal(r.err, '', r.err);
    assert.equal(r.out, want);
  });
}

test('JSCPP: syntax errors are reported as compile errors', async () => {
  const r = await run('int main(){ int x = ; }');
  assert.match(r.err, /^\[compile\]/);
  assert.equal(r.code, 1);
});

test('Auto engine: the interpreter takes what it can run and hands off the rest', () => {
  assert.deepEqual(interpreterBlockers('class A{public:int x;A(int v){x=v;}};'), []);
  assert.deepEqual(interpreterBlockers('while (cin >> x) s += x;'), []);
  assert.deepEqual(interpreterBlockers('struct P{int x;int d(){return x;}};'), []);
  assert.ok(interpreterBlockers('#include <map>\nmap<int,int> m;').length);
  assert.ok(interpreterBlockers('class A{ virtual int f(); };').includes('virtual functions'));
  assert.ok(interpreterBlockers('stringstream ss;').includes('string streams'));
});
