import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeUserFacingText, cleanText } from '../../js/utils.js';

test('sanitizeUserFacingText: strips invisible and zero-width characters', () => {
  const dirty = 'Hello\u200B \u200CWorld\uFEFF!\u200D';
  const sanitized = sanitizeUserFacingText(dirty);
  assert.equal(sanitized, 'Hello World!');
});

test('sanitizeUserFacingText: strips non-printable control characters while keeping newlines and tabs', () => {
  const dirty = 'Line 1\x00\x07\x1F\n\tIndented Line 2\x08';
  const sanitized = sanitizeUserFacingText(dirty);
  assert.equal(sanitized, 'Line 1\n\tIndented Line 2');
});

test('sanitizeUserFacingText: preserves markdown backticks and code blocks without modification', () => {
  const code = 'Here is code:\n```javascript\nconst a = `hello ${name}`;\nconst b = 42;\n```';
  const sanitized = sanitizeUserFacingText(code);
  assert.equal(sanitized, code);
  assert.ok(sanitized.includes('```javascript'));
  assert.ok(sanitized.includes('`hello ${name}`'));
});

test('sanitizeUserFacingText: preserves code indentation and whitespace', () => {
  const indented = 'function test() {\n    const x = 1;\n    if (x) {\n        return true;\n    }\n}';
  const sanitized = sanitizeUserFacingText(indented, { preserveWhitespace: true });
  assert.equal(sanitized, indented);
});

test('cleanText: keeps backticks intact while cleaning smart quotes and invisible chars', () => {
  const text = '“Smart Quote” and `backtick_code` \u200B';
  const cleaned = cleanText(text);
  assert.ok(cleaned.includes('`backtick_code`'), 'Backticks must NOT be converted to single quotes');
  assert.ok(cleaned.includes('"Smart Quote"'), 'Smart double quotes converted to standard ASCII quotes');
});
