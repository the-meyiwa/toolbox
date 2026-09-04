---
trigger: always_on
---

TOOLBOX ARCHITECTURE CUSTOM INSTRUCTIONS

These instructions govern the architecture of Toolbox.

They apply to every feature, tool, Assistant capability, integration, refactor, and architectural change.

============================================================
1. ARCHITECTURE BEFORE IMPLEMENTATION
============================================================

Understand the existing architecture before changing it.

Never modify code based solely on assumptions about how the project works.

Before implementing a change:

1. Inspect the relevant existing code.
2. Identify the current source of truth.
3. Trace the existing data and control flow.
4. Identify dependencies and consumers.
5. Determine whether the requested capability already exists.
6. Determine the smallest architectural change that solves the problem correctly.

Do not invent architecture when the repository already contains an appropriate pattern.

Do not replace an existing architecture simply because another architecture is personally preferred.

============================================================
2. ONE SOURCE OF TRUTH
============================================================

Every domain must have a clear authoritative source of truth.

Do not create duplicate stores, duplicate state models, duplicate registries, or duplicate implementations of the same domain logic.

If multiple parts of Toolbox need access to the same information, expose that information through the existing architectural abstraction rather than copying it into another system.

Examples of architectural relationships:

UI
→ domain capability
→ authoritative state

Assistant
→ capability
→ authoritative state

Tool
→ capability
→ authoritative state

Different interfaces may interact with the same underlying capability, but they must not create competing versions of that capability.

============================================================
3. EXTEND EXISTING SYSTEMS BEFORE CREATING NEW ONES
============================================================

When a requested capability already exists:

- improve it
- repair it
- extend it
- expose it through the appropriate abstraction
- integrate it with existing systems

Do not create a second implementation merely because the first one is incomplete.

When a capability genuinely does not exist:

- create it using established Toolbox architectural patterns
- give it a clear responsibility
- integrate it with existing abstractions
- avoid creating unnecessary dependencies

The number of systems is not a measure of architectural quality.

Fewer coherent systems are preferable to many overlapping ones.

============================================================
4. SEPARATION OF RESPONSIBILITIES
============================================================

Keep responsibilities clearly separated.

UI is responsible for presentation and interaction.

Tools are responsible for user-facing capabilities.

Domain modules are responsible for domain logic.

Persistence abstractions are responsible for persistence.

The Assistant is responsible for understanding intent and orchestrating capabilities.

Rendering systems are responsible for presenting structured results.

Infrastructure is an implementation concern and must remain behind appropriate abstractions.

Do not allow one layer to absorb responsibilities belonging to another layer simply because it is convenient.

Avoid giant modules that know how to do everything.

============================================================
5. ASSISTANT ARCHITECTURE
============================================================

The Assistant is an orchestrator, not a replacement for Toolbox.

The Assistant should:

- understand user intent
- determine required capabilities
- select appropriate tools
- provide correct arguments
- sequence dependent operations
- parallelize independent operations where appropriate
- combine structured results
- verify outcomes where necessary
- communicate results clearly

The Assistant should NOT duplicate domain logic that already exists elsewhere.

If Toolbox already has a calculator, the Assistant should use the calculator.

If Toolbox already has a filesystem capability, the Assistant should use the filesystem.

If Toolbox already has a calendar capability, the Assistant should use the calendar.

The Assistant should operate Toolbox, not secretly rebuild Toolbox inside itself.

============================================================
6. ABSTRACTIONS OVER IMPLEMENTATION DETAILS
============================================================

Architecture must expose capabilities, not implementation details.

Code and internal interfaces should describe WHAT a system does rather than unnecessarily exposing HOW it does it.

Prefer concepts such as:

- FileStore
- FileSystem
- Calendar
- SearchProvider
- BrowserSession
- Project
- Compiler
- Artifact
- Storage
- Authentication
- ToolRegistry

over implementation-specific details leaking throughout the application.

Implementation details should be isolated behind appropriate boundaries.

Changing an underlying implementation should not require rewriting unrelated parts of Toolbox.

============================================================
7. USER-FACING ABSTRACTION
============================================================

Users interact with Toolbox capabilities, not its infrastructure.

Never design user-facing behavior around implementation details.

Do not expose internal architecture in:

- Assistant responses
- button labels
- tool descriptions
- empty states
- status messages
- error messages
- generated text
- file descriptions
- UI copy
- tool names intended for users

For example, users should see:

"Create a folder"

not an instruction describing where or how that folder is physically stored.

Users should see:

"Saved to Files"

not an explanation of the underlying persistence mechanism.

Users should see:

"Your files are available online"

not infrastructure terminology.

The implementation may use whatever technology is appropriate internally.

That technology should remain behind the abstraction.

============================================================
8. NEVER LEAK IMPLEMENTATION DETAILS INTO USER-FACING CODE
============================================================

Do not put infrastructure-specific instructions or terminology into user-facing strings merely because the implementation uses that infrastructure.

Bad:

"Create new folder on [implementation-specific service]"

Good:

"Create a new folder"

Bad:

"Upload this file to [implementation-specific storage]"

Good:

"Save this file"

Bad:

"Authenticate with [implementation-specific provider]"

Good:

"Sign in"

Bad:

"Create a remote record"

Good:

"Save"

The user cares about the capability and outcome.

The architecture determines how that outcome is achieved.

Keep those concerns separate.

============================================================
9. DO NOT HALLUCINATE ARCHITECTURE
============================================================

Never invent:

- modules
- APIs
- capabilities
- files
- functions
- data structures
- integrations
- dependencies
- existing behavior
- architectural conventions

If something is unknown, inspect the repository.

If it cannot be determined from the repository, do not pretend to know.

If the correct architectural decision depends on information that is genuinely ambiguous, STOP and ask for clarification before making a potentially irreversible architectural decision.

An explicit question is better than an elegant implementation of the wrong idea.

============================================================
10. UNCERTAINTY RULE
============================================================

When there are multiple materially different interpretations of a request, do not silently choose one.

Ask a concise clarification question when the ambiguity affects:

- architecture
- data ownership
- persistence
- security boundaries
- user experience
- destructive behavior
- compatibility
- long-term maintainability

Do not ask questions for trivial implementation details that can be safely resolved using existing project conventions.

The goal is:

inspect when the answer exists in the codebase

ask when the answer does not exist and matters

decide when the choice is low-risk and consistent with existing architecture

============================================================
11. NO ASSUMPTION-DRIVEN DEVELOPMENT
============================================================

Never assume:

- a service exists
- a database exists
- a file exists
- a function works
- a tool is registered
- an integration is configured
- a capability is available
- an operation succeeded
- a component behaves as expected

Verify.

Architecture should be based on the actual repository state.

============================================================
12. TOOL ARCHITECTURE
============================================================

Every Toolbox tool should have a clear responsibility.

A tool should answer:

"What specific capability does this provide?"

Avoid tools whose responsibility is vague or overlaps heavily with another tool.

Tools should remain independently usable where appropriate.

Use established lifecycle conventions.

Do not make tools tightly dependent on unrelated UI components.

Do not put unrelated domain logic into a tool merely because the tool happens to call it.

============================================================
13. REGISTRY ARCHITECTURE
============================================================

Tool registration should remain declarative and centralized.

Do not scatter tool discovery logic throughout the application.

Do not create competing registries.

A capability should have one authoritative registration mechanism.

Assistant discovery should derive from the authoritative tool definitions wherever possible.

Do not manually maintain duplicate lists of tools unless there is a clearly justified architectural reason.

============================================================
14. RESULT ARCHITECTURE
============================================================

Tools should return structured results rather than presentation-specific strings whenever practical.

A tool should communicate:

- success/failure
- meaningful result data
- relevant metadata
- state
- errors
- references to resulting artifacts where appropriate

Rendering should happen separately.

This allows the same capability to be used by:

- the Assistant
- a Toolbox page
- another tool
- an artifact workflow
- future interfaces

Do not make domain logic dependent on a particular visual renderer.
15. ARTIFACT ARCHITECTURE
Artifacts should represent meaningful outputs that can move between Toolbox capabilities.

An artifact should have a clear owner and lifecycle.

Cross-tool workflows should use established artifact/handoff mechanisms.

Do not create ad-hoc communication channels between tools when an existing architectural mechanism can represent the relationship.

Avoid passing opaque state through arbitrary global variables, unrelated DOM elements, or temporary hacks.

If a handoff mechanism is insufficient, improve the mechanism rather than multiplying workarounds.

16. DATA OWNERSHIP

Every piece of persistent data must have an identifiable owner.

Ask:

"Which system is authoritative for this information?"

Other systems should consume or reference that information rather than independently maintaining competing copies.

When data must be transformed for another capability, distinguish:

source data

derived data

temporary working state

persistent state

Do not accidentally turn temporary