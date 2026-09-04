/* ============================================================
   TOOLBOX — Assistant Tool Declarations Schema Validation Test
   Verifies that all tool definitions conform strictly to Gemini
   and OpenAPI specifications:
   - Valid data types on all properties
   - Mandatory 'items' field on every ARRAY schema (including nested arrays)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ASSISTANT_TOOL_DECLARATIONS } from '../../js/lib/assistant-tools.js';
import { toolDiscovery } from '../../js/lib/assistant-tool-discovery.js';

const VALID_TYPES = new Set(['STRING', 'NUMBER', 'INTEGER', 'BOOLEAN', 'ARRAY', 'OBJECT']);

function validateSchema(propName, schema, path = '', errors = []) {
  if (!schema || typeof schema !== 'object') return;
  const currentPath = path ? `${path}.${propName}` : propName;

  if (!schema.type) {
    errors.push(`Missing 'type' on property at ${currentPath}`);
  } else {
    const t = String(schema.type).toUpperCase();
    if (!VALID_TYPES.has(t)) {
      errors.push(`Invalid type '${schema.type}' at ${currentPath}`);
    }
  }

  const type = schema.type ? String(schema.type).toUpperCase() : null;
  if (type === 'ARRAY') {
    if (!schema.items || typeof schema.items !== 'object') {
      errors.push(`Missing 'items' on ARRAY property at ${currentPath}`);
    } else {
      validateSchema('items', schema.items, currentPath, errors);
    }
  }

  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, val] of Object.entries(schema.properties)) {
      validateSchema(key, val, currentPath, errors);
    }
  }

  return errors;
}

test('Assistant Tool Declarations: calculate_math matrix schema has valid nested items', () => {
  const calcMath = ASSISTANT_TOOL_DECLARATIONS.find(t => t.name === 'calculate_math');
  assert.ok(calcMath, 'calculate_math declaration must exist');
  assert.ok(calcMath.parameters, 'calculate_math must have parameters');
  assert.ok(calcMath.parameters.properties, 'calculate_math must have properties');
  assert.ok(calcMath.parameters.properties.matrix, 'matrix property must exist');

  const matrix = calcMath.parameters.properties.matrix;
  assert.equal(matrix.type.toUpperCase(), 'ARRAY');
  assert.ok(matrix.items, 'matrix must define items');
  assert.equal(matrix.items.type.toUpperCase(), 'ARRAY');
  assert.ok(matrix.items.items, 'nested matrix items must define items');
  assert.equal(matrix.items.items.type.toUpperCase(), 'NUMBER');
});

test('Assistant Tool Declarations: all 180+ tools conform to Gemini API schema standards', () => {
  const allErrors = [];

  for (let i = 0; i < ASSISTANT_TOOL_DECLARATIONS.length; i++) {
    const tool = ASSISTANT_TOOL_DECLARATIONS[i];
    if (tool.parameters) {
      validateSchema(`ASSISTANT_TOOL_DECLARATIONS[${i}]:${tool.name}`, tool.parameters, '', allErrors);
    }
  }

  const llmDecls = toolDiscovery.generateLLMDeclarations();
  for (let i = 0; i < llmDecls.length; i++) {
    const item = llmDecls[i];
    for (const fn of (item.functionDeclarations || [])) {
      if (fn.parameters) {
        validateSchema(`llmDecl[${i}]:${fn.name}`, fn.parameters, '', allErrors);
      }
    }
  }

  const navDecls = toolDiscovery.generateNavigationDeclarations();
  for (let i = 0; i < navDecls.length; i++) {
    const fn = navDecls[i];
    if (fn.parameters) {
      validateSchema(`navDecl[${i}]:${fn.name}`, fn.parameters, '', allErrors);
    }
  }

  assert.deepEqual(allErrors, [], `Found schema validation errors:\n${allErrors.join('\n')}`);
});

test('Assistant Tool Declarations: all tool declaration names are strictly unique', () => {
  const seen = new Set();
  const duplicates = [];
  for (const tool of ASSISTANT_TOOL_DECLARATIONS) {
    if (seen.has(tool.name)) {
      duplicates.push(tool.name);
    }
    seen.add(tool.name);
  }
  assert.deepEqual(duplicates, [], `Found duplicate tool declarations: ${duplicates.join(', ')}`);
});
