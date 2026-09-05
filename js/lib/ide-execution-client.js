/* ============================================================
   Toolbox IDE — Client-Side Execution API Client
   Communicates with the server execution engine (/api/ide/*),
   handles SSE streaming of real stdout/stderr logs,
   detects exposed dev server ports, manages cancellations,
   and synchronizes workspace files with the host disk.
   When running in Node.js test environments, directly binds
   to the execution engine for zero-overhead local execution.
   ============================================================ */

const isNodeEnv = typeof window === 'undefined' || !globalThis.window?.location?.host;

let nodeEngine = null;
async function getNodeEngine() {
  if (!nodeEngine && isNodeEnv) {
    try {
      nodeEngine = await import('../../server-execution-engine.js');
    } catch {
      try {
        nodeEngine = await import('../../server-execution-engine.js');
      } catch {
        try {
          nodeEngine = await import('./server-execution-engine.js');
        } catch {}
      }
    }
  }
  return nodeEngine;
}

let cachedHealth = null;
let healthCheckPromise = null;

/**
 * Checks whether the real execution backend is available and healthy
 * @returns {Promise<{ available: boolean, platform?: string, tools?: object }>}
 */
export async function checkIdeBackend(forceRefresh = false) {
  if (!forceRefresh && cachedHealth) return cachedHealth;

  const engine = await getNodeEngine();
  if (engine) {
    const tools = await engine.detectSystemTools();
    cachedHealth = {
      available: true,
      platform: process.platform,
      arch: process.arch,
      tools
    };
    return cachedHealth;
  }

  if (!forceRefresh && healthCheckPromise) return healthCheckPromise;

  healthCheckPromise = (async () => {
    try {
      const res = await fetch('/api/ide/health', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(1500) : undefined
      });
      if (!res.ok) {
        cachedHealth = { available: false, error: `HTTP ${res.status}` };
        return cachedHealth;
      }
      const data = await res.json();
      cachedHealth = {
        available: Boolean(data.success),
        platform: data.platform,
        arch: data.arch,
        tools: data.tools || {}
      };
      return cachedHealth;
    } catch (err) {
      cachedHealth = { available: false, error: err.message };
      return cachedHealth;
    } finally {
      healthCheckPromise = null;
    }
  })();

  return healthCheckPromise;
}

/**
 * Synchronizes an array of client workspace files to the disk workspace
 * @param {string} workspaceId
 * @param {Array<{ name: string, path?: string, content: string }>} files
 */
export async function syncWorkspaceToDisk(workspaceId, files = []) {
  const cleanId = String(workspaceId || 'default');
  const engine = await getNodeEngine();
  if (engine) {
    return await engine.syncWorkspace(cleanId, files);
  }

  const res = await fetch('/api/ide/workspace/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: cleanId, files })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Workspace sync failed: ${errText}`);
  }
  return await res.json();
}

/**
 * Fetches the real disk file tree for a workspace
 * @param {string} workspaceId
 */
export async function fetchWorkspaceDiskFiles(workspaceId) {
  const cleanId = String(workspaceId || 'default');
  const engine = await getNodeEngine();
  if (engine) {
    return await engine.listWorkspaceFiles(cleanId);
  }

  const res = await fetch(`/api/ide/workspace/files?workspaceId=${encodeURIComponent(cleanId)}`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Failed to list workspace files: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * Reads a single file from the disk workspace
 * @param {string} workspaceId
 * @param {string} filePath
 */
export async function readWorkspaceDiskFile(workspaceId, filePath) {
  const cleanId = String(workspaceId || 'default');
  const engine = await getNodeEngine();
  if (engine) {
    return await engine.readWorkspaceFile(cleanId, filePath);
  }

  const res = await fetch(`/api/ide/workspace/file?workspaceId=${encodeURIComponent(cleanId)}&path=${encodeURIComponent(filePath)}`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Failed to read file ${filePath}: HTTP ${res.status}`);
  }
  return await res.text();
}

/**
 * Writes or updates a file directly on disk in the workspace
 * @param {string} workspaceId
 * @param {string} filePath
 * @param {string} content
 */
export async function writeWorkspaceDiskFile(workspaceId, filePath, content) {
  const cleanId = String(workspaceId || 'default');
  const engine = await getNodeEngine();
  if (engine) {
    return await engine.writeWorkspaceFile(cleanId, filePath, content);
  }

  const res = await fetch('/api/ide/workspace/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: cleanId, path: filePath, content })
  });
  if (!res.ok) {
    throw new Error(`Failed to write file ${filePath}: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Deletes a file or directory inside the disk workspace
 * @param {string} workspaceId
 * @param {string} filePath
 */
export async function deleteWorkspaceDiskFile(workspaceId, filePath) {
  const cleanId = String(workspaceId || 'default');
  const engine = await getNodeEngine();
  if (engine) {
    return await engine.deleteWorkspaceFile(cleanId, filePath);
  }

  const res = await fetch('/api/ide/workspace/file', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: cleanId, path: filePath })
  });
  if (!res.ok) {
    throw new Error(`Failed to delete file ${filePath}: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Executes a command on the real operating system backend with live streaming
 * @param {string} workspaceId
 * @param {string} command
 * @param {object} options
 * @returns {Promise<{ processId: string, pid: number, kill: Function, promise: Promise<object> }>}
 */
export async function executeRemoteCommand(workspaceId, command, {
  cwd = '',
  env = {},
  timeoutMs = 300000,
  onStdout = () => {},
  onStderr = () => {},
  onSystem = () => {},
  onPort = () => {},
  onExit = () => {}
} = {}) {
  const cleanId = String(workspaceId || 'default');
  const engine = await getNodeEngine();

  // In Node.js environment, execute directly via server-execution-engine
  if (engine) {
    const proc = engine.spawnProcess(cleanId, command, { cwd, env, timeoutMs });

    const kill = (sig = 'SIGTERM') => {
      engine.killProcess(proc.id, sig);
    };

    const promise = new Promise((resolve) => {
      const listener = (event) => {
        if (event.type === 'output') {
          if (event.type === 'stdout' || !event.level) onStdout(event.text);
          else if (event.type === 'stderr') onStderr(event.text);
          else onSystem(event.text);
        } else if (event.type === 'port') {
          onPort(event.port);
        } else if (event.type === 'exit') {
          proc.listeners.delete(listener);
          onExit(event);
          resolve(event);
        }
      };
      proc.listeners.add(listener);

      // Handle child stdout & stderr chunks
      if (proc.child) {
        proc.child.stdout?.on('data', chunk => onStdout(chunk.toString('utf8')));
        proc.child.stderr?.on('data', chunk => onStderr(chunk.toString('utf8')));
      }
    });

    return {
      processId: proc.id,
      pid: proc.pid,
      kill,
      promise
    };
  }

  // In Browser environment, execute via HTTP/SSE
  const spawnRes = await fetch('/api/ide/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: cleanId,
      command,
      cwd,
      env,
      timeoutMs
    })
  });

  if (!spawnRes.ok) {
    const errData = await spawnRes.json().catch(() => ({}));
    throw new Error(errData.error || `Process spawn failed: HTTP ${spawnRes.status}`);
  }

  const { processId, pid, status } = await spawnRes.json();

  let eventSource = null;
  let hasExited = false;

  const kill = async (signal = 'SIGTERM') => {
    try {
      await fetch('/api/ide/exec/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processId, signal })
      });
    } catch (err) {
      console.warn('[IDE Execution] Kill request failed:', err);
    }
  };

  const promise = new Promise((resolve, reject) => {
    if (typeof EventSource === 'undefined') {
      reject(new Error('EventSource is not supported in this browser environment'));
      return;
    }

    eventSource = new EventSource(`/api/ide/exec/stream?processId=${encodeURIComponent(processId)}`);

    eventSource.addEventListener('output', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'stdout') {
          onStdout(payload.text);
        } else if (payload.type === 'stderr') {
          onStderr(payload.text);
        } else {
          onSystem(payload.text);
        }
      } catch (err) {
        console.warn('[SSE Parse Error]:', err);
      }
    });

    eventSource.addEventListener('port', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.port) {
          onPort(payload.port);
        }
      } catch (err) {}
    });

    eventSource.addEventListener('exit', (e) => {
      try {
        hasExited = true;
        const payload = JSON.parse(e.data);
        if (eventSource) eventSource.close();
        onExit(payload);
        resolve(payload);
      } catch (err) {
        if (eventSource) eventSource.close();
        resolve({ exitCode: 0, status: 'COMPLETED' });
      }
    });

    eventSource.onerror = (err) => {
      if (hasExited) return;
      fetch(`/api/ide/processes?workspaceId=${encodeURIComponent(cleanId)}`)
        .then(r => r.json())
        .then(data => {
          const match = (data.processes || []).find(p => p.id === processId);
          if (match && match.status !== 'RUNNING') {
            if (eventSource) eventSource.close();
            resolve({ exitCode: match.exitCode, status: match.status });
          }
        }).catch(() => {});
    };
  });

  return {
    processId,
    pid,
    kill,
    promise
  };
}

/**
 * Kills a remote process by its process ID
 * @param {string} processId
 * @param {string} signal
 */
export async function killRemoteProcess(processId, signal = 'SIGTERM') {
  const engine = await getNodeEngine();
  if (engine) {
    return engine.killProcess(processId, signal);
  }
  return fetch('/api/ide/exec/kill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ processId, signal })
  });
}

/**
 * Returns the live reverse-proxy URL for a running dev server port
 * @param {number|string} port
 */
export function getDevServerPreviewUrl(port) {
  return `/api/ide/preview/${port}/`;
}

