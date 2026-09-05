/* ============================================================
   Toolbox IDE — Server-Side Real Code Execution Engine
   Manages real isolated workspace directories on disk,
   spawns real OS child processes, streams stdout/stderr,
   tracks process lifecycles, detects exposed dev ports,
   and proxies live dev servers into the IDE Preview.
   ============================================================ */

import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Base directory where real workspace projects live on disk
export const WORKSPACES_ROOT = process.env.TOOLBOX_WORKSPACES_ROOT || path.join(process.cwd(), '.workspaces');

// Ensure root directory exists
try {
  if (!fs.existsSync(WORKSPACES_ROOT)) {
    fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
  }
} catch (err) {
  console.error('[ExecutionEngine] Failed to create WORKSPACES_ROOT:', err);
}

// In-memory process table
const processes = new Map();

// Maximum concurrent running processes allowed per workspace (Fork bomb / DoS protection)
export const MAX_CONCURRENT_PROCESSES_PER_WORKSPACE = 5;

// Output history caps to prevent memory exhaustion from infinite logging loops
export const MAX_OUTPUT_HISTORY_ENTRIES = 500;
export const MAX_OUTPUT_BUFFER_BYTES = 1024 * 1024; // 1MB

// Strict Whitelist of environment variable keys permitted in child processes.
// Absolutely no application secrets, database URLs, payment keys, or IDE agent tokens are ever passed.
const WHITELISTED_ENV_VARS = new Set([
  'PATH', 'Path', 'PATHEXT',
  'NODE_ENV', 'TERM', 'COLORTERM', 'FORCE_COLOR', 'LANG', 'LC_ALL',
  'HOME', 'USERPROFILE', 'TEMP', 'TMP',
  'SystemRoot', 'COMSPEC', 'ComSpec', 'OS', 'PROCESSOR_ARCHITECTURE',
  'windir', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES', 'ProgramFiles',
  'SHELL'
]);

// Regexes to extract exposed server ports from stdout/stderr logs
const PORT_DETECTION_REGEXES = [
  /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0):([0-9]{4,5})/i,
  /(?:port|listening on|ready on|running at)\s*:?\s*([0-9]{4,5})/i,
  /Local:\s+https?:\/\/localhost:([0-9]{4,5})/i,
  /Network:\s+https?:\/\/[^:]+:([0-9]{4,5})/i
];

/**
 * Validates and resolves the absolute path to a workspace folder on disk
 */
export function getWorkspaceDir(workspaceId) {
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error('Invalid workspaceId');
  }
  const cleanId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetDir = path.resolve(WORKSPACES_ROOT, cleanId);

  // Security: prevent escaping WORKSPACES_ROOT
  if (!targetDir.startsWith(path.resolve(WORKSPACES_ROOT))) {
    throw new Error('Access denied: workspace path escapes root');
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  return targetDir;
}

/**
 * Resolves a file/directory path inside a workspace and ensures containment
 */
export function resolveWorkspacePath(workspaceId, subPath = '') {
  const root = getWorkspaceDir(workspaceId);
  const normalized = path.normalize(subPath).replace(/^(\.\.[\/\\])+/, '');
  const resolved = path.resolve(root, normalized);

  if (!resolved.startsWith(root)) {
    throw new Error(`Security error: path "${subPath}" escapes workspace`);
  }

  return resolved;
}

/**
 * Recursively lists all files in a workspace directory
 */
export async function listWorkspaceFiles(workspaceId, currentSub = '') {
  const dir = resolveWorkspacePath(workspaceId, currentSub);
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    // Skip heavy node_modules and .git in recursive listings to keep operations fast
    if (entry.name === 'node_modules' || entry.name === '.git') {
      results.push({
        name: entry.name,
        path: currentSub ? `${currentSub}/${entry.name}` : entry.name,
        isDirectory: true,
        isIgnored: true
      });
      continue;
    }

    const relPath = currentSub ? `${currentSub}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        path: relPath,
        isDirectory: true
      });
      const children = await listWorkspaceFiles(workspaceId, relPath);
      results.push(...children);
    } else {
      const stat = await fs.promises.stat(path.join(dir, entry.name));
      results.push({
        name: entry.name,
        path: relPath,
        isDirectory: false,
        size: stat.size,
        updatedAt: stat.mtimeMs
      });
    }
  }

  return results;
}

/**
 * Writes or synchronizes a file into the workspace on disk
 */
export async function writeWorkspaceFile(workspaceId, filePath, content) {
  const absPath = resolveWorkspacePath(workspaceId, filePath);
  const parentDir = path.dirname(absPath);
  if (!fs.existsSync(parentDir)) {
    await fs.promises.mkdir(parentDir, { recursive: true });
  }

  if (typeof content === 'string') {
    await fs.promises.writeFile(absPath, content, 'utf8');
  } else if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
    await fs.promises.writeFile(absPath, content);
  } else {
    await fs.promises.writeFile(absPath, String(content || ''), 'utf8');
  }

  const stat = await fs.promises.stat(absPath);
  return {
    path: filePath,
    size: stat.size,
    updatedAt: stat.mtimeMs
  };
}

/**
 * Reads a file from the workspace on disk
 */
export async function readWorkspaceFile(workspaceId, filePath, { encoding = 'utf8' } = {}) {
  const absPath = resolveWorkspacePath(workspaceId, filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return await fs.promises.readFile(absPath, encoding);
}

/**
 * Deletes a file or directory inside the workspace
 */
export async function deleteWorkspaceFile(workspaceId, filePath) {
  const absPath = resolveWorkspacePath(workspaceId, filePath);
  if (!fs.existsSync(absPath)) return false;

  const stat = await fs.promises.stat(absPath);
  if (stat.isDirectory()) {
    await fs.promises.rm(absPath, { recursive: true, force: true });
  } else {
    await fs.promises.unlink(absPath);
  }
  return true;
}

/**
 * Synchronizes an array of client files into the disk workspace
 */
export async function syncWorkspace(workspaceId, files = []) {
  const root = getWorkspaceDir(workspaceId);
  const synced = [];

  for (const f of files) {
    if (!f || (!f.name && !f.path)) continue;
    const rel = f.path || f.name;
    const meta = await writeWorkspaceFile(workspaceId, rel, f.content ?? f.text ?? '');
    synced.push(meta);
  }

  return {
    workspaceId,
    rootPath: root,
    syncedCount: synced.length,
    files: synced
  };
}

/**
 * Detects toolchains and versions installed on the host operating system
 */
export async function detectSystemTools() {
  const tools = {
    node: null,
    npm: null,
    git: null,
    python: null
  };

  try {
    const { stdout } = await execFileAsync('node', ['-v']);
    tools.node = stdout.trim();
  } catch {}

  try {
    const { stdout } = await execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['-v']);
    tools.npm = stdout.trim();
  } catch {}

  try {
    const { stdout } = await execFileAsync('git', ['--version']);
    tools.git = stdout.trim();
  } catch {}

  try {
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout } = await execFileAsync(pyCmd, ['--version']);
    tools.python = stdout.trim();
  } catch {}

  return tools;
}

/**
 * Spawns a real operating system child process inside the workspace directory
 */
export function spawnProcess(workspaceId, commandLine, { cwd = '', env = {}, timeoutMs = 300000 } = {}) {
  const wsRoot = getWorkspaceDir(workspaceId);
  const effectiveCwd = cwd ? resolveWorkspacePath(workspaceId, cwd) : wsRoot;

  // Enforce workspace concurrency limits to prevent fork bombs
  const activeWorkspaceProcs = listWorkspaceProcesses(workspaceId).filter(p => p.status === 'RUNNING');
  if (activeWorkspaceProcs.length >= MAX_CONCURRENT_PROCESSES_PER_WORKSPACE) {
    throw new Error(`Concurrency limit reached: workspace already has ${activeWorkspaceProcs.length} active processes (maximum: ${MAX_CONCURRENT_PROCESSES_PER_WORKSPACE}). Terminate existing processes before spawning new ones.`);
  }

  const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Construct strictly scrubbed environment variables
  const cleanEnv = {
    NODE_ENV: 'development',
    TERM: 'xterm-256color',
    FORCE_COLOR: '1',
    CI: 'true',
    GIT_AUTHOR_NAME: 'Toolbox Developer',
    GIT_AUTHOR_EMAIL: 'developer@toolbox.local',
    GIT_COMMITTER_NAME: 'Toolbox Developer',
    GIT_COMMITTER_EMAIL: 'developer@toolbox.local'
  };

  // Only pass whitelisted environment keys from host OS
  for (const key of WHITELISTED_ENV_VARS) {
    if (process.env[key] !== undefined) {
      cleanEnv[key] = process.env[key];
    }
  }

  // Ensure workspace directory is set as PWD
  cleanEnv.PWD = effectiveCwd;

  // Overlay user custom env
  Object.assign(cleanEnv, env);

  const isWin = process.platform === 'win32';
  const shellCmd = isWin ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
  const shellArgs = isWin ? ['/d', '/s', '/c', commandLine] : ['-c', commandLine];

  const child = spawn(shellCmd, shellArgs, {
    cwd: effectiveCwd,
    env: cleanEnv,
    windowsVerbatimArguments: isWin,
    detached: false
  });

  const procRecord = {
    id: processId,
    workspaceId,
    command: commandLine,
    pid: child.pid,
    cwd: effectiveCwd,
    status: 'RUNNING',
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    outputHistory: [],
    detectedPorts: new Set(),
    listeners: new Set(),
    child
  };

  processes.set(processId, procRecord);

  // Broadcast event to active listeners (SSE / WebSocket)
  function broadcast(event) {
    procRecord.listeners.forEach(fn => {
      try { fn(event); } catch {}
    });
  }

  // Broadcast process start event
  broadcast({
    type: 'start',
    eventType: 'PROCESS_STARTED',
    processId,
    workspaceId,
    pid: child.pid,
    command: commandLine,
    timestamp: procRecord.startedAt
  });

  let totalBufferedChars = 0;

  // Output handler with buffer cap
  function handleOutput(type, data) {
    const text = data.toString('utf8');
    const entry = {
      type: 'output',
      eventType: 'PROCESS_OUTPUT',
      processId,
      workspaceId,
      stream: type, // 'stdout' | 'stderr' | 'system'
      data: text,
      text,
      timestamp: Date.now()
    };

    // Prevent buffer blowup from infinite logging loops
    if (procRecord.outputHistory.length < MAX_OUTPUT_HISTORY_ENTRIES && totalBufferedChars < MAX_OUTPUT_BUFFER_BYTES) {
      procRecord.outputHistory.push({ type, text, timestamp: entry.timestamp });
      totalBufferedChars += text.length;
    } else if (procRecord.outputHistory.length === MAX_OUTPUT_HISTORY_ENTRIES) {
      procRecord.outputHistory.push({
        type: 'system',
        text: '\n[Notice: Output history truncated to prevent memory exhaustion]\n',
        timestamp: Date.now()
      });
    }

    // Scan for exposed ports
    for (const regex of PORT_DETECTION_REGEXES) {
      const match = text.match(regex);
      if (match && match[1]) {
        const port = parseInt(match[1], 10);
        if (port > 0 && port < 65536 && !procRecord.detectedPorts.has(port)) {
          procRecord.detectedPorts.add(port);
          broadcast({
            type: 'port',
            eventType: 'PORT_DETECTED',
            processId,
            workspaceId,
            port,
            url: `/api/ide/preview/${port}/`,
            timestamp: Date.now()
          });
        }
      }
    }

    broadcast(entry);
  }

  if (child.stdout) {
    child.stdout.on('data', chunk => handleOutput('stdout', chunk));
  }
  if (child.stderr) {
    child.stderr.on('data', chunk => handleOutput('stderr', chunk));
  }

  // Process termination timer
  let timeoutTimer = null;
  if (timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      if (procRecord.status === 'RUNNING') {
        procRecord.status = 'TIMED_OUT';
        handleOutput('system', `\n[Toolbox Process] Execution timed out after ${timeoutMs / 1000}s.\n`);
        killProcess(processId, 'SIGKILL');
      }
    }, timeoutMs);
  }

  child.on('error', (err) => {
    handleOutput('system', `\n[Toolbox Process Error]: ${err.message}\n`);
    procRecord.status = 'FAILED';
    procRecord.endedAt = Date.now();
    procRecord.exitCode = -1;
    if (timeoutTimer) clearTimeout(timeoutTimer);
    broadcast({
      type: 'exit',
      eventType: 'PROCESS_FAILED',
      processId,
      workspaceId,
      exitCode: -1,
      status: 'FAILED',
      error: { code: 'ERR_PROCESS_SPAWN', message: err.message },
      durationMs: procRecord.endedAt - procRecord.startedAt,
      timestamp: procRecord.endedAt
    });
  });

  child.on('close', (code) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (procRecord.status === 'RUNNING') {
      procRecord.status = (code === 0) ? 'COMPLETED' : 'FAILED';
    }
    procRecord.endedAt = Date.now();
    procRecord.exitCode = code;

    let eventType = 'PROCESS_EXITED';
    if (procRecord.status === 'TIMED_OUT') eventType = 'PROCESS_TIMEOUT';
    else if (procRecord.status === 'CANCELLED') eventType = 'PROCESS_CANCELLED';
    else if (procRecord.status === 'FAILED') eventType = 'PROCESS_FAILED';

    broadcast({
      type: 'exit',
      eventType,
      processId,
      workspaceId,
      exitCode: code,
      status: procRecord.status,
      durationMs: procRecord.endedAt - procRecord.startedAt,
      timestamp: procRecord.endedAt
    });
  });

  return procRecord;
}

/**
 * Terminates a running process
 */
export function killProcess(processId, signal = 'SIGTERM') {
  const proc = processes.get(processId);
  if (!proc || !proc.child) return false;

  if (proc.status === 'RUNNING') {
    proc.status = 'CANCELLED';
    proc.endedAt = Date.now();
    proc.outputHistory.push({
      type: 'system',
      text: `\n[Toolbox Process] Terminated by user (${signal}).\n`,
      timestamp: proc.endedAt
    });
    for (const fn of proc.listeners) {
      try {
        fn({
          type: 'exit',
          eventType: 'PROCESS_CANCELLED',
          processId,
          workspaceId: proc.workspaceId,
          signal,
          exitCode: 130,
          status: 'CANCELLED',
          durationMs: proc.endedAt - proc.startedAt,
          timestamp: proc.endedAt
        });
      } catch {}
    }
  }

  try {
    if (process.platform === 'win32' && proc.pid) {
      // On Windows, kill entire child process tree
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
    } else {
      proc.child.kill(signal);
    }
  } catch (err) {
    try { proc.child.kill(); } catch {}
  }

  return true;
}

/**
 * Gets process record by ID
 */
export function getProcess(processId) {
  return processes.get(processId) || null;
}

/**
 * Lists all processes for a workspace
 */
export function listWorkspaceProcesses(workspaceId) {
  const list = [];
  for (const proc of processes.values()) {
    if (proc.workspaceId === workspaceId) {
      list.push({
        id: proc.id,
        command: proc.command,
        pid: proc.pid,
        cwd: proc.cwd,
        status: proc.status,
        startedAt: proc.startedAt,
        endedAt: proc.endedAt,
        exitCode: proc.exitCode,
        detectedPorts: Array.from(proc.detectedPorts)
      });
    }
  }
  return list;
}

/**
 * Security: Checks if a port is an authorized dev server port actively registered to a running process.
 * Rejects requests to arbitrary or unexposed host system ports (e.g. 22, 5432, 6379, 3000).
 */
export function isAuthorizedPreviewPort(port) {
  const targetPort = parseInt(port, 10);
  if (!targetPort || targetPort <= 1024 || targetPort >= 65536) return false;
  for (const proc of processes.values()) {
    if (proc.status === 'RUNNING' && proc.detectedPorts?.has(targetPort)) {
      return true;
    }
  }
  return false;
}

/**
 * Proxies live dev server requests from localhost into the IDE Preview pane
 */
export function proxyDevServerRequest(port, req, res) {
  const targetPort = parseInt(port, 10);
  if (!targetPort || targetPort <= 0 || targetPort >= 65536) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid port number');
    return;
  }

  // Security: only proxy ports actively detected and registered to running workspace processes
  if (!isAuthorizedPreviewPort(targetPort)) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <div style="font-family:sans-serif; padding:24px; color:#ef4444; background:#18181b; height:100vh; box-sizing:border-box;">
        <h2 style="margin:0 0 8px;">Unauthorized Preview Port</h2>
        <p style="color:#a1a1aa; font-size:14px;">Port <strong>${targetPort}</strong> is not authorized. Only ports exposed by active workspace processes can be previewed.</p>
      </div>
    `);
    return;
  }

  const prefix = `/api/ide/preview/${targetPort}`;
  const subUrl = req.url.startsWith(prefix) ? (req.url.slice(prefix.length) || '/') : req.url;

  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: subUrl,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${targetPort}` }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <div style="font-family:sans-serif; padding:24px; color:#ef4444; background:#18181b; height:100vh; box-sizing:border-box;">
        <h2 style="margin:0 0 8px;">Development Server Unavailable</h2>
        <p style="color:#a1a1aa; font-size:14px;">No process is currently listening on port <strong>${targetPort}</strong>.</p>
        <p style="color:#71717a; font-size:12px;">Start your development server in the terminal (e.g. <code>npm run dev</code> or <code>npm start</code>).</p>
      </div>
    `);
  });

  req.pipe(proxyReq, { end: true });
}

/* ============================================================
   Resource Policy Abstraction Layer (Section 11)
   Defines enforceable resource controls and policies per isolation tier.
   ============================================================ */

export class ResourcePolicy {
  constructor(config = {}) {
    this.maxConcurrentProcesses = config.maxConcurrentProcesses ?? MAX_CONCURRENT_PROCESSES_PER_WORKSPACE;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 300000;
    this.maxTimeoutMs = config.maxTimeoutMs ?? 600000;
    this.maxOutputBufferBytes = config.maxOutputBufferBytes ?? MAX_OUTPUT_BUFFER_BYTES;
    this.maxOutputHistoryEntries = config.maxOutputHistoryEntries ?? MAX_OUTPUT_HISTORY_ENTRIES;
    this.maxMemoryMb = config.maxMemoryMb ?? null;
    this.maxCpuShares = config.maxCpuShares ?? null;
    this.maxDiskBytes = config.maxDiskBytes ?? null;
    this.networkPolicy = config.networkPolicy ?? 'host-unrestricted';
  }

  getEnforceableLimits(isolationTier) {
    if (isolationTier === 'host-process') {
      return {
        concurrencyEnforced: true,
        maxConcurrentProcesses: this.maxConcurrentProcesses,
        timeoutEnforced: true,
        maxTimeoutMs: this.maxTimeoutMs,
        outputBufferEnforced: true,
        maxOutputBufferBytes: this.maxOutputBufferBytes,
        memoryCgroupsEnforced: false,
        cpuQuotaEnforced: false,
        diskQuotaEnforced: false,
        networkIsolationEnforced: false
      };
    }
    return {
      concurrencyEnforced: true,
      maxConcurrentProcesses: this.maxConcurrentProcesses,
      timeoutEnforced: true,
      maxTimeoutMs: this.maxTimeoutMs,
      outputBufferEnforced: true,
      maxOutputBufferBytes: this.maxOutputBufferBytes,
      memoryCgroupsEnforced: Boolean(this.maxMemoryMb),
      cpuQuotaEnforced: Boolean(this.maxCpuShares),
      diskQuotaEnforced: Boolean(this.maxDiskBytes),
      networkIsolationEnforced: this.networkPolicy !== 'host-unrestricted'
    };
  }
}

export const defaultResourcePolicy = new ResourcePolicy();

/* ============================================================
   Execution Provider Abstraction Layer (Phase 6, 8, 9)
   Decouples the IDE execution interface from the underlying runtime
   and provides a replaceable migration boundary for microVMs/containers.
   ============================================================ */

/**
 * Base abstract interface for an execution provider
 */
export class ExecutionProvider {
  constructor(name = 'base', isolationTier = 'none') {
    this.name = name;
    this.isolationTier = isolationTier; // 'none' | 'host-process' | 'container' | 'microvm'
  }

  async detectTools() {
    throw new Error('detectTools() not implemented');
  }

  spawnProcess(workspaceId, commandLine, options) {
    throw new Error('spawnProcess() not implemented');
  }

  killProcess(processId, signal) {
    throw new Error('killProcess() not implemented');
  }

  getProcess(processId) {
    throw new Error('getProcess() not implemented');
  }

  listWorkspaceProcesses(workspaceId) {
    throw new Error('listWorkspaceProcesses() not implemented');
  }
}

/**
 * Host OS Process Execution Provider (Staging / Development)
 * Operates on the local server with environment scrubbing and process limits.
 */
export class HostExecutionProvider extends ExecutionProvider {
  constructor() {
    super('host-process', 'host-process');
  }

  async detectTools() {
    return detectSystemTools();
  }

  spawnProcess(workspaceId, commandLine, options) {
    return spawnProcess(workspaceId, commandLine, options);
  }

  killProcess(processId, signal) {
    return killProcess(processId, signal);
  }

  getProcess(processId) {
    return getProcess(processId);
  }

  listWorkspaceProcesses(workspaceId) {
    return listWorkspaceProcesses(workspaceId);
  }
}

/**
 * Execution Manager Singleton
 * Manages active provider and reports truthful execution capabilities
 */
class ExecutionManager {
  constructor() {
    this.provider = new HostExecutionProvider();
  }

  setProvider(provider) {
    if (!(provider instanceof ExecutionProvider)) {
      throw new Error('Invalid provider: must inherit from ExecutionProvider');
    }
    this.provider = provider;
  }

  getProvider() {
    return this.provider;
  }

  getCapabilities() {
    const provider = this.provider;
    return {
      provider: provider.name,
      isolationTier: provider.isolationTier,
      sandboxed: provider.isolationTier === 'container' || provider.isolationTier === 'microvm',
      resourcePolicy: defaultResourcePolicy.getEnforceableLimits(provider.isolationTier),
      limits: {
        maxConcurrentProcesses: defaultResourcePolicy.maxConcurrentProcesses,
        maxOutputBufferBytes: defaultResourcePolicy.maxOutputBufferBytes,
        defaultTimeoutMs: defaultResourcePolicy.defaultTimeoutMs,
        maxTimeoutMs: defaultResourcePolicy.maxTimeoutMs
      }
    };
  }
}

export const executionManager = new ExecutionManager();

/**
 * Exports all source files in a workspace for durable persistence
 * Filters out transient node_modules and internal VCS directories
 */
export async function exportWorkspaceArchive(workspaceId) {
  const files = await listWorkspaceFiles(workspaceId);
  const archiveFiles = [];

  for (const f of files) {
    if (f.isDirectory || f.isIgnored) continue;
    try {
      const content = await readWorkspaceFile(workspaceId, f.path);
      archiveFiles.push({
        name: f.name || f.path,
        path: f.path,
        content,
        size: f.size,
        updatedAt: f.updatedAt
      });
    } catch {}
  }

  return {
    workspaceId,
    exportedAt: Date.now(),
    fileCount: archiveFiles.length,
    files: archiveFiles
  };
}

/**
 * Imports an archive of files into the workspace directory
 */
export async function importWorkspaceArchive(workspaceId, files = []) {
  return syncWorkspace(workspaceId, files);
}

