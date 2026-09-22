/* ============================================================
   Starter projects for Code Playground. Each one runs as-is with the
   Run button and is laid out the way the real tool would lay it out
   (Vite, npm, Express, pytest, g++ ...), so what students learn here
   transfers directly to a real machine.
   ============================================================ */

const pkg = (name, extra = {}) => `${JSON.stringify({ name, version: '1.0.0', private: true, ...extra }, null, 2)}\n`;

const GITIGNORE = 'node_modules/\ndist/\n.env\n__pycache__/\n*.pyc\n';

export const TEMPLATES = {
  blank: {
    name: 'Blank',
    description: 'An empty workspace with a README.',
    icon: 'file',
    open: 'README.md',
    files: () => ({
      'README.md': '# My project\n\nCreate files with the + button, or type in the terminal:\n\n```bash\ntouch app.js\nnode app.js\n```\n',
    }),
  },

  web: {
    name: 'HTML, CSS & JavaScript',
    description: 'A website with separate HTML, CSS and JS files and live preview.',
    icon: 'globe',
    open: 'index.html',
    preview: true,
    files: () => ({
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>Hello, web!</h1>
    <p>Edit <code>index.html</code>, <code>style.css</code> and <code>script.js</code> — the preview updates as you type.</p>
  </header>

  <main>
    <form id="todo-form">
      <input id="todo-input" placeholder="What needs doing?" autocomplete="off" required>
      <button type="submit">Add</button>
    </form>
    <ul id="todo-list"></ul>
    <p id="count"></p>
  </main>

  <script src="script.js"></script>
</body>
</html>
`,
      'style.css': `* { box-sizing: border-box; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  max-width: 560px;
  margin: 40px auto;
  padding: 0 16px;
  color: #1f2937;
  background: #f8fafc;
}
header h1 { margin-bottom: 4px; }
header p { color: #64748b; margin-top: 0; }
form { display: flex; gap: 8px; margin: 24px 0 12px; }
input { flex: 1; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
button { padding: 10px 16px; border: 0; border-radius: 8px; background: #2563eb; color: white; font: inherit; cursor: pointer; }
button:hover { background: #1d4ed8; }
ul { list-style: none; padding: 0; }
li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; }
li.done span { text-decoration: line-through; color: #94a3b8; }
li button { margin-left: auto; background: transparent; color: #ef4444; padding: 4px 8px; }
#count { color: #64748b; font-size: 0.9rem; }
`,
      'script.js': `// Your todos are kept in localStorage, so they survive a reload.
const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const count = document.querySelector('#count');

let todos = JSON.parse(localStorage.getItem('todos') || '[]');

function save() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

function render() {
  list.innerHTML = '';
  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = todo.done ? 'done' : '';
    li.innerHTML = \`
      <input type="checkbox" \${todo.done ? 'checked' : ''}>
      <span></span>
      <button title="Delete">✕</button>\`;
    li.querySelector('span').textContent = todo.text;
    li.querySelector('input').addEventListener('change', () => {
      todo.done = !todo.done;
      save();
      render();
    });
    li.querySelector('button').addEventListener('click', () => {
      todos = todos.filter((t) => t !== todo);
      save();
      render();
    });
    list.appendChild(li);
  }
  const left = todos.filter((t) => !t.done).length;
  count.textContent = \`\${left} item\${left === 1 ? '' : 's'} left\`;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  todos.push({ text: input.value.trim(), done: false });
  input.value = '';
  save();
  render();
});

render();
console.log('App loaded with', todos.length, 'todos');
`,
    }),
  },

  'vite-react': {
    name: 'React (Vite)',
    description: 'A React 18 app laid out like `npm create vite` — components, CSS, tests.',
    icon: 'react',
    open: 'src/App.jsx',
    preview: true,
    files: ({ name = 'react-app' } = {}) => ({
      'package.json': pkg(name, {
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview', test: 'vitest run' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: { vite: '^6.0.0', '@vitejs/plugin-react': '^4.3.4', vitest: '^2.1.8' },
      }),
      'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
      'src/main.jsx': `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
      'src/App.jsx': `import { useState } from 'react';
import Counter from './components/Counter.jsx';
import TodoList from './components/TodoList.jsx';
import './App.css';

export default function App() {
  const [name, setName] = useState('React');

  return (
    <main className="app">
      <h1>Hello, {name}!</h1>
      <input
        className="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Your name"
      />
      <Counter start={0} />
      <TodoList />
      <p className="hint">
        Edit <code>src/App.jsx</code> and the preview updates automatically.
      </p>
    </main>
  );
}
`,
      'src/components/Counter.jsx': `import { useState } from 'react';

export default function Counter({ start = 0 }) {
  const [count, setCount] = useState(start);
  return (
    <div className="card">
      <button onClick={() => setCount((c) => c - 1)}>−</button>
      <span className="count">{count}</span>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
    </div>
  );
}
`,
      'src/components/TodoList.jsx': `import { useState } from 'react';
import { addTodo, toggleTodo, remaining } from '../lib/todos.js';

export default function TodoList() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');

  function submit(e) {
    e.preventDefault();
    setTodos((t) => addTodo(t, text));
    setText('');
  }

  return (
    <section className="card column">
      <form onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a todo" />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} className={todo.done ? 'done' : ''} onClick={() => setTodos((t) => toggleTodo(t, todo.id))}>
            {todo.text}
          </li>
        ))}
      </ul>
      <small>{remaining(todos)} left</small>
    </section>
  );
}
`,
      'src/lib/todos.js': `// Pure functions are easy to test — see todos.test.js.
let nextId = 1;

export function addTodo(todos, text) {
  const clean = text.trim();
  if (!clean) return todos;
  return [...todos, { id: nextId++, text: clean, done: false }];
}

export function toggleTodo(todos, id) {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function remaining(todos) {
  return todos.filter((t) => !t.done).length;
}
`,
      'src/lib/todos.test.js': `import { describe, it, expect } from 'vitest';
import { addTodo, toggleTodo, remaining } from './todos.js';

describe('todos', () => {
  it('adds a trimmed todo', () => {
    const list = addTodo([], '  learn React  ');
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe('learn React');
  });

  it('ignores empty text', () => {
    expect(addTodo([], '   ')).toEqual([]);
  });

  it('toggles and counts remaining', () => {
    let list = addTodo(addTodo([], 'a'), 'b');
    list = toggleTodo(list, list[0].id);
    expect(remaining(list)).toBe(1);
  });
});
`,
      'src/index.css': `:root {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #e2e8f0;
  background: #0f172a;
}
body { margin: 0; display: grid; place-items: center; min-height: 100vh; }
`,
      'src/App.css': `.app { width: min(520px, 92vw); text-align: center; }
.name { padding: 8px 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: inherit; font: inherit; }
.card { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 20px 0; padding: 16px; border-radius: 12px; background: #1e293b; border: 1px solid #334155; }
.card.column { flex-direction: column; align-items: stretch; text-align: left; }
.card form { display: flex; gap: 8px; }
.card input { flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: inherit; }
button { padding: 8px 14px; border-radius: 8px; border: 0; background: #38bdf8; color: #0f172a; font-weight: 600; cursor: pointer; }
.count { font-size: 2rem; min-width: 3ch; }
ul { padding-left: 18px; }
li { cursor: pointer; padding: 4px 0; }
li.done { text-decoration: line-through; opacity: 0.6; }
.hint { color: #94a3b8; font-size: 0.9rem; }
code { background: #1e293b; padding: 2px 6px; border-radius: 4px; }
`,
      '.gitignore': GITIGNORE,
      'README.md': `# ${name}\n\n- \`npm run dev\` — live preview\n- \`npm test\` — run the tests\n- \`npm run build\` — build a single-file site into \`dist/\`\n`,
    }),
  },

  'vite-react-ts': {
    name: 'React + TypeScript',
    description: 'React with TypeScript (.tsx), type-checked with `npx tsc`.',
    icon: 'react',
    open: 'src/App.tsx',
    preview: true,
    files: ({ name = 'react-ts-app' } = {}) => ({
      'package.json': pkg(name, {
        type: 'module',
        scripts: { dev: 'vite', build: 'tsc --noEmit && vite build', test: 'vitest run', typecheck: 'tsc --noEmit' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: { typescript: '^5.6.3', vite: '^6.0.0', vitest: '^2.1.8' },
      }),
      'tsconfig.json': `${JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true }, include: ['src'] }, null, 2)}\n`,
      'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      'src/main.tsx': `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
      'src/App.tsx': `import { useState } from 'react';
import { total, type LineItem } from './cart';

const initial: LineItem[] = [
  { name: 'Notebook', price: 4.5, qty: 2 },
  { name: 'Pen', price: 1.2, qty: 5 },
];

export default function App() {
  const [items, setItems] = useState<LineItem[]>(initial);

  const bump = (i: number, delta: number) =>
    setItems((list) => list.map((it, k) => (k === i ? { ...it, qty: Math.max(0, it.qty + delta) } : it)));

  return (
    <main>
      <h1>Shopping cart</h1>
      <table>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.name}>
              <td>{it.name}</td>
              <td>£{it.price.toFixed(2)}</td>
              <td>
                <button onClick={() => bump(i, -1)}>−</button> {it.qty} <button onClick={() => bump(i, 1)}>+</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total">Total: £{total(items).toFixed(2)}</p>
    </main>
  );
}
`,
      'src/cart.ts': `export interface LineItem {
  name: string;
  price: number;
  qty: number;
}

export function total(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
`,
      'src/cart.test.ts': `import { test, expect } from 'vitest';
import { total } from './cart';

test('total multiplies price by quantity', () => {
  expect(total([{ name: 'a', price: 2, qty: 3 }])).toBe(6);
});

test('empty cart costs nothing', () => {
  expect(total([])).toBe(0);
});
`,
      'src/index.css': `body { font-family: system-ui, sans-serif; max-width: 520px; margin: 40px auto; padding: 0 16px; }
table { width: 100%; border-collapse: collapse; }
td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
button { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #d1d5db; background: white; cursor: pointer; }
.total { font-weight: 700; font-size: 1.2rem; }
`,
      '.gitignore': GITIGNORE,
    }),
  },

  'vite-vanilla': {
    name: 'Vanilla JS (Vite)',
    description: 'ES modules without a framework, the `npm create vite` vanilla layout.',
    icon: 'js',
    open: 'main.js',
    preview: true,
    files: ({ name = 'vanilla-app' } = {}) => ({
      'package.json': pkg(name, { type: 'module', scripts: { dev: 'vite', build: 'vite build', test: 'vitest run' } }),
      'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`,
      'main.js': `import './style.css';
import { setupCounter } from './counter.js';

document.querySelector('#app').innerHTML = \`
  <h1>Hello Vite!</h1>
  <div class="card">
    <button id="counter" type="button"></button>
  </div>
  <p>Edit <code>main.js</code> and <code>counter.js</code> to get started.</p>
\`;

setupCounter(document.querySelector('#counter'));
`,
      'counter.js': `export function setupCounter(element) {
  let counter = 0;
  const setCounter = (count) => {
    counter = count;
    element.innerHTML = \`count is \${counter}\`;
  };
  element.addEventListener('click', () => setCounter(counter + 1));
  setCounter(0);
}
`,
      'style.css': `:root { font-family: system-ui, sans-serif; color-scheme: light dark; }
body { display: grid; place-items: center; min-height: 100vh; margin: 0; text-align: center; }
button { padding: 0.6em 1.2em; font-size: 1em; border-radius: 8px; border: 1px solid transparent; background: #646cff; color: white; cursor: pointer; }
`,
      '.gitignore': GITIGNORE,
    }),
  },

  'vite-vue': {
    name: 'Vue 3',
    description: 'A Vue 3 app with components written as template strings.',
    icon: 'vue',
    open: 'src/App.js',
    preview: true,
    files: ({ name = 'vue-app' } = {}) => ({
      'package.json': pkg(name, { type: 'module', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { vue: '^3.5.13' } }),
      'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`,
      'src/main.js': `// The full build of Vue compiles templates in the browser.
import { createApp } from 'vue/dist/vue.esm-browser.js';
import App from './App.js';

createApp(App).mount('#app');
`,
      'src/App.js': `import { ref, computed } from 'vue/dist/vue.esm-browser.js';

export default {
  setup() {
    const items = ref(['Learn Vue', 'Build something']);
    const draft = ref('');
    const count = computed(() => items.value.length);
    const add = () => {
      if (draft.value.trim()) items.value.push(draft.value.trim());
      draft.value = '';
    };
    return { items, draft, count, add };
  },
  template: \`
    <main>
      <h1>Vue 3 · {{ count }} items</h1>
      <form @submit.prevent="add">
        <input v-model="draft" placeholder="New item" />
        <button>Add</button>
      </form>
      <ul><li v-for="item in items" :key="item">{{ item }}</li></ul>
    </main>
  \`,
};
`,
      'src/style.css': `body { font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
form { display: flex; gap: 8px; }
input { flex: 1; padding: 8px; }
button { padding: 8px 14px; background: #42b883; color: white; border: 0; border-radius: 6px; }
`,
    }),
  },

  'node-cli': {
    name: 'Node.js console app',
    description: 'An interactive terminal program with readline, modules and tests.',
    icon: 'node',
    open: 'index.js',
    files: ({ name = 'guess-the-number' } = {}) => ({
      'package.json': pkg(name, { type: 'commonjs', main: 'index.js', scripts: { start: 'node index.js', test: 'vitest run' } }),
      'index.js': `// A number-guessing game. Press Run, then type your guesses in the terminal.
const readline = require('readline/promises');
const { checkGuess } = require('./game');

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const secret = Math.floor(Math.random() * 100) + 1;
  console.log("I'm thinking of a number between 1 and 100.");

  for (let tries = 1; ; tries++) {
    const answer = await rl.question('Your guess: ');
    const result = checkGuess(Number(answer), secret);
    if (result === 'correct') {
      console.log(\`🎉 Correct! You got it in \${tries} tries.\`);
      break;
    }
    console.log(result === 'low' ? 'Too low.' : result === 'high' ? 'Too high.' : 'Please type a number.');
  }
  rl.close();
}

main();
`,
      'game.js': `function checkGuess(guess, secret) {
  if (!Number.isFinite(guess)) return 'invalid';
  if (guess < secret) return 'low';
  if (guess > secret) return 'high';
  return 'correct';
}

module.exports = { checkGuess };
`,
      'game.test.js': `const { checkGuess } = require('./game');

describe('checkGuess', () => {
  test('recognises the right answer', () => {
    expect(checkGuess(42, 42)).toBe('correct');
  });
  test('says when a guess is low or high', () => {
    expect(checkGuess(10, 42)).toBe('low');
    expect(checkGuess(90, 42)).toBe('high');
  });
  test('rejects things that are not numbers', () => {
    expect(checkGuess(NaN, 42)).toBe('invalid');
  });
});
`,
      '.gitignore': GITIGNORE,
    }),
  },

  express: {
    name: 'Node.js + Express API',
    description: 'A REST API with Express and a front-end that calls it — runs fully in the browser.',
    icon: 'server',
    open: 'server.js',
    files: ({ name = 'express-api' } = {}) => ({
      'package.json': pkg(name, { type: 'commonjs', main: 'server.js', scripts: { start: 'node server.js', dev: 'node server.js', test: 'vitest run' }, dependencies: { express: '^4.21.2', cors: '^2.8.5' } }),
      'server.js': `const express = require('express');
const cors = require('cors');
const { createStore } = require('./src/store');

const app = express();
const todos = createStore();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/todos', (req, res) => {
  res.json(todos.list());
});

app.post('/api/todos', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
  res.status(201).json(todos.add(text.trim()));
});

app.patch('/api/todos/:id', (req, res) => {
  const todo = todos.toggle(Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'not found' });
  res.json(todo);
});

app.delete('/api/todos/:id', (req, res) => {
  const ok = todos.remove(Number(req.params.id));
  res.status(ok ? 204 : 404).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
  console.log('Try: curl localhost:3000/api/todos  (in a second terminal tab)');
});
`,
      'src/store.js': `function createStore() {
  let nextId = 1;
  const items = new Map();
  return {
    list: () => [...items.values()],
    add(text) {
      const todo = { id: nextId++, text, done: false };
      items.set(todo.id, todo);
      return todo;
    },
    toggle(id) {
      const todo = items.get(id);
      if (todo) todo.done = !todo.done;
      return todo || null;
    },
    remove: (id) => items.delete(id),
  };
}

module.exports = { createStore };
`,
      'src/store.test.js': `const { createStore } = require('./store');

test('adds and lists todos', () => {
  const store = createStore();
  store.add('write tests');
  expect(store.list()).toHaveLength(1);
  expect(store.list()[0]).toMatchObject({ id: 1, text: 'write tests', done: false });
});

test('toggles and removes', () => {
  const store = createStore();
  const t = store.add('x');
  expect(store.toggle(t.id).done).toBe(true);
  expect(store.remove(t.id)).toBe(true);
  expect(store.list()).toEqual([]);
});
`,
      'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todos (Express)</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <h1>Todos</h1>
  <form id="form"><input id="text" placeholder="New todo" required><button>Add</button></form>
  <ul id="list"></ul>
  <script src="/app.js"></script>
</body>
</html>
`,
      'public/style.css': `body { font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
form { display: flex; gap: 8px; }
input { flex: 1; padding: 8px; }
li { cursor: pointer; padding: 6px 0; }
li.done { text-decoration: line-through; color: #888; }
`,
      'public/app.js': `// The page talks to the Express server with fetch(), exactly as it would in production.
const list = document.getElementById('list');

async function load() {
  const todos = await fetch('/api/todos').then((r) => r.json());
  list.innerHTML = '';
  for (const t of todos) {
    const li = document.createElement('li');
    li.textContent = t.text;
    li.className = t.done ? 'done' : '';
    li.onclick = async () => { await fetch('/api/todos/' + t.id, { method: 'PATCH' }); load(); };
    list.appendChild(li);
  }
}

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('text');
  await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input.value }),
  });
  input.value = '';
  load();
});

load();
`,
      '.gitignore': GITIGNORE,
    }),
  },

  python: {
    name: 'Python',
    description: 'A Python program with input(), a module and pytest tests.',
    icon: 'python',
    open: 'main.py',
    files: () => ({
      'main.py': `"""A tiny gradebook. Press Run and answer the questions in the terminal."""
from grades import average, letter


def main():
    name = input("Student name: ")
    count = int(input("How many scores? "))
    scores = []
    for i in range(count):
        scores.append(float(input(f"Score {i + 1}: ")))

    avg = average(scores)
    print(f"\\n{name}'s average is {avg:.1f} ({letter(avg)})")

    with open("report.txt", "a") as f:
        f.write(f"{name}: {avg:.1f} {letter(avg)}\\n")
    print("Saved to report.txt")


if __name__ == "__main__":
    main()
`,
      'grades.py': `def average(scores):
    if not scores:
        raise ValueError("need at least one score")
    return sum(scores) / len(scores)


def letter(score):
    for cutoff, grade in ((90, "A"), (80, "B"), (70, "C"), (60, "D")):
        if score >= cutoff:
            return grade
    return "F"
`,
      'test_grades.py': `import pytest
from grades import average, letter


def test_average():
    assert average([80, 90, 100]) == 90


def test_average_needs_scores():
    with pytest.raises(ValueError):
        average([])


@pytest.mark.parametrize("score,expected", [(95, "A"), (85, "B"), (72, "C"), (61, "D"), (10, "F")])
def test_letter(score, expected):
    assert letter(score) == expected
`,
      'requirements.txt': '# Add packages here, then run: pip install -r requirements.txt\n',
      '.gitignore': GITIGNORE,
    }),
  },

  'python-data': {
    name: 'Python data analysis',
    description: 'pandas + matplotlib on a CSV file; charts appear in the terminal.',
    icon: 'chart',
    open: 'analysis.py',
    files: () => ({
      'analysis.py': `import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("sales.csv", parse_dates=["date"])
print(df.head(), "\\n")

monthly = df.groupby(df["date"].dt.to_period("M"))["amount"].sum()
print("Revenue by month:")
print(monthly, "\\n")

by_region = df.groupby("region")["amount"].agg(["count", "sum", "mean"]).round(1)
print(by_region)

ax = monthly.plot(kind="bar", title="Monthly revenue", color="#3b82f6")
ax.set_xlabel("")
plt.tight_layout()
plt.show()
`,
      'sales.csv': `date,region,product,amount
2025-01-05,North,Laptop,1200
2025-01-17,South,Monitor,350
2025-01-29,East,Keyboard,85
2025-02-03,North,Monitor,340
2025-02-14,West,Laptop,1150
2025-02-25,South,Laptop,1300
2025-03-02,East,Mouse,40
2025-03-11,West,Keyboard,90
2025-03-21,North,Laptop,1250
2025-03-30,South,Monitor,360
2025-04-08,East,Laptop,1180
2025-04-19,West,Mouse,45
`,
    }),
  },

  cpp: {
    name: 'C++',
    description: 'A C++ console program; interactive cin, real g++ when needed.',
    icon: 'cpp',
    open: 'main.cpp',
    files: () => ({
      'main.cpp': `#include <iostream>
#include <string>
#include <vector>
using namespace std;

int main() {
    string name;
    cout << "What's your name? ";
    getline(cin, name);

    int n;
    cout << "How many numbers? ";
    cin >> n;

    vector<int> numbers;
    for (int i = 0; i < n; i++) {
        int x;
        cout << "Number " << i + 1 << ": ";
        cin >> x;
        numbers.push_back(x);
    }

    int total = 0;
    for (int x : numbers) total += x;

    cout << "Hi " << name << ", the sum is " << total;
    if (n > 0) cout << " and the average is " << (double)total / n;
    cout << endl;
    return 0;
}
`,
    }),
  },

  'cpp-project': {
    name: 'C++ multi-file project',
    description: 'Classes split into header and source files, built with g++.',
    icon: 'cpp',
    open: 'main.cpp',
    files: () => ({
      'main.cpp': `#include <iostream>
#include "BankAccount.h"

int main() {
    BankAccount account("Ada", 100.0);
    account.deposit(50);
    if (!account.withdraw(500)) {
        std::cout << "Insufficient funds for that withdrawal." << std::endl;
    }
    account.withdraw(30);
    account.printStatement();
    return 0;
}
`,
      'BankAccount.h': `#pragma once
#include <string>
#include <vector>

class BankAccount {
public:
    BankAccount(std::string owner, double openingBalance);
    void deposit(double amount);
    bool withdraw(double amount);
    double balance() const { return balance_; }
    void printStatement() const;

private:
    std::string owner_;
    double balance_;
    std::vector<std::string> history_;
};
`,
      'BankAccount.cpp': `#include "BankAccount.h"
#include <iostream>
#include <iomanip>
#include <sstream>

BankAccount::BankAccount(std::string owner, double openingBalance)
    : owner_(std::move(owner)), balance_(openingBalance) {
    history_.push_back("Opened with " + std::to_string(openingBalance));
}

void BankAccount::deposit(double amount) {
    balance_ += amount;
    history_.push_back("Deposit " + std::to_string(amount));
}

bool BankAccount::withdraw(double amount) {
    if (amount > balance_) return false;
    balance_ -= amount;
    history_.push_back("Withdraw " + std::to_string(amount));
    return true;
}

void BankAccount::printStatement() const {
    std::cout << "Statement for " << owner_ << "\\n";
    for (const auto& line : history_) std::cout << "  " << line << "\\n";
    std::cout << std::fixed << std::setprecision(2) << "Balance: " << balance_ << std::endl;
}
`,
      'Makefile': 'app: main.cpp BankAccount.cpp BankAccount.h\n\tg++ main.cpp BankAccount.cpp -o app\n',
    }),
  },

  c: {
    name: 'C',
    description: 'A C program with scanf/printf.',
    icon: 'c',
    open: 'main.c',
    files: () => ({
      'main.c': `#include <stdio.h>

int main(void) {
    int n;
    printf("How many Fibonacci numbers? ");
    scanf("%d", &n);

    long long a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        printf("%lld ", a);
        long long next = a + b;
        a = b;
        b = next;
    }
    printf("\\n");
    return 0;
}
`,
    }),
  },

  java: {
    name: 'Java',
    description: 'A Java program (compiled with OpenJDK on Wandbox).',
    icon: 'java',
    open: 'Main.java',
    files: () => ({
      'Main.java': `import java.util.*;

public class Main {
    record Student(String name, int score) {}

    public static void main(String[] args) {
        List<Student> students = List.of(
            new Student("Ada", 91),
            new Student("Bala", 78),
            new Student("Chen", 85)
        );

        double average = students.stream().mapToInt(Student::score).average().orElse(0);
        Student best = Collections.max(students, Comparator.comparingInt(Student::score));

        System.out.printf("Average score: %.1f%n", average);
        System.out.println("Top student: " + best.name());
    }
}
`,
    }),
  },

  sql: {
    name: 'SQL database',
    description: 'SQLite with a schema, seed data and queries.',
    icon: 'database',
    open: 'queries.sql',
    files: () => ({
      'schema.sql': `CREATE TABLE departments (
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
`,
      'seed.sql': `INSERT INTO departments (id, name, budget) VALUES
  (1, 'Engineering', 1850000),
  (2, 'Sales', 920000),
  (3, 'Finance', 410000);

INSERT INTO employees (name, department_id, role, salary, hired_on) VALUES
  ('Ada Achebe', 1, 'Staff Engineer', 118000, '2019-03-11'),
  ('Bala Nwosu', 1, 'Engineer', 86000, '2021-07-01'),
  ('Chen Wei', 1, 'Engineering Lead', 134000, '2017-01-23'),
  ('Dara Okonkwo', 2, 'Account Executive', 74000, '2020-09-14'),
  ('Emeka Balogun', 2, 'Sales Director', 121000, '2016-05-02'),
  ('Fatima Sule', 3, 'Financial Analyst', 79000, '2022-02-28');
`,
      'queries.sql': `-- Loads the tables and data, then runs the queries below.
-- (".read" works exactly like in the sqlite3 command-line shell.)
.read schema.sql
.read seed.sql

-- Headcount and average salary per department
SELECT d.name AS department,
       COUNT(e.id) AS headcount,
       ROUND(AVG(e.salary)) AS avg_salary
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id
GROUP BY d.id
ORDER BY headcount DESC;

-- Everyone hired since 2020
SELECT name, role, hired_on FROM employees WHERE hired_on >= '2020-01-01' ORDER BY hired_on;
`,
      'README.md': '# SQL practice\n\nPress **Run** on `queries.sql`, or open a persistent database in the terminal:\n\n```bash\nsqlite3 company.db < schema.sql\nsqlite3 company.db < seed.sql\nsqlite3 company.db\nsqlite> .tables\n```\n',
    }),
  },

  typescript: {
    name: 'TypeScript (Node)',
    description: 'TypeScript run with ts-node and type-checked with tsc.',
    icon: 'ts',
    open: 'src/index.ts',
    files: ({ name = 'ts-app' } = {}) => ({
      'package.json': pkg(name, { scripts: { start: 'ts-node src/index.ts', typecheck: 'tsc --noEmit', test: 'vitest run' }, devDependencies: { typescript: '^5.6.3' } }),
      'tsconfig.json': `${JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, outDir: 'dist' }, include: ['src'] }, null, 2)}\n`,
      'src/index.ts': `import { Inventory, type Product } from './inventory';

const inventory = new Inventory();
const items: Product[] = [
  { sku: 'A1', name: 'Keyboard', price: 49.99, stock: 12 },
  { sku: 'B2', name: 'Mouse', price: 19.5, stock: 0 },
  { sku: 'C3', name: 'Monitor', price: 189, stock: 4 },
];
items.forEach((p) => inventory.add(p));

console.log('In stock:', inventory.inStock().map((p) => p.name).join(', '));
console.log('Stock value: $' + inventory.totalValue().toFixed(2));
`,
      'src/inventory.ts': `export interface Product {
  sku: string;
  name: string;
  price: number;
  stock: number;
}

export class Inventory {
  private products = new Map<string, Product>();

  add(product: Product): void {
    this.products.set(product.sku, product);
  }

  inStock(): Product[] {
    return [...this.products.values()].filter((p) => p.stock > 0);
  }

  totalValue(): number {
    let total = 0;
    for (const p of this.products.values()) total += p.price * p.stock;
    return total;
  }
}
`,
      'src/inventory.test.ts': `import { test, expect } from 'vitest';
import { Inventory } from './inventory';

test('values stock correctly', () => {
  const inv = new Inventory();
  inv.add({ sku: 'x', name: 'x', price: 2, stock: 5 });
  expect(inv.totalValue()).toBe(10);
});
`,
      '.gitignore': GITIGNORE,
    }),
  },

  lua: {
    name: 'Lua',
    description: 'A Lua 5.4 script.',
    icon: 'lua',
    open: 'main.lua',
    files: () => ({
      'main.lua': `-- Word frequency counter
local text = "the quick brown fox jumps over the lazy dog the end"
local counts = {}
for word in text:gmatch("%a+") do
  counts[word] = (counts[word] or 0) + 1
end

local words = {}
for w in pairs(counts) do table.insert(words, w) end
table.sort(words, function(a, b) return counts[a] > counts[b] or (counts[a] == counts[b] and a < b) end)

for i = 1, 3 do print(words[i], counts[words[i]]) end
`,
    }),
  },

  game: {
    name: 'Canvas game',
    description: 'A playable Snake game drawn on an HTML canvas.',
    icon: 'game',
    open: 'game.js',
    preview: true,
    files: () => ({
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snake</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Snake</h1>
  <p id="score">Score: 0</p>
  <canvas id="board" width="400" height="400"></canvas>
  <p class="help">Arrow keys or WASD to move · Space to restart</p>
  <script src="game.js"></script>
</body>
</html>
`,
      'style.css': `body { background: #0b1220; color: #e2e8f0; font-family: system-ui, sans-serif; text-align: center; }
canvas { background: #111a2e; border: 2px solid #1e293b; border-radius: 8px; max-width: 95vw; }
.help { color: #64748b; }
`,
      'game.js': `const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const SIZE = 20;
const CELLS = canvas.width / SIZE;

let snake, dir, nextDir, food, score, over;

function reset() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = nextDir = { x: 1, y: 0 };
  score = 0;
  over = false;
  placeFood();
}

function placeFood() {
  do {
    food = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
}

function step() {
  if (over) return;
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  const hitWall = head.x < 0 || head.y < 0 || head.x >= CELLS || head.y >= CELLS;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) { over = true; return; }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) { score++; placeFood(); } else snake.pop();
}

function draw() {
  ctx.fillStyle = '#111a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(food.x * SIZE + 3, food.y * SIZE + 3, SIZE - 6, SIZE - 6);
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? '#4ade80' : '#22c55e';
    ctx.fillRect(s.x * SIZE + 1, s.y * SIZE + 1, SIZE - 2, SIZE - 2);
  });
  scoreEl.textContent = over ? \`Game over! Score: \${score} — press Space\` : \`Score: \${score}\`;
}

document.addEventListener('keydown', (e) => {
  const keys = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
  if (e.key === ' ') { reset(); return; }
  const k = keys[e.key];
  if (!k) return;
  e.preventDefault();
  if (k[0] !== -dir.x || k[1] !== -dir.y) nextDir = { x: k[0], y: k[1] };
});

reset();
setInterval(() => { step(); draw(); }, 110);
`,
    }),
  },
};

/** Order shown on the landing page. */
export const TEMPLATE_ORDER = ['web', 'vite-react', 'express', 'node-cli', 'python', 'python-data', 'cpp', 'cpp-project', 'c', 'java', 'sql', 'typescript', 'vite-react-ts', 'vite-vanilla', 'vite-vue', 'game', 'lua', 'blank'];

export function instantiateTemplate(key, opts = {}) {
  const t = TEMPLATES[key] || TEMPLATES.blank;
  return { files: t.files(opts), open: t.open, preview: Boolean(t.preview), name: t.name };
}
