/* ============================================================
   Instruction Semantics, Authority & Execution Discipline Tests
   Validates:
   - Instruction classification: command, development, information, workspace, mixed, ambiguous
   - Execution modes: literal, autonomous, none, mixed
   - Action-level authority and lifecycle
   - Shell parsing: compound operators, quotes, redirects, flags
   - Constraint extraction: package managers, frameworks, dependencies, exact commands
   - Prevention of literal execution for informational queries
   - Decomposition of multi-step sequential tasks
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTRUCTION_KINDS,
  EXECUTION_MODES,
  ACTION_LIFECYCLE,
  InstructionIntent,
  classifyInstruction,
  extractConstraints,
  extractTargets,
  parseShellTokens,
  splitShellCompound,
  isPlausibleExecutableCommand,
  hasShellSyntaxIndicators
} from '../../js/lib/instruction-semantics.js';

test('Shell Parser: splits compound operators respecting quotes', () => {
  const compound = splitShellCompound('npm run build && npm test || echo "failed; please retry"');
  assert.equal(compound.length, 3);
  assert.equal(compound[0].segment, 'npm run build');
  assert.equal(compound[0].op, '&&');
  assert.equal(compound[1].segment, 'npm test');
  assert.equal(compound[1].op, '||');
  assert.equal(compound[2].segment, 'echo "failed; please retry"');
  assert.equal(compound[2].op, null);
});

test('Shell Parser: parses shell tokens preserving quoted arguments', () => {
  const tokens = parseShellTokens('git commit -m "feat(ui): add new navbar" --author="Test <test@example.com>"');
  assert.deepEqual(tokens, [
    'git',
    'commit',
    '-m',
    '"feat(ui): add new navbar"',
    '--author="Test <test@example.com>"'
  ]);
});

test('Command Detection: identifies plausible executable commands', () => {
  assert.ok(isPlausibleExecutableCommand('npm install react'));
  assert.ok(isPlausibleExecutableCommand('git status'));
  assert.ok(isPlausibleExecutableCommand('npx create-react-app my-app'));
  assert.ok(isPlausibleExecutableCommand('node ./scripts/build.js'));
  assert.ok(isPlausibleExecutableCommand('cat package.json | grep react'));
  assert.ok(!isPlausibleExecutableCommand('What does npm install do?'));
  assert.ok(!isPlausibleExecutableCommand('Explain why this build failed'));
  assert.ok(!isPlausibleExecutableCommand('Create a modern dashboard with dark mode'));
});

test('Constraints: extracts declared package manager, tool, and safety constraints', () => {
  const c1 = extractConstraints('Create a Vite app using pnpm, not npm. Do not install any dependencies.');
  assert.equal(c1.packageManager, 'pnpm');
  assert.equal(c1.tool, 'vite');
  assert.equal(c1.noDependencies, true);

  const c2 = extractConstraints('Run exactly this command without modifying package.json: npm test');
  assert.equal(c2.exact, true);
  assert.equal(c2.noModifyPackageJson, true);
});

test('Targets: extracts referenced file targets', () => {
  const targets = extractTargets('Check src/App.jsx and update package.json then verify index.html');
  assert.ok(targets.includes('src/App.jsx'));
  assert.ok(targets.includes('package.json'));
  assert.ok(targets.includes('index.html'));
});

test('Classification: Explicit Command Execution (Literal)', () => {
  const inputs = [
    'npm install',
    'npm run build',
    'git status',
    'Run npm install',
    'Please run git status',
    'Execute npm test',
    'npm create vite@latest app -- --template react'
  ];

  for (const input of inputs) {
    const intent = classifyInstruction(input);
    assert.equal(intent.kind, INSTRUCTION_KINDS.COMMAND, `Expected COMMAND for: ${input}`);
    assert.equal(intent.executionMode, EXECUTION_MODES.LITERAL);
    assert.equal(intent.executionAuthorized, true);
    assert.equal(intent.mechanismSpecified, true);
    assert.ok(intent.exactCommands.length > 0);
    assert.equal(intent.actions[0].action, 'execute-command');
    assert.equal(intent.actions[0].status, ACTION_LIFECYCLE.AUTHORIZED);
  }
});

test('Classification: Informational / Explanation Queries (Zero Execution)', () => {
  const inputs = [
    'Explain `npm install`.',
    'What does `git status` do?',
    'What does npm install do?',
    'What command creates a Vite React app?',
    'Why did the build fail?',
    'Give me the command to run the tests.',
    'Show me how to run the tests.'
  ];

  for (const input of inputs) {
    const intent = classifyInstruction(input);
    assert.equal(intent.kind, INSTRUCTION_KINDS.INFORMATION, `Expected INFORMATION for: ${input}`);
    assert.equal(intent.executionMode, EXECUTION_MODES.NONE);
    assert.equal(intent.executionAuthorized, false, `Execution must NOT be authorized for: ${input}`);
    assert.equal(intent.exactCommands.length, 0);
  }
});

test('Classification: Natural Language Development (Autonomous)', () => {
  const inputs = [
    'Create a React app',
    'Build me a dashboard',
    'Add authentication',
    'Fix this application',
    'Make the layout responsive'
  ];

  for (const input of inputs) {
    const intent = classifyInstruction(input);
    assert.equal(intent.kind, INSTRUCTION_KINDS.DEVELOPMENT, `Expected DEVELOPMENT for: ${input}`);
    assert.equal(intent.executionMode, EXECUTION_MODES.AUTONOMOUS);
    assert.equal(intent.executionAuthorized, true);
    assert.equal(intent.exactCommands.length, 0);
    assert.ok(intent.actions.length > 0);
    assert.equal(intent.actions[0].action, 'development');
  }
});

test('Classification: Workspace Operations', () => {
  const intent1 = classifyInstruction('Create config.js');
  assert.equal(intent1.kind, INSTRUCTION_KINDS.WORKSPACE);
  assert.equal(intent1.executionAuthorized, true);
  assert.ok(intent1.targets.includes('config.js'));

  const intent2 = classifyInstruction('Delete the old authentication module');
  assert.equal(intent2.kind, INSTRUCTION_KINDS.WORKSPACE);
  assert.equal(intent2.executionAuthorized, true);

  const intent3 = classifyInstruction('Move App.jsx into src/components');
  assert.equal(intent3.kind, INSTRUCTION_KINDS.WORKSPACE);
  assert.equal(intent3.executionAuthorized, true);
});

test('Classification: Mixed Requests with Context and Sequencing', () => {
  // Command + Context
  const intent1 = classifyInstruction('Run npm test and explain the failure');
  assert.equal(intent1.kind, INSTRUCTION_KINDS.MIXED);
  assert.equal(intent1.executionAuthorized, true);
  assert.equal(intent1.exactCommands[0], 'npm test');
  assert.equal(intent1.actions.length, 2);
  assert.equal(intent1.actions[0].action, 'execute-command');
  assert.equal(intent1.actions[0].command, 'npm test');
  assert.equal(intent1.actions[1].action, 'explain');

  // Sequential multi-step
  const intent2 = classifyInstruction('Run npm install, then add authentication and test it');
  assert.equal(intent2.kind, INSTRUCTION_KINDS.MIXED);
  assert.equal(intent2.executionAuthorized, true);
  assert.ok(intent2.actions.length >= 2);
  assert.equal(intent2.actions[0].action, 'execute-command');
  assert.equal(intent2.actions[0].command, 'npm install');

  // Multi-command sequence block
  const intent3 = classifyInstruction('Run these commands:\ngit status\nnpm test\ngit push origin Beta');
  assert.equal(intent3.kind, INSTRUCTION_KINDS.MIXED);
  assert.equal(intent3.executionAuthorized, true);
  assert.deepEqual(intent3.exactCommands, ['git status', 'npm test', 'git push origin Beta']);
});

test('Classification: Ambiguous Inputs (No invented authority)', () => {
  const inputs = [
    'vite dashboard',
    'build app',
    'npm?',
    'run this',
    'make this work'
  ];

  for (const input of inputs) {
    const intent = classifyInstruction(input);
    assert.equal(intent.kind, INSTRUCTION_KINDS.AMBIGUOUS, `Expected AMBIGUOUS for: ${input}`);
    assert.equal(intent.executionAuthorized, false, `Execution must NOT be authorized for ambiguous: ${input}`);
    assert.equal(intent.executionMode, EXECUTION_MODES.NONE);
  }
});
