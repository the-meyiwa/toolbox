/* Chat-owned, declarative tools. No generated JavaScript, HTML, network or storage access. */
import { getCurrentUser } from '../supabase.js';

const OPERATIONS = ['calculate', 'template', 'uppercase', 'lowercase', 'titlecase', 'trim', 'slug', 'word_count', 'character_count', 'sort_lines', 'unique_lines', 'replace'];
const IDENTIFIER = /^[a-z][a-z0-9_]{0,39}$/;
const RESERVED = new Set(['constructor', 'prototype', '__proto__']);
const text = (v, max = 400) => String(v ?? '').slice(0, max);
function identifier(value) {
  if (!IDENTIFIER.test(value || '') || RESERVED.has(value)) throw new Error('Use a short lowercase identifier beginning with a letter.');
  return value;
}

export function validateChatTool(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('A tool definition is required.');
  if (!Array.isArray(raw.inputs) || raw.inputs.length > 12 || !Array.isArray(raw.outputs) || !raw.outputs.length || raw.outputs.length > 8) throw new Error('Tools support up to 12 inputs and 1–8 outputs.');
  const ids = new Set();
  const inputs = raw.inputs.map(input => {
    const id = identifier(input.id);
    if (ids.has(id)) throw new Error('Input identifiers must be unique.');
    ids.add(id);
    if (!['text', 'number', 'select'].includes(input.type)) throw new Error('Inputs must be text, number or select.');
    const options = input.type === 'select' ? (Array.isArray(input.options) ? input.options.slice(0, 30).map(v => text(v, 100)) : []) : undefined;
    if (options && !options.length) throw new Error('Select inputs need options.');
    return { id, label: text(input.label || id, 80), type: input.type, defaultValue: text(input.defaultValue, 1000), ...(options ? { options } : {}) };
  });
  const outputs = raw.outputs.map(output => {
    if (!OPERATIONS.includes(output.operation)) throw new Error('Unsupported tool operation.');
    if (!['calculate', 'template'].includes(output.operation) && !ids.has(output.source)) throw new Error('Choose an existing input for each text operation.');
    if (output.operation === 'calculate' && !/^[\w\s.+*/%()^,\-]+$/.test(output.expression || '')) throw new Error('A mathematical expression is required.');
    return { label: text(output.label || 'Result', 80), operation: output.operation, source: text(output.source, 40), expression: text(output.expression, 1000), template: text(output.template, 4000), find: text(output.find, 1000), replacement: text(output.replacement, 1000), decimals: Math.max(0, Math.min(10, Number.isInteger(output.decimals) ? output.decimals : 4)) };
  });
  return { id: identifier(raw.id), name: text(raw.name || raw.id, 80), description: text(raw.description, 400), inputs, outputs };
}

/** Bounded arithmetic parser: every character is consumed; identifiers never resolve on globals. */
export function calculateChatExpression(expression, values = {}) {
  if (typeof expression !== 'string' || expression.length > 1000) throw new Error('Expression is too long.');
  const source = expression.trim(), tokens = [], re = /\s*(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+|[a-z][a-z0-9_]*|[+*/%()^,\-])/iy;
  let at = 0;
  while (at < source.length) { re.lastIndex = at; const m = re.exec(source); if (!m) throw new Error('Unsupported expression syntax.'); tokens.push(m[1]); at = re.lastIndex; if (tokens.length > 256) throw new Error('Expression is too complex.'); }
  let pos = 0;
  const funcs = { abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round, sqrt: Math.sqrt, min: Math.min, max: Math.max, pow: Math.pow };
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
  function parse(min = 0, depth = 0) {
    if (depth > 32) throw new Error('Expression is too deeply nested.');
    const token = tokens[pos++];
    let left;
    if (token === '-' || token === '+') left = (token === '-' ? -1 : 1) * parse(3, depth + 1);
    else if (token === '(') { left = parse(0, depth + 1); if (tokens[pos++] !== ')') throw new Error('Missing closing parenthesis.'); }
    else if (token && /^(\d|\.)/.test(token)) left = Number(token);
    else if (token && Object.hasOwn(funcs, token) && tokens[pos] === '(') {
      pos++; const args = [parse(0, depth + 1)];
      while (tokens[pos] === ',') { pos++; args.push(parse(0, depth + 1)); }
      if (tokens[pos++] !== ')' || args.length > 12) throw new Error('Invalid function arguments.');
      if (!['min', 'max'].includes(token) && args.length !== (token === 'pow' ? 2 : 1)) throw new Error('Incorrect number of function arguments.');
      left = funcs[token](...args);
    } else if (token && !RESERVED.has(token) && Object.hasOwn(values, token)) left = Number(values[token]);
    else throw new Error(`Unknown value: ${token || 'empty expression'}.`);
    while (Object.hasOwn(precedence, tokens[pos]) && precedence[tokens[pos]] >= min) {
      const op = tokens[pos++], right = parse(precedence[op] + (op === '^' ? 0 : 1), depth + 1);
      if ((op === '/' || op === '%') && right === 0) throw new Error('Cannot divide by zero.');
      left = op === '+' ? left + right : op === '-' ? left - right : op === '*' ? left * right : op === '/' ? left / right : op === '%' ? left % right : left ** right;
    }
    if (!Number.isFinite(left)) throw new Error('Enter finite numbers with a valid result.');
    return left;
  }
  const result = parse();
  if (pos !== tokens.length) throw new Error('Unexpected expression input.');
  return result;
}

export function runChatTool(definition, supplied = {}) {
  const tool = validateChatTool(definition), values = Object.create(null);
  for (const input of tool.inputs) {
    const value = Object.hasOwn(supplied, input.id) ? supplied[input.id] : input.defaultValue;
    if (input.type === 'number' && (String(value).trim() === '' || !Number.isFinite(Number(value)))) throw new Error(`Enter a number for ${input.label}.`);
    if (input.type === 'select' && !input.options.includes(String(value))) throw new Error(`Choose an option for ${input.label}.`);
    values[input.id] = input.type === 'number' ? Number(value) : text(value, 12000);
  }
  return tool.outputs.map(output => {
    const source = String(values[output.source] ?? ''); let value;
    switch (output.operation) {
      case 'calculate': value = Number(calculateChatExpression(output.expression, values).toFixed(output.decimals)); break;
      case 'template': value = output.template.replace(/\{([a-z][a-z0-9_]*)\}/g, (_, id) => Object.hasOwn(values, id) ? String(values[id]) : ''); break;
      case 'uppercase': value = source.toUpperCase(); break;
      case 'lowercase': value = source.toLowerCase(); break;
      case 'titlecase': value = source.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()); break;
      case 'trim': value = source.trim(); break;
      case 'slug': value = source.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); break;
      case 'word_count': value = source.trim().split(/\s+/).filter(Boolean).length; break;
      case 'character_count': value = [...source].length; break;
      case 'sort_lines': value = source.split(/\r?\n/).sort((a, b) => a.localeCompare(b)).join('\n'); break;
      case 'unique_lines': value = [...new Set(source.split(/\r?\n/))].join('\n'); break;
      case 'replace': value = output.find ? source.split(output.find).join(output.replacement) : source; break;
    }
    return { label: output.label, value: typeof value === 'string' ? value.slice(0, 24000) : value };
  });
}

export const CHAT_TOOL_DECLARATIONS = [
  { name: 'create_chat_tool', description: 'Build or revise a reusable interactive mini-tool saved ONLY in this Assistant chat. Supports calculators, text transformers and templates; no scripts, files or network. Reuse the same id to revise. Inputs: number/text/select. Outputs: calculate expressions reference input ids (+ - * / % ^, parentheses, abs/round/floor/ceil/sqrt/min/max/pow); template uses {input_id}; other operations use source input id.', parameters: { type: 'OBJECT', properties: {
    id: { type: 'STRING' }, name: { type: 'STRING' }, description: { type: 'STRING' },
    inputs: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, label: { type: 'STRING' }, type: { type: 'STRING', enum: ['number', 'text', 'select'] }, defaultValue: { type: 'STRING' }, options: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['id', 'label', 'type'] } },
    outputs: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, operation: { type: 'STRING', enum: OPERATIONS }, source: { type: 'STRING' }, expression: { type: 'STRING' }, template: { type: 'STRING' }, find: { type: 'STRING' }, replacement: { type: 'STRING' }, decimals: { type: 'INTEGER' } }, required: ['label', 'operation'] } },
  }, required: ['id', 'name', 'inputs', 'outputs'] } },
  { name: 'list_chat_tools', description: 'List mini-tools saved in this chat only.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'run_chat_tool', description: 'Run and show a mini-tool owned by this chat. Values are JSON object text keyed by input id; omit to show its defaults.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, values: { type: 'STRING' } }, required: ['id'] } },
];

export async function executeChatTool(name, args, taskState) {
  const scope = taskState?.chatScope;
  if (!scope?.conversationId || !scope.ownerId || getCurrentUser()?.id !== scope.ownerId || !scope.isActive?.()) throw new Error('Open the originating Assistant chat to use its tools.');
  const tools = scope.getTools();
  if (name === 'list_chat_tools') return { status: 'success', tools: tools.map(validateChatTool), message: tools.length ? 'These tools belong only to this chat.' : 'This chat has no custom tools yet.' };
  let tool;
  if (name === 'create_chat_tool') {
    tool = validateChatTool(args);
    if (tools.length >= 12 && !tools.some(t => t.id === tool.id)) throw new Error('This chat already has 12 tools. Revise an existing tool.');
    scope.saveTool(tool);
  } else {
    tool = tools.find(t => t.id === args.id);
    if (!tool) throw new Error('That tool does not belong to this chat.');
    tool = validateChatTool(tool);
  }
  let values = {};
  if (args.values) { values = JSON.parse(args.values); if (!values || Array.isArray(values) || typeof values !== 'object') throw new Error('Values must be a JSON object.'); }
  let outputs = [];
  try { outputs = runChatTool(tool, values); } catch (error) { if (args.values) throw error; }
  return { status: 'success', renderer: 'chat-tool', type: 'chat-tool', conversationId: scope.conversationId, ownerId: scope.ownerId, tool, values, outputs, message: `${tool.name} is ready in this chat.` };
}

/** Built-in controls, textContent output and a bounded evaluator keep generated tools inert. */
export function renderChatTool(data, container) {
  const tool = validateChatTool(data.tool), card = document.createElement('section');
  card.className = 'astc ast-chat-tool';
  const heading = document.createElement('h4'); heading.textContent = tool.name; card.appendChild(heading);
  const sub = document.createElement('p'); sub.className = 'ast-chat-tool-description'; sub.textContent = tool.description || 'Made for this chat'; card.appendChild(sub);
  const form = document.createElement('form'), controls = new Map();
  for (const field of tool.inputs) {
    const label = document.createElement('label'), title = document.createElement('span'); title.textContent = field.label; label.appendChild(title);
    const control = document.createElement(field.type === 'select' ? 'select' : field.type === 'text' ? 'textarea' : 'input');
    if (field.type === 'number') { control.type = 'number'; control.step = 'any'; }
    if (field.type === 'select') for (const value of field.options) { const option = document.createElement('option'); option.value = value; option.textContent = value; control.appendChild(option); }
    control.value = String(data.values?.[field.id] ?? field.defaultValue ?? (field.options?.[0] || ''));
    if ('maxLength' in control) control.maxLength = 12000;
    controls.set(field.id, control); label.appendChild(control); form.appendChild(label);
  }
  const button = document.createElement('button'); button.type = 'submit'; button.className = 'btn btn-primary btn-sm'; button.textContent = 'Run tool'; form.appendChild(button);
  const result = document.createElement('div'); result.className = 'ast-chat-tool-results'; result.setAttribute('aria-live', 'polite');
  const caption = document.createElement('small'); caption.textContent = 'Saved only to this chat · Runs on your device';
  const show = (outputs) => { result.replaceChildren(); for (const out of outputs) { const row = document.createElement('div'), label = document.createElement('strong'), value = document.createElement('output'); label.textContent = out.label; value.textContent = String(out.value); row.append(label, value); result.appendChild(row); } };
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (getCurrentUser()?.id !== data.ownerId || container.closest?.('[data-chat-id]')?.dataset.chatId !== data.conversationId) { result.textContent = 'This tool is available only in its original chat.'; return; }
    try { show(runChatTool(tool, Object.fromEntries([...controls].map(([id, control]) => [id, control.value])))); }
    catch (error) { result.textContent = error.message; }
  });
  show(data.outputs || []); card.append(form, result, caption); container.appendChild(card); return card;
}
