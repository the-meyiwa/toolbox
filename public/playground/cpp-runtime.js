/* ============================================================
   Toolbox Code Playground — C/C++ interpreter worker (JSCPP)

   Runs C and C++ programs entirely in the browser with JSCPP, built
   from github.com/thatcrazydave/JSCPP: C++ classes, inheritance,
   pointers and new/delete, plus C that works (structs with self
   pointers, malloc/free, scanf, fgets, strcpy into buffers). The
   interpreter is asynchronous, so `cin >> x` pauses the program and
   asks the page for a line of input, like a compiled binary.

   The bundle (public/vendor/jscpp/JSCPP.min.js) is a classic script
   that sets `self.JSCPP`; see public/vendor/jscpp/VERSION for how it
   was built. C's stdio reads all of its input at once through
   `stdio.drain`, which is served here from the same input as cin.

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
  importScripts(url);
  var mod = self.JSCPP;
  JSCPP = mod && typeof mod.run !== 'function' && mod.default ? mod.default : mod;
  if (!JSCPP || typeof JSCPP.run !== 'function') { JSCPP = null; throw new Error('The C++ interpreter failed to load.'); }
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
  try { jscpp = load(msg.jscppUrl || '/vendor/jscpp/JSCPP.min.js'); } catch (err) {
    send({ type: 'error', kind: 'runtime', message: String(err && err.message || err) });
    send({ type: 'exit', code: 1 });
    return;
  }

  var batch = msg.interactive ? null : String(msg.stdinText || '').split(/(?<=\n)/);
  var done = false;
  function finish(code) { if (done) return; done = true; send({ type: 'exit', code: code }); }

  function nextLine() {
    // JSCPP asks for one line at a time and appends the newline itself.
    // At end of input a read gets nothing, as from a real terminal, so
    // `while (cin >> x)` ends instead of stopping the program with an error.
    if (batch) {
      if (!batch.length) return Promise.resolve('');
      return Promise.resolve(batch.shift().replace(/\r?\n$/, ''));
    }
    return new Promise(function (resolve) {
      var take = function () {
        if (pendingInput.length) { resolve(pendingInput.shift().replace(/\r?\n$/, '')); return; }
        if (inputEOF) { resolve(''); return; }
        stdinWaiter = take;
        send({ type: 'stdin-request' });
      };
      take();
    });
  }

  /* C's stdio (scanf, getchar, fgets) takes the whole of its input in one
     synchronous call. In batch runs that is everything supplied; in the
     interactive terminal it is whatever has been typed so far. */
  function drainAll() {
    if (batch) { var all = batch.join(''); batch = []; return all; }
    var typed = pendingInput.map(function (l) { return /\n$/.test(l) ? l : l + '\n'; }).join('');
    pendingInput = [];
    return typed;
  }

  var config = {
    maxTimeout: msg.maxTimeout || 0,
    maxExecutionSteps: msg.maxSteps || 1e12,
    eventLoopSteps: 5000,
    unsigned_overflow: 'warn',
    printStdin: false,
    stdio: {
      write: function (s) { send({ type: 'stdout', data: String(s) }); },
      drain: drainAll,
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
