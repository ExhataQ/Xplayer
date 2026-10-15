---
name: xplayer-ui-redesign
description: Redesign the existing Xplayer music player's interface using its UI preferences, established functionality, and a cohesive design system. Use when planning, implementing, reviewing, or refining Xplayer UI changes.
---

# Xplayer UI Redesign Skill

## Purpose

Improve the actual Xplayer application UI. Do not substitute a static mockup or standalone prototype for implementation in the existing application.

## Before Starting

1. Read `.agent/ui-redesign/USER_PREFERENCES.md` and any relevant, more specific design notes.
2. Inspect the existing interface, renderer structure, styles, component behavior, and relevant tests.
3. Identify existing functionality and interaction patterns before proposing replacements.
4. Treat preference documents as evolving guidance, not immutable specifications. Use design judgment and explain meaningful trade-offs.

## Design Process

1. **Audit:** Identify usability problems, inconsistencies, redundant UI, and opportunities for simplification.
2. **System:** Establish shared design tokens and reusable rules for color, typography, spacing, borders, icons, motion, and interaction states.
3. **Proposal:** Present a concise design direction and explain how it improves the existing application. Obtain approval before major visual restructuring or behavior changes.
4. **Implementation:** Modify the real application source, reusing existing functionality and components where sensible.
5. **Verification:** Check relevant tests, rendering, resizing, interaction states, and Electron-specific behavior. Report anything not verified.

## Implementation Rules

- Preserve playback, library management, playlists, queue behavior, keyboard shortcuts, lyrics, metadata editing, and other existing functionality unless a change is explicitly approved.
- Follow the project's existing architecture, script-loading order, and coding conventions.
- Do not introduce a new framework, broad refactor, or unnecessary abstraction solely to support the redesign.
- Use a consistent, properly licensed icon system. Avoid mixing unrelated icon styles.
- Account for hover, focus, active, selected, disabled, loading, empty, error, and success states where relevant.
- Keep animations restrained and avoid unnecessary resource usage.
- Ensure the UI remains usable at different window sizes.
- Respect Electron security boundaries and existing main-process/preload responsibilities.
- Do not overwrite user work or unrelated changes.

## Scope and Approval

Start with analysis and a design proposal, not immediate large-scale code changes. Small, reversible improvements may be implemented when explicitly requested. Ask before changing navigation structure, removing features, introducing dependencies, or changing established behavior.

## Completion Report

Summarize:
- What changed and why.
- Which existing files or views were affected.
- Tests and checks performed, including failures or skipped checks.
- Any remaining limitations or decisions requiring user input.

The objective is a cohesive, practical, maintainable music player—not novelty for its own sake.