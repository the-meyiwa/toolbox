/**
 * TOOLBOX ASSISTANT — Tool Discovery & Integration
 *
 * Maps registered Toolbox tools for Assistant invocation:
 * - Discovers all available tools
 * - Provides tool metadata for LLM context
 * - Determines presentation strategies
 * - Handles tool invocation mapping
 */

import { TOOLS } from '../registry/tools.js';

/**
 * Tool Invocation Helper — maps registry tool to Assistant-compatible format
 */
export class ToolInvocationHelper {
  constructor(registryTool) {
    this.tool = registryTool;
  }

  /**
   * Can this tool be invoked by Assistant?
   */
  isAssistantCompatible() {
    // By default, all tools are compatible
    // Override per-tool if needed
    return true;
  }

  /**
   * Get tool metadata for LLM
   *
   * Format suitable for Gemini/Groq/OpenAI function_declaration
   */
  toLLMDeclaration() {
    return {
      name: this.tool.id,
      description: this.tool.description,
      parameters: {
        type: 'object',
        properties: this.getParameterSchema(),
        required: this.getRequiredParameters()
      }
    };
  }

  /** Gemini declaration for the existing generic registry-tool dispatcher. */
  toNavigationDeclaration() {
    const tool = this.tool;
    return {
      name: `open_tool_${tool.id.replace(/-/g, '_')}`,
      description: `Toolbox Tool: ${tool.name}. ${tool.description}. Keywords: ${(tool.keywords || []).join(', ')}. Intents: ${(tool.intents || []).join(', ')}. Accepts: ${(tool.accepts || []).join(', ')}. Produces: ${(tool.produces || []).join(', ')}.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          inputData: { type: 'STRING', description: 'Optional text or code artifact content to pass directly to the tool.' },
          artifactName: { type: 'STRING', description: 'Optional filename for the input artifact.' },
          standalone: { type: 'BOOLEAN', description: 'Open the tool in a new fullscreen window.' }
        }
      }
    };
  }

  /**
   * Determine presentation strategy for this tool
   */
  getPresentationStrategy() {
    // Explicit declaration wins
    if (this.tool.presentationStrategy) {
      return this.tool.presentationStrategy;
    }

    // Infer from tool metadata
    if (this.tool.category === 'developer' && this.tool.id === 'code-playground') {
      return 'workspace';
    }

    if (this.tool.id === 'assistant') {
      return 'workspace'; // recursive!
    }

    if (this.isAudioTool()) {
      return 'interactive';
    }

    if (this.isLargeTool()) {
      return 'preview'; // has "Open in Toolbox"
    }

    // Default: result-only
    return 'result';
  }

  /**
   * Get input parameters schema for this tool
   *
   * Specific to each tool's expected invocation
   */
  getParameterSchema() {
    const toolId = this.tool.id;

    // Audio/sound tools
    if (toolId === 'sound-effects') {
      return {
        query: { type: 'string', description: 'Sound effect to search for' },
        limit: { type: 'number', description: 'Max results to return (default 10)' }
      };
    }

    if (toolId === 'play_sound') {
      return {
        soundId: { type: 'string', description: 'ID of the sound to play' },
        title: { type: 'string', description: 'Display title for the player' },
        artist: { type: 'string', description: 'Artist name (optional)' }
      };
    }

    // Calculators
    if (toolId === 'calculator') {
      return {
        expression: { type: 'string', description: 'Mathematical expression to evaluate' }
      };
    }

    if (toolId === 'percentage-calculator') {
      return {
        amount: { type: 'number', description: 'Base amount' },
        percentage: { type: 'number', description: 'Percentage value' },
        operation: { type: 'string', enum: ['of', 'increase', 'decrease'], description: 'Type of calculation' }
      };
    }

    // Text processors
    if (toolId === 'case-converter') {
      return {
        text: { type: 'string', description: 'Text to convert' },
        targetCase: { type: 'string', enum: ['upper', 'lower', 'camel', 'snake', 'kebab', 'title'], description: 'Target case format' }
      };
    }

    if (toolId === 'word-counter') {
      return {
        text: { type: 'string', description: 'Text to analyze' }
      };
    }

    // Code execution
    if (toolId === 'code-playground') {
      return {
        language: { type: 'string', enum: ['javascript', 'typescript', 'python', 'sql'], description: 'Programming language' },
        code: { type: 'string', description: 'Code to execute' },
        operation: { type: 'string', enum: ['run', 'save', 'format'], description: 'Operation to perform' }
      };
    }

    // Network tools
    if (toolId === 'speed-test') {
      return {
        action: { type: 'string', enum: ['start', 'check'], description: 'Start test or check results' }
      };
    }

    // Data/analysis
    if (toolId === 'data-bot') {
      return {
        csvData: { type: 'string', description: 'CSV data to visualize' },
        chartType: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter'], description: 'Chart type' }
      };
    }

    // Defaults: single 'input' or 'query' parameter
    if (this.tool.accepts?.includes('text') || this.tool.category === 'text') {
      return {
        text: { type: 'string', description: this.tool.description }
      };
    }

    return {};
  }

  /**
   * Which parameters are required for invocation
   */
  getRequiredParameters() {
    const toolId = this.tool.id;
    const schema = this.getParameterSchema();

    // Define required params per tool
    const required = {
      'sound-effects': ['query'],
      'play_sound': ['soundId', 'title'],
      'calculator': ['expression'],
      'percentage-calculator': ['amount', 'percentage', 'operation'],
      'case-converter': ['text', 'targetCase'],
      'word-counter': ['text'],
      'code-playground': ['language', 'code', 'operation'],
      'speed-test': ['action'],
      'data-bot': ['csvData']
    };

    return required[toolId] || Object.keys(schema);
  }

  /**
   * Determine result presentation for this tool
   */
  getResultPresentation() {
    const strategy = this.getPresentationStrategy();

    return {
      strategy,
      renderer: this.getResultRenderer(),
      expandable: strategy !== 'result',
      openInToolbox: strategy !== 'result'
    };
  }

  /**
   * Which renderer to use for results from this tool
   */
  getResultRenderer() {
    const toolId = this.tool.id;

    // Audio
    if (this.isAudioTool()) {
      return 'audio-player';
    }

    // Calculators/numbers
    if (toolId.includes('calculator') || toolId.includes('converter')) {
      return 'text'; // plain number output
    }

    // Code/developer
    if (toolId === 'code-playground') {
      return 'code';
    }

    // Data/charts
    if (toolId === 'data-bot') {
      return 'chart';
    }

    // Table outputs
    if (toolId.includes('schedule') || toolId.includes('amortization')) {
      return 'table';
    }

    // Default to text
    return 'text';
  }

  /**
   * Check if this is an audio-producing tool
   */
  isAudioTool() {
    const audioToolIds = [
      'sound-effects',
      'speaker-cleaner',
      'tuner',
      'metronome',
      'audio-tag-editor'
    ];
    return audioToolIds.includes(this.tool.id) || this.tool.id.startsWith('play_');
  }

  /**
   * Check if this is a large/complex workspace tool
   */
  isLargeTool() {
    const largeToolIds = [
      'code-playground',
      'pdf-editor',
      'architecture-editor',
      'container-planner',
      'anatomy-explorer',
      'notes',
      'financial-analyzer',
      'file-drop'
    ];
    return largeToolIds.includes(this.tool.id);
  }

  /**
   * Get hash to open full tool in Toolbox
   */
  getOpenInToolboxHash() {
    return `#${this.tool.id}`;
  }
}

/**
 * Tool Discovery Manager
 *
 * Singleton that tracks all available tools for Assistant
 */
export class ToolDiscoveryManager {
  constructor() {
    this.tools = new Map(); // id → ToolInvocationHelper
    this.initialize();
  }

  /**
   * Initialize from registry
   */
  initialize() {
    TOOLS.forEach(tool => {
      const helper = new ToolInvocationHelper(tool);
      if (helper.isAssistantCompatible()) {
        this.tools.set(tool.id, helper);
      }
    });
  }

  /**
   * Get all tools that Assistant can invoke
   */
  getAvailableTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Find a specific tool
   */
  getTool(toolId) {
    return this.tools.get(toolId);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category) {
    return this.getAvailableTools().filter(t => t.tool.category === category);
  }

  /**
   * Get tools by presentation strategy
   */
  getToolsByStrategy(strategy) {
    return this.getAvailableTools().filter(t => t.getPresentationStrategy() === strategy);
  }

  /**
   * Generate LLM function declarations for all tools
   *
   * Suitable for Gemini's `tools` parameter
   */
  generateLLMDeclarations() {
    return this.getAvailableTools().map(tool => ({
      functionDeclarations: [tool.toLLMDeclaration()]
    }));
  }

  generateNavigationDeclarations() {
    return this.getAvailableTools().map(tool => tool.toNavigationDeclaration());
  }

  /**
   * Search tools by keyword
   */
  searchTools(query) {
    const q = query.toLowerCase();
    return this.getAvailableTools().filter(t => {
      const tool = t.tool;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.keywords.some(k => k.toLowerCase().includes(q)) ||
        tool.intents.some(i => i.toLowerCase().includes(q))
      );
    });
  }

  /**
   * Suggest tools based on user intent
   */
  suggestTools(intent) {
    const results = [];

    // Exact intent match
    for (const helper of this.tools.values()) {
      if (helper.tool.intents.some(i => i.toLowerCase() === intent.toLowerCase())) {
        results.push({ helper, score: 100 });
      }
    }

    // Partial matches
    for (const helper of this.tools.values()) {
      if (helper.tool.intents.some(i => i.toLowerCase().includes(intent.toLowerCase()))) {
        results.push({ helper, score: 50 });
      }
    }

    // Keyword matches
    for (const helper of this.tools.values()) {
      if (helper.tool.keywords.some(k => k.toLowerCase().includes(intent.toLowerCase()))) {
        results.push({ helper, score: 25 });
      }
    }

    // Sort by score, return
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(r => r.helper);
  }

  /**
   * Statistics
   */
  getStats() {
    const strategies = {};
    const renderers = {};

    for (const helper of this.tools.values()) {
      const strategy = helper.getPresentationStrategy();
      strategies[strategy] = (strategies[strategy] || 0) + 1;

      const renderer = helper.getResultRenderer();
      renderers[renderer] = (renderers[renderer] || 0) + 1;
    }

    return {
      totalTools: this.tools.size,
      strategies,
      renderers
    };
  }
}

// Export singleton
export const toolDiscovery = new ToolDiscoveryManager();
