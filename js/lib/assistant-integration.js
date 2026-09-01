/**
 * TOOLBOX ASSISTANT — Integration Adapter
 *
 * Bridges new persistence/rendering systems with existing assistant.js
 * Maintains backward compatibility while enabling new capabilities:
 * - Message persistence across refreshes
 * - Result reconstruction from historical messages
 * - Unified result rendering framework
 * - Tool discovery and LLM integration
 */

import { AssistantMessage, ToolResult, conversationPersistence } from './assistant-message-persistence.js';
import { renderToolResult, cleanupToolResult, selectRenderer } from './assistant-result-renderer.js';
import { toolDiscovery } from './assistant-tool-discovery.js';

/**
 * Conversation Integration Manager
 *
 * Wraps the existing assistant history array with persistence and rendering
 */
export class ConversationIntegrationManager {
  constructor(options = {}) {
    this.history = options.history || [];
    this.keepContext = options.keepContext !== false;
    this.onHistoryChange = options.onHistoryChange || null;
    this.onMessageRendered = options.onMessageRendered || null;
    this.audioManager = options.audioManager || null;
    this.persistQueue = Promise.resolve();
  }

  /**
   * Load conversation from storage on startup
   */
  async loadConversation() {
    try {
      const messages = await conversationPersistence.loadConversation();
      if (messages.length && this.keepContext) {
        this.history = messages;
        return messages;
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
    return [];
  }

  /**
   * Add a user message to conversation
   */
  async addUserMessage(text, fileData = null) {
    const msg = new AssistantMessage({
      role: 'user',
      content: text,
      fileData,
      filePreview: fileData ? {
        name: fileData.name,
        size: fileData.size
      } : null,
      turnId: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    });

    this.history.push(msg);

    // Persist
    if (this.keepContext) {
      await conversationPersistence.persistMessage(msg);
    }

    return msg;
  }

  /**
   * Add an assistant message with tool results
   */
  async addAssistantMessage(text, toolResults = [], turnId = null, error = null, status = 'completed') {
    // Convert raw tool results to ToolResult format if needed
    const results = toolResults.map(r => {
      if (r instanceof ToolResult) return r;
      // Auto-wrap plain objects
      return new ToolResult({
        ...r,
        type: r.type || this.inferResultType(r)
      });
    });

    const msg = new AssistantMessage({
      role: 'assistant',
      content: text,
      toolResults: results,
      turnId: turnId || `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status,
      error
    });

    this.history.push(msg);

    // Persist
    if (this.keepContext) {
      await conversationPersistence.persistMessage(msg);
    }

    return msg;
  }

  /** Persist the live legacy history through the single conversation store. */
  async persistHistory(history) {
    const snapshot = history.map(message => new AssistantMessage({
      ...message,
      toolResults: (message.toolResults || []).map(result => this.normalizeToolResult(result))
    }));
    this.persistQueue = this.persistQueue.then(async () => {
      this.history = snapshot;
      await conversationPersistence.clearConversation();
      for (const message of snapshot) {
        await conversationPersistence.persistMessage(message);
      }
      this.onHistoryChange?.(snapshot);
    });
    return this.persistQueue;
  }

  normalizeToolResult(result, toolName = null, toolCallId = null) {
    if (result instanceof ToolResult) return result;
    // Results read from storage have already passed through ToolResult#toJSON.
    // Rehydrate them instead of treating that wrapper as ordinary result data.
    if (result?.data && (result.renderer || result.toolCallId || result.toolName) &&
        ['result', 'interactive', 'workspace', 'preview'].includes(result.type)) {
      const saved = ToolResult.fromJSON(result);
      if (saved.renderer === 'text' && saved.data?.language && Object.hasOwn(saved.data, 'output')) {
        saved.renderer = 'sandbox-output';
      }
      return saved;
    }
    const failed = result?.success === false || result?.status === 'error';
    const isAudio = result?.type === 'audio' || result?.audioId;
    const isSpeedTest = typeof result?.downloadSpeedMbps !== 'undefined';
    const isSandboxOutput = Boolean(result?.language && Object.hasOwn(result, 'output'));
    return new ToolResult({
      toolId: result?.toolId || toolName,
      toolName: result?.toolName || toolName,
      toolCallId: result?.toolCallId || toolCallId,
      success: !failed,
      error: failed ? (result?.error || result?.message || 'Operation failed') : null,
      type: isAudio || isSpeedTest ? 'interactive' : 'result',
      data: result || {},
      state: result?.state || {},
      renderer: isAudio ? 'audio-player' : (isSpeedTest ? 'speed-test' : (isSandboxOutput ? 'sandbox-output' : 'text'))
    });
  }

  async renderToolResult(result, container, toolName = null, toolCallId = null) {
    const normalized = this.normalizeToolResult(result, toolName, toolCallId);
    const element = await renderToolResult(normalized, container);
    this.bindResultInteractions(normalized, container);
    return element;
  }

  /**
   * Infer result type from result object
   */
  inferResultType(result) {
    // Audio
    if (result.audioId || result.type === 'audio' || result.url?.includes('audio')) {
      return 'interactive';
    }

    // Speed test
    if (typeof result.downloadSpeedMbps !== 'undefined') {
      return 'interactive';
    }

    // DNS records
    if (result.answers?.length) {
      return 'interactive';
    }

    // Tables
    if (result.rows && Array.isArray(result.rows)) {
      return 'interactive';
    }

    // Default: simple result
    return 'result';
  }

  /**
   * Get all history in original format (for backward compatibility)
   */
  getHistory() {
    return this.history.map(msg => ({
      id: msg.id,
      turnId: msg.turnId,
      role: msg.role,
      content: msg.content,
      fileData: msg.fileData,
      filePreview: msg.filePreview,
      toolResults: msg.toolResults.map(r => r.toJSON()),
      status: msg.status,
      error: msg.error,
      timestamp: msg.timestamp
    }));
  }

  /**
   * Clear entire conversation
   */
  async clearConversation() {
    this.history = [];
    await conversationPersistence.clearConversation();
  }

  /**
   * Get tool discovery manager
   */
  getToolDiscovery() {
    return toolDiscovery;
  }

  /**
   * Render all messages to DOM using new rendering framework
   *
   * Usage in assistant.js:
   *   const container = document.querySelector('.ast-messages');
   *   integrationManager.renderAllMessages(container);
   */
  async renderAllMessages(container) {
    if (!container) return;

    container.innerHTML = '';

    if (this.history.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:48px 20px; color:var(--g500);">
          <p>How can Assistant help you?</p>
        </div>
      `;
      return;
    }

    for (const msg of this.history) {
      await this.renderMessage(msg, container);
    }

    container.scrollTop = container.scrollHeight;
  }

  /**
   * Render a single message and append to container
   */
  async renderMessage(msg, container) {
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `ast-msg ast-msg-${msg.role}`;
    msgDiv.setAttribute('data-msg-id', msg.id);
    msgDiv.setAttribute('data-turn-id', msg.turnId);
    msgDiv.style.display = 'flex';
    msgDiv.style.gap = '12px';
    msgDiv.style.maxWidth = msg.role === 'user' ? '80%' : '90%';
    msgDiv.style.alignSelf = msg.role === 'user' ? 'flex-end' : 'flex-start';

    if (msg.role === 'user') {
      // User message
      msgDiv.innerHTML = `
        <div style="background:var(--black); color:var(--white); padding:12px 18px; border-radius:16px; font-size:0.9rem; line-height:1.5; word-break:break-word;">
          ${msg.filePreview ? `<div style="font-size:0.75rem; opacity:0.8; margin-bottom:6px;">📎 ${msg.filePreview.name}</div>` : ''}
          ${msg.content}
        </div>
      `;
    } else {
      // Assistant message
      msgDiv.innerHTML = `
        <div style="width:34px; height:34px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <div style="background:var(--g100); color:var(--black); padding:14px 18px; border-radius:16px; font-size:0.9rem; line-height:1.6; word-break:break-word;">
          <div class="ast-text-body" style="margin-bottom:${msg.toolResults.length ? '8px' : '0'};"></div>
          <div class="ast-tool-results-area"></div>
        </div>
      `;

      const textBody = msgDiv.querySelector('.ast-text-body');
      const resultsArea = msgDiv.querySelector('.ast-tool-results-area');

      // Render text
      if (textBody && msg.content) {
        textBody.innerHTML = this.formatMarkdown(msg.content);
      }

      // Render tool results
      for (const result of msg.toolResults) {
        try {
          const resultContainer = document.createElement('div');
          resultContainer.style.marginTop = '10px';
          resultsArea.appendChild(resultContainer);

          await this.renderToolResult(result, resultContainer);
        } catch (err) {
          console.error('Failed to render tool result:', err);
        }
      }
    }

    container.appendChild(msgDiv);

    if (this.onMessageRendered) {
      this.onMessageRendered(msg, msgDiv);
    }
  }

  /**
   * Bind event handlers for interactive results
   *
   * This is where historical results become interactive without new API calls
   */
  bindResultInteractions(result, container) {
    if (!this.audioManager || result.renderer !== 'audio-player') return;

    // Audio player interactions
    const audioId = result.data.audioId;
    const restore = () => this.audioManager.restore(result.data);
    container.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', async () => {
        const action = button.getAttribute('data-action');
        try {
          restore();
          if (action === 'play') await this.audioManager.resume(audioId);
          if (action === 'pause') this.audioManager.pause(audioId);
          if (action === 'stop') this.audioManager.stop(audioId);
        } catch (err) { console.error(`Audio action failed: ${action}`, err); }
      });
    });
    const progress = container.querySelector('.audio-player-progress');
    progress?.addEventListener('input', () => { restore(); this.audioManager.seek(audioId, Number(progress.value)); });
    const volume = container.querySelector('.audio-player-volume');
    volume?.addEventListener('input', () => { restore(); this.audioManager.setVolume(audioId, Number(volume.value) / 100); });
  }

  /**
   * Format markdown (uses marked if available, fallback to escapeHtml)
   */
  formatMarkdown(text) {
    if (!text) return '';
    try {
      if (typeof window !== 'undefined' && window.marked?.parse) {
        return window.marked.parse(text);
      }
    } catch {}
    return this.escapeHtml(text).replace(/\n/g, '<br/>');
  }

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Register callback for when a result is reconstructed
   *
   * Usage:
   *   integrationManager.onResultReconstruct('audio-player', (result) => {
   *     console.log('Audio reconstructed:', result);
   *   });
   */
  onResultReconstruct(rendererType, callback) {
    conversationPersistence.registerReconstructor(rendererType, callback);
  }

  /**
   * Get tool LLM declarations for Gemini
   *
   * Usage in AI provider:
   *   const toolDecls = integrationManager.getToolDeclarations();
   *   // Pass to Gemini tools parameter
   */
  getToolDeclarations() {
    return toolDiscovery.generateLLMDeclarations();
  }

  /**
   * Search tools by intent or keyword
   *
   * Usage:
   *   const tools = integrationManager.suggestTools('play a sound');
   */
  suggestTools(intent) {
    return toolDiscovery.suggestTools(intent);
  }

  /**
   * Get statistics about available tools
   */
  getToolStats() {
    return toolDiscovery.getStats();
  }
}

/**
 * Create global singleton integrationManager
 */
let globalIntegrationManager = null;

export function getIntegrationManager(options = {}) {
  if (!globalIntegrationManager) {
    globalIntegrationManager = new ConversationIntegrationManager(options);
  }
  return globalIntegrationManager;
}

export function createIntegrationManager(options = {}) {
  return new ConversationIntegrationManager(options);
}
