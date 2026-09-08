/* ============================================================
   TOOLBOX ASSISTANT — Instruction Semantics, Authority & Execution Discipline
   Authoritative Semantic Engine governing user instructions, action-level
   authority, literal command execution, autonomous development, informational
   queries, and constraint preservation.

   Author: Meyiwa-Meyigbene Nifemi Edun
   ============================================================ */

/**
 * Standard Instruction Kinds
 */
export const INSTRUCTION_KINDS = {
  COMMAND: 'command',
  DEVELOPMENT: 'development',
  INFORMATION: 'information',
  WORKSPACE: 'workspace',
  MIXED: 'mixed',
  AMBIGUOUS: 'ambiguous'
};

/**
 * Legacy Mode Mapping (For backwards compatibility with existing consumers)
 */
export const INSTRUCTION_MODES = {
  EXPLICIT_COMMAND: 'command',
  NATURAL_LANGUAGE_DEVELOPMENT: 'development',
  COMMAND_WITH_CONTEXT: 'command',
  INFORMATION: 'information',
  WORKSPACE_OPERATION: 'workspace',
  MIXED: 'mixed',
  AMBIGUOUS: 'ambiguous'
};

/**
 * Execution Modes
 */
export const EXECUTION_MODES = {
  LITERAL: 'literal',
  AUTONOMOUS: 'autonomous',
  NONE: 'none',
  MIXED: 'mixed'
};

/**
 * Action Lifecycle States
 */
export const ACTION_LIFECYCLE = {
  REQUESTED: 'REQUESTED',
  AUTHORIZED: 'AUTHORIZED',
  DISPATCHED: 'DISPATCHED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED'
};

/**
 * Common executable binaries, package managers, runtimes, compilers, and shell tools
 */
const KNOWN_EXECUTABLES = new Set([
  // Package managers & project orchestrators
  'npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'bun', 'bunx', 'deno', 'corepack', 'cargo', 'pip', 'pip3', 'poetry', 'gem', 'composer', 'gradle', 'mvn',
  // Interpreters & runtimes
  'node', 'nodejs', 'python', 'python3', 'py', 'ruby', 'perl', 'bash', 'sh', 'zsh', 'pwsh', 'powershell', 'cmd',
  // Bundlers, compilers & dev servers
  'vite', 'vitest', 'webpack', 'rollup', 'esbuild', 'tsc', 'babel', 'next', 'astro', 'remix', 'nuxt', 'gatsby', 'turbo', 'react-scripts', 'jest', 'mocha', 'pytest',
  // Version control
  'git', 'gh', 'svn', 'hg',
  // Shell utilities
  'ls', 'dir', 'pwd', 'cd', 'mkdir', 'rm', 'rmdir', 'cp', 'mv', 'touch', 'cat', 'echo', 'grep', 'find', 'curl', 'wget', 'which', 'where', 'head', 'tail', 'chmod', 'chown', 'tar', 'zip', 'unzip', 'sed', 'awk', 'kill', 'ps', 'df', 'du', 'tree', 'open', 'start'
]);

/**
 * Common command execution prefixes in natural language
 */
const RUN_PREFIX_REGEX = /^(?:please\s+)?(?:run\s+exactly\s*:|run\s+exactly|execute\s+exactly\s*:|execute\s+the\s+exact\s+command|run\s+the\s+command|run\s+command|run\s+these\s+commands?|execute\s+these\s+commands?|run|execute|exec)(?:\s*:|\s+this\s*:|\s+the\s+following\s*:|\s+)?\s+/i;

/**
 * Informational / Question interrogative patterns
 */
const INFO_INTERROGATIVE_REGEX = /^(?:what\s+(?:is|does|are|command\s+would|command\s+creates?|command\s+builds?|command\s+runs?|command)|how\s+(?:do\s+i|to|can\s+i|does)|why\s+(?:is|did|does|would)|explain|tell\s+me\s+about|give\s+me\s+the\s+command|show\s+me\s+(?:the\s+command|how\s+to|an\s+example)|can\s+you\s+explain|what\s+happens\s+if)\b/i;

/**
 * Pure informational phrasing that specifically mentions commands without authorizing run
 */
const INFO_ABOUT_COMMAND_REGEX = /\b(?:what\s+does\s+[`'"]?([a-z0-9_\-\s]+)[`'"]?\s+do|what\s+command\s+(?:creates?|builds?|runs?|starts?|installs?|is\s+used)|why\s+did\s+(?:the\s+)?(?:build|tests?|command|server)\s+fail|why\s+does\s+[`'"]?([a-z0-9_\-\s]+)[`'"]?\s+fail|give\s+me\s+the\s+command|show\s+me\s+how\s+to\s+run|how\s+to\s+run)\b/i;

/**
 * Natural language outcome development triggers
 */
const DEV_OUTCOME_REGEX = /^(?:create|build|develop|implement|scaffold|make|add|generate|fix|update|refactor)\s+(?:a|an|the|me\s+a|me\s+an)\s+(?:react|vue|svelte|angular|next|vite|web|node|dashboard|app|application|landing\s+page|website|feature|component|authentication|auth|dark\s+mode|rest\s+api|api|layout|table|chart|calculator)/i;

/**
 * Tokenize shell command string while strictly respecting single quotes '...' and double quotes "..."
 * Inner characters inside quotes are treated literally and never split into separate tokens.
 *
 * @param {string} cmdStr - Command line string
 * @returns {string[]} Array of shell tokens
 */
export function parseShellTokens(cmdStr) {
  if (!cmdStr || typeof cmdStr !== 'string') return [];
  const tokens = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (let i = 0; i < cmdStr.length; i++) {
    const char = cmdStr[i];
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      current += char;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      current += char;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

/**
 * Splits shell statements outside quotes on compound operators (&&, ||, ;, |)
 *
 * @param {string} cmdStr
 * @returns {Array<{ segment: string, op: string|null }>}
 */
export function splitShellCompound(cmdStr) {
  if (!cmdStr || typeof cmdStr !== 'string') return [];
  const parts = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (let i = 0; i < cmdStr.length; i++) {
    const char = cmdStr[i];
    const next = cmdStr[i + 1];
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      current += char;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      current += char;
      continue;
    }
    if (!inSingle && !inDouble) {
      if ((char === '&' && next === '&') || (char === '|' && next === '|')) {
        parts.push({ segment: current.trim(), op: char + next });
        current = '';
        i++; // skip next
        continue;
      }
      if (char === ';' || char === '|') {
        parts.push({ segment: current.trim(), op: char });
        current = '';
        continue;
      }
    }
    current += char;
  }
  if (current.trim().length > 0) {
    parts.push({ segment: current.trim(), op: null });
  }
  return parts;
}

/**
 * Strips code fences, backticks, and cleans surrounding whitespace
 */
export function cleanCodeFence(text) {
  if (!text) return '';
  let str = text.trim();
  if (str.startsWith('```') && str.endsWith('```')) {
    const lines = str.split('\n');
    lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === '```') {
      lines.pop();
    }
    return lines.join('\n').trim();
  }
  if (str.startsWith('`') && str.endsWith('`') && str.length > 2) {
    return str.slice(1, -1).trim();
  }
  return str;
}

/**
 * Inspects whether a string has clear shell syntax indicators:
 * flags, pipes, redirects, chaining, variable assignments, path executions
 */
export function hasShellSyntaxIndicators(str) {
  if (!str) return false;
  // Pipes, redirects, chaining operators outside quotes
  const compound = splitShellCompound(str);
  if (compound.length > 1) return true;
  // Redirections (> , >> , < , 2>&1)
  if (/(?:^|\s)(?:>>|>|<|2>&1)(?:\s|$)/.test(str)) return true;
  // Common CLI flags (--template, -m "...", -rf, --workspace ./app, etc.)
  if (/(?:^|\s)(?:--[a-z0-9_\-]+|-[a-zA-Z0-9]+)(?:[=\s]|$)/.test(str)) return true;
  // Environment variable prefix (e.g. PORT=3000, NODE_ENV=production)
  if (/^[A-Z_][A-Z0-9_]*=[^\s]+\s+/.test(str)) return true;
  // Local script invocation (./script.sh, .\run.bat)
  if (/^\.{1,2}[/\\][^\s]+/.test(str)) return true;
  return false;
}

/**
 * Determines whether an input string is a plausible executable command.
 * Uses shell grammar, executable positions, known executables, flags, and arguments.
 * Does NOT require hardcoding every executable name in advance.
 */
export function isPlausibleExecutableCommand(input) {
  if (!input || typeof input !== 'string') return false;
  const cleaned = cleanCodeFence(input.trim());
  if (!cleaned) return false;

  // Multi-word natural sentences without shell syntax or known binaries are not commands
  const tokens = parseShellTokens(cleaned);
  if (!tokens.length) return false;

  let firstWord = tokens[0];

  // Strip leading env vars (e.g. "PORT=3000 npm start" -> "npm")
  let index = 0;
  while (index < tokens.length && /^[A-Z_][A-Z0-9_]*=/.test(tokens[index])) {
    index++;
  }
  if (index < tokens.length) {
    firstWord = tokens[index];
  }

  // Remove leading paths (e.g. "/usr/bin/git", "./scripts/build.js")
  const baseName = firstWord.replace(/^.*[/\\]/, '').replace(/\.(exe|cmd|bat|sh|ps1)$/i, '').toLowerCase();

  if (KNOWN_EXECUTABLES.has(baseName) || KNOWN_EXECUTABLES.has(firstWord.toLowerCase())) {
    // If followed by high-level abstract nouns rather than CLI subcommands/args (e.g. "vite dashboard", "react app", "node project")
    if (tokens.length === 2 && /^(?:dashboard|app|application|website|site|landing|project)$/i.test(tokens[1])) {
      return false;
    }
    return true;
  }

  // File execution syntax (./foo, python script.py, node script.js)
  if (/^\.{1,2}[/\\]/.test(firstWord)) return true;
  if (/\.(js|mjs|cjs|ts|py|rb|sh|bash|ps1|bat|cmd)$/i.test(firstWord) && tokens.length >= 1) return true;

  // Custom CLI pattern: identifier followed by flags or subcommands
  // e.g. "my-custom-cli --workspace ./app --deploy=false"
  if (/^[a-z0-9_\-]+$/i.test(firstWord) && tokens.length >= 2) {
    // Check if subsequent tokens are flags or arguments
    const hasFlags = tokens.slice(1).some(t => /^--?[a-z0-9_\-]+/i.test(t));
    if (hasFlags) {
      // Must not start with common conversational English words
      if (!/^(?:what|why|how|who|where|when|which|explain|is|are|can|could|would|please|show|create|build|make)\b/i.test(firstWord)) {
        return true;
      }
    }
  }

  // Has shell operators outside quotes (e.g. "cat file | grep test", "npm run build && npm test")
  const compound = splitShellCompound(cleaned);
  if (compound.length > 1) {
    const firstSegment = compound[0].segment;
    if (isPlausibleExecutableCommand(firstSegment)) return true;
  }

  return false;
}

/**
 * Extracts explicit constraints declared by the user
 */
export function extractConstraints(text) {
  const constraints = {
    tool: null,
    packageManager: null,
    language: null,
    noDependencies: false,
    noModifyPackageJson: false,
    isolated: false,
    exact: false,
    framework: null,
    raw: []
  };

  if (!text || typeof text !== 'string') return constraints;
  const lower = text.toLowerCase();

  // Package manager constraints
  if (/\b(?:use|using|with)\s+pnpm\b/.test(lower) || /\bpnpm,\s*not\s+npm\b/.test(lower) || /\bpnpm\s+to\s+install\b/.test(lower)) {
    constraints.packageManager = 'pnpm';
    constraints.raw.push('use pnpm');
  } else if (/\b(?:use|using|with)\s+yarn\b/.test(lower)) {
    constraints.packageManager = 'yarn';
    constraints.raw.push('use yarn');
  } else if (/\b(?:use|using|with)\s+bun\b/.test(lower)) {
    constraints.packageManager = 'bun';
    constraints.raw.push('use bun');
  } else if (/\b(?:use|using|with)\s+npm\b/.test(lower) || /\bnpm,\s*not\s+pnpm\b/.test(lower)) {
    constraints.packageManager = 'npm';
    constraints.raw.push('use npm');
  }

  // Framework / tool constraints
  if (/\bcreate[\s\-_]react[\s\-_]app\b/.test(lower) || /\bcra\b/.test(lower)) {
    constraints.tool = 'create-react-app';
    constraints.framework = 'react';
    constraints.raw.push('create-react-app');
  } else if (/\bvite\b/.test(lower)) {
    constraints.tool = 'vite';
    constraints.raw.push('vite');
  } else if (/\bnext(?:\.js)?\b/.test(lower)) {
    constraints.tool = 'nextjs';
    constraints.raw.push('next.js');
  }

  // Language constraints
  if (/\btypescript\b/.test(lower) || /\bwith\s+ts\b/.test(lower)) {
    constraints.language = 'typescript';
    constraints.raw.push('typescript');
  } else if (/\bjavascript\b/.test(lower) || /\bwith\s+js\b/.test(lower)) {
    constraints.language = 'javascript';
    constraints.raw.push('javascript');
  }

  // Dependency constraints
  if (/\b(?:don'?t|do\s+not|without)\s+install(?:ing)?\s+(?:any\s+)?dependencies\b/.test(lower) || /\bno\s+dependencies\b/.test(lower)) {
    constraints.noDependencies = true;
    constraints.raw.push('no dependencies');
  }

  // Filesystem modification constraints
  if (/\b(?:don'?t|do\s+not|without)\s+modify(?:ing)?\s+package\.json\b/.test(lower)) {
    constraints.noModifyPackageJson = true;
    constraints.raw.push('do not modify package.json');
  }

  // Exact command execution constraint
  if (/\b(?:run\s+exactly|this\s+exact\s+command|exact\s+commands?|literal\s+command)\b/.test(lower)) {
    constraints.exact = true;
    constraints.raw.push('exact command');
  }

  return constraints;
}

/**
 * Extracts targets (files, directories, applications) mentioned in the instruction
 */
export function extractTargets(text) {
  if (!text || typeof text !== 'string') return [];
  const targets = [];
  // Match file paths or names with extensions (e.g. config.js, src/App.jsx, package.json)
  const fileMatches = text.match(/\b[a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]{1,5}\b/g);
  if (fileMatches) {
    fileMatches.forEach(f => {
      if (!targets.includes(f) && !['e.g.', 'etc.', 'i.e.'].includes(f.toLowerCase())) {
        targets.push(f);
      }
    });
  }
  return targets;
}

/**
 * Decomposes multi-step instructions into sequential action intents
 */
export function decomposeInstructions(input, context = {}) {
  if (!input || typeof input !== 'string') return [];
  const text = input.trim();

  // Multi-command lead phrases (e.g. "Run these commands: ...")
  const multiCmdLead = /^(?:run\s+these\s+commands?|execute\s+these\s+commands?|run\s+the\s+following\s+commands?)(?:\s*:|\s+in\s+order\s*:|\s+in\s+sequence\s*:)?/i;
  if (multiCmdLead.test(text)) {
    const remainder = text.replace(multiCmdLead, '').trim();
    const cleaned = cleanCodeFence(remainder);
    const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    return lines.map((cmd, idx) => ({
      id: `act-${idx + 1}`,
      action: 'execute-command',
      authorized: true,
      mechanism: EXECUTION_MODES.LITERAL,
      command: cmd,
      description: `Execute literal command: ${cmd}`,
      status: ACTION_LIFECYCLE.AUTHORIZED
    }));
  }

  // Sequential "then" / "and then" compound instructions
  // e.g. "Run npm install, then add authentication and test it"
  // e.g. "Run npm run build, fix whatever breaks, and run it again"
  const stepSplitRegex = /(?:,\s*then\s+|\s+and\s+then\s+|\s*;\s*then\s+)/i;
  if (stepSplitRegex.test(text)) {
    const parts = text.split(stepSplitRegex).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((part, idx) => {
        const subIntent = classifyInstruction(part, context);
        if (subIntent.kind === INSTRUCTION_KINDS.COMMAND || subIntent.exactCommands.length > 0) {
          return {
            id: `act-${idx + 1}`,
            action: 'execute-command',
            authorized: true,
            mechanism: EXECUTION_MODES.LITERAL,
            command: subIntent.exactCommands[0],
            description: `Execute literal command: ${subIntent.exactCommands[0]}`,
            status: ACTION_LIFECYCLE.AUTHORIZED
          };
        }
        if (subIntent.kind === INSTRUCTION_KINDS.DEVELOPMENT) {
          return {
            id: `act-${idx + 1}`,
            action: 'development',
            authorized: true,
            mechanism: EXECUTION_MODES.AUTONOMOUS,
            description: part,
            outcome: subIntent.requestedOutcome,
            status: ACTION_LIFECYCLE.AUTHORIZED
          };
        }
        return {
          id: `act-${idx + 1}`,
          action: 'development',
          authorized: true,
          mechanism: EXECUTION_MODES.AUTONOMOUS,
          description: part,
          status: ACTION_LIFECYCLE.AUTHORIZED
        };
      });
    }
  }

  return [];
}

/**
 * Structured Instruction Intent Record
 */
export class InstructionIntent {
  constructor({
    kind = INSTRUCTION_KINDS.AMBIGUOUS,
    executionMode = EXECUTION_MODES.NONE,
    executionAuthorized = false,
    mechanismSpecified = false,
    exactCommands = [],
    requestedOutcome = null,
    constraints = {},
    targets = [],
    actions = [],
    confidence = 1.0,
    signals = []
  }) {
    this.kind = kind;
    // Backward compatibility aliases
    this.mode = kind;
    this.executionMode = executionMode;
    this.executionAuthorized = Boolean(executionAuthorized);
    this.mechanismSpecified = Boolean(mechanismSpecified);
    this.exactCommands = Array.isArray(exactCommands) ? exactCommands : (exactCommands ? [exactCommands] : []);
    this.exactCommand = this.exactCommands[0] || null;
    this.commands = this.exactCommands;
    this.requestedOutcome = requestedOutcome;
    this.constraints = {
      tool: constraints.tool || null,
      packageManager: constraints.packageManager || null,
      language: constraints.language || null,
      noDependencies: Boolean(constraints.noDependencies),
      noModifyPackageJson: Boolean(constraints.noModifyPackageJson),
      isolated: Boolean(constraints.isolated),
      exact: Boolean(constraints.exact),
      framework: constraints.framework || null,
      raw: Array.isArray(constraints.raw) ? constraints.raw : []
    };
    this.targets = Array.isArray(targets) ? targets : [];
    this.actions = Array.isArray(actions) ? actions : [];
    this.confidence = confidence;
    this.signals = Array.isArray(signals) ? signals : [];
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      kind: this.kind,
      executionMode: this.executionMode,
      executionAuthorized: this.executionAuthorized,
      mechanismSpecified: this.mechanismSpecified,
      exactCommands: this.exactCommands,
      exactCommand: this.exactCommand,
      requestedOutcome: this.requestedOutcome,
      constraints: this.constraints,
      targets: this.targets,
      actions: this.actions,
      confidence: this.confidence,
      signals: this.signals,
      timestamp: this.timestamp
    };
  }
}

/**
 * AUTHORITATIVE CLASSIFIER
 * Analyzes user input and produces an InstructionIntent
 *
 * @param {string} input - Raw text entered by the user
 * @param {object} context - Current workspace / editor / assistant context
 * @returns {InstructionIntent}
 */
export function classifyInstruction(input, context = {}) {
  if (!input || typeof input !== 'string') {
    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.AMBIGUOUS,
      executionMode: EXECUTION_MODES.NONE,
      executionAuthorized: false,
      confidence: 0,
      signals: []
    });
  }

  const rawTrimmed = input.trim();
  const cleaned = cleanCodeFence(rawTrimmed);
  const constraints = extractConstraints(rawTrimmed);
  const targets = extractTargets(rawTrimmed);

  // 1. AMBIGUOUS FRAGMENTS (e.g. "vite dashboard", "build app", "npm?", "run this", "make this work")
  if (/^(?:run\s+this|make\s+this\s+work|npm\?|test\?|build\s+app|vite\s+dashboard)$/i.test(cleaned)) {
    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.AMBIGUOUS,
      executionMode: EXECUTION_MODES.NONE,
      executionAuthorized: false,
      mechanismSpecified: false,
      exactCommands: [],
      constraints,
      targets,
      confidence: 0.35,
      signals: ['ambiguous-input']
    });
  }

  // 1.5. QUOTED COMMAND EXPLANATIONS / INFORMATION REGRESSIONS
  // e.g. "Explain `npm install`."
  // e.g. "What does `git status` do?"
  // e.g. "What does npm install do?"
  // e.g. "What command creates a Vite React app?"
  // e.g. "Why did the build fail?"
  // e.g. "Why does npm run build fail?"
  // e.g. "Give me the command to run the tests."
  // e.g. "Show me how to run the tests."
  const isInterrogative = INFO_INTERROGATIVE_REGEX.test(cleaned) || INFO_ABOUT_COMMAND_REGEX.test(cleaned);
  const hasExplainVerb = /^(?:explain|describe|show\s+me\s+how|give\s+me\s+the\s+command)\b/i.test(cleaned);

  if ((isInterrogative || hasExplainVerb) && !RUN_PREFIX_REGEX.test(cleaned)) {
    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.INFORMATION,
      executionMode: EXECUTION_MODES.NONE,
      executionAuthorized: false,
      mechanismSpecified: false,
      exactCommands: [],
      requestedOutcome: cleaned,
      constraints,
      targets,
      actions: [
        {
          id: 'act-1',
          action: 'explain',
          authorized: true,
          mechanism: EXECUTION_MODES.NONE,
          description: 'Provide technical explanation or command syntax without executing.',
          status: ACTION_LIFECYCLE.AUTHORIZED
        }
      ],
      confidence: 0.98,
      signals: ['informational-interrogative']
    });
  }

  // 2. MULTI-COMMAND SPECIFIC BLOCKS (e.g. "Run these commands: ...", "Run the following commands: ...")
  const multiCmdLead = /^(?:run\s+these\s+commands?|execute\s+these\s+commands?|run\s+the\s+following\s+commands?)(?:\s*:|\s+in\s+order\s*:|\s+in\s+sequence\s*:)?/i;
  if (multiCmdLead.test(rawTrimmed)) {
    const decomposed = decomposeInstructions(rawTrimmed, context);
    const commandList = decomposed.filter(d => d.action === 'execute-command').map(d => d.command);
    if (commandList.length) {
      return new InstructionIntent({
        kind: INSTRUCTION_KINDS.MIXED,
        executionMode: EXECUTION_MODES.LITERAL,
        executionAuthorized: true,
        mechanismSpecified: true,
        exactCommands: commandList,
        constraints,
        targets,
        actions: decomposed,
        confidence: 0.98,
        signals: ['explicit-imperative', 'multi-step-sequence', 'shell-syntax', 'explicit-mechanism']
      });
    }
  }

  // 3. EXPLICIT COMMAND PREFIX (e.g. "Run npm install", "Run exactly: ...", "Please run git status", "Execute npm run build")
  if (RUN_PREFIX_REGEX.test(cleaned)) {
    const stripped = cleaned.replace(RUN_PREFIX_REGEX, '').trim();
    const cleanCmd = cleanCodeFence(stripped);

    // Check for Command + Context / Mixed Sequential (e.g. "Run npm test and explain the failure", "Run npm install, then add authentication")
    const contextSplitMatch = cleanCmd.match(/^([^\n]+?)\s+(?:and\s+tell\s+me|and\s+explain|because)\s+(.+)$/i);
    if (contextSplitMatch) {
      const candidateCmd = contextSplitMatch[1].trim();
      const followUpText = contextSplitMatch[2].trim();

      if (isPlausibleExecutableCommand(candidateCmd)) {
        return new InstructionIntent({
          kind: INSTRUCTION_KINDS.MIXED,
          executionMode: EXECUTION_MODES.LITERAL,
          executionAuthorized: true,
          mechanismSpecified: true,
          exactCommands: [candidateCmd],
          requestedOutcome: followUpText,
          constraints,
          targets,
          actions: [
            {
              id: 'act-1',
              action: 'execute-command',
              authorized: true,
              mechanism: EXECUTION_MODES.LITERAL,
              command: candidateCmd,
              description: `Execute literal command: ${candidateCmd}`,
              status: ACTION_LIFECYCLE.AUTHORIZED
            },
            {
              id: 'act-2',
              action: 'explain',
              authorized: true,
              mechanism: EXECUTION_MODES.NONE,
              description: followUpText,
              status: ACTION_LIFECYCLE.REQUESTED
            }
          ],
          confidence: 0.95,
          signals: ['explicit-imperative', 'known-executable', 'shell-syntax', 'explicit-mechanism']
        });
      }
    }

    // Check for sequential multi-step (e.g. "Run npm install, then add authentication", "Run npm run build, fix whatever breaks, and run it again")
    const decomposed = decomposeInstructions(cleaned, context);
    if (decomposed.length > 1) {
      return new InstructionIntent({
        kind: INSTRUCTION_KINDS.MIXED,
        executionMode: EXECUTION_MODES.MIXED,
        executionAuthorized: true,
        mechanismSpecified: decomposed.some(d => d.mechanism === EXECUTION_MODES.LITERAL),
        exactCommands: decomposed.filter(d => d.command).map(d => d.command),
        requestedOutcome: cleaned,
        constraints,
        targets,
        actions: decomposed,
        confidence: 0.94,
        signals: ['explicit-imperative', 'multi-step-sequence', 'shell-syntax']
      });
    }

    if (isPlausibleExecutableCommand(cleanCmd)) {
      return new InstructionIntent({
        kind: INSTRUCTION_KINDS.COMMAND,
        executionMode: EXECUTION_MODES.LITERAL,
        executionAuthorized: true,
        mechanismSpecified: true,
        exactCommands: [cleanCmd],
        constraints,
        targets,
        actions: [
          {
            id: 'act-1',
            action: 'execute-command',
            authorized: true,
            mechanism: EXECUTION_MODES.LITERAL,
            command: cleanCmd,
            description: `Execute literal command: ${cleanCmd}`,
            status: ACTION_LIFECYCLE.AUTHORIZED
          }
        ],
        confidence: 0.99,
        signals: ['explicit-imperative', 'known-executable', 'shell-syntax', 'explicit-mechanism']
      });
    }
  }

  // 4. BARE EXECUTABLE COMMANDS (e.g. "npm install", "npm run build", "git status", "npm create vite@latest app -- --template react", "npm run build && npm test")
  if (isPlausibleExecutableCommand(cleaned)) {
    const tokens = parseShellTokens(cleaned);
    const firstWord = tokens[0]?.toLowerCase() || '';

    // Guard ambiguous single tokens (e.g. "vite", "build", "start", "test" without args)
    if (tokens.length === 1 && !['git', 'npm', 'node', 'ls', 'dir', 'pwd'].includes(firstWord)) {
      if (['vite', 'build', 'start', 'test'].includes(firstWord)) {
        return new InstructionIntent({
          kind: INSTRUCTION_KINDS.AMBIGUOUS,
          executionMode: EXECUTION_MODES.NONE,
          executionAuthorized: false,
          mechanismSpecified: false,
          exactCommands: [],
          constraints,
          targets,
          confidence: 0.4,
          signals: ['ambiguous-single-word']
        });
      }
    }

    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.COMMAND,
      executionMode: EXECUTION_MODES.LITERAL,
      executionAuthorized: true,
      mechanismSpecified: true,
      exactCommands: [cleaned],
      constraints,
      targets,
      actions: [
        {
          id: 'act-1',
          action: 'execute-command',
          authorized: true,
          mechanism: EXECUTION_MODES.LITERAL,
          command: cleaned,
          description: `Execute literal command: ${cleaned}`,
          status: ACTION_LIFECYCLE.AUTHORIZED
        }
      ],
      confidence: 0.98,
      signals: ['shell-syntax', 'known-executable', 'explicit-mechanism']
    });
  }

  // 5. NATURAL LANGUAGE SEQUENCING & MIXED REQUESTS
  // e.g. "Run npm install, then add authentication"
  // e.g. "Create a Vite app and start its dev server"
  // e.g. "Run npm run build, fix whatever breaks, and run it again"
  const decomposed = decomposeInstructions(rawTrimmed, context);
  if (decomposed.length > 1) {
    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.MIXED,
      executionMode: EXECUTION_MODES.MIXED,
      executionAuthorized: true,
      mechanismSpecified: decomposed.some(d => d.mechanism === EXECUTION_MODES.LITERAL),
      exactCommands: decomposed.filter(d => d.command).map(d => d.command),
      requestedOutcome: cleaned,
      constraints,
      targets,
      actions: decomposed,
      confidence: 0.92,
      signals: ['multi-step-sequence', 'natural-language-outcome']
    });
  }

  // Check for "Create a Vite app and start its dev server"
  if (/^create\s+(?:a|an)\s+.*?\s+and\s+start\s+/i.test(cleaned)) {
    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.MIXED,
      executionMode: EXECUTION_MODES.AUTONOMOUS,
      executionAuthorized: true,
      mechanismSpecified: Boolean(constraints.tool || constraints.packageManager),
      exactCommands: [],
      requestedOutcome: cleaned,
      constraints,
      targets,
      actions: [
        {
          id: 'act-1',
          action: 'development',
          authorized: true,
          mechanism: EXECUTION_MODES.AUTONOMOUS,
          description: cleaned,
          status: ACTION_LIFECYCLE.AUTHORIZED
        },
        {
          id: 'act-2',
          action: 'start-dev-server',
          authorized: true,
          mechanism: EXECUTION_MODES.AUTONOMOUS,
          description: 'Launch preview and dev server',
          status: ACTION_LIFECYCLE.REQUESTED
        }
      ],
      confidence: 0.92,
      signals: ['natural-language-outcome', 'multi-step-sequence']
    });
  }

  // 6. NATURAL LANGUAGE WORKSPACE OPERATIONS
  // e.g. "Create config.js", "Delete the old authentication module", "Move App.jsx into src/components"
  if (/^(?:create|delete|remove|move|rename|replace)\s+(?:config\.js|[a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]{1,5}|the\s+old\s+[a-z0-9_\-\s]+module|the\s+file\b)/i.test(cleaned)) {
    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.WORKSPACE,
      executionMode: EXECUTION_MODES.AUTONOMOUS,
      executionAuthorized: true,
      mechanismSpecified: false,
      exactCommands: [],
      requestedOutcome: cleaned,
      constraints,
      targets,
      actions: [
        {
          id: 'act-1',
          action: 'workspace-fs',
          authorized: true,
          mechanism: EXECUTION_MODES.AUTONOMOUS,
          description: cleaned,
          status: ACTION_LIFECYCLE.AUTHORIZED
        }
      ],
      confidence: 0.90,
      signals: ['workspace-operation']
    });
  }

  // 7. NATURAL LANGUAGE DEVELOPMENT
  // e.g. "Create a React app", "Build me a dashboard", "Add authentication", "Fix this application", "Make the layout responsive", "Build this React app"
  if (DEV_OUTCOME_REGEX.test(cleaned) || /^(?:create|build|develop|implement|scaffold|make|add|fix)\s+(?:a|an|the|this|me\s+a)\b/i.test(cleaned) || /\b(?:dashboard|landing\s+page|authentication|responsive)\b/i.test(cleaned)) {
    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.DEVELOPMENT,
      executionMode: EXECUTION_MODES.AUTONOMOUS,
      executionAuthorized: true,
      mechanismSpecified: Boolean(constraints.tool || constraints.packageManager),
      exactCommands: [],
      requestedOutcome: cleaned,
      constraints,
      targets,
      actions: [
        {
          id: 'act-1',
          action: 'development',
          authorized: true,
          mechanism: EXECUTION_MODES.AUTONOMOUS,
          outcome: cleaned,
          description: cleaned,
          status: ACTION_LIFECYCLE.AUTHORIZED
        }
      ],
      confidence: 0.92,
      signals: ['natural-language-outcome', constraints.tool || constraints.packageManager ? 'explicit-mechanism' : null].filter(Boolean)
    });
  }

  // 8. AMBIGUOUS INPUTS (NO INVENTED AUTHORITY)
  // e.g. "vite dashboard", "build app", "npm?", "run this", "make this work"
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2 || /^(?:run\s+this|make\s+this\s+work|npm\?|test\?|build\s+app|vite\s+dashboard)$/i.test(cleaned)) {
    return new InstructionIntent({
      kind: INSTRUCTION_KINDS.AMBIGUOUS,
      executionMode: EXECUTION_MODES.NONE,
      executionAuthorized: false,
      mechanismSpecified: false,
      exactCommands: [],
      constraints,
      targets,
      confidence: 0.35,
      signals: ['ambiguous-input']
    });
  }

  // 9. FALLBACK
  return new InstructionIntent({
    kind: INSTRUCTION_KINDS.DEVELOPMENT,
    executionMode: EXECUTION_MODES.AUTONOMOUS,
    executionAuthorized: true,
    mechanismSpecified: false,
    exactCommands: [],
    requestedOutcome: cleaned,
    constraints,
    targets,
    actions: [
      {
        id: 'act-1',
        action: 'development',
        authorized: true,
        mechanism: EXECUTION_MODES.AUTONOMOUS,
        outcome: cleaned,
        description: cleaned,
        status: ACTION_LIFECYCLE.AUTHORIZED
      }
    ],
    confidence: 0.75,
    signals: ['natural-language-outcome']
  });
}
