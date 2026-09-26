import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { readStylesheet } from '../helpers/stylesheet.js';

test('Fit Screen Tools: isFitScreenTool accurately classifies tools in app.js', () => {
  const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf-8');

  // isFitScreenTool and LONG_CONTENT_TOOL_IDS must exist in app.js
  assert.ok(
    appJs.includes('isFitScreenTool') && appJs.includes('LONG_CONTENT_TOOL_IDS'),
    'app.js must define and export isFitScreenTool and LONG_CONTENT_TOOL_IDS'
  );

  // openTool must toggle tool-fit-screen class
  assert.ok(
    appJs.includes("document.body.classList.toggle('tool-fit-screen', isFitScreenTool(id))"),
    'openTool must toggle tool-fit-screen on document.body'
  );

  // teardownTool and showPage must remove tool-fit-screen
  assert.ok(
    appJs.includes("document.body.classList.remove('tool-fit-screen')"),
    'showPage and teardownTool must remove tool-fit-screen on document.body'
  );
});

test('Fit Screen Tools: Desktop non-scrollable outer container rules defined in CSS', () => {
  const css = readStylesheet();
  const desktop = css.match(/@media \(min-width: 769px\) \{([\s\S]*?)\n\}/);
  assert.ok(desktop, 'css/style.css must have a desktop media query');
  const block = desktop[1];

  assert.ok(
    /body\.in-tool\.tool-fit-screen #main\s*\{[^}]*height:\s*calc\(100dvh - var\(--header-h\)\)[^}]*overflow:\s*hidden/.test(block),
    'Fit-screen tools must lock #main to the viewport below the header'
  );
  assert.ok(
    /body\.in-tool\.tool-fit-screen #tool-viewport\s*\{[^}]*height:\s*100%/.test(block),
    'Fit-screen #tool-viewport must fill #main'
  );
  assert.ok(
    /body\.in-tool\.tool-fit-screen #viewport-content\s*\{[^}]*overflow:\s*auto/.test(block),
    'Fit-screen tools must scroll inside #viewport-content'
  );
});

