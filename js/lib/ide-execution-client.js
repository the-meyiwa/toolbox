/* ============================================================
   Toolbox IDE — Client-Side Execution API Client
   Pure browser-safe transport client for the IDE Execution Service.
   Communicates strictly over HTTP/SSE with /api/ide/* endpoints.
   No server modules, child_process, or Node.js runtime APIs are bundled.
   ============================================================ */

/**
 * Standardized Execution Error
 */
export class ExecutionError extends Error {
  constructor(message, code = 'ERR_EXECUTION', details = {}) {
    super(message);
    this.name = 'ExecutionError';
    this.code = code; // ERR_NETWORK | ERR_BACKEND_UNAVAILABLE | ERR_WORKSPACE_NOT_FOUND | ERR_TIMEOUT | ERR_CANCELLED | ERR_COMMAND_FAILED | ERR_UNAUTHORIZED_PORT
    this.details = details;
  }
}

/**
 * Client-side interface to the Toolbox execution service
 */
export class ExecutionClient {
  constructor({ baseUrl = '' } = {}) {
    this.baseUrl = baseUrl;
    this.adapter = null; // Injected solely by test runners via setExecutionAdapter()
    this.cachedCapabilities = null;
    this.capabilitiesPromise = null;
  }

  /**
   * Dependency injection for unit test harnesses.
   * Production browser bundles never invoke this.
   */
  setAdapter(adapter) {
    this.adapter = adapter;
    this.cachedCapabilities = null;
  }

  /**
   * Detects capabilities and environment properties from the real execution backend
   * @param {boolean} forceRefresh
   * @returns {Promise<{ available: boolean, platform?: string, arch?: string, tools?: object, capabilities?: object }>}
   */
  async detectCapabilities(forceRefresh = false) {
    if (!forceRefresh && this.cachedCapabilities) return this.cachedCapabilities;

    if (this.adapter?.detectSystemTools) {
      const tools = await this.adapter.detectSystemTools();
      const capabilities = this.adapter.executionManager?.getCapabilities?.() || {
        provider: 'host-process',
        isolationTier: 'host-process',
        sandboxed: false
      };
      this.cachedCapabilities = {
        available: true,
        platform: typeof process !== 'undefined' ? process.platform : 'browser',
        arch: typeof process !== 'undefined' ? process.arch : 'unknown',
        tools,
        capabilities
      };
      return this.cachedCapabilities;
    }

    if (!forceRefresh && this.capabilitiesPromise) return this.capabilitiesPromise;

    this.capabilitiesPromise = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/api/ide/health`, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(2000) : undefined
        });

        if (!res.ok) {
          this.cachedCapabilities = {
            available: false,
            error: `HTTP ${res.status}`,
            code: 'ERR_BACKEND_UNAVAILABLE'
          };
          return this.cachedCapabilities;
        }

        const data = await res.json();
        this.cachedCapabilities = {
          available: Boolean(data.success),
          platform: data.platform,
          arch: data.arch,
          tools: data.tools || {},
          capabilities: data.capabilities || {}
        };
        return this.cachedCapabilities;
      } catch (err) {
        this.cachedCapabilities = {
          available: false,
          error: err.message,
          code: err.name === 'TimeoutError' ? 'ERR_TIMEOUT' : 'ERR_NETWORK'
        };
        return this.cachedCapabilities;
      } finally {
        this.capabilitiesPromise = null;
      }
    })();

    return this.capabilitiesPromise;
  }

  /**
   * Synchronizes an array of client workspace files to the disk workspace
   * @param {string} workspaceId
   * @param {Array<{ name: string, path?: string, content: string }>} files
   */
  async syncWorkspace(workspaceId, files = []) {
    const cleanId = String(workspaceId || 'default');

    if (this.adapter?.syncWorkspace) {
      return await this.adapter.syncWorkspace(cleanId, files);
    }

    const res = await fetch(`${this.baseUrl}/api/ide/workspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: cleanId, files })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new ExecutionError(`Workspace sync failed: ${errText}`, 'ERR_WORKSPACE_SYNC');
    }

    return await res.json();
  }

  /**
   * Fetches the real disk file tree for a workspace
   * @param {string} workspaceId
   */
  async fetchWorkspaceFiles(workspaceId) {
    const cleanId = String(workspaceId || 'default');

    if (this.adapter?.listWorkspaceFiles) {
      return await this.adapter.listWorkspaceFiles(cleanId);
    }

    const res = await fetch(`${this.baseUrl}/api/ide/workspace/files?workspaceId=${encodeURIComponent(cleanId)}`, {
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new ExecutionError(`Failed to list workspace files: HTTP ${res.status}`, 'ERR_WORKSPACE_NOT_FOUND');
    }

    const data = await res.json();
    return data.files || [];
  }

  /**
   * Reads a single file from the disk workspace
   * @param {string} workspaceId
   * @param {string} filePath
   */
  async readWorkspaceFile(workspaceId, filePath) {
    const cleanId = String(workspaceId || 'default');

    if (this.adapter?.readWorkspaceFile) {
      return await this.adapter.readWorkspaceFile(cleanId, filePath);
    }

    const res = await fetch(`${this.baseUrl}/api/ide/workspace/file?workspaceId=${encodeURIComponent(cleanId)}&path=${encodeURIComponent(filePath)}`, {
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new ExecutionError(`Failed to read file ${filePath}: HTTP ${res.status}`, 'ERR_FILE_READ');
    }

    return await res.text();
  }

  /**
   * Writes or updates a file directly on disk in the workspace
   * @param {string} workspaceId
   * @param {string} filePath
   * @param {string} content
   */
  async writeWorkspaceFile(workspaceId, filePath, content) {
    const cleanId = String(workspaceId || 'default');

    if (this.adapter?.writeWorkspaceFile) {
      return await this.adapter.writeWorkspaceFile(cleanId, filePath, content);
    }

    const res = await fetch(`${this.baseUrl}/api/ide/workspace/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: cleanId, path: filePath, content })
    });

    if (!res.ok) {
      throw new ExecutionError(`Failed to write file ${filePath}: HTTP ${res.status}`, 'ERR_FILE_WRITE');
    }

    return await res.json();
  }

  /**
   * Deletes a file or directory inside the disk workspace
   * @param {string} workspaceId
   * @param {string} filePath
   */
  async deleteWorkspaceFile(workspaceId, filePath) {
    const cleanId = String(workspaceId || 'default');

    if (this.adapter?.deleteWorkspaceFile) {
      return await this.adapter.deleteWorkspaceFile(cleanId, filePath);
    }

    const res = await fetch(`${this.baseUrl}/api/ide/workspace/file`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: cleanId, path: filePath })
    });

    if (!res.ok) {
      throw new ExecutionError(`Failed to delete file ${filePath}: HTTP ${res.status}`, 'ERR_FILE_DELETE');
    }

    return await res.json();
  }

  /**
   * Exports an archive of workspace source files
   */
  async exportArchive(workspaceId) {
    const cleanId = String(workspaceId || 'default');

    if (this.adapter?.exportWorkspaceArchive) {
      return await this.adapter.exportWorkspaceArchive(cleanId);
    }

    const res = await fetch(`${this.baseUrl}/api/ide/workspace/archive?workspaceId=${encodeURIComponent(cleanId)}`, {
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new ExecutionError(`Archive export failed: HTTP ${res.status}`, 'ERR_WORKSPACE_NOT_FOUND');
    }

    const data = await res.json();
    return data.archive;
  }

  /**
   * Imports an archive of workspace files
   */
  async importArchive(workspaceId, files = []) {
    const cleanId = String(workspaceId || 'default');

    if (this.adapter?.importWorkspaceArchive) {
      return await this.adapter.importWorkspaceArchive(cleanId, files);
    }

    const res = await fetch(`${this.baseUrl}/api/ide/workspace/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: cleanId, files })
    });

    if (!res.ok) {
      throw new ExecutionError(`Archive import failed: HTTP ${res.status}`, 'ERR_WORKSPACE_SYNC');
    }

    return await res.json();
  }

  /**
   * Executes a command on the real operating system backend with live streaming
   * @param {string} workspaceId
   * @param {string} command
   * @param {object} options
   */
  async execute(workspaceId, command, {
    cwd = '',
    env = {},
    timeoutMs = 300000,
    onEvent = () => {},
    onStdout = () => {},
    onStderr = () => {},
    onSystem = () => {},
    onPort = () => {},
    onExit = () => {}
  } = {}) {
    const cleanId = String(workspaceId || 'default');

    // In-memory test runner adapter path
    if (this.adapter?.spawnProcess) {
      const proc = this.adapter.spawnProcess(cleanId, command, { cwd, env, timeoutMs });
      const kill = (sig = 'SIGTERM') => this.adapter.killProcess(proc.id, sig);

      // Emit start event immediately
      const startEvt = {
        type: 'start',
        eventType: 'PROCESS_STARTED',
        processId: proc.id,
        workspaceId: cleanId,
        pid: proc.pid,
        command,
        timestamp: proc.startedAt || Date.now()
      };
      onEvent(startEvt);

      const promise = new Promise((resolve) => {
        const listener = (event) => {
          onEvent(event);
          if (event.type === 'output' || event.eventType === 'PROCESS_OUTPUT') {
            const stream = event.stream || (event.type === 'stderr' ? 'stderr' : 'stdout');
            const data = event.data || event.text || '';
            if (stream === 'stdout') onStdout(data);
            else if (stream === 'stderr') onStderr(data);
            else onSystem(data);
          } else if (event.type === 'port' || event.eventType === 'PORT_DETECTED') {
            if (event.port) onPort(event.port);
          } else if (event.type === 'exit' || event.eventType === 'PROCESS_EXITED' || event.eventType === 'PROCESS_CANCELLED' || event.eventType === 'PROCESS_TIMEOUT') {
            proc.listeners.delete(listener);
            onExit(event);
            resolve(event);
          }
        };
        proc.listeners.add(listener);

        if (proc.child) {
          proc.child.stdout?.on('data', chunk => {
            const text = chunk.toString('utf8');
            onStdout(text);
          });
          proc.child.stderr?.on('data', chunk => {
            const text = chunk.toString('utf8');
            onStderr(text);
          });
        }
      });

      return {
        processId: proc.id,
        pid: proc.pid,
        kill,
        promise
      };
    }

    // Pure Browser HTTP/SSE transport
    const spawnRes = await fetch(`${this.baseUrl}/api/ide/exec`, {
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
      throw new ExecutionError(
        errData.error || `Process spawn failed: HTTP ${spawnRes.status}`,
        errData.code || 'ERR_COMMAND_FAILED',
        errData
      );
    }

    const { processId, pid } = await spawnRes.json();

    // Emit start event immediately
    const startEvt = {
      type: 'start',
      eventType: 'PROCESS_STARTED',
      processId,
      workspaceId: cleanId,
      pid,
      command,
      timestamp: Date.now()
    };
    onEvent(startEvt);

    const kill = async (signal = 'SIGTERM') => {
      try {
        await fetch(`${this.baseUrl}/api/ide/exec/kill`, {
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
        reject(new ExecutionError('EventSource is not supported in this browser environment', 'ERR_NETWORK'));
        return;
      }

      const sse = new EventSource(`${this.baseUrl}/api/ide/exec/stream?processId=${encodeURIComponent(processId)}`);
      let hasExited = false;

      const handleParsedEvent = (payload) => {
        onEvent(payload);
        if (payload.type === 'output' || payload.eventType === 'PROCESS_OUTPUT') {
          const stream = payload.stream || (payload.type === 'stderr' ? 'stderr' : 'stdout');
          const data = payload.data || payload.text || '';
          if (stream === 'stdout') onStdout(data);
          else if (stream === 'stderr') onStderr(data);
          else onSystem(data);
        } else if (payload.type === 'port' || payload.eventType === 'PORT_DETECTED') {
          if (payload.port) onPort(payload.port);
        } else if (payload.type === 'exit' || payload.eventType === 'PROCESS_EXITED') {
          hasExited = true;
          sse.close();
          onExit(payload);
          resolve(payload);
        }
      };

      sse.addEventListener('output', (e) => {
        try { handleParsedEvent(JSON.parse(e.data)); } catch {}
      });
      sse.addEventListener('port', (e) => {
        try { handleParsedEvent(JSON.parse(e.data)); } catch {}
      });
      sse.addEventListener('exit', (e) => {
        try {
          handleParsedEvent(JSON.parse(e.data));
        } catch {
          hasExited = true;
          sse.close();
          resolve({ exitCode: 0, status: 'COMPLETED' });
        }
      });

      sse.onerror = () => {
        if (hasExited) return;
        fetch(`${this.baseUrl}/api/ide/processes?workspaceId=${encodeURIComponent(cleanId)}`)
          .then(r => r.json())
          .then(data => {
            const match = (data.processes || []).find(p => p.id === processId);
            if (match && match.status !== 'RUNNING') {
              sse.close();
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
   */
  async killProcess(processId, signal = 'SIGTERM') {
    if (this.adapter?.killProcess) {
      return this.adapter.killProcess(processId, signal);
    }
    return fetch(`${this.baseUrl}/api/ide/exec/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId, signal })
    });
  }

  /**
   * Returns the live reverse-proxy URL for a running dev server port
   */
  getPreviewUrl(port) {
    return `${this.baseUrl}/api/ide/preview/${port}/`;
  }
}

// Global singleton instance for app-wide use
export const executionClient = new ExecutionClient();

// Backwards-compatible standalone functional exports
export function setExecutionAdapter(adapter) {
  executionClient.setAdapter(adapter);
}
export function setNodeExecutionEngine(engine) {
  executionClient.setAdapter(engine);
}
export async function checkIdeBackend(forceRefresh = false) {
  return executionClient.detectCapabilities(forceRefresh);
}
export async function syncWorkspaceToDisk(workspaceId, files = []) {
  return executionClient.syncWorkspace(workspaceId, files);
}
export async function fetchWorkspaceDiskFiles(workspaceId) {
  return executionClient.fetchWorkspaceFiles(workspaceId);
}
export async function readWorkspaceDiskFile(workspaceId, filePath) {
  return executionClient.readWorkspaceFile(workspaceId, filePath);
}
export async function writeWorkspaceDiskFile(workspaceId, filePath, content) {
  return executionClient.writeWorkspaceFile(workspaceId, filePath, content);
}
export async function deleteWorkspaceDiskFile(workspaceId, filePath) {
  return executionClient.deleteWorkspaceFile(workspaceId, filePath);
}
export async function executeRemoteCommand(workspaceId, command, options) {
  return executionClient.execute(workspaceId, command, options);
}
export async function killRemoteProcess(processId, signal = 'SIGTERM') {
  return executionClient.killProcess(processId, signal);
}
export function getDevServerPreviewUrl(port) {
  return executionClient.getPreviewUrl(port);
}
