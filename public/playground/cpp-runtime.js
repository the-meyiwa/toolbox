/* ============================================================
   Toolbox Code Playground — C/C++ interpreter worker (JSCPP)

   Runs C and C++ programs entirely in the browser with JSCPP
   (the maintained JSCPP-NG fork: vector, string, map, set, algorithm,
   iomanip, sstream, structs, pointers, new/delete ...). The interpreter
   is asynchronous, so `cin >> x` pauses the program and asks the page
   for a line of input — programs are interactive in the terminal, just
   like a compiled binary.

   JSCPP decides at load time whether it is in a worker by looking at
   `window.document`; loaded naively into a worker it installs its own
   message protocol and hides its API. Giving it a stand-in `window`
   object makes it publish `JSCPP.run` there instead, while the real
   worker global stays untouched.

   page → worker  { type:'run', code, jscppUrl, interactive, stdinText, maxTimeout, maxSteps }
                  { type:'stdin', data:string|null }
   worker → page  { type:'stdout', data } { type:'stdin-request' }
                  { type:'error', kind:'compile'|'runtime', message, line, column }
                  { type:'exit', code }
   ============================================================ */
'use strict';

var JSCPP = null;
var stdinWaiter = null;
var pendingInput = [];
var inputEOF = false;

function send(m) { self.postMessage(m); }

function load(url) {
  if (JSCPP) return JSCPP;
  self.window = { document: {} };
  importScripts(url);
  JSCPP = self.window.JSCPP;
  if (!JSCPP || typeof JSCPP.run !== 'function') throw new Error('The C++ interpreter failed to load.');
  return JSCPP;
}

function parseLocation(message) {
  var m = /\[line (\d+):(\d+)\]/.exec(message) || /^(\d+):(\d+)\s/.exec(message);
  return m ? { line: Number(m[1]), column: Number(m[2]) } : { line: null, column: null };
}

function cleanMessage(message) {
  return String(message || '').replace(/\(internal erro\)/, '(internal error)');
}

self.onmessage = function (e) {
  var msg = e.data || {};
  if (msg.type === 'stdin') {
    if (msg.data === null) inputEOF = true; else pendingInput.push(String(msg.data));
    if (stdinWaiter) { var w = stdinWaiter; stdinWaiter = null; w(); }
    return;
  }
  if (msg.type !== 'run') return;

  var jscpp;
  try { jscpp = load(msg.jscppUrl || '/vendor/jscpp/JSCPP.es5.min.js'); } catch (err) {
    send({ type: 'error', kind: 'runtime', message: String(err && err.message || err) });
    send({ type: 'exit', code: 1 });
    return;
  }

  var batch = msg.interactive ? null : String(msg.stdinText || '').split(/(?<=\n)/);
  var done = false;
  function finish(code) { if (done) return; done = true; send({ type: 'exit', code: code }); }

  function nextLine() {
    // JSCPP asks for one line at a time and appends the newline itself.
    if (batch) {
      if (!batch.length) return Promise.reject(new Error('end of input'));
      return Promise.resolve(batch.shift().replace(/\r?\n$/, ''));
    }
    return new Promise(function (resolve, reject) {
      var take = function () {
        if (pendingInput.length) { resolve(pendingInput.shift().replace(/\r?\n$/, '')); return; }
        if (inputEOF) { reject(new Error('end of input')); return; }
        stdinWaiter = take;
        send({ type: 'stdin-request' });
      };
      take();
    });
  }

  var config = {
    maxTimeout: msg.maxTimeout || 0,
    maxExecutionSteps: msg.maxSteps || 1e12,
    eventLoopSteps: 5000,
    unsigned_overflow: 'warn',
    printStdin: false,
    stdio: {
      write: function (s) { send({ type: 'stdout', data: String(s) }); },
      finishCallback: function (code) { finish(typeof code === 'number' ? code : Number(code) || 0); },
      promiseError: function (err) {
        var message = cleanMessage(err && err.message || err);
        if (/end of input/i.test(message) || /Unexpected end of input/.test(message)) {
          send({ type: 'error', kind: 'runtime', message: 'The program tried to read input but there is none left (end of input).' });
        } else {
          var loc = parseLocation(message);
          send({ type: 'error', kind: 'runtime', message: message.replace(/^\[line \d+:\d+\]\s*/, ''), line: loc.line, column: loc.column });
        }
        finish(1);
      },
    },
  };

  try {
    jscpp.run(String(msg.code || ''), nextLine, config);
  } catch (err) {
    var message = cleanMessage(err && err.message || err);
    var loc = parseLocation(message);
    send({ type: 'error', kind: 'compile', message: message.replace(/^\[line \d+:\d+\]\s*/, ''), line: loc.line, column: loc.column });
    finish(1);
  }
};
send({ type: 'ready' });
