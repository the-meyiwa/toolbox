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

  // Must have media query for min-width 769px
  assert.ok(
    css.includes('@media (min-width: 769px)'),
    'css/style.css must have desktop media query'
  );

  // #main containment for messaging, calendar, calculator, notes, timer
  assert.ok(
    css.includes('body[data-tool-id="messaging"] #main') &&
    css.includes('body[data-tool-id="calendar"] #main') &&
    css.includes('body[data-tool-id="calculator"] #main') &&
    css.includes('body[data-tool-id="notes"] #main') &&
    css.includes('body[data-tool-id="timer"] #main'),
    'Desktop CSS must lock #main for messaging, calendar, calculator, notes, and timer'
  );

  // tool-fit-screen class support for all simple container tools
  assert.ok(
    css.includes('body.tool-fit-screen #main') &&
    css.includes('height: calc(100dvh - var(--header-h, 57px)) !important;') &&
    css.includes('overflow: hidden !important;'),
    'body.tool-fit-screen #main must be height 100dvh minus header and overflow: hidden'
  );

  // #tool-viewport containment
  assert.ok(
    css.includes('body.tool-fit-screen #tool-viewport') &&
    css.includes('body[data-tool-id="messaging"] #tool-viewport') &&
    css.includes('body[data-tool-id="calendar"] #tool-viewport') &&
    css.includes('body[data-tool-id="calculator"] #tool-viewport'),
    'Desktop CSS must contain #tool-viewport for fit-screen tools'
  );

  // Messaging full height
  assert.ok(
    css.includes('body[data-tool-id="messaging"] .messaging-app') &&
    css.includes('height: 100% !important;'),
    'Desktop messaging-app must have height: 100% !important'
  );

  // Calendar full height with auto-rows
  assert.ok(
    css.includes('body[data-tool-id="calendar"] .calendar-app-wrapper') &&
    css.includes('body[data-tool-id="calendar"] .cal-days-grid') &&
    css.includes('grid-auto-rows: 1fr !important;'),
    'Desktop calendar must use grid-auto-rows: 1fr to fit month grid on one screen'
  );

  // Calculator full height
  assert.ok(
    css.includes('body[data-tool-id="calculator"] .calc-wrapper') &&
    css.includes('height: 100% !important;'),
    'Desktop calc-wrapper must have height: 100% !important'
  );
});
