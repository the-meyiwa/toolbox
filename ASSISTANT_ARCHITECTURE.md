# Toolbox Assistant — Architectural Improvement Plan

## PHASE 1: Complete Tool Integration Matrix

### Overview
**Total Registered Tools: 120**

### Presentation Category Breakdown

#### CATEGORY A — RESULT-ONLY (53 tools)
Tools where the operation produces a self-contained answer. Return the result directly without UI.

```
word-counter, case-converter, find-replace, sort-lines, remove-duplicates,
slug-generator, lorem-ipsum, document-analyzer, json-formatter, csv-to-json,
base64-codec, url-codec, html-entity-codec, jwt-decoder, hash-generator,
uuid-generator, cron-parser, timestamp-converter, number-base-converter,
image-converter, image-metadata, image-to-pdf, pdf-merge, percentage-calculator,
unit-converter, random-number, business-days, color-converter, aspect-ratio,
qr-generator, password-generator, vat-calculator, margin-markup, runway-calculator,
payroll-cost, salary-converter, email-signature, currency-exchange, net-subnet,
ip-lookup, net-dns-lookup, net-reverse-dns, net-whois, net-domain-availability,
net-ssl-viewer, net-url-analyzer, net-sitemap, net-mac-lookup, file-hash,
tempo-delay, concrete-estimator, ohms-law, resistor-code, voltage-drop,
wiki, dictionary, bible, quran, case-digest, case-comparator,
legal-document-analyzer, legal-research, text-cleaner, chemical-equation-balancer,
stoichiometry-calculator, compound-database, weather-forecast, email-signature,
break-even (summary), npv-irr (summary), depreciation-calculator (summary)
```

#### CATEGORY B — INTERACTIVE RESULT (48 tools)
Tools where continued interaction is useful. Render compact interactive UI inside message.

```
markdown-preview, text-diff, regex-tester, image-compressor, image-resizer,
image-cropper, watermark-remover, pdf-split, calculator, color-palette-generator,
break-even, amortization-schedule, compound-interest, npv-irr, depreciation-calculator,
cap-table, unit-economics, meeting-cost, timesheet, pto-accrual, subscription-analyzer,
contrast-checker, timer, audio-tag-editor, legal-pdf, algorithm-lab, uml-diagram,
logic-lab, beam-calculator, metronome, tuner, chord-finder, speed-test, interactive-map,
periodic-table, file-compressor, file-decompressor, video-player, data-bot,
speaker-cleaner, sound-effects, anatomy-explorer (embedded 3D), container-planner (preview)
```

#### CATEGORY C — WORKSPACE-BACKED (15 tools)
Assistant operates these but does NOT embed entire workspace. Return useful output + "Open in Toolbox".

```
code-playground, pdf-editor, invoice-generator, financial-analyzer, flowchart,
architecture-editor, notes, file-drop, assistant, payment-hub
```

#### CATEGORY D — FULL-WORKSPACE/PREVIEW (4 tools)
Too complex to reproduce in chat. Return compact preview + "Open in Toolbox".

```
container-planner, architecture-editor, anatomy-explorer, payment-hub
```

### Development Status

| Category | Count | Status | Work Required |
|----------|-------|--------|----------------|
| A (Result-only) | 53 | 0% | Implement basic tool discovery & result formatting |
| B (Interactive) | 48 | 5% | Implement interactive card renderers (audio, speed-test, charts) |
| C (Workspace) | 15 | 20% | Integrate with existing workspace tools |
| D (Preview) | 4 | 10% | Create preview renderers |
| **TOTAL** | **120** | **~9%** | Phase 2-4 work |

---

## PHASE 2: Conversation Persistence Architecture

### Current State
- Messages are stored in `history` array
- `toolResults` are rendered but become inert when new prompt arrives
- No serializable state preservation
- Audio/WebGL resources are not cleaned up
- Historical results cannot be interacted with without re-invoking

### Proposed State

```javascript
// Each Assistant Message must have durable state:
AssistantMessage {
  id: string,                  // unique message ID
  role: 'assistant',
  content: string,             // text response
  toolCalls: [                 // what was invoked
    {
      callId: string,          // unique within turn
      toolId: string,          // from registry
      toolName: string,
      args: object,            // serialized args
      createdAt: timestamp,
      executedAt: timestamp
    }
  ],
  toolResults: [               // structured results
    {
      toolCallId: string,      // matches the call
      toolId: string,
      resultType: string,      // 'value' | 'interactive' | 'preview'
      resultData: object,      // SERIALIZABLE - no DOM/functions/closures
      resultState: object,     // state needed for reconstruction
      renderers: string[],     // UI renderers to use
      error?: string,          // if failed
      createdAt: timestamp
    }
  ],
  status: 'processing' | 'completed' | 'failed' | 'cancelled',
  turnId: string,             // conversation turn identifier
  timestamp: timestamp,
  storage: 'local' | 'cloud'  // where this was persisted
}
```

### Result Data Structure

Result objects must be **completely serializable**:

**DO persist:**
- Scalars: numbers, strings, booleans
- Arrays and objects
- Serialized state (JSON-safe)
- URLs (data: and blob: URLs too)
- Error messages

**DO NOT persist:**
- DOM elements
- Event listeners
- Functions/closures
- Audio objects
- WebGL renderer state
- Worker instances
- Timers/intervals

### Interactive State Reconstruction

When a historical result is displayed or interacted with:

```javascript
// Historical audio result:
{
  resultType: 'interactive',
  resultData: {
    audioId: 'aud_xxx',
    title: 'Idea 12',
    url: 'blob:https://...',    // safe to persist
    duration: 45
  },
  renderers: ['audio-player'],
  reconstruct: async () => {
    // Called when message becomes visible
    const audio = new Audio(resultData.url);
    return new AudioInstance(audio, resultData);
  }
}
```

---

## Architecture Changes Required

### 1. Registry Extension (Backward-compatible)

Add optional metadata to tools:

```javascript
{
  id: 'play_sound',
  // ... existing metadata ...
  
  // NEW: presentation hint
  presentationStrategy: 'interactive',  // 'result' | 'interactive' | 'workspace' | 'preview'
  
  // NEW: for workspace tools
  workspaceConfig: {
    hideFullTool: true,
    returnOutput: true,
    supportsSaving: true
  },
  
  // NEW: result renderer type
  resultRenderer: 'audio-player'  // or 'chart', 'code-output', etc.
}
```

### 2. Tool Result Schema

Unified serializable format:

```javascript
ToolResult {
  // Execution
  toolId: string,
  toolCallId: string,
  
  // Status
  success: boolean,
  error?: string,
  
  // Presentation
  type: 'result' | 'interactive' | 'workspace' | 'preview',
  
  // Data (ALWAYS serializable)
  data: {
    // tool-specific fields
    // examples:
    audioId, title, url, duration,  // for audio
    downloadSpeed, uploadSpeed, latency,  // for speed-test
    code, output, errors,  // for code-playground
  },
  
  // UI state
  state?: {
    isPlaying: boolean,      // audio
    currentTime: number,
    volume: number
  },
  
  // How to render
  renderer: string,          // 'audio-player', 'chart', 'code', etc.
  expandable: boolean,       // can open full tool?
  openInToolbox?: string     // hash to open full tool
}
```

### 3. Message Persistence Layer

```javascript
// Storage abstraction respects current mode
async function persistAssistantMessage(message, storage = getActiveStorage()) {
  // SIGNED OUT: Browser storage only
  // SIGNED IN: Cloud storage (default) or Browser storage
  
  return saveArtifact({
    kind: 'assistant-message',
    name: `Turn ${message.turnId}`,
    content: JSON.stringify(message)  // fully serializable
  });
}

async function reconstructHistoricalMessage(messageId) {
  const artifact = await loadArtifact(messageId);
  const message = JSON.parse(artifact.content);
  
  // Reconstruct interactive resources as needed
  for (const result of message.toolResults) {
    if (result.type === 'interactive') {
      result.instance = await reconstructInteractiveResult(result);
    }
  }
  
  return message;
}
```

### 4. Idempotency & Duplicate Prevention

Use three-level deduplication:

**Level 1: Server-side idempotency store** (existing)
- 5-minute TTL
- Key: `idempotencyKey` from client
- Returns cached response if present

**Level 2: Turn-level deduplication** (existing but enhanced)
- Key: `callId` if present, else `${toolName}:${JSON.stringify(args)}`
- Map: `turnExecutedTools`
- Prevents same tool call twice in same turn

**Level 3: Side-effect guards** (new)
- For side-effecting tools (audio, payments, etc.)
- Before executing: check if result already exists for this call
- Return existing result instead of re-executing

```javascript
async function executeToolWithIdempotency(toolId, args, callId, turnId) {
  // Get the deduplication key
  const dedupeKey = callId || `${toolId}:${JSON.stringify(args)}`;
  
  // Check: has this call already executed in this turn?
  if (turnExecutedTools.has(dedupeKey)) {
    return turnExecutedTools.get(dedupeKey);
  }
  
  // Check: does a historical result exist for this call?
  if (shouldCheckHistoricalResults && hasHistoricalResult(dedupeKey)) {
    return loadHistoricalResult(dedupeKey);
  }
  
  // Execute new
  const result = await executeToolCall(toolId, args);
  turnExecutedTools.set(dedupeKey, result);
  
  return result;
}
```

### 5. Audio-Specific Enhancements

Persist audio state serialized:

```javascript
AudioResult {
  toolCallId: string,
  audioId: string,
  title: string,
  artist: string,
  url: string,              // blob: or http(s):
  artworkUrl: string,
  duration: number,
  
  // Reconstructable state
  currentTime: number,
  volume: number,
  isPlaying: boolean,
  
  // Cleanup
  blobUrl?: string,         // tracked for revocation
  
  // Prevent re-execution
  preventDuplication: true
}
```

When message is displayed:
```javascript
async function reconstructAudioResult(result) {
  const audio = new Audio(result.url);
  return new AudioInstance({
    ...result,
    audio,
    currentTime: result.currentTime,
    volume: result.volume
  });
}
```

When message is hidden/removed:
```javascript
function cleanupAudioResult(result) {
  if (result.audio) {
    result.audio.pause();
    result.audio.currentTime = 0;
    result.audio.src = '';
  }
  if (result.blobUrl) {
    URL.revokeObjectURL(result.blobUrl);
  }
}
```

---

## PHASE 3: Reusable Result Presentation Framework

### Assistant Result Renderer System

```javascript
// Registry of result renderers
const RESULT_RENDERERS = {
  'audio-player': AudioPlayerRenderer,
  'speed-test': SpeedTestRenderer,
  'chart': ChartRenderer,
  'code-output': CodeOutputRenderer,
  'text': TextResultRenderer,
  '3d-viewer': Viewer3DRenderer,
  'table': TableRenderer,
  'map': MapRenderer,
  // ... etc
};

// Each renderer:
class ResultRenderer {
  canRender(result) {
    // Should this renderer handle this result?
  }
  
  renderToDOM(result, container) {
    // Render into DOM
    // Must NOT store closures, only data
  }
  
  bindInteractions(result, container) {
    // Set up event listeners
    // Reference the actual result object, not copy
  }
  
  cleanup(result) {
    // Remove listeners, revoke URLs, etc.
  }
  
  reconstruct(result) {
    // Rebuild runtime resources from serialized result
  }
}
```

### Discovery & Selection

```javascript
function selectPresentationStrategy(toolId, result) {
  const tool = BY_ID.get(toolId);
  
  // Strategy 1: Tool declares it explicitly
  if (tool.presentationStrategy) {
    return tool.presentationStrategy;
  }
  
  // Strategy 2: Tool produces specific artifact kinds
  if (tool.produces === 'audio') return 'interactive:audio-player';
  if (tool.produces === 'chart') return 'interactive:chart';
  if (tool.produces === 'code') return 'workspace:code-playground';
  
  // Strategy 3: Result type hints
  if (result.type === 'audio') return 'interactive:audio-player';
  if (result.hasChart) return 'interactive:chart';
  
  // Strategy 4: Result-only by default
  return 'result-only';
}
```

---

## PHASE 4: Tool Integration Checklist

For each tool, follow this workflow:

```
1. Discovery       → Can Assistant find and invoke the tool?
2. Invocation      → Can Assistant call it with appropriate args?
3. Result Type     → What does the tool return?
4. Presentation    → Which presentation strategy fits?
5. Rendering       → Build/reuse appropriate renderer
6. Persistence     → Ensure result is fully serializable
7. Interaction     → If interactive, ensure controls work on historical
8. Cleanup         → Resources are released properly
9. Full-tool Link  → "Open in Toolbox" available where appropriate
10. Testing        → Verify in conversation
```

---

## Implementation Order (Priority)

### High Priority (User-Facing Impact)
1. Conversation persistence (all tool results become historical)
2. Audio player interactive cards (single most-used interactive tool)
3. Speed Test interactive result (important for users)
4. Code Playground workspace integration (Assistant can write & run code)

### Medium Priority (Feature Completeness)
5. Calculator interactive UI
6. Chart/data visualization renderers
7. Code output formatting
8. Link/expand-to-full-tool system

### Low Priority (Nice-to-Have)
9. Complex 3D viewers
10. Advanced workspace previews
11. Exotic tool integrations

---

## Security Considerations

✅ **Authentication**: Only signed-in users access Assistant
✅ **API Keys**: Server-side only, never exposed to browser
✅ **Data Storage**: Respects active storage mode (Browser/Cloud)
✅ **Result Data**: Only serializable, safe-to-persist data
✅ **Tool Execution**: Server-side validation of tool invocations
✅ **Idempotency**: Prevents duplicate side effects

---

## Success Criteria

1. ✅ All 120 tools discoverable by Assistant
2. ✅ Each tool has appropriate presentation strategy
3. ✅ Historical tool results remain interactive
4. ✅ Clicking old audio result does NOT invoke Gemini
5. ✅ Clicking old audio result plays audio from serialized state
6. ✅ Multiple consecutive tool calls work correctly
7. ✅ Refresh preserves conversation state
8. ✅ Retry doesn't duplicate completed side effects
9. ✅ No unnecessary narration (no "controls are displayed")
10. ✅ Code Playground can write → save → run → fix cycle
11. ✅ Full-tool navigation available where appropriate
12. ✅ Audio duplication bug cannot happen

---

## Files to Create/Modify

### New Files
- `js/lib/assistant-result-renderer.js` - Renderer system
- `js/lib/assistant-message-persistence.js` - Message storage
- `js/lib/assistant-tool-discovery.js` - Tool registry integration
- `js/lib/assistant-presentation-strategies.js` - Strategy definitions
- `docs/ASSISTANT_INTEGRATION_GUIDE.md` - Developer guide

### Modified Files
- `js/lib/assistant-tools.js` - Tool execution with idempotency
- `js/tools/assistant.js` - Message rendering, persistence
- `js/registry/schema.js` - Tool metadata extensions
- `js/registry/tools.js` - Add presentation hints (optional)
- `js/lib/assistant-audio.js` - Already enhanced

### Tests
- `tests/integration/assistant-persistence.test.js`
- `tests/integration/assistant-result-rendering.test.js`
- `tests/unit/assistant-result-renderer.test.js`

