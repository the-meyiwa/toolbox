import test from 'node:test';
import assert from 'node:assert/strict';
import { toolboxHelp, TOOLBOX_HELP_DECLARATION } from '../../js/lib/assistant/toolbox-guide.js';
import { CORE_TOOLS } from '../../js/lib/assistant/tool-groups.js';

test('the Assistant always has the Toolbox guide at hand', () => {
  assert.ok(CORE_TOOLS.includes('toolbox_help'));
  assert.equal(TOOLBOX_HELP_DECLARATION.name, 'toolbox_help');
});

test('questions about using Toolbox find the right sections', () => {
  const cases = { 'move a file to online files': 'Files', 'change the theme to dark': 'Settings', 'keyboard shortcut to search': 'Keyboard shortcuts', 'assistant daily limit': 'The Assistant', 'reset my password': 'Account and sign-in' };
  for (const [q, title] of Object.entries(cases)) {
    assert.ok(toolboxHelp(q).sections.some(s => s.title === title), `${q} → ${title}`);
  }
  assert.ok(toolboxHelp('').topics.length > 5);
});
