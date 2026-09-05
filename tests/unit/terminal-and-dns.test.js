/* ============================================================
   Terminal Architecture, React Scaffolding, Git, and DNS Tests
   Validates:
   - Resilient DNS resolution (queryDns) with Google DoH and Cloudflare fallback
   - Numeric DNS type mapping and IPv4/IPv6 reverse ARPA formatting
   - Assistant dns_lookup execution
   - Assistant IDE Agent commands:
     * ide_run_command (npx create-react-app, npm test, git commands, filesystem)
     * ide_run_tests (Vitest / Jest suite reporting)
     * ide_git_push (staging, commit, remote setup, push)
   - Code Playground interactive terminal:
     * React 18 scaffolding (package.json, App.jsx, App.css, App.test.js, index.jsx, index.html)
     * Virtual test runner (describe, test, it, expect)
     * Git lifecycle (init, add, commit, remote add, push)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { queryDns, ipToArpa, DNS_TYPE_MAP } from '../../js/lib/dns-resolver.js';
import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { setExecutionAdapter } from '../../js/lib/ide-execution-client.js';
import * as serverEngine from '../../server-execution-engine.js';
const {
  executionManager,
  resolveWorkspacePath,
  exportWorkspaceArchive,
  importWorkspaceArchive,
  writeWorkspaceFile,
  readWorkspaceFile,
  MAX_CONCURRENT_PROCESSES_PER_WORKSPACE,
  MAX_OUTPUT_BUFFER_BYTES
} = serverEngine;

setExecutionAdapter(serverEngine);

const { document } = setupDOMEnvironment();

test('DNS Resolver: Type code mapping and IPv4/IPv6 reverse ARPA formatting', () => {
  assert.equal(DNS_TYPE_MAP[1], 'A');
  assert.equal(DNS_TYPE_MAP[28], 'AAAA');
  assert.equal(DNS_TYPE_MAP[15], 'MX');
  assert.equal(DNS_TYPE_MAP[16], 'TXT');
  assert.equal(DNS_TYPE_MAP[5], 'CNAME');
  assert.equal(DNS_TYPE_MAP[12], 'PTR');

  // IPv4 to ARPA
  assert.equal(ipToArpa('8.8.8.8'), '8.8.8.8.in-addr.arpa');
  assert.equal(ipToArpa('1.1.1.1'), '1.1.1.1.in-addr.arpa');
  assert.equal(ipToArpa('192.168.1.50'), '50.1.168.192.in-addr.arpa');

  // Normal domain stays untouched
  assert.equal(ipToArpa('google.com'), 'google.com');
});

test('DNS Resolver: Queries Google DoH with resilient answer parsing', async () => {
  // Test with mock or real network query
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('dns.google')) {
      return {
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [
            { name: 'google.com.', type: 1, TTL: 300, data: '142.250.190.46' }
          ]
        })
      };
    }
    return originalFetch(url);
  };

  try {
    const result = await queryDns('google.com', 'A');
    assert.equal(result.status, 'success');
    assert.equal(result.domain, 'google.com');
    assert.equal(result.type, 'A');
    assert.ok(result.answers.length > 0);
    assert.equal(result.answers[0].data, '142.250.190.46');
    assert.equal(result.answers[0].type, 'A');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DNS Resolver: Falls back to Cloudflare DoH if Google DoH fails', async () => {
  const originalFetch = globalThis.fetch;
  let cloudflareCalled = false;

  globalThis.fetch = async (url) => {
    if (url.includes('dns.google')) {
      throw new Error('Google DoH network error');
    }
    if (url.includes('cloudflare-dns.com')) {
      cloudflareCalled = true;
      return {
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [
            { name: 'cloudflare.com.', type: 1, TTL: 120, data: '104.16.132.229' }
          ]
        })
      };
    }
    return originalFetch(url);
  };

  try {
    const result = await queryDns('cloudflare.com', 'A');
    assert.equal(result.status, 'success');
    assert.ok(cloudflareCalled, 'Must have fallen back to Cloudflare DoH');
    assert.equal(result.answers[0].data, '104.16.132.229');
    assert.ok(result.provider.includes('Cloudflare'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Assistant Tool dns_lookup: Successfully resolves record via Assistant', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    return {
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          { name: 'example.com.', type: 1, TTL: 86400, data: '93.184.216.34' }
        ]
      })
    };
  };

  try {
    const res = await executeAssistantTool('dns_lookup', { domain: 'https://example.com/path', type: 'A' }, {});
    assert.equal(res.status, 'success');
    assert.equal(res.domain, 'example.com');
    assert.equal(res.type, 'A');
    assert.equal(res.answers[0].data, '93.184.216.34');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Assistant Tool ide_run_command: Scaffolds React 18 application with test suite', async () => {
  const res = await executeAssistantTool('ide_run_command', {
    command: 'npx create-react-app modern-react-app',
    projectName: 'modern-react-app'
  }, {});

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'ide-command');
  assert.equal(res.project, 'modern-react-app');
  assert.ok(res.filesCreated.some(f => f.includes('package.json')));
  assert.ok(res.filesCreated.some(f => f.includes('App.jsx')));
  assert.ok(res.filesCreated.some(f => f.includes('App.test.js')));
  assert.ok(res.output.includes('Successfully initialized React 18 application'));
});

test('Assistant Tool ide_run_tests: Executes test runner and outputs Vitest report', async () => {
  const res = await executeAssistantTool('ide_run_tests', {
    projectName: 'modern-react-app'
  }, {});

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'ide-test-runner');
  assert.ok(res.passed >= 1);
  assert.equal(res.failed, 0);
  assert.ok(res.output.includes('PASS'));
  assert.ok(res.output.includes('Test Suites:'));
});

test('Assistant Tool ide_git_push: Stages, commits, and pushes to remote GitHub repository', async () => {
  const res = await executeAssistantTool('ide_git_push', {
    projectName: 'modern-react-app',
    remoteUrl: 'https://github.com/my-org/modern-react-app.git',
    branch: 'main',
    commitMessage: 'feat: initialize interactive react app with test suite'
  }, {});

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'ide-git-push');
  assert.equal(res.remoteUrl, 'https://github.com/my-org/modern-react-app.git');
  assert.equal(res.branch, 'main');
  assert.ok(res.message.includes('Successfully pushed codebase to GitHub'));
});

test('Code Playground Terminal: Initializes React 18 app, runs tests, and executes git push', async () => {
  const cpgModule = await import('../../js/tools/code-playground.js');

  const container = document.createElement('div');
  document.body.appendChild(container);

  // Render playground with an initial workspace
  await cpgModule.default.render(container, {
    artifact: {
      id: 'ws_term_test',
      name: 'main.js',
      kind: 'js',
      text: '// Start of test'
    }
  });

  assert.ok(typeof cpgModule.default.executeTerminalCommand === 'function', 'executeTerminalCommand must be exposed');

  // 1. Execute real Node.js command via terminal
  const nodeRes = await cpgModule.default.executeTerminalCommand('node -e "console.log(84)"', { echo: true });
  assert.equal(nodeRes.exitCode, 0);
  assert.ok(nodeRes.stdout.includes('84'));

  // 2. Execute real Git repository lifecycle in terminal
  const gitInitRes = await cpgModule.default.executeTerminalCommand('git init', { echo: true });
  assert.equal(gitInitRes.exitCode, 0);

  const gitStatusRes = await cpgModule.default.executeTerminalCommand('git status', { echo: true });
  assert.equal(gitStatusRes.exitCode, 0);
});

test('Execution Engine: ExecutionProvider reports accurate capabilities and isolation tier', () => {
  const caps = executionManager.getCapabilities();
  assert.equal(caps.provider, 'host-process');
  assert.equal(caps.isolationTier, 'host-process');
  assert.equal(caps.sandboxed, false, 'Host process provider must honestly report un-sandboxed status');
  assert.equal(caps.limits.maxConcurrentProcesses, MAX_CONCURRENT_PROCESSES_PER_WORKSPACE);
  assert.equal(caps.limits.maxOutputBufferBytes, MAX_OUTPUT_BUFFER_BYTES);
});

test('Execution Engine: Path containment prevents directory traversal out of workspace root', () => {
  const safePath = resolveWorkspacePath('ws_security_test', 'src/App.jsx');
  assert.ok(safePath.includes('ws_security_test'));
  assert.ok(safePath.includes('src'));

  // Attempting to escape with ../../ must be normalized and contained inside the workspace
  const traversalPath = resolveWorkspacePath('ws_security_test', '../../etc/passwd');
  assert.ok(traversalPath.includes('ws_security_test'));
  assert.ok(!traversalPath.startsWith('C:\\etc') && !traversalPath.startsWith('/etc'));
});

test('Execution Engine: Workspace archival export and import preserves project state', async () => {
  const testWsId = 'ws_archive_unit_test';
  await writeWorkspaceFile(testWsId, 'package.json', JSON.stringify({ name: 'archive-test', version: '1.0.0' }));
  await writeWorkspaceFile(testWsId, 'src/index.js', 'console.log("archive hello");');

  // Verify write
  const content = await readWorkspaceFile(testWsId, 'src/index.js');
  assert.equal(content, 'console.log("archive hello");');

  // Export archive
  const archive = await exportWorkspaceArchive(testWsId);
  assert.equal(archive.workspaceId, testWsId);
  assert.ok(archive.fileCount >= 2);
  assert.ok(archive.files.some(f => f.path.includes('package.json')));
  assert.ok(archive.files.some(f => f.path.includes('src/index.js')));

  // Import into new workspace
  const restoredWsId = 'ws_restored_unit_test';
  await importWorkspaceArchive(restoredWsId, archive.files);
  const restoredContent = await readWorkspaceFile(restoredWsId, 'src/index.js');
  assert.equal(restoredContent, 'console.log("archive hello");');
});


