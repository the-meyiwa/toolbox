/**
 * TOOLBOX ASSISTANT — Message & Result Persistence Layer
 *
 * Responsible for:
 * - Serializing/deserializing Assistant messages
 * - Persisting tool results in a reconstructable format
 * - Respecting storage mode (Browser/Cloud)
 * - Managing lifecycle of expensive runtime resources
 */

// User-scoped assistant history key to prevent history leaking across sessions or accounts
export function getAssistantHistoryStorageKey() {
  try {
    const raw = localStorage.getItem('toolbox_supabase_session') || localStorage.getItem('supabase_auth_session');
    if (raw) {
      const user = JSON.parse(raw);
      const id = user?.id || user?.user?.id;
      const email = user?.email || user?.user?.email;
      if (id) return `toolbox_assistant_history_${id}`;
      if (email) return `toolbox_assistant_history_${email}`;
    }
  } catch {}
  return 'toolbox_assistant_history_guest';
}

// Scrub legacy un-scoped assistant history key so old chats don't leak
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('toolbox_assistant_history_v2');
  }
} catch {}

/**
 * Unified Tool Result Schema — ALWAYS SERIALIZABLE
 *
 * DO persist: scalars, arrays, objects, URLs, error messages
 * DO NOT persist: DOM, functions, closures, Audio objects, WebGL, workers
 */
export class ToolResult {
  constructor(opts = {}) {
    this.toolId = opts.toolId || null;
    this.toolCallId = opts.toolCallId || null;
    this.toolName = opts.toolName || null;
    
    // Execution status
    this.success = opts.success !== false;
    this.error = opts.error || null;
    
    // Presentation strategy
    this.type = opts.type || 'result'; // 'result' | 'interactive' | 'workspace' | 'preview'
    
    // Serialized result data (REQUIRED to be JSON-safe)
    this.data = opts.data || {};
    
    // State needed for UI reconstruction
    this.state = opts.state || {};
    
    // Which renderer to use
    this.renderer = opts.renderer || null;
    
    // Can the user expand to full tool?
    this.expandable = opts.expandable !== false;
    this.openInToolboxHash = opts.openInToolboxHash || null;
    
    // Timestamps
    this.createdAt = opts.createdAt || Date.now();
    this.executedAt = opts.executedAt || Date.now();
    
    // For debugging
    this.metadata = opts.metadata || {};
  }

  /**
   * Verify this result is serializable (no functions, DOM, etc.)
   */
  isSerializable() {
    try {
      JSON.stringify(this);
      return true;
    } catch (e) {
      console.error('ToolResult not serializable:', e);
      return false;
    }
  }

  toJSON() {
    // Ensure we only return serializable fields
    return {
      toolId: this.toolId,
      toolCallId: this.toolCallId,
      toolName: this.toolName,
      success: this.success,
      error: this.error,
      type: this.type,
      data: this.data,
      state: this.state,
      renderer: this.renderer,
      expandable: this.expandable,
      openInToolboxHash: this.openInToolboxHash,
      createdAt: this.createdAt,
      executedAt: this.executedAt,
      metadata: this.metadata
    };
  }

  static fromJSON(json) {
    return new ToolResult(json);
  }
}

/**
 * Unified Assistant Message Format
 */
export class AssistantMessage {
  constructor(opts = {}) {
    this.id = opts.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.turnId = opts.turnId || null;
    this.role = opts.role || 'assistant'; // 'user' | 'assistant'
    
    // Message content
    this.content = opts.content || '';
    
    // Tool invocations (for context)
    this.toolCalls = opts.toolCalls || [];
    
    // Tool results (serializable format)
    this.toolResults = (opts.toolResults || []).map(r =>
      r instanceof ToolResult ? r : ToolResult.fromJSON(r)
    );
    
    // Status tracking
    this.status = opts.status || 'completed'; // 'processing' | 'completed' | 'failed' | 'cancelled'
    this.error = opts.error || null;
    
    // Attached file (if applicable)
    this.fileData = opts.fileData || null;
    this.filePreview = opts.filePreview || null;
    
    // Timestamps & metadata
    this.timestamp = opts.timestamp || Date.now();
    this.storage = opts.storage || 'local'; // where it was persisted
  }

  /**
   * Verify complete serializability
   */
  isSerializable() {
    try {
      JSON.stringify(this);
      return this.toolResults.every(r => r.isSerializable());
    } catch (e) {
      console.error('AssistantMessage not serializable:', e);
      return false;
    }
  }

  toJSON() {
    return {
      id: this.id,
      turnId: this.turnId,
      role: this.role,
      content: this.content,
      toolCalls: this.toolCalls,
      toolResults: this.toolResults.map(r => r.toJSON()),
      status: this.status,
      error: this.error,
      fileData: this.fileData,
      filePreview: this.filePreview,
      timestamp: this.timestamp,
      storage: this.storage
    };
  }

  static fromJSON(json) {
    return new AssistantMessage({
      ...json,
      toolResults: (json.toolResults || []).map(r => ToolResult.fromJSON(r))
    });
  }
}

/**
 * Conversation Persistence Manager
 *
 * Handles storage, retrieval, and lifecycle of Assistant conversation messages.
 * Respects active storage mode (Browser/Cloud).
 */
export class ConversationPersistence {
  constructor() {
    this.messageCache = new Map(); // in-memory cache
    this.reconstructionCallbacks = new Map(); // for interactive reconstruction

    // Invalidate in-memory cache when user changes
    if (typeof window !== 'undefined') {
      window.addEventListener('toolbox:authchange', () => {
        this.clearCache();
      });
    }
  }

  clearCache() {
    this.messageCache.clear();
  }

  /**
   * Persist a single Assistant message
   */
  async persistMessage(message, options = {}) {
    if (!message.isSerializable()) {
      throw new Error('Message contains non-serializable data');
    }

    try {
      const storageKey = getAssistantHistoryStorageKey();
      let messages = [];
      try { messages = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch {}
      const index = messages.findIndex(item => item.id === message.id);
      if (index === -1) messages.push(message.toJSON());
      else messages[index] = message.toJSON();
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
      message.storage = 'local';

      // Cache it
      this.messageCache.set(message.id, message);
      return message;
    } catch (err) {
      console.error('Failed to persist message:', err);
      throw err;
    }
  }

  /**
   * Load a single message by ID
   */
  async loadMessage(messageId) {
    // Check cache
    if (this.messageCache.has(messageId)) {
      return this.messageCache.get(messageId);
    }

    try {
      const storageKey = getAssistantHistoryStorageKey();
      const messages = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const json = messages.find(m => m.id === messageId);
      if (json) {
        const msg = AssistantMessage.fromJSON(json);
        this.messageCache.set(messageId, msg);
        return msg;
      }
    } catch {}

    return null;
  }

  /**
   * Load all messages in conversation
   */
  async loadConversation() {
    const messages = [];

    try {
      const storageKey = getAssistantHistoryStorageKey();
      const browserMessages = JSON.parse(localStorage.getItem(storageKey) || '[]');
      messages.push(...browserMessages.map(m => AssistantMessage.fromJSON(m)));
    } catch {}

    // Sort by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // Populate cache
    messages.forEach(m => this.messageCache.set(m.id, m));

    return messages;
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId) {
    this.messageCache.delete(messageId);

    // Remove from browser storage
    try {
      const storageKey = getAssistantHistoryStorageKey();
      let messages = JSON.parse(localStorage.getItem(storageKey) || '[]');
      messages = messages.filter(m => m.id !== messageId);
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}

    // Could also delete from cloud if needed
  }

  /**
   * Clear entire conversation
   */
  async clearConversation() {
    this.messageCache.clear();
    const storageKey = getAssistantHistoryStorageKey();
    localStorage.removeItem(storageKey);
    localStorage.removeItem('toolbox_assistant_history_v2');
  }

  /**
   * Register a callback for interactive result reconstruction
   *
   * Called when a historical interactive result needs to be rendered/interacted with
   */
  registerReconstructor(rendererType, callback) {
    this.reconstructionCallbacks.set(rendererType, callback);
  }

  /**
   * Reconstruct an interactive result for rendering
   *
   * Creates runtime resources (Audio, WebGL, etc.) from serialized state
   */
  async reconstructInteractiveResult(result) {
    const reconstructor = this.reconstructionCallbacks.get(result.renderer);
    if (!reconstructor) {
      console.warn(`No reconstructor for renderer: ${result.renderer}`);
      return result; // return as-is
    }

    try {
      return await reconstructor(result);
    } catch (err) {
      console.error(`Failed to reconstruct result:`, err);
      return result; // return serialized, skip interaction
    }
  }

  /**
   * Cleanup interactive resources from a result
   *
   * Called when result is removed/hidden
   */
  async cleanupInteractiveResult(result) {
    // Revoke blob URLs
    if (result.data?.url?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(result.data.url);
      } catch {}
    }

    // Stop audio
    if (result.renderer === 'audio-player' && result.instance?.audio) {
      try {
        result.instance.audio.pause();
        result.instance.audio.currentTime = 0;
        result.instance.audio.src = '';
      } catch {}
    }

    // More cleanup patterns can be added per-renderer
  }
}

// Export singleton
export const conversationPersistence = new ConversationPersistence();
