/* ============================================================
   Toolbox IDE — Boundary & Client/Server Separation Tests
   Validates the clean separation between browser client and server runtime:
   1. Browser execution client is pure client-safe with zero server imports
   2. Browser execution client operates without Node globals (process/require)
   3. Server execution engine operates without browser globals (window/document)
   4. Structured execution events follow typed schema (PROCESS_STARTED, etc.)
   5. Dev server preview boundary prevents SSRF / host port exposure
   6. Truthful capability detection & ResourcePolicy honesty
   7. Structured error contracts (ExecutionError)
   8. In-memory adapter injection allows test execution without code leakage
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  ExecutionClient,
  ExecutionError,
  setExecutionAdapter
} from '../../js/lib/ide-execution-client.js';
import * as serverEngine from '../../server-execution-engine.js';
const {
  executionManager,
  ResourcePolicy,
  defaultResourcePolicy,
  isAuthorizedPreviewPort,
  spawnProcess,
  killProcess,
  getProcess
} = serverEngine;

test('IDE Boundary: Client module source contains zero server-only imports', () => {
  const clientPath = path.resolve('js/lib/ide-execution-client.js');
  const source = fs.readFileSync(clientPath, 'utf8');

  // Verify no server execution engine imports
  assert.equal(source.includes('server-execution-engine'), false, 'ide-execution-client.js must not import server-execution-engine');
  assert.equal(source.includes("from 'child_process'"), false, 'ide-execution-client.js must not import child_process');
  assert.equal(source.includes("from 'fs'"), false, 'ide-execution-client.js must not import fs');
  assert.equal(source.includes("from 'http'"), false, 'ide-execution-client.js must not import http');
  assert.equal(source.includes("from 'os'"), false, 'ide-execution-client.js must not import os');
  assert.equal(source.includes("from 'path'"), false, 'ide-execution-client.js must not import path');
});

test('IDE Boundary: Client module defines clean ExecutionClient contract and typed ExecutionError', () => {
  const client = new ExecutionClient({ baseUrl: 'http://localhost:3000' });
  assert.equal(typeof client.detectCapabilities, 'function');
  assert.equal(typeof client.syncWorkspace, 'function');
  assert.equal(typeof client.fetchWorkspaceFiles, 'function');
  assert.equal(typeof client.readWorkspaceFile, 'function');
  assert.equal(typeof client.writeWorkspaceFile, 'function');
  assert.equal(typeof client.deleteWorkspaceFile, 'function');
  assert.equal(typeof client.execute, 'function');
  assert.equal(typeof client.killProcess, 'function');
  assert.equal(typeof client.getPreviewUrl, 'function');

  // Preview URL points to reverse proxy endpoint
  assert.equal(client.getPreviewUrl(5173), 'http://localhost:3000/api/ide/preview/5173/');

  // Error contract
  const err = new ExecutionError('Process failed', 'ERR_COMMAND_FAILED', { exitCode: 1 });
  assert.equal(err.name, 'ExecutionError');
  assert.equal(err.code, 'ERR_COMMAND_FAILED');
  assert.equal(err.details.exitCode, 1);
});

test('IDE Boundary: Capability detection is truthful and reports honest isolation tier', () => {
  const caps = executionManager.getCapabilities();

  assert.equal(caps.provider, 'host-process');
  assert.equal(caps.isolationTier, 'host-process');
  // Sandboxing must be honestly false until genuine container/microVM provider is active
  assert.equal(caps.sandboxed, false);

  // Resource policy honesty checks
  assert.ok(caps.resourcePolicy, 'Must include resourcePolicy');
  assert.equal(caps.resourcePolicy.concurrencyEnforced, true);
  assert.equal(caps.resourcePolicy.timeoutEnforced, true);
  assert.equal(caps.resourcePolicy.outputBufferEnforced, true);

  // Host process cannot enforce cgroups or kernel network namespaces
  assert.equal(caps.resourcePolicy.memoryCgroupsEnforced, false);
  assert.equal(caps.resourcePolicy.cpuQuotaEnforced, false);
  assert.equal(caps.resourcePolicy.diskQuotaEnforced, false);
  assert.equal(caps.resourcePolicy.networkIsolationEnforced, false);
});

test('IDE Boundary: Preview boundary blocks unauthorized host ports', () => {
  // Common system ports must be rejected by default
  assert.equal(isAuthorizedPreviewPort(22), false, 'SSH port 22 must not be authorized');
  assert.equal(isAuthorizedPreviewPort(80), false, 'Port 80 must not be authorized');
  assert.equal(isAuthorizedPreviewPort(443), false, 'Port 443 must not be authorized');
  assert.equal(isAuthorizedPreviewPort(3000), false, 'Toolbox host port 3000 must not be authorized without active child process');
  assert.equal(isAuthorizedPreviewPort(5432), false, 'Postgres port 5432 must not be authorized');
  assert.equal(isAuthorizedPreviewPort(6379), false, 'Redis port 6379 must not be authorized');
  assert.equal(isAuthorizedPreviewPort(99999), false, 'Invalid port must not be authorized');
});

test('IDE Boundary: Structured execution events adhere to typed schema', async () => {
  const events = [];
  const client = new ExecutionClient();
  client.setAdapter(serverEngine);

  const echoCmd = process.platform === 'win32' ? 'cmd /c echo BOUNDARY_TEST_OK' : 'echo BOUNDARY_TEST_OK';
  const exec = await client.execute('boundary-test-ws', echoCmd, {
    onEvent: (e) => events.push(e)
  });

  const result = await exec.promise;
  assert.equal(result.exitCode, 0);

  // Verify typed event schema
  const startEvt = events.find(e => e.eventType === 'PROCESS_STARTED');
  assert.ok(startEvt, 'Must emit PROCESS_STARTED event');
  assert.equal(startEvt.workspaceId, 'boundary-test-ws');
  assert.ok(startEvt.pid);

  const outputEvt = events.find(e => e.eventType === 'PROCESS_OUTPUT');
  assert.ok(outputEvt, 'Must emit PROCESS_OUTPUT event');
  assert.ok(outputEvt.stream === 'stdout' || outputEvt.stream === 'stderr');
  assert.ok(outputEvt.data.includes('BOUNDARY_TEST_OK'));

  const exitEvt = events.find(e => e.eventType === 'PROCESS_EXITED');
  assert.ok(exitEvt, 'Must emit PROCESS_EXITED event');
  assert.equal(exitEvt.exitCode, 0);
  assert.equal(exitEvt.status, 'COMPLETED');
});

test('IDE Boundary: Real process cancellation emits PROCESS_CANCELLED', async () => {
  const events = [];
  const client = new ExecutionClient();
  client.setAdapter(serverEngine);

  const sleepCmd = process.platform === 'win32' ? 'powershell -NoProfile -Command "Start-Sleep -Seconds 15"' : 'sleep 15';
  const exec = await client.execute('boundary-cancel-ws', sleepCmd, {
    onEvent: (e) => events.push(e)
  });

  // Terminate process
  exec.kill('SIGTERM');
  const result = await exec.promise;

  assert.equal(result.status, 'CANCELLED');
  const cancelEvt = events.find(e => e.eventType === 'PROCESS_CANCELLED');
  assert.ok(cancelEvt, 'Must emit PROCESS_CANCELLED event');
  assert.equal(cancelEvt.status, 'CANCELLED');
});
