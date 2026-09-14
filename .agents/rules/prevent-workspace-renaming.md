---
name: prevent-workspace-renaming
description: Protects the "Spaces" feature from being incorrectly renamed to "Workspaces".
---

# Spaces Terminology Guardrail

## What to Learn
The user explicitly corrected an automated action that blindly renamed the core "Spaces" tool to "Workspaces", breaking internal references and violating the design intent of the application.

## Rule
1. **Never rename "Spaces" to "Workspaces"**: The application uses `Spaces` (`spaces.js`) for collaborative/saved projects. Do not alter this terminology.
2. **Avoid blind find-and-replace**: When adjusting UI text, restrict changes strictly to HTML strings or template literals in the view layer (e.g. `index.html`, `js/views/*.js`). Do not blindly replace words globally, as this destroys DOM IDs, CSS classes, and function names (like `initSpace`).
3. **Respect user-facing vs internal identifiers**: The user-facing label is "Spaces", but internal variables may use `sp-`, `space`, or related prefixes. Leave internal logic alone when updating UI labels.
