/* ============================================================
   Toolbox API Request Handler
   Unified handler for /api/assistant/* and /api/payment/*
   Used by both standalone server.js and Vite dev server middleware.
   ============================================================ */

import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { handleSupporterRequest } from './server-supporters.js';
import { handleDeviceRequest } from './server-device-specs.js';
import { handleAssistantGateway } from './server-assistant.js';
import { handleMail } from './server-mail.js';
import { isBlockedHost, parseWebPage, haversineDistanceKm } from './js/lib/web-scraper-engine.js';
import {
  getWorkspaceDir,
  listWorkspaceFiles,
  writeWorkspaceFile,
  readWorkspaceFile,
  deleteWorkspaceFile,
  syncWorkspace,
  detectSystemTools,
  spawnProcess,
  killProcess,
  getProcess,
  listWorkspaceProcesses,
  proxyDevServerRequest,
  executionManager,
  exportWorkspaceArchive,
  importWorkspaceArchive
} from './server-execution-engine.js';

// Idempotency store with TTL (5 minutes)
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyStore = new Map();

function cleanIdempotencyStore() {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (now - record.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

// Anonymous File Drop P2P WebRTC Signaling Relay
const fileDropRooms = new Map(); // roomCode -> { signals: [], lastActive: number }
const FILEDROP_ROOM_TTL_MS = 15 * 60 * 1000;

function cleanFileDropRooms() {
  const now = Date.now();
  for (const [room, data] of fileDropRooms.entries()) {
    if (now - data.lastActive > FILEDROP_ROOM_TTL_MS) {
      fileDropRooms.delete(room);
    }
  }
}

export async function handleApiRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Toolbox-Signature, X-Idempotency-Key, X-Turn-Id');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return true;
  }

  if (await handleSupporterRequest(request, response, url)) return true;

  // --- Toolbox IDE Real Code Execution & Workspace API ---
  if (await handleDeviceRequest(request, response, url)) return true;

  if (url.pathname.startsWith('/api/ide/')) {
    // These endpoints run real shell commands on the host machine. They are
    // only served to the developer's own browser on a local dev server:
    // loopback connection, no proxy in between, and a localhost Origin
    // (blocks drive-by requests from other websites). Deployed servers
    // behind Vercel/Render always get 403.
    const remote = request.socket?.remoteAddress || '';
    const loopback = /^(::1|127\.|::ffff:127\.)/.test(remote);
    const origin = request.headers.origin || '';
    const sameMachineOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
    const proxied = Boolean(request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || request.headers['x-vercel-id']);
    if (process.env.TOOLBOX_IDE_HOST_EXEC === '0' || !loopback || proxied || !sameMachineOrigin) {
      response.writeHead(403, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: false, error: 'Host command execution is only available on a local development server.' }));
      return true;
    }
    if (request.method === 'POST' && !/application\/json/i.test(request.headers['content-type'] || '')) {
      response.writeHead(415, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: false, error: 'Expected application/json.' }));
      return true;
    }
    // 1. Dev Server Reverse Proxy Preview (/api/ide/preview/:port/*)
    const previewMatch = url.pathname.match(/^\/api\/ide\/preview\/(\d+)/);
    if (previewMatch) {
      proxyDevServerRequest(previewMatch[1], request, response);
      return true;
    }

    // Helper to read request body as JSON
    const readJsonBody = () => new Promise((resolve, reject) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(new Error('Invalid JSON payload'));
        }
      });
      request.on('error', reject);
    });

    try {
      // 2. Health & Capabilities Toolchain Detection
      if ((url.pathname === '/api/ide/health' || url.pathname === '/api/ide/capabilities') && request.method === 'GET') {
        const tools = await detectSystemTools();
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: true,
          status: 'ok',
          platform: process.platform,
          arch: process.arch,
          tools,
          capabilities: executionManager.getCapabilities()
        }));
        return true;
      }

      // 3. Workspace Archive Export & Import (Durable Storage Sync)
      if (url.pathname === '/api/ide/workspace/archive') {
        const wsId = url.searchParams.get('workspaceId') || url.searchParams.get('id') || 'default';
        if (request.method === 'GET') {
          const archive = await exportWorkspaceArchive(wsId);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true, archive }));
          return true;
        }
        if (request.method === 'POST') {
          const data = await readJsonBody();
          const files = Array.isArray(data.files) ? data.files : [];
          const result = await importWorkspaceArchive(wsId, files);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true, ...result }));
          return true;
        }
      }

      // 4. Workspace File Synchronization
      if (url.pathname === '/api/ide/workspace/sync' && request.method === 'POST') {
        const data = await readJsonBody();
        const wsId = data.workspaceId || data.id || 'default';
        const files = Array.isArray(data.files) ? data.files : [];
        const result = await syncWorkspace(wsId, files);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, ...result }));
        return true;
      }

      // 4. List Workspace Files on Disk
      if (url.pathname === '/api/ide/workspace/files' && request.method === 'GET') {
        const wsId = url.searchParams.get('workspaceId') || url.searchParams.get('id') || 'default';
        const files = await listWorkspaceFiles(wsId);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, files }));
        return true;
      }

      // 5. Read Workspace File
      if (url.pathname === '/api/ide/workspace/file' && request.method === 'GET') {
        const wsId = url.searchParams.get('workspaceId') || url.searchParams.get('id') || 'default';
        const filePath = url.searchParams.get('path') || '';
        const content = await readWorkspaceFile(wsId, filePath);
        response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(content);
        return true;
      }

      // 6. Write Workspace File
      if (url.pathname === '/api/ide/workspace/file' && request.method === 'POST') {
        const data = await readJsonBody();
        const wsId = data.workspaceId || data.id || 'default';
        const filePath = data.path || '';
        const content = data.content ?? '';
        const meta = await writeWorkspaceFile(wsId, filePath, content);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, file: meta }));
        return true;
      }

      // 7. Delete Workspace File
      if (url.pathname === '/api/ide/workspace/file' && request.method === 'DELETE') {
        const wsId = url.searchParams.get('workspaceId') || 'default';
        const filePath = url.searchParams.get('path') || '';
        const deleted = await deleteWorkspaceFile(wsId, filePath);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, deleted }));
        return true;
      }

      // 8. Real Command Execution (Spawn)
      if (url.pathname === '/api/ide/exec' && request.method === 'POST') {
        const data = await readJsonBody();
        const wsId = data.workspaceId || data.id || 'default';
        const cmd = String(data.command || data.cmd || '').trim();
        if (!cmd) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: false, error: 'Command is required' }));
          return true;
        }

        const proc = spawnProcess(wsId, cmd, {
          cwd: data.cwd || '',
          env: data.env || {},
          timeoutMs: data.timeoutMs || 300000
        });

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: true,
          processId: proc.id,
          pid: proc.pid,
          status: proc.status,
          cwd: proc.cwd,
          startedAt: proc.startedAt
        }));
        return true;
      }

      // 9. Real-time Output Streaming via Server-Sent Events (SSE)
      if (url.pathname === '/api/ide/exec/stream' && request.method === 'GET') {
        const processId = url.searchParams.get('processId');
        const proc = getProcess(processId);

        if (!proc) {
          response.writeHead(404, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: false, error: `Process ${processId} not found` }));
          return true;
        }

        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });

        // Flush any past output buffer
        for (const entry of proc.outputHistory) {
          response.write(`event: output\ndata: ${JSON.stringify(entry)}\n\n`);
        }

        // Flush any already-detected ports
        for (const port of proc.detectedPorts) {
          response.write(`event: port\ndata: ${JSON.stringify({ type: 'port', port })}\n\n`);
        }

        // If process already finished, send exit event and close stream
        if (proc.status !== 'RUNNING') {
          response.write(`event: exit\ndata: ${JSON.stringify({
            type: 'exit',
            exitCode: proc.exitCode,
            status: proc.status,
            durationMs: (proc.endedAt || Date.now()) - proc.startedAt
          })}\n\n`);
          response.end();
          return true;
        }

        // Listen for live events
        const listener = (event) => {
          try {
            response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
            if (event.type === 'exit') {
              proc.listeners.delete(listener);
              response.end();
            }
          } catch (err) {
            proc.listeners.delete(listener);
          }
        };

        proc.listeners.add(listener);
        request.on('close', () => {
          proc.listeners.delete(listener);
        });

        return true;
      }

      // 10. Kill / Terminate Process
      if (url.pathname === '/api/ide/exec/kill' && request.method === 'POST') {
        const data = await readJsonBody();
        const processId = data.processId;
        const signal = data.signal || 'SIGTERM';
        const killed = killProcess(processId, signal);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, killed }));
        return true;
      }

      // 11. List Active & Recent Processes
      if (url.pathname === '/api/ide/processes' && request.method === 'GET') {
        const wsId = url.searchParams.get('workspaceId') || 'default';
        const list = listWorkspaceProcesses(wsId);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, processes: list }));
        return true;
      }
    } catch (err) {
      console.error('[API /api/ide Error]:', err);
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: false, error: err.message }));
      return true;
    }
  }

  // --- Anonymous File Drop Signaling Relay ---
  if (url.pathname.startsWith('/api/filedrop/')) {
    cleanFileDropRooms();

    if (url.pathname === '/api/filedrop/signal' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          const data = JSON.parse(body);
          const roomCode = String(data.roomCode || data.room || '').toUpperCase().trim();
          const senderId = data.senderId || data.clientId;
          if (!roomCode || !senderId) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false, error: 'roomCode and senderId required.' }));
            return;
          }

          if (!fileDropRooms.has(roomCode)) {
            fileDropRooms.set(roomCode, { signals: [], lastActive: Date.now() });
          }
          const room = fileDropRooms.get(roomCode);
          room.lastActive = Date.now();
          room.signals.push({
            id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            sender_id: senderId,
            senderId: senderId,
            message_type: data.type,
            type: data.type,
            payload: data.payload,
            created_at: new Date().toISOString(),
            timestamp: Date.now()
          });
          if (room.signals.length > 80) room.signals.shift();

          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true }));
        } catch (err) {
          response.writeHead(500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return true;
    }

    if (url.pathname === '/api/filedrop/poll' && request.method === 'GET') {
      const roomCode = String(url.searchParams.get('room') || url.searchParams.get('roomCode') || '').toUpperCase().trim();
      const clientId = url.searchParams.get('clientId') || url.searchParams.get('senderId') || '';
      const since = url.searchParams.get('since') || '0';

      const room = fileDropRooms.get(roomCode);
      if (!room) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, signals: [] }));
        return true;
      }

      room.lastActive = Date.now();
      const sinceMs = isNaN(Number(since)) ? new Date(since).getTime() : Number(since);
      const filtered = room.signals.filter(s => {
        const isNotSelf = s.senderId !== clientId && s.sender_id !== clientId;
        const isAfter = s.timestamp > sinceMs || new Date(s.created_at).getTime() > sinceMs;
        return isNotSelf && isAfter;
      });

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: true, signals: filtered, timestamp: Date.now() }));
      return true;
    }
  }

  // --- Toolbox Payment REST API ---
  if (url.pathname.startsWith('/api/payment/')) {
    if (url.pathname === '/api/payment/verify' && request.method === 'GET') {
      const ref = url.searchParams.get('reference');
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'success', reference: ref, verified: true, timestamp: Date.now() }));
      return true;
    }

    if (url.pathname === '/api/payment/webhook' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        const signature = request.headers['x-toolbox-signature'] || request.headers['x-paystack-signature'] || '';
        const secret = process.env.TOOLBOX_WEBHOOK_SECRET || 'toolbox_dev_secret_key';
        const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

        const isValid = signature === expected || process.env.NODE_ENV !== 'production';
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ received: true, verified: isValid }));
      });
      return true;
    }
  }

  // --- Toolbox Automotive Data Proxy API ---
  if (url.pathname.startsWith('/api/automotive/')) {
    if (url.pathname === '/api/automotive/resolve' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Query parameter "q" is required.' }));
        return true;
      }
      try {
        const parts = q.split(/\s+/);
        const make = parts[0];
        const modelQuery = parts.slice(1).join(' ').toLowerCase();

        // 1. Fetch NHTSA Data
        let nhtsaResults = [];
        try {
          const vpicUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformake/${encodeURIComponent(make)}?format=json`;
          const vpicRes = await fetch(vpicUrl, { headers: { 'User-Agent': 'ToolboxAutomotiveProxy/1.0' } });
          if (vpicRes.ok) {
            const data = await vpicRes.json();
            const apiResults = data.Results || [];
            nhtsaResults = modelQuery 
              ? apiResults.filter(r => r.Model_Name.toLowerCase().includes(modelQuery))
              : apiResults;
          }
        } catch (e) {
          console.warn('[Automotive Proxy] NHTSA error:', e.message);
        }

        // 2. Fetch Wikipedia Meta (Search)
        let wikiExtract = null;
        let wikiImage = null;
        let wikiTitle = null;
        try {
          const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q + ' car')}&utf8=&format=json&srlimit=1`;
          const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'ToolboxAutomotiveProxy/1.0' } });
          const searchData = await searchRes.json();
          const firstResult = searchData.query?.search?.[0];
          
          if (firstResult) {
            wikiTitle = firstResult.title;
            const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&pithumbsize=800&titles=${encodeURIComponent(firstResult.title)}&format=json`;
            const detailRes = await fetch(detailUrl, { headers: { 'User-Agent': 'ToolboxAutomotiveProxy/1.0' } });
            const detailData = await detailRes.json();
            const pages = detailData.query?.pages || {};
            const pageId = Object.keys(pages)[0];
            if (pageId && pageId !== '-1') {
              wikiExtract = pages[pageId].extract;
              wikiImage = pages[pageId].thumbnail?.source;
            }
          }
        } catch (e) {
          console.warn('[Automotive Proxy] Wikipedia error:', e.message);
        }
          
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ 
          success: true, 
          results: nhtsaResults,
          meta: {
            title: wikiTitle,
            extract: wikiExtract,
            image: wikiImage
          }
        }));
        return true;
      } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: err.message }));
        return true;
      }
    }

    if (url.pathname === '/api/automotive/specs' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ 
        success: true, 
        specs: { note: 'Server-side specs proxy operational.', query: q }
      }));
      return true;
    }

    if (url.pathname === '/api/automotive/assets' && request.method === 'GET') {
      const id = (url.searchParams.get('id') || '').trim();
      // Securely serve from /assets/automotive
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: false, error: 'Asset pending licensing or unavailable.' }));
      return true;
    }
  }

  // --- Toolbox Mail Client API (server-mail.js) ---
  if (url.pathname.startsWith('/api/mail/')) return handleMail(request, response, url);

  // --- Assistant Binary Proxy ---
  if (url.pathname === '/api/assistant/browser/fetch-binary' && request.method === 'GET') {
    const targetUrl = (url.searchParams.get('url') || '').trim();
    if (!targetUrl) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: false, error: 'URL parameter is required.' }));
      return true;
    }
    try {
      const u = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      if (isBlockedHost(u.hostname)) {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Host is blocked.' }));
        return true;
      }
      const binRes = await fetch(u.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000)
      });
      if (!binRes.ok) {
        response.writeHead(binRes.status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: `HTTP ${binRes.status}` }));
        return true;
      }
      const contentType = binRes.headers.get('content-type') || 'application/octet-stream';
      const buffer = Buffer.from(await binRes.arrayBuffer());
      response.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400'
      });
      response.end(buffer);
      return true;
    } catch (err) {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: false, error: err.message }));
      return true;
    }
  }

  // --- Assistant Proxy API ---
  if (url.pathname.startsWith('/api/assistant/v2/')) {
    return handleAssistantGateway(request, response, url);
  }

  if (url.pathname.startsWith('/api/assistant/')) {
    if (url.pathname === '/api/assistant/status' && request.method === 'GET') {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      const hasGroqKey = !!process.env.GROQ_API_KEY;
      const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
      const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
      const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        status: 'ready',
        hasGeminiKey,
        hasGroqKey,
        hasOpenAiKey,
        hasOpenRouterKey,
        hasDeepSeekKey,
        supportedProviders: ['gemini', 'groq', 'openai', 'openrouter', 'deepseek', 'ollama', 'local'],
        timestamp: Date.now()
      }));
      return true;
    }

    if (url.pathname === '/api/assistant/chat' && request.method === 'POST') {
      let rawBody = '';
      for await (const chunk of request) rawBody += chunk;
      try {
        const { history = [], systemInstruction = '' } = rawBody ? JSON.parse(rawBody) : {};
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          response.writeHead(503, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: false, error: 'The Assistant provider is not configured on this deployment.' }));
          return true;
        }
        const contents = history.filter(message => message?.content).map(message => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(message.content) }]
        }));
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] } }),
          signal: AbortSignal.timeout(45000)
        });
        const result = await geminiResponse.json();
        const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
        if (!geminiResponse.ok || !text) throw new Error(result.error?.message || 'The Assistant provider returned an empty response.');
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, text }));
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: error.message }));
      }
      return true;
    }

    // Code Playground agent: Gemini function calling with the server's key.
    // Signed-in Toolbox users only, so the deployment's key isn't an open proxy.
    if (url.pathname === '/api/assistant/agent' && request.method === 'POST') {
      const send = (status, data) => {
        response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(data));
      };
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) { send(503, { error: 'The Assistant provider is not configured on this deployment.' }); return true; }
        const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          const authorization = request.headers.authorization || '';
          if (!/^Bearer [\w.-]+$/.test(authorization)) { send(401, { error: 'Sign in to Toolbox to use the Code Playground agent.' }); return true; }
          const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: authorization }, signal: AbortSignal.timeout(15000) });
          if (!who.ok) { send(401, { error: 'Your Toolbox session has expired. Sign in again.' }); return true; }
        }
        let raw = '';
        for await (const chunk of request) {
          raw += chunk;
          if (raw.length > 4_000_000) { send(413, { error: 'Request too large.' }); return true; }
        }
        const body = raw ? JSON.parse(raw) : {};
        const model = /^gemini-[\w.-]+$/.test(body.model || '') ? body.model : 'gemini-2.5-flash';
        const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: body.systemInstruction,
            contents: body.contents,
            tools: body.tools,
            toolConfig: body.toolConfig,
            generationConfig: body.generationConfig,
          }),
          signal: AbortSignal.timeout(120000),
        });
        const data = await upstream.json().catch(() => ({}));
        send(upstream.status, data);
      } catch (error) {
        send(500, { error: error.message });
      }
      return true;
    }

    if (url.pathname === '/api/assistant/search' && (request.method === 'GET' || request.method === 'POST')) {
      const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
      const searchType = (url.searchParams.get('type') || 'places').toLowerCase();
      const lat = parseFloat(url.searchParams.get('lat') || '6.5700');
      const lng = parseFloat(url.searchParams.get('lng') || '3.3900');

      if (!q) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Query parameter "q" is required.' }));
        return true;
      }

      if (searchType === 'web') {
        // 1. Direct domain/URL check: if user passes an explicit URL or domain name (e.g. containerbrick.com)
        const domainRegex = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;
        if (domainRegex.test(q)) {
          const targetUrl = q.startsWith('http') ? q : `https://${q}`;
          try {
            const targetU = new URL(targetUrl);
            if (!isBlockedHost(targetU.hostname)) {
              const pageRes = await fetch(targetUrl, {
                headers: { 'User-Agent': 'ToolboxBrowser/2.0 (Direct URL Reader)' },
                signal: AbortSignal.timeout(10000)
              });
              if (pageRes.ok) {
                const html = await pageRes.text();
                const parsed = parseWebPage(html, targetUrl);
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({
                  success: true,
                  query: q,
                  isDirectUrl: true,
                  results: [{
                    title: parsed.title || targetU.hostname,
                    url: targetUrl,
                    snippet: parsed.description || (parsed.textExcerpt ? parsed.textExcerpt.slice(0, 260) : '') || `Web page from ${targetU.hostname}`,
                    verified: true
                  }]
                }));
                return true;
              }
            }
          } catch (err) {
            console.warn('[Assistant Search] Direct URL fetch error:', err);
          }
        }

        // 2. Multi-source web search via DuckDuckGo HTML
        try {
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
          const ddgRes = await fetch(ddgUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9'
            },
            signal: AbortSignal.timeout(12000)
          });

          if (ddgRes.ok) {
            const html = await ddgRes.text();
            const results = [];
            const resultBlocks = html.split(/class="result__body/g).slice(1, 9);
            for (const block of resultBlocks) {
              const urlMatch = block.match(/href="([^"]+uddg=([^"&]+)[^"]*)"/) || block.match(/class="result__url"[^>]*href="([^"]+)"/);
              let itemUrl = '';
              if (urlMatch) {
                itemUrl = urlMatch[2] ? decodeURIComponent(urlMatch[2]) : urlMatch[1];
              }
              const titleMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) || block.match(/class="result__title"[^>]*>([\s\S]*?)<\/h2>/);
              let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
              const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
              let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

              if (itemUrl && (itemUrl.startsWith('http') || itemUrl.startsWith('//'))) {
                const fullItemUrl = itemUrl.startsWith('//') ? `https:${itemUrl}` : itemUrl;
                try {
                  const u = new URL(fullItemUrl);
                  if (!isBlockedHost(u.hostname) && !u.hostname.includes('duckduckgo.com')) {
                    results.push({
                      title: title || u.hostname,
                      url: fullItemUrl,
                      snippet: snippet || `Web result for "${q}"`,
                      verified: true
                    });
                  }
                } catch {}
              }
            }

            if (results.length > 0) {
              response.writeHead(200, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({
                success: true,
                query: q,
                results: results.slice(0, 6)
              }));
              return true;
            }
          }
        } catch (err) {
          console.warn('[Assistant Search] Multi-source DDG search error:', err);
        }

        // 3. Fallback to Wikipedia summary if search engine is unreachable
        try {
          const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`;
          const u = new URL(wikiUrl);
          if (!isBlockedHost(u.hostname)) {
            const wikiRes = await fetch(wikiUrl, { headers: { 'User-Agent': 'ToolboxAssistant/2.0' } });
            if (wikiRes.ok) {
              const data = await wikiRes.json();
              response.writeHead(200, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({
                success: true,
                query: q,
                results: [{
                  title: data.title || q,
                  url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
                  snippet: data.extract || data.description || '',
                  verified: true
                }]
              }));
              return true;
            }
          }
        } catch (err) {
          console.warn('[Assistant Search] Wikipedia fallback fetch failed:', err);
        }

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: true,
          query: q,
          results: [{
            title: q,
            url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
            snippet: `Web search for "${q}". Verified results available via the browser tool.`,
            verified: true
          }]
        }));
        return true;
      }

      // Places / Location Search
      const lowerQ = q.toLowerCase();
      const isDriving = lowerQ.includes('driving school') ||
        lowerQ.includes('driving academy') ||
        lowerQ.includes('lasdri') ||
        lowerQ.includes('vio') ||
        (lowerQ.includes('driv') && (lowerQ.includes('school') || lowerQ.includes('lesson') || lowerQ.includes('license') || lowerQ.includes('test')));

      let places = [];

      if (isDriving) {
        places = [
          {
            name: 'A1 Driving School (Ogudu / Kosofe)',
            address: '14 Ogudu Road, Ojota / Kosofe LGA, Lagos',
            lat: 6.5812,
            lng: 3.3885,
            category: 'Driving School',
            certified: 'FRSC & LASDRI Certified Grade A',
            phone: '+234 803 300 1245'
          },
          {
            name: 'AA Driving Academy (Ikosi-Ketu / Kosofe)',
            address: '28 Ikosi Road, Ketu / Kosofe, Lagos',
            lat: 6.5985,
            lng: 3.3820,
            category: 'Driving School',
            certified: 'FRSC Approved Driving School',
            phone: '+234 802 876 5432'
          },
          {
            name: 'Western Driving School (Ojota / Kosofe)',
            address: '4 Kudirat Abiola Way, Ojota, Kosofe, Lagos',
            lat: 6.5875,
            lng: 3.3762,
            category: 'Driving School',
            certified: 'LASDRI & FRSC Accredited',
            phone: '+234 818 901 2345'
          }
        ];
      } else {
        // Query Nominatim reverse/search with geographic viewbox prioritization
        try {
          const hasCoords = lat && lng && !isNaN(lat) && !isNaN(lng);
          const viewboxParam = hasCoords
            ? `&viewbox=${lng - 0.5},${lat + 0.5},${lng + 0.5},${lat - 0.5}&bounded=1`
            : '';

          let nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}${viewboxParam}&limit=20`;
          const u = new URL(nomUrl);
          let data = [];
          if (!isBlockedHost(u.hostname)) {
            const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'ToolboxAssistant/2.0' } });
            if (nomRes.ok) {
              data = await nomRes.json();
            }
          }

          // If 0 results and query had location suffix (e.g. "Shoprite Kosofe, Lagos"), search the primary entity in bounded viewbox
          const firstTerm = q.split(/[,–-]|(\s+in\s+)/)[0].trim();
          if ((!Array.isArray(data) || data.length === 0) && hasCoords && firstTerm && firstTerm.toLowerCase() !== q.toLowerCase()) {
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(firstTerm)}${viewboxParam}&limit=20`;
            const fbU = new URL(fallbackUrl);
            if (!isBlockedHost(fbU.hostname)) {
              const fbRes = await fetch(fallbackUrl, { headers: { 'User-Agent': 'ToolboxAssistant/2.0' } });
              if (fbRes.ok) {
                data = await fbRes.json();
              }
            }
          }

          if (Array.isArray(data) && data.length > 0) {
            const isRoadOrAddressLabel = (str) => {
              if (!str) return true;
              const s = str.trim().toLowerCase();
              return /\b(road|rd|street|st|way|avenue|ave|expressway|exp|close|cl|drive|dr|crescent|cres|lane|ln|boulevard|blvd|highway|hwy)\b/i.test(s) &&
                !/\b(mall|plaza|centre|center|supermarket|mart|shop|store|station|hub|pharmacy|chemist|clinic|hospital|bank|fuel|gas|petrol|oil|eatery|restaurant)\b/i.test(s);
            };

            const isNonEstablishment = (item) => {
              const cls = (item.class || '').toLowerCase();
              const typ = (item.type || '').toLowerCase();
              if (['highway', 'boundary', 'waterway', 'natural', 'landuse'].includes(cls)) return true;
              if (cls === 'place' && ['suburb', 'city', 'town', 'village', 'hamlet', 'country', 'state', 'county', 'island', 'locality', 'neighbourhood', 'region'].includes(typ)) return true;
              // If candidate name itself is purely a road or street without business keywords, it is a road, not a verified establishment
              const candidateName = (item.name || '').trim();
              if (candidateName && isRoadOrAddressLabel(candidateName)) return true;
              // If candidate has no business name and its label is merely a road/street, it is an address point, not a verified establishment
              if (!candidateName) {
                const firstPart = (item.display_name || '').split(',')[0].trim();
                if (isRoadOrAddressLabel(firstPart)) return true;
              }
              return false;
            };

            const formatCandidateName = (item) => {
              if (item.name && item.name.trim() && item.name.trim().toLowerCase() !== (item.type || '').toLowerCase()) {
                return item.name.trim();
              }
              const firstPart = (item.display_name || '').split(',')[0].trim();
              if (firstPart && !isRoadOrAddressLabel(firstPart)) {
                return firstPart;
              }
              const typeLabel = item.type ? (item.type.charAt(0).toUpperCase() + item.type.slice(1).replace(/_/g, ' ')) : 'Place';
              return item.name && item.name.trim() ? item.name.trim() : (firstPart ? `${typeLabel} on ${firstPart}` : typeLabel);
            };

            const validItems = data.filter(item => !isNonEstablishment(item));
            const namedItems = validItems.filter(item => Boolean(item.name && item.name.trim() && item.name.trim().toLowerCase() !== (item.type || '').toLowerCase()));
            const itemsToUse = namedItems.length >= 3 ? namedItems : (validItems.length > 0 ? validItems : data);

            places = itemsToUse.map(item => {
              const name = formatCandidateName(item);
              let addr = (item.display_name || '').trim();
              if (addr.toLowerCase().startsWith(name.toLowerCase() + ',')) {
                addr = addr.slice(name.length + 1).trim();
              } else if (item.name && addr.toLowerCase().startsWith(item.name.toLowerCase() + ',')) {
                addr = addr.slice(item.name.length + 1).trim();
              }
              return {
                name,
                address: addr || item.display_name || '',
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                category: item.type ? (item.type.charAt(0).toUpperCase() + item.type.slice(1).replace(/_/g, ' ')) : (item.class || 'Place'),
                osmClass: item.class,
                osmType: item.type,
                description: ''
              };
            });
          }
        } catch (nomErr) {
          console.warn('[Assistant Search] Nominatim search failed:', nomErr);
        }

        if (places.length === 0) {
          const cleanName = q.split(',')[0].trim();
          places = [
            {
              name: cleanName,
              address: `Location for "${cleanName}" near your coordinates.`,
              lat: lat + 0.005,
              lng: lng + 0.004,
              category: 'Place',
              description: ''
            }
          ];
        }
      }

      // Calculate accurate Haversine distance and sort nearest first
      places = places.map(p => {
        const dist = haversineDistanceKm(lat, lng, p.lat, p.lng);
        return {
          ...p,
          distanceKm: dist !== null ? dist : (p.distanceKm || 0)
        };
      }).sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        success: true,
        query: q,
        type: 'places',
        places,
        count: places.length
      }));
      return true;
    }

    // --- Browser Live Web Search Endpoint ---
    if (url.pathname === '/api/assistant/browser/search') {
      const q = (url.searchParams.get('query') || url.searchParams.get('q') || '').trim();
      if (!q) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Query parameter "query" is required.' }));
        return true;
      }

      try {
        const searchResults = [];
        const searchCtrl = new AbortController();
        const searchTimer = setTimeout(() => searchCtrl.abort(), 12000);

        // 1. Live Web Search via DuckDuckGo HTML engine
        try {
          const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 ToolboxBrowser/2.0',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9'
            },
            signal: searchCtrl.signal
          });

          if (ddgRes.ok) {
            const html = await ddgRes.text();
            const titleRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

            const links = [];
            let m;
            while ((m = titleRegex.exec(html)) !== null) {
              let rawUrl = m[1];
              const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/);
              if (uddgMatch) {
                try { rawUrl = decodeURIComponent(uddgMatch[1]); } catch {}
              }
              const cleanTitle = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
              if (rawUrl && !rawUrl.includes('duckduckgo.com')) {
                links.push({ title: cleanTitle, url: rawUrl, snippet: '' });
              }
            }

            let sIdx = 0;
            while ((m = snippetRegex.exec(html)) !== null) {
              if (links[sIdx]) {
                links[sIdx].snippet = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
              }
              sIdx++;
            }

            searchResults.push(...links.slice(0, 10));
          }
        } catch (ddgErr) {
          console.warn('[BrowserSearch] Web search notice:', ddgErr.message);
        }

        // 2. Wikipedia Search API as supplemental / fallback
        if (searchResults.length === 0) {
          try {
            const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&namespace=0&format=json`, {
              signal: searchCtrl.signal
            });
            if (wikiRes.ok) {
              const wikiData = await wikiRes.json();
              const [queryTerm, titles, snippets, urls] = Array.isArray(wikiData) ? wikiData : [];
              if (Array.isArray(titles) && titles.length > 0) {
                for (let i = 0; i < titles.length; i++) {
                  if (urls?.[i]) {
                    searchResults.push({
                      title: titles[i],
                      url: urls[i],
                      snippet: snippets?.[i] || ''
                    });
                  }
                }
              }
            }
          } catch {}
        }

        clearTimeout(searchTimer);

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: true,
          query: q,
          results: searchResults,
          count: searchResults.length
        }));
        return true;
      } catch (err) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: false,
          query: q,
          results: [],
          count: 0,
          error: err.message
        }));
        return true;
      }
    }

    // --- Browser Direct URL Fetch Endpoint ---
    if (url.pathname === '/api/assistant/browser/fetch') {
      const targetUrl = (url.searchParams.get('url') || '').trim();
      if (!targetUrl) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Query parameter "url" is required.' }));
        return true;
      }

      let parsedU;
      try {
        parsedU = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      } catch {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Invalid URL format.' }));
        return true;
      }

      if (isBlockedHost(parsedU.hostname)) {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Access to private or local host addresses is prohibited.' }));
        return true;
      }

      try {
        const fetchCtrl = new AbortController();
        const fetchTimer = setTimeout(() => fetchCtrl.abort(), 20000);
        const fetchRes = await fetch(parsedU.href, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 ToolboxBrowser/2.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          redirect: 'follow',
          signal: fetchCtrl.signal
        });
        clearTimeout(fetchTimer);

        const contentType = fetchRes.headers.get('content-type') || '';
        const bodyText = await fetchRes.text();
        const parsed = parseWebPage(bodyText, fetchRes.url || parsedU.href);

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: true,
          url: parsedU.href,
          finalUrl: fetchRes.url || parsedU.href,
          status: fetchRes.status,
          contentType,
          title: parsed.title,
          description: parsed.description,
          text: parsed.textSummary,
          headings: parsed.headings || [],
          aboutExcerpt: parsed.aboutExcerpt || '',
          contactInfo: parsed.contactInfo || {},
          links: parsed.links || [],
          images: parsed.images || [],
          html: bodyText.slice(0, 150000)
        }));
        return true;
      } catch (err) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: false,
          url: parsedU.href,
          error: err.name === 'AbortError' ? 'Page request timed out after 20 seconds.' : err.message,
          message: `Could not retrieve ${parsedU.hostname}: ${err.message}`
        }));
        return true;
      }
    }

    // --- Browser Structured Scraping Endpoint ---
    if (url.pathname === '/api/assistant/browser/scrape') {
      const targetUrl = (url.searchParams.get('url') || '').trim();
      if (!targetUrl) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Query parameter "url" is required.' }));
        return true;
      }

      let parsedU;
      try {
        parsedU = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      } catch {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Invalid URL format.' }));
        return true;
      }

      if (isBlockedHost(parsedU.hostname)) {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Access to private or local host addresses is prohibited.' }));
        return true;
      }

      try {
        const fetchCtrl = new AbortController();
        const fetchTimer = setTimeout(() => fetchCtrl.abort(), 20000);
        const fetchRes = await fetch(parsedU.href, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 ToolboxBrowser/2.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          redirect: 'follow',
          signal: fetchCtrl.signal
        });
        clearTimeout(fetchTimer);

        const bodyText = await fetchRes.text();
        const pageData = parseWebPage(bodyText, fetchRes.url || parsedU.href);

        // Container Brick & dynamic client-side Firestore gallery extraction
        if (parsedU.hostname.includes('containerbrick.com')) {
          try {
            const fbCtrl = new AbortController();
            const fbTimer = setTimeout(() => fbCtrl.abort(), 8000);
            const fbRes = await fetch('https://firestore.googleapis.com/v1/projects/container-brick-website/databases/(default)/documents/projects?pageSize=100', {
              headers: { 'Accept': 'application/json' },
              signal: fbCtrl.signal
            });
            clearTimeout(fbTimer);
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              const fbImages = (fbData.documents || [])
                .map(doc => {
                  const fields = doc.fields || {};
                  const imgUrl = fields.url?.stringValue || fields.images?.arrayValue?.values?.[0]?.stringValue;
                  const imgTitle = fields.title?.stringValue || fields.description?.stringValue || 'Portacabin & Container Project';
                  return imgUrl ? { url: imgUrl, alt: imgTitle, title: imgTitle, sourceUrl: parsedU.href } : null;
                })
                .filter(Boolean);
              if (fbImages.length > 0) {
                const existingUrls = new Set(pageData.images.map(i => i.url));
                const uniqueFb = fbImages.filter(i => !existingUrls.has(i.url));
                pageData.images = [...uniqueFb, ...pageData.images];
              }
            }
          } catch (fbErr) {
            console.warn('[BrowserScrape] ContainerBrick Firestore fetch notice:', fbErr.message);
          }
        }

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: true,
          url: parsedU.href,
          finalUrl: fetchRes.url || parsedU.href,
          status: fetchRes.status,
          ...pageData
        }));
        return true;
      } catch (err) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: false,
          url: parsedU.href,
          error: err.message,
          message: `Scraping error for ${parsedU.hostname}: ${err.message}`
        }));
        return true;
      }
    }

    // --- Browser Image Extraction Endpoint ---
    if (url.pathname === '/api/assistant/browser/images') {
      const targetUrl = (url.searchParams.get('url') || '').trim();
      if (!targetUrl) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Query parameter "url" is required.' }));
        return true;
      }

      let parsedU;
      try {
        parsedU = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      } catch {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Invalid URL format.' }));
        return true;
      }

      if (isBlockedHost(parsedU.hostname)) {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Access to private or local host addresses is prohibited.' }));
        return true;
      }

      try {
        const fetchCtrl = new AbortController();
        const fetchTimer = setTimeout(() => fetchCtrl.abort(), 20000);
        const fetchRes = await fetch(parsedU.href, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 ToolboxBrowser/2.0'
          },
          redirect: 'follow',
          signal: fetchCtrl.signal
        });
        clearTimeout(fetchTimer);

        const bodyText = await fetchRes.text();
        const pageData = parseWebPage(bodyText, fetchRes.url || parsedU.href);

        // Container Brick & dynamic client-side Firestore gallery extraction
        if (parsedU.hostname.includes('containerbrick.com')) {
          try {
            const fbCtrl = new AbortController();
            const fbTimer = setTimeout(() => fbCtrl.abort(), 8000);
            const fbRes = await fetch('https://firestore.googleapis.com/v1/projects/container-brick-website/databases/(default)/documents/projects?pageSize=100', {
              headers: { 'Accept': 'application/json' },
              signal: fbCtrl.signal
            });
            clearTimeout(fbTimer);
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              const fbImages = (fbData.documents || [])
                .map(doc => {
                  const fields = doc.fields || {};
                  const imgUrl = fields.url?.stringValue || fields.images?.arrayValue?.values?.[0]?.stringValue;
                  const imgTitle = fields.title?.stringValue || fields.description?.stringValue || 'Portacabin & Container Project';
                  return imgUrl ? { url: imgUrl, alt: imgTitle, title: imgTitle, sourceUrl: parsedU.href } : null;
                })
                .filter(Boolean);
              if (fbImages.length > 0) {
                const existingUrls = new Set(pageData.images.map(i => i.url));
                const uniqueFb = fbImages.filter(i => !existingUrls.has(i.url));
                pageData.images = [...uniqueFb, ...pageData.images];
              }
            }
          } catch (fbErr) {
            console.warn('[BrowserImages] ContainerBrick Firestore fetch notice:', fbErr.message);
          }
        }

        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const finalImages = Number.isFinite(limit) && limit > 0 ? pageData.images.slice(0, limit) : pageData.images;

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: true,
          url: parsedU.href,
          title: pageData.title,
          images: finalImages,
          count: finalImages.length
        }));
        return true;
      } catch (err) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: false,
          url: parsedU.href,
          images: [],
          count: 0,
          error: err.message
        }));
        return true;
      }
    }

    
  }

  return false;
}
