# TOOLBOX ASSISTANT INTEGRATION GUIDE

## Overview

This guide explains how to integrate the new conversation persistence, result rendering, and tool discovery systems into the existing `js/tools/assistant.js` file.

The new architecture enables:
- ✅ Persistent conversation across refreshes
- ✅ Interactive historical results (no re-execution)
- ✅ Unified result rendering framework
- ✅ Automatic tool discovery for LLM
- ✅ Serializable message format

## Architecture Components

```
├── assistant-message-persistence.js  (ToolResult, AssistantMessage, storage)
├── assistant-result-renderer.js      (Result renderers, unified framework)
├── assistant-tool-discovery.js       (Tool registry, LLM declarations)
├── assistant-integration.js          (Bridge to assistant.js)
└── js/tools/assistant.js             (Existing, minimal changes needed)
```

## Integration Steps

### Step 1: Import New Modules in assistant.js

```javascript
// At the top of js/tools/assistant.js, add:
import { getIntegrationManager } from '../lib/assistant-integration.js';
import { toolDiscovery } from '../lib/assistant-tool-discovery.js';
```

### Step 2: Initialize Integration Manager

Replace the current storage initialization:

```javascript
// OLD CODE (remove):
// let history = [];
// let keepContext = localStorage.getItem(STORAGE_KEEP_CONTEXT) !== 'false';
// try {
//   if (keepContext) {
//     history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
//   }
// } catch {}

// NEW CODE (add in render function):
const integrationManager = getIntegrationManager({
  history: [],
  keepContext: localStorage.getItem(STORAGE_KEEP_CONTEXT) !== 'false',
  audioManager: AssistantAudioManager, // Pass audio manager for bindings
  onHistoryChange: () => {
    // Called when history is updated
  },
  onMessageRendered: (msg, msgDiv) => {
    // Called after each message is rendered
  }
});

// Load persistent conversation
const persistedHistory = await integrationManager.loadConversation();
```

### Step 3: Replace Message Rendering

Replace the existing `renderMessageList()` and `appendRenderedMessage()` functions:

```javascript
// OLD: Manual HTML string construction for each message
function renderMessageList() {
  if (!messagesEl) return;
  // ... old code ...
}

// NEW: Use integration manager for unified rendering
async function renderMessageList() {
  if (!messagesEl) return;
  await integrationManager.renderAllMessages(messagesEl);
}

// OLD: appendRenderedMessage() no longer needed
// NEW: Use integration manager to append
async function appendMessage(msg) {
  await integrationManager.renderMessage(msg, messagesEl);
  if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
}
```

### Step 4: Update Message Sending Logic

Replace `handleSend()` to use integration manager:

```javascript
// In handleSend(), replace old message object creation:

// OLD CODE:
// const userMsgObj = { id: ..., turnId: ..., role: 'user', ... };
// history.push(userMsgObj);
// persistHistory();
// appendRenderedMessage('user', userMsgObj.content, ...);

// NEW CODE:
const userMsg = await integrationManager.addUserMessage(text, fileToProcess);
await appendMessage(userMsg);

// ... then stream the assistant response ...

// OLD CODE:
// const assistantMsgObj = { role: 'assistant', content: text, toolResults: [...] };
// history.push(assistantMsgObj);
// persistHistory();

// NEW CODE:
const assistantMsg = await integrationManager.addAssistantMessage(
  accumulatedStreamText,
  executedToolResults,
  turnId,
  null,
  'completed'
);
await appendMessage(assistantMsg);
```

### Step 5: Remove Old Persistence Code

Delete these functions (now handled by integration manager):

```javascript
// REMOVE:
- persistHistory()
- renderToolResultCard()    // Replaced by unified renderers
- bindAudioControls()        // Replaced by integration manager
- function formatMarkdown()  // Use integration manager version
- function escapeHtml()      // Use integration manager version
```

### Step 6: Wire Up Tool Discovery

Connect tool discovery to Gemini AI provider:

```javascript
// In ai-provider.js, update streamChatCompletion():

import { toolDiscovery } from './assistant-tool-discovery.js';

async function streamChatCompletion(opts) {
  // ... existing code ...
  
  // Add tool declarations
  const toolDeclarations = toolDiscovery.generateLLMDeclarations();
  
  // Pass to Gemini API
  const response = await geminiApi.generateContent({
    contents: [...messages],
    tools: toolDeclarations,  // NEW
    // ... rest of config
  });
  
  // ... rest of stream handling
}
```

### Step 7: Update "Clear Conversation" Function

```javascript
// OLD:
btnClear?.addEventListener('click', () => {
  if (confirm('Clear current conversation history?')) {
    history = [];
    localStorage.removeItem(STORAGE_HISTORY);
    renderMessageList();
  }
});

// NEW:
btnClear?.addEventListener('click', async () => {
  if (confirm('Clear current conversation history?')) {
    await integrationManager.clearConversation();
    await renderMessageList();
  }
});
```

### Step 8: Update Quota & Status Display

No changes needed — integration manager maintains backward compatibility with `getHistory()`:

```javascript
// This still works:
const history = integrationManager.getHistory();  // Returns compatible format
```

## Key Implementation Details

### Message Lifecycle

```
User Input
  ↓
addUserMessage() → AssistantMessage (persisted)
  ↓
renderMessage() → DOM (user message)
  ↓
streamChatCompletion() → Gemini response
  ↓
onToolCallResult() → ToolResult (serializable)
  ↓
addAssistantMessage() → AssistantMessage + results (persisted)
  ↓
renderMessage() → DOM (assistant message + results)
  ↓
bindResultInteractions() → Event listeners (no re-execution)
```

### Persistence Strategy

**Browser (localStorage):**
- Always available
- Immediate write
- ~5MB limit
- Used when signed out

**Cloud (Supabase artifacts):**
- When signed in
- Optional, configurable
- Unlimited storage
- Automatic sync

### Result Rendering Pipeline

```
ToolResult (serializable data)
  ↓
selectRenderer() → Choose appropriate renderer
  ↓
Renderer.render() → Create DOM
  ↓
Renderer.bindInteractions() → Add event listeners
  ↓
Renderer.reconstruct() → Rebuild runtime resources (if interactive)
  ↓
Renderer.cleanup() → Revoke URLs, stop audio, etc.
```

## Testing Checklist

After integration:

- [ ] Load assistant, verify old messages persist
- [ ] Send new message, verify it persists
- [ ] Refresh page, verify conversation still there
- [ ] Clear conversation, verify it's gone
- [ ] Keep context toggle works
- [ ] Sign out, conversation stays in Browser storage
- [ ] Sign in, conversation syncs to Cloud
- [ ] Click old audio result, audio plays (no new API call)
- [ ] Click speed test, results display
- [ ] All error messages render correctly

## Result Renderer Extension

To add a new renderer for a tool:

```javascript
// In assistant-result-renderer.js:

export class MyToolResultRenderer extends ResultRenderer {
  static id = 'my-tool';
  static name = 'My Tool Output';

  static canRender(result) {
    return result.renderer === 'my-tool' || result.data?.myToolData;
  }

  static render(result, container) {
    const el = document.createElement('div');
    el.className = 'assistant-result-mytool';
    el.innerHTML = `<!-- your HTML -->`;
    container.appendChild(el);
    return el;
  }

  static bindInteractions(result, container) {
    // Wire up event listeners
  }

  static async reconstruct(result) {
    // Rebuild runtime resources if needed
    return result;
  }

  static async cleanup(result) {
    // Release resources
  }
}

// Then register it:
export const RESULT_RENDERERS = [
  MyToolResultRenderer,  // Add here
  // ... rest
];
```

## Breaking Changes

**None!** The integration manager provides full backward compatibility:

- `getHistory()` returns the same format as before
- `history` array still accessible (via `integrationManager.history`)
- Storage keys remain unchanged
- Audio manager still works the same way
- Quota system unaffected

## Performance Considerations

- **Lazy Rendering**: Messages are rendered on-demand, not stored as DOM
- **Serialization**: Only JSON data persisted, no functions or closures
- **Cleanup**: Resources (blob URLs, audio, etc.) properly released
- **Caching**: In-memory cache for reconstructed interactive results
- **Subscription**: Conversation updates can trigger custom callbacks

## Security Notes

✅ Authentication: Only signed-in users access Cloud storage
✅ API Keys: Server-side only, never exposed to browser
✅ Data Validation: All persisted data validated before use
✅ Blob URLs: Revoked after use to prevent memory leaks
✅ No Eval: No dynamic code execution in rendering

## Future Enhancements

1. **Workspace Tools** (Phase 4)
   - Code Playground: Write → Save → Run → Fix cycle
   - PDF Editor: Annotate and return artifact
   - Architecture Editor: Design and save plan

2. **Full-Tool Preview** (Phase 4)
   - Container Planner: Preview + "Open in Toolbox"
   - Anatomy Explorer: Embedded 3D + "Open in Toolbox"
   - Advanced data visualizations

3. **Search & Filter** (Phase 4)
   - Search conversation by tool name or result type
   - Filter by date, tool category, status
   - Export conversation as JSON/Markdown

4. **Collaboration** (Future)
   - Share conversations
   - Collaborative editing
   - Conversation versioning

## Troubleshooting

**Q: Conversation doesn't persist after refresh**
A: Check that `keepContext` is `true` and browser storage is enabled

**Q: Old audio result doesn't play**
A: Ensure `AudioPlayerResultRenderer.bindInteractions()` is called and `audioManager` is passed to integration manager

**Q: Tool results don't render**
A: Check console for errors, ensure tool result is serializable, verify renderer is registered

**Q: Storage switch (Browser ↔ Cloud) doesn't work**
A: Verify user is signed in before switching to Cloud, check network access to Supabase

## Support

For questions or issues:
1. Check the ASSISTANT_ARCHITECTURE.md for design details
2. Review the persistence layer (assistant-message-persistence.js) for storage logic
3. Check the result renderer (assistant-result-renderer.js) for rendering issues
4. Verify tool discovery (assistant-tool-discovery.js) for LLM integration problems

