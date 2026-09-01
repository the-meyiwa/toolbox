/* ============================================================
   Code runtimes.

   Every language runs inside a Web Worker built from a Blob, so a
   runaway loop can be killed with terminate() and nothing a student
   writes can touch the page.

   The heavy runtimes (Python, SQLite, the TypeScript compiler) are
   fetched from a CDN the first time that language is run, then served
   from the browser's HTTP cache. Nothing is downloaded until used, and
   no code is ever sent anywhere — execution is entirely local.
   ============================================================ */

import { EXTRA_LANGUAGES } from './runtimes-extra.js';

const PYODIDE_VERSION = '0.28.3';
const PYODIDE_BASE    = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const SQLJS_BASE      = 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/';
const TYPESCRIPT_URL  = 'https://cdn.jsdelivr.net/npm/typescript@5.9.2/lib/typescript.js';

/* ---------------- shared worker preamble ---------------- */

/* Formats a value the way a console would, without pulling in a
   dependency. Kept inside the worker source so it ships with it. */
const FORMAT_FN = `
function fmt(v, depth) {
  depth = depth || 0;
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  var t = typeof v;
  if (t === 'string') return depth ? JSON.stringify(v) : v;
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
  if (t === 'function') return '[Function' + (v.name ? ': ' + v.name : '') + ']';
  if (t === 'symbol') return v.toString();
  if (v instanceof Error) return v.stack || (v.name + ': ' + v.message);
  if (depth > 4) return '…';
  if (Array.isArray(v)) return '[' + v.map(function (x) { return fmt(x, depth + 1); }).join(', ') + ']';
  if (v instanceof Map) return 'Map(' + v.size + ') {' + [...v].map(function (p) { return fmt(p[0], depth+1) + ' => ' + fmt(p[1], depth+1); }).join(', ') + '}';
  if (v instanceof Set) return 'Set(' + v.size + ') {' + [...v].map(function (x) { return fmt(x, depth+1); }).join(', ') + '}';
  try {
    var keys = Object.keys(v);
    if (!keys.length) return '{}';
    return '{ ' + keys.map(function (k) { return k + ': ' + fmt(v[k], depth + 1); }).join(', ') + ' }';
  } catch (e) { return String(v); }
}`;

const CONSOLE_SHIM = `
function post(type, level, text) { self.postMessage({ type: type, level: level, text: text }); }
function joinArgs(args) { return Array.prototype.map.call(args, function (a) { return fmt(a); }).join(' '); }
console.log   = function () { post('out', 'log',   joinArgs(arguments)); };
console.info  = function () { post('out', 'log',   joinArgs(arguments)); };
console.debug = function () { post('out', 'muted', joinArgs(arguments)); };
console.warn  = function () { post('out', 'warn',  joinArgs(arguments)); };
console.error = function () { post('out', 'error', joinArgs(arguments)); };
console.table = function (d) { post('out', 'log', fmt(d)); };
self.addEventListener('unhandledrejection', function (e) {
  post('out', 'error', 'Unhandled promise rejection: ' + fmt(e.reason));
});`;

/* ---------------- JavaScript ---------------- */

const JS_WORKER = `
${FORMAT_FN}
${CONSOLE_SHIM}

self.onmessage = async function (e) {
  var code = e.data.code;
  var started = Date.now();
  try {
    var value, ranAsExpression = false;

    // If the whole program is a single expression, echo its value the way
    // a REPL would. Otherwise run it as statements.
    try {
      var exprFn = new Function('return (' + code + '\\n)');
      value = await exprFn();
      ranAsExpression = true;
    } catch (parseErr) {
      var fn = new Function('return (async () => {' + code + '\\n})()');
      value = await fn();
    }

    if (ranAsExpression && value !== undefined) post('out', 'result', fmt(value));
    post('done', null, String(Date.now() - started));
  } catch (err) {
    post('out', 'error', err && err.stack ? err.stack : String(err));
    post('done', null, String(Date.now() - started));
  }
};`;

/* ---------------- Python (Pyodide) ---------------- */

const PY_WORKER = `
${FORMAT_FN}
importScripts('${PYODIDE_BASE}pyodide.js');

function post(type, level, text) { self.postMessage({ type: type, level: level, text: text }); }

var pyodideReady = null;

async function boot() {
  post('status', null, 'Downloading Python (about 10 MB) — first run only, then it is cached…');
  var py = await loadPyodide({ indexURL: '${PYODIDE_BASE}' });
  py.setStdout({ batched: function (s) { post('out', 'log', s); } });
  py.setStderr({ batched: function (s) { post('out', 'error', s); } });
  post('status', null, 'Python ready.');
  return py;
}

self.onmessage = async function (e) {
  var code = e.data.code;
  var started = Date.now();
  try {
    if (!pyodideReady) pyodideReady = boot();
    var py = await pyodideReady;

    // Pull in any third-party package the program imports (numpy, pandas…)
    // so "import numpy" just works without a pip step.
    try {
      await py.loadPackagesFromImports(code, {
        messageCallback: function (m) { post('status', null, m); },
      });
    } catch (pkgErr) { /* not fatal — the import error will surface below */ }

    var result = await py.runPythonAsync(code);
    if (result !== undefined && result !== null) {
      post('out', 'result', String(result));
    }
    post('done', null, String(Date.now() - started));
  } catch (err) {
    post('out', 'error', String(err && err.message ? err.message : err));
    post('done', null, String(Date.now() - started));
  }
};`;

/* ---------------- SQL (SQLite via sql.js) ---------------- */

const SQL_SEED = `
CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  budget REAL NOT NULL
);
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  role TEXT,
  salary REAL,
  hired_on TEXT
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id),
  amount REAL NOT NULL,
  placed_on TEXT NOT NULL,
  status TEXT NOT NULL
);

INSERT INTO departments (id, name, budget) VALUES
  (1, 'Engineering', 1850000),
  (2, 'Sales',        920000),
  (3, 'Finance',      410000),
  (4, 'Operations',   650000);

INSERT INTO employees (id, name, department_id, role, salary, hired_on) VALUES
  (1,  'Ada Achebe',      1, 'Staff Engineer',    118000, '2019-03-11'),
  (2,  'Bala Nwosu',      1, 'Engineer',           86000, '2021-07-01'),
  (3,  'Chen Wei',        1, 'Engineering Lead',  134000, '2017-01-23'),
  (4,  'Dara Okonkwo',    2, 'Account Executive',  74000, '2020-09-14'),
  (5,  'Emeka Balogun',   2, 'Sales Director',    121000, '2016-05-02'),
  (6,  'Fatima Sule',     3, 'Financial Analyst',  79000, '2022-02-28'),
  (7,  'Grace Adeyemi',   3, 'Controller',        105000, '2018-11-05'),
  (8,  'Hakeem Yusuf',    4, 'Ops Manager',        92000, '2019-08-19'),
  (9,  'Ifeoma Eze',      4, 'Logistics Analyst',  68000, '2023-01-09'),
  (10, 'Jide Fashola',    2, 'Account Executive',  71000, '2023-06-12');

INSERT INTO orders (id, customer, employee_id, amount, placed_on, status) VALUES
  (1,  'Northwind Ltd',   4,  24500, '2024-01-15', 'paid'),
  (2,  'Contoso plc',     5,  81200, '2024-01-28', 'paid'),
  (3,  'Fabrikam',        4,  12750, '2024-02-03', 'pending'),
  (4,  'Northwind Ltd',  10,  33900, '2024-02-19', 'paid'),
  (5,  'Adventure Co',     5,  57300, '2024-03-07', 'cancelled'),
  (6,  'Contoso plc',    10,  19850, '2024-03-22', 'paid'),
  (7,  'Tailspin',        4,  46100, '2024-04-11', 'pending'),
  (8,  'Fabrikam',        5, 102400, '2024-04-30', 'paid'),
  (9,  'Adventure Co',   10,   8900, '2024-05-16', 'paid'),
  (10, 'Tailspin',        4,  67500, '2024-06-02', 'pending');
`;

const SQLJS_WORKER = `
importScripts('${SQLJS_BASE}sql-wasm.js');

function post(type, level, text, payload) {
  self.postMessage({ type: type, level: level, text: text, payload: payload });
}

var dbReady = null;
var SEED = ${JSON.stringify(SQL_SEED)};

async function boot() {
  post('status', null, 'Downloading SQLite (about 1 MB) — first run only…');
  var SQL = await initSqlJs({ locateFile: function (f) { return '${SQLJS_BASE}' + f; } });
  var db = new SQL.Database();
  db.run(SEED);
  post('status', null, 'SQLite ready — sample tables: departments, employees, orders.');
  return db;
}

self.onmessage = async function (e) {
  var started = Date.now();
  try {
    if (!dbReady) dbReady = boot();
    var db = await dbReady;

    if (e.data.reset) {
      db.run('DROP TABLE IF EXISTS orders; DROP TABLE IF EXISTS employees; DROP TABLE IF EXISTS departments;');
      db.run(SEED);
      post('out', 'log', 'Sample database reset.');
      post('done', null, String(Date.now() - started));
      return;
    }

    var results = db.exec(e.data.code);
    if (!results.length) {
      var changes = db.getRowsModified();
      post('out', 'log', changes
        ? 'Statement ran. ' + changes + ' row' + (changes === 1 ? '' : 's') + ' affected.'
        : 'Statement ran. No rows returned.');
    } else {
      for (var i = 0; i < results.length; i++) {
        post('table', null, null, { columns: results[i].columns, values: results[i].values });
      }
    }
    post('done', null, String(Date.now() - started));
  } catch (err) {
    post('out', 'error', String(err && err.message ? err.message : err));
    post('done', null, String(Date.now() - started));
  }
};`;

/* ---------------- C++ (In-Browser Offline Engine) ---------------- */

const CPP_WORKER = `
${FORMAT_FN}

function post(type, level, text) { self.postMessage({ type: type, level: level, text: text }); }

// Try to optionally load JSCPP if online, without crashing if offline
try {
  importScripts('https://cdn.jsdelivr.net/npm/jscpp@2.0.10/dist/JSCPP.es5.min.js');
} catch (e) {
  // Offline mode active
}

self.onmessage = function (e) {
  var code = e.data.code;
  var stdin = e.data.stdin || '';
  var started = Date.now();

  try {
    if (typeof JSCPP === 'undefined' || !JSCPP.run) {
      throw new Error('JSCPP library is not loaded. Ensure you have an internet connection.');
    }
    
    var outputBuffer = '';
    var exitCode = JSCPP.run(code, stdin, {
      stdio: { 
        write: function (s) {
          outputBuffer += s;
          var nIdx;
          while ((nIdx = outputBuffer.indexOf('\\n')) !== -1) {
            post('out', 'log', outputBuffer.substring(0, nIdx));
            outputBuffer = outputBuffer.substring(nIdx + 1);
          }
        } 
      },
      maxTimeout: 15000
    });

    if (outputBuffer.length > 0) {
      post('out', 'log', outputBuffer);
    }
    
    post('out', 'muted', 'Process finished with exit code ' + exitCode);
    post('done', null, String(Date.now() - started));
  } catch (err) {
    post('out', 'error', err && err.message ? err.message : String(err));
    post('done', null, String(Date.now() - started));
  }
};`;

/* ---------------- TypeScript ---------------- */

let tsLoader = null;

/* Loads the TypeScript compiler once and hands back `ts`. */
function loadTypeScript() {
  if (tsLoader) return tsLoader;
  tsLoader = new Promise((resolve, reject) => {
    if (window.ts) return resolve(window.ts);
    const script = document.createElement('script');
    script.src = TYPESCRIPT_URL;
    script.onload  = () => window.ts ? resolve(window.ts) : reject(new Error('TypeScript failed to initialise'));
    script.onerror = () => reject(new Error('Could not download the TypeScript compiler. Check your connection.'));
    document.head.appendChild(script);
  });
  return tsLoader;
}

export async function transpileTypeScript(source) {
  const ts = await loadTypeScript();
  const out = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
      experimentalDecorators: true,
    },
    reportDiagnostics: true,
  });

  const errors = (out.diagnostics || [])
    .filter(d => d.category === 1)   // ts.DiagnosticCategory.Error
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, ' '));

  return { code: out.outputText, errors };
}

/* ---------------- language registry ---------------- */

const BASE_LANGUAGES = {
  javascript: {
    name: 'JavaScript',
    mono: 'js',
    worker: JS_WORKER,
    weight: null,
    note: 'Runs natively in your browser. Nothing to download.',
    sample: `// Anything you log shows up below.
const invoices = [
  { client: 'Northwind', amount: 24500, paid: true },
  { client: 'Contoso',   amount: 81200, paid: true },
  { client: 'Fabrikam',  amount: 12750, paid: false },
];

const outstanding = invoices
  .filter(i => !i.paid)
  .reduce((sum, i) => sum + i.amount, 0);

console.log('Invoices:', invoices.length);
console.log('Outstanding:', outstanding.toLocaleString('en-GB', {
  style: 'currency', currency: 'GBP',
}));

// Async works too — top-level await is fine.
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(150);
console.log('…and async code runs as you would expect.');`,
  },

  typescript: {
    name: 'TypeScript',
    mono: 'ts',
    worker: JS_WORKER,
    weight: 'Downloads the TypeScript compiler on first run (~9 MB), then cached.',
    note: 'Types are stripped and the result is run, the same as tsc --transpileOnly. Syntax errors are reported; type errors are not.',
    sample: `// Types are checked for syntax, stripped, then the code runs.
interface Employee {
  name: string;
  role: string;
  salary: number;
}

const team: Employee[] = [
  { name: 'Ada',   role: 'Staff Engineer', salary: 118000 },
  { name: 'Bala',  role: 'Engineer',       salary: 86000  },
  { name: 'Chen',  role: 'Lead',           salary: 134000 },
];

function payrollTotal(people: Employee[]): number {
  return people.reduce((sum, p) => sum + p.salary, 0);
}

const byCost = [...team].sort((a, b) => b.salary - a.salary);

console.log('Headcount:', team.length);
console.log('Payroll:', payrollTotal(team).toLocaleString());
console.log('Most expensive:', byCost[0].name);`,
  },

  python: {
    name: 'Python',
    mono: 'py',
    worker: PY_WORKER,
    weight: 'Downloads Python on first run (~10 MB), then cached. Later runs start instantly.',
    note: 'Real CPython 3 compiled to WebAssembly. import numpy, pandas and friends are fetched automatically. input() is not available.',
    sample: `# Real CPython, running in your browser.
from dataclasses import dataclass


@dataclass
class Employee:
    name: str
    role: str
    salary: float


team = [
    Employee("Ada",  "Staff Engineer", 118_000),
    Employee("Bala", "Engineer",        86_000),
    Employee("Chen", "Lead",           134_000),
]

payroll = sum(e.salary for e in team)
dearest = max(team, key=lambda e: e.salary)

print(f"Headcount: {len(team)}")
print(f"Payroll:   {payroll:,.0f}")
print(f"Highest:   {dearest.name} ({dearest.role})")

# Standard library is all there.
import statistics
print("Median salary:", statistics.median(e.salary for e in team))`,
  },

  cpp: {
    name: 'C++',
    mono: 'cpp',
    worker: CPP_WORKER,
    weight: 'Runs locally on your device via in-browser JSCPP engine.',
    note: 'Interprets C++ offline in your browser with standard library support (<iostream>, <vector>, <cmath>, <string>, etc.).',
    sample: `// Real C++ running offline in your browser!
#include <iostream>
#include <vector>
#include <cmath>

using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "=== C++ In-Browser Offline Engine ===" << endl;
    cout << "Fibonacci(10) = " << fibonacci(10) << endl;

    vector<int> numbers = {10, 20, 30, 40, 50};
    int sum = 0;
    for (int num : numbers) {
        sum += num;
    }
    cout << "Sum of vector elements: " << sum << endl;
    return 0;
}`,
  },

  sql: {
    name: 'SQL',
    mono: 'sql',
    worker: SQLJS_WORKER,
    weight: 'Downloads SQLite on first run (~1 MB), then cached.',
    note: 'A real in-memory SQLite database, pre-loaded with departments, employees and orders. Your changes persist until you reset or leave.',
    sample: `-- Three sample tables are already loaded:
--   departments(id, name, budget)
--   employees(id, name, department_id, role, salary, hired_on)
--   orders(id, customer, employee_id, amount, placed_on, status)

SELECT
  d.name                        AS department,
  COUNT(e.id)                   AS headcount,
  ROUND(AVG(e.salary), 0)       AS avg_salary,
  d.budget,
  ROUND(SUM(e.salary) * 100.0 / d.budget, 1) AS pct_of_budget
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id
GROUP BY d.id
ORDER BY pct_of_budget DESC;`,
  },
};

/** Locally-run languages: the three original runtimes plus Lua and the
    web sandbox. Everything here executes on the device. */
export const LANGUAGES = { ...BASE_LANGUAGES, ...EXTRA_LANGUAGES };

/* ---------------- worker lifecycle ---------------- */

const blobUrls = new Map();

export function makeWorker(languageId) {
  const lang = LANGUAGES[languageId];
  if (!blobUrls.has(languageId)) {
    blobUrls.set(languageId, URL.createObjectURL(new Blob([lang.worker], { type: 'text/javascript' })));
  }
  // wasmoon ships as an ES module, so its worker must be a module
  // worker; the others stay classic so importScripts keeps working.
  return lang.moduleWorker
    ? new Worker(blobUrls.get(languageId), { type: 'module' })
    : new Worker(blobUrls.get(languageId));
}

export function releaseWorkers() {
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();
}
