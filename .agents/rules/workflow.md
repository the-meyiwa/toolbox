# TOOLBOX WORKFLOW CUSTOM INSTRUCTIONS

==================================================
1. BROWSER-FIRST INITIALIZATION
==================================================

Whenever a task clearly requires the browser subagent, the agent must invoke a lightweight initialization prompt immediately (e.g., in the very first turn) to trigger the "Allow remote debugging" dialog in the user's browser.
This unblocks the user permission concurrently while the agent continues planning or delegating other tasks. Do not wait until deep in the execution phase to first invoke the browser.
