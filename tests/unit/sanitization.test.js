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

test('sanitizeUserFacingText: converts HTML entities and unicode escapes into visual characters', () => {
  const input = 'Temperature is 25&deg;C with &plusmn;2&deg;C variation and &rarr; symbol';
  const sanitized = sanitizeUserFacingText(input);
  assert.equal(sanitized, 'Temperature is 25°C with ±2°C variation and → symbol');

  const unicodeEscaped = 'Delta \\u2192 reaction at 100\\u00b0C';
  const sanitizedUnicode = sanitizeUserFacingText(unicodeEscaped);
  assert.equal(sanitizedUnicode, 'Delta → reaction at 100°C');
});

test('sanitizeUserFacingText: cleans escaped currencies and normalizes pseudo-symbols outside code', () => {
  const input = 'Cost is \\₦50,000 +/- 10% and flow goes A -> B but code `x -> y`';
  const sanitized = sanitizeUserFacingText(input);
  assert.ok(sanitized.includes('₦50,000'), 'Escaped Naira symbol unescaped');
  assert.ok(sanitized.includes('± 10%'), '+/- converted to ±');
  assert.ok(sanitized.includes('A → B'), '-> converted to → in prose');
  assert.ok(sanitized.includes('`x -> y`'), 'Inline code block preserved without mangling');
});

test('sanitizeUserFacingText: decodes space entities (&#x20;, &#32;, &nbsp;) without leakage and preserves XSS safety', () => {
  const input = 'Nearest&#x20;Ebeano&nbsp;Supermarket&#32;Lekki&amp;#x20;Branch';
  const sanitized = sanitizeUserFacingText(input, { preserveWhitespace: false });
  assert.equal(sanitized, 'Nearest Ebeano Supermarket Lekki Branch');
  assert.ok(!sanitized.includes('&#x20;'), 'Must not contain &#x20;');
  assert.ok(!sanitized.includes('&nbsp;'), 'Must not contain &nbsp;');

  // XSS protection
  const malicious = '&#60;script&#62;alert(1)&#60;/script&#62; and &#x3c;img src=x&#x3e;';
  const safe = sanitizeUserFacingText(malicious);
  assert.ok(!safe.includes('<script>'), 'Must NOT unescape dangerous <script> tags');
  assert.ok(!safe.includes('<img>'), 'Must NOT unescape dangerous <img> tags');
});


