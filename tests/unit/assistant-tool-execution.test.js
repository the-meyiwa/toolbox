import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAssistantTool, ASSISTANT_TOOL_DECLARATIONS } from '../../js/lib/assistant-tools.js';

// Setup minimal globals for Node testing
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { hash: '' },
    open: () => {}
  };
}

test('Tool Declarations: contains required operational tool schemas', () => {
  const toolNames = ASSISTANT_TOOL_DECLARATIONS.map(t => t.name);
  assert.ok(toolNames.includes('pdf_process'), 'Includes pdf_process');
  assert.ok(toolNames.includes('convert_pdf_to_word'), 'Includes convert_pdf_to_word');
  assert.ok(toolNames.includes('generate_qr_code'), 'Includes generate_qr_code');
  assert.ok(toolNames.includes('visualize_data'), 'Includes visualize_data');
  assert.ok(toolNames.includes('slug_generator'), 'Includes slug_generator');
  assert.ok(toolNames.includes('simulate_logic_circuit'), 'Includes simulate_logic_circuit');
  assert.ok(toolNames.includes('generate_flowchart'), 'Includes generate_flowchart');
  assert.ok(toolNames.includes('generate_csv'), 'Includes generate_csv');
  assert.ok(toolNames.includes('csv_to_json'), 'Includes csv_to_json');
});

test('QR Code: generates QR data URL for text/url query', async () => {
  const result = await executeAssistantTool('generate_qr_code', { text: 'https://apple.com' });
  assert.equal(result.status, 'success');
  assert.equal(result.type, 'image');
  assert.equal(result.renderer, 'image');
  assert.ok(result.dataUrl.startsWith('data:image/png;base64,'));
  assert.equal(result.text, 'https://apple.com');
});

test('Slug Generator: converts title into clean URL slug in dedicated transform structure', async () => {
  const result = await executeAssistantTool('slug_generator', { text: 'Hello World & AI Toolbox 2026!' });
  assert.equal(result.status, 'success');
  assert.equal(result.type, 'transform');
  assert.equal(result.renderer, 'transform');
  assert.equal(result.resultText, 'hello-world-ai-toolbox-2026');
});

test('Data Visualization: generates Fibonacci sequence chart without needing CSV file', async () => {
  const result = await executeAssistantTool('visualize_data', { sequence: 'fibonacci', count: 10 });
  assert.equal(result.status, 'success');
  assert.equal(result.type, 'chart');
  assert.equal(result.renderer, 'chart');
  assert.equal(result.title, 'Fibonacci Sequence');
  assert.equal(result.labels.length, 10);
  assert.equal(result.datasets[0].data[0], 0);
  assert.equal(result.datasets[0].data[1], 1);
  assert.equal(result.datasets[0].data[6], 8);
});

test('Logic Lab: builds circuit model and returns unified truth table', async () => {
  const result = await executeAssistantTool('simulate_logic_circuit', { circuitType: 'halfAdder' });
  assert.equal(result.status, 'success');
  assert.equal(result.type, 'circuit');
  assert.equal(result.renderer, 'circuit');
  assert.ok(result.circuit.nodes.length > 0);
  assert.ok(result.truthTable.headers.length > 0);
  assert.equal(result.truthTable.rows.length, 4); // 2 inputs -> 4 rows
});

test('Flowchart: generates flowchart node graph from algorithm specification', async () => {
  const result = await executeAssistantTool('generate_flowchart', {
    title: 'Fibonacci Algorithm',
    code: 'def fib(n): return [0, 1]...'
  });
  assert.equal(result.status, 'success');
  assert.equal(result.type, 'flowchart');
  assert.equal(result.renderer, 'flowchart');
  assert.ok(result.nodes.length > 0);
});

test('CSV & JSON Workflow: generates CSV dataset and chains into csv_to_json tool', async () => {
  const taskState = {};
  
  // Step 1: Generate CSV
  const csvRes = await executeAssistantTool('generate_csv', {
    headers: ['id', 'product', 'price'],
    rows: [
      ['1', 'Toolbox Pro', '29'],
      ['2', 'Assistant AI', '49']
    ],
    filename: 'products.csv'
  }, { taskState });

  assert.equal(csvRes.status, 'success');
  assert.equal(csvRes.type, 'file');
  assert.ok(taskState.lastCsvText.includes('Toolbox Pro'));

  // Step 2: Convert CSV to JSON directly using chained taskState
  const jsonRes = await executeAssistantTool('csv_to_json', {}, { taskState });
  assert.equal(jsonRes.status, 'success');
  assert.equal(jsonRes.type, 'json');
  assert.equal(jsonRes.renderer, 'json');
  assert.equal(jsonRes.rowCount, 2);
  assert.equal(jsonRes.json[0].product, 'Toolbox Pro');
  assert.equal(jsonRes.json[0].price, 29);
});

test('PDF Conversion: returns needs_file prompt if no PDF is attached', async () => {
  const result = await executeAssistantTool('convert_pdf_to_word', {});
  assert.equal(result.status, 'needs_file');
  assert.ok(result.message.toLowerCase().includes('upload') || result.message.toLowerCase().includes('drag & drop'));
});

test('Code to Flowchart: parses arbitrary Python & JS code into structured AST nodes', async () => {
  const { parseCodeToNodes } = await import('../../js/lib/flowchart.js');
  
  const pyCode = `
# Calculate discount
price = 100
if price > 50:
    discount = 10
    print("Discount applied")
else:
    discount = 0
`;
  const nodes = parseCodeToNodes(pyCode);
  assert.ok(nodes.length >= 2, 'Parsed nodes from Python code');
  const ifNode = nodes.find(n => n.kind === 'if');
  assert.ok(ifNode, 'Identified if decision branch');
  assert.equal(ifNode.cond, 'price > 50');
  assert.ok(ifNode.then.length > 0, 'Populated true branch');
  assert.ok(ifNode.else.length > 0, 'Populated false branch');
});

