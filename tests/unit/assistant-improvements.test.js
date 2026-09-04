import test from 'node:test';
import assert from 'node:assert/strict';
import { fs, ToolboxFilesystem } from '../../js/lib/filesystem.js';
import { executeAssistantTool, ASSISTANT_TOOL_DECLARATIONS } from '../../js/lib/assistant-tools.js';
import { FileDeletionConfirmationRenderer, selectRenderer } from '../../js/lib/assistant-result-renderer.js';
import { updateSettings, resetSettings } from '../../js/lib/settings.js';
import { getAssistantAnimationClass } from '../../js/tools/assistant.js';

test('Assistant File Deletion: request_file_deletion requires explicit user confirmation', async () => {
  // Setup files in filesystem
  await fs.mkdir('/TestDel');
  await fs.writeFile('/TestDel/doc1.txt', 'Doc 1 content');
  await fs.writeFile('/TestDel/doc2.txt', 'Doc 2 content');

  // Assistant invokes request_file_deletion tool
  const reqResult = await executeAssistantTool('request_file_deletion', {
    paths: ['/TestDel/doc1.txt', '/TestDel/doc2.txt']
  });

  assert.equal(reqResult.status, 'confirmation_required');
  assert.equal(reqResult.requiresConfirmation, true);
  assert.equal(reqResult.renderer, 'file-deletion-confirmation');
  assert.equal(reqResult.files.length, 2);
  assert.deepEqual(reqResult.paths, ['/TestDel/doc1.txt', '/TestDel/doc2.txt']);
  assert.match(reqResult.message, /confirm deletion of 2 file\(s\)/i);

  // Verify FileDeletionConfirmationRenderer can render this result
  assert.equal(FileDeletionConfirmationRenderer.canRender(reqResult), true);
  assert.equal(selectRenderer(reqResult), FileDeletionConfirmationRenderer);

  // Files must still exist in filesystem prior to confirmation
  const stat1 = await fs.stat('/TestDel/doc1.txt');
  const stat2 = await fs.stat('/TestDel/doc2.txt');
  assert.ok(stat1, 'doc1.txt must not be deleted before confirmation');
  assert.ok(stat2, 'doc2.txt must not be deleted before confirmation');
});

test('Assistant File Deletion Guardrail: rejects unconfirmed deletions', async () => {
  await fs.mkdir('/GuardrailDel');
  await fs.writeFile('/GuardrailDel/secret.txt', 'Secret');

  // Attempting unconfirmed delete_file must throw permission denied
  await assert.rejects(
    async () => executeAssistantTool('delete_file', { path: '/GuardrailDel/secret.txt' }),
    /strictly prohibited from deleting files without user confirmation/i
  );

  // File still exists
  const stat = await fs.stat('/GuardrailDel/secret.txt');
  assert.ok(stat, 'secret.txt must not be deleted');
});

test('Assistant File Deletion: executes multiple deletions when confirmed', async () => {
  await fs.mkdir('/ConfirmedDel');
  await fs.writeFile('/ConfirmedDel/fileA.txt', 'A');
  await fs.writeFile('/ConfirmedDel/fileB.txt', 'B');

  // User confirmed deletion
  const delResult = await executeAssistantTool('delete_file', {
    paths: ['/ConfirmedDel/fileA.txt', '/ConfirmedDel/fileB.txt'],
    confirmed: true
  });

  assert.equal(delResult.success, true);
  assert.equal(delResult.deletedCount, 2);
  assert.equal(delResult.files.length, 2);

  // Verify files are deleted
  const statA = await fs.stat('/ConfirmedDel/fileA.txt');
  const statB = await fs.stat('/ConfirmedDel/fileB.txt');
  assert.equal(statA, null, 'fileA.txt must be deleted');
  assert.equal(statB, null, 'fileB.txt must be deleted');
});

test('Assistant Response Text Animations: supports 4 customizable animation styles and toggle', () => {
  resetSettings();

  // 1. color rave (default)
  updateSettings({ assistantResponseAnimation: true, assistantAnimationStyle: 'color rave' });
  assert.equal(getAssistantAnimationClass(), 'ast-anim-color-rave');

  // 2. glow & legacy Pixel
  updateSettings({ assistantResponseAnimation: true, assistantAnimationStyle: 'glow' });
  assert.equal(getAssistantAnimationClass(), 'ast-anim-glow');
  updateSettings({ assistantResponseAnimation: true, assistantAnimationStyle: 'Pixel' });
  assert.equal(getAssistantAnimationClass(), 'ast-anim-glow');

  // 3. Plain Fade
  updateSettings({ assistantResponseAnimation: true, assistantAnimationStyle: 'Plain Fade' });
  assert.equal(getAssistantAnimationClass(), 'ast-anim-plain-fade');

  // 4. Pop In
  updateSettings({ assistantResponseAnimation: true, assistantAnimationStyle: 'Pop In' });
  assert.equal(getAssistantAnimationClass(), 'ast-anim-pop-in');

  // Disabled toggle
  updateSettings({ assistantResponseAnimation: false });
  assert.equal(getAssistantAnimationClass(), '');
});
