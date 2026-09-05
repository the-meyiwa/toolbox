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

// Sensitive environment variable names that must NEVER be passed to child processes
const SENSITIVE_ENV_KEYS = new Set([
  'GEMINI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_KEY',
  'TOOLBOX_WEBHOOK_SECRET',
  'PAYSTACK_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'DATABASE_URL',
  'PORT'
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
    if (!f || !f.name) continue;
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

  const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Construct isolated environment variables
  const cleanEnv = {
    PATH: process.env.PATH || '',
    HOME: os.homedir(),
    USERPROFILE: process.env.USERPROFILE || os.homedir(),
    NODE_ENV: 'development',
    TERM: 'xterm-256color',
    FORCE_COLOR: '1'
  };

  // Copy safe host env variables
  for (const [key, val] of Object.entries(process.env)) {
    if (!SENSITIVE_ENV_KEYS.has(key) && val !== undefined) {
      cleanEnv[key] = val;
    }
  }

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

  // Output handler
  function handleOutput(type, data) {
    const text = data.toString('utf8');
    const entry = { type, text, timestamp: Date.now() };
    procRecord.outputHistory.push(entry);

    // Scan for exposed ports
    for (const regex of PORT_DETECTION_REGEXES) {
      const match = text.match(regex);
      if (match && match[1]) {
        const port = parseInt(match[1], 10);
        if (port > 0 && port < 65536 && !procRecord.detectedPorts.has(port)) {
          procRecord.detectedPorts.add(port);
          broadcast({ type: 'port', port, timestamp: Date.now() });
        }
      }
    }

    broadcast({ type: 'output', ...entry });
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
    broadcast({ type: 'exit', exitCode: -1, status: 'FAILED', durationMs: procRecord.endedAt - procRecord.startedAt });
  });

  child.on('close', (code) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (procRecord.status === 'RUNNING') {
      procRecord.status = (code === 0) ? 'COMPLETED' : 'FAILED';
    }
    procRecord.endedAt = Date.now();
    procRecord.exitCode = code;
    broadcast({
      type: 'exit',
      exitCode: code,
      status: procRecord.status,
      durationMs: procRecord.endedAt - procRecord.startedAt
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
    proc.outputHistory.push({
      type: 'system',
      text: `\n[Toolbox Process] Terminated by user (${signal}).\n`,
      timestamp: Date.now()
    });
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
 * Proxies live dev server requests from localhost into the IDE Preview pane
 */
export function proxyDevServerRequest(port, req, res) {
  const targetPort = parseInt(port, 10);
  if (!targetPort || targetPort <= 0 || targetPort >= 65536) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid port number');
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
