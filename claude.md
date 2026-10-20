# Xplayer — Project Instructions

**Public repository:** https://github.com/ExhataQ/Xplayer

**Project name:** Xplayer  
**Developer / GitHub account:** ExhataQ

Keep the repository public when sharing it.it.

Xplayer is a free, local-first Electron music player for Windows. Its primary goals are reliable playback, practical music-library management, and useful metadata and lyrics tools.

The repository contains:

- `Source/` — development source, tests, documentation, and build system.
- `App/` — deployed and generated application files.

The project should remain free. Do not introduce paid services or premium-only functionality.

## 2. Architecture and File Ownership

Read `Source/.agent/AGENTS.md` before making changes. Also consult the current `Source/.agent/PLAN.md`, `BOARD.md`, and relevant task reports when the requested work relates to an active development plan.

### Build and runtime

- `Source/build/music_player.py` — Python build system. It assembles the application and preserves existing song data when appropriate.
- `Source/build/music_player.html` — build template.
- `App/MusicPlayerOutput/` — generated application output.
- `App/electron.exe` — deployed Electron executable.
- `Source/electron/scan-folder.js` — runtime audio scanner. It uses `music-metadata` and handles importing files, changing folders, downloads, rebuilds, and metadata scanning.

Do not confuse build-time processing with runtime scanning. Changes to source files do not automatically update the deployed application.

### Renderer

Renderer JavaScript is organized by responsibility under `Source/src/js/`:

- `core/` — application state, event bus, storage, startup, and build data.
- `library/` — library data, favorites, settings, metadata editing, and related features.
- `playlists/` — playlists, pinned items, and folders.
- `search/` — search engine, search history, and search panel.
- `playback/` — playback controls, song navigation, queue, and shuffle.
- `lyrics/` — lyrics display, parsing, synchronization, and online lyrics.
- `ui/` — views, panels, rendering, layout, and UI behavior.
- `ui/subscribers/` — event subscribers for UI rendering and related state changes.
- `api/` — renderer-facing API modules.

`Source/src/js/main.js` is the renderer entry point. Its import order determines module load order. Preserve that order and its dependency assumptions.

JavaScript filenames retain their numeric prefixes. Follow the existing naming and folder conventions when adding or moving files.

`Source/src/js/99-player.js` is a build-time data template containing placeholders such as `{{SONGS_DATA}}` and `{{PLACEHOLDER_IMAGE}}`. `core/build-data.js` reads it. Do not treat it as the primary runtime library store.

The runtime library is stored in `MusicPlayerOutput/songs.json`, managed by `Source/electron/songs-store.js`. The template's placeholder song data is used as a fallback for plain-browser operation and tests.

Startup logic is in `Source/src/js/core/startup.js`.

### Important file ownership

Inspect the existing implementation before deciding where a change belongs.

- Audio scanning, tag extraction, supported formats, and cover extraction: `Source/electron/scan-folder.js`
- Metadata reading and writing: `Source/electron/metadata-editor.py` and its Node wrapper
- MusicBrainz and Cover Art Archive: `Source/electron/online-metadata.js`
- LRCLIB backend: `Source/electron/online-lyrics.js`
- Online lyrics UI: `Source/src/js/lyrics/19-online-lyrics.js`
- Electron IPC and application bootstrap: `Source/electron/main.js`
- Window behavior: `Source/electron/window-manager.js`
- Playback and shuffle: `Source/src/js/playback/10a-playback-shuffle.js`, `10a0-shuffle-state.js`, `10b-playback-smart-shuffle.js`, `10c-playback-queue.js`, and `10d-playback-song.js`
- Playback controls: `Source/src/js/playback/15a-controls-time-play.js` through `15g-controls-volume-fade.js`; related state is in `15a0-controls-state.js`
- Song navigation and highlighting: `Source/src/js/playback/14-song-navigation.js` and `13-song-highlight.js`
- Library data and related operations: `Source/src/js/library/03*.js`
- Playlists, pinned items, and folders: `Source/src/js/playlists/03c-playlists.js`, `03g-pinned-items.js`, `03h-folders.js`, and `09-folders-playlists.js`
- Search: `Source/src/js/search/03b-search-engine.js`, `03i-search-history.js`, and `08h-panel-search.js`
- State, events, storage, and settings: `Source/src/js/core/00-state.js`, `00b-events.js`, `storage.js`, and `Source/src/js/library/03f-favorites-settings.js`
- Views: `Source/src/js/ui/07-views.js`
- Panels: `Source/src/js/ui/08a-panel-layout.js` through `08f-panel-extended-metadata.js`; settings are in `08e-panel-settings.js`
- Track and saved lyrics panels: `Source/src/js/lyrics/08c-panel-track-lyrics.js` and `08g-panel-saved-lyrics.js`
- Virtual scrolling: `Source/src/js/ui/05a-lazy-load-main-list.js`, `05b-lazy-load-left-panel.js`, and `05c-lazy-load-smart-lyrics.js`
- Main UI rendering: `Source/src/js/ui/04a-ui-render-core.js` through `04g`, with event subscribers `04h` through `04v` under `Source/src/js/ui/subscribers/`
- Lyrics parsing and synchronization: `Source/src/js/lyrics/11a-lrc-parser-display.js`, `11b` through `11g`, and `lrc-parser.js`
- Language detection: `Source/src/js/lyrics/21-language-detect.js`
- Styling: the relevant file under `Source/src/css/`

These mappings are navigation aids, not permission to ignore the actual implementation. If a responsibility has moved, follow the current code and update the relevant documentation.

Do not duplicate existing functionality in another module simply because it is convenient.

### Electron security

Preserve the existing security model, including `nodeIntegration: false` and `contextIsolation: true`. Follow the existing main-process, preload, IPC, and renderer API boundaries.

Do not introduce direct Node.js or Electron access into the renderer where the architecture prohibits it.

## 3. Development Workflow

### Understand, then implement

When given a requested change, patch, error, or code sample:

1. Read the relevant implementation and identify the actual code path.
2. Inspect only the related files and tests.
3. Make the smallest reasonable change.
4. Preserve unrelated behavior and existing user work.
5. Run focused verification after implementation.
6. Report the result concisely.

Do not repeatedly summarize the architecture or test an unchanged baseline. The existing project is assumed to have been tested unless there is evidence of a baseline problem.

Avoid broad searches, unrelated refactoring, unnecessary abstractions, and new dependencies unless the change justifies them.

### Comments and documentation

Add comments only when they explain non-obvious behavior, important constraints, or deliberate workarounds. Do not narrate obvious code.

Update architectural documentation when a responsibility, interface, or dependency materially changes. Do not rewrite the entire project description for a small change.

### Agent workflow

- `Source/.agent/AGENTS.md` — shared instructions and agent responsibilities.
- `Source/.agent/PLAN.md` — current development plan.
- `Source/.agent/BOARD.md` — current task status.
- `Source/.agent/reports/` — detailed evidence for individual tasks.
- `Source/.agent/reports/TEMPLATE.md` — report format.
- `Source/tools/CHANGELOG.md` — concise integrated-development history, using the dated file-and-bullets format below.
- `Source/CHANGELOG.md` — project/release changelog, organized by release headings such as `Unreleased`. Keep the two changelogs' purposes distinct; do not copy entries between them automatically.

Plan 3's completed work and historical agent material belong in the appropriate archive. Do not reactivate archived tasks or overwrite historical reports unless explicitly requested.

For new agent tasks, use a unique report filename and record the actual changes, commands, results, environment, skipped checks, and unresolved issues. Do not claim an unrun test passed.

Task agents should not edit the shared integrated-development changelog. The designated integration owner updates `Source/tools/CHANGELOG.md` after integration and verification, preserving historical entries and using the existing format:

- Date on its own line.
- File name on its own line.
- Bullets describing actual changes.

Keep the changelog concise. Put detailed implementation and test evidence in the task report.

## 4. Testing

Tests validate changes; they are not a ritual to repeat at the beginning of every task.

Run the smallest relevant tests after implementation. Expand verification only when failures, shared functionality, cross-module effects, or the scope of the change warrant it.

Examples:

- Scanner changes: scanner and metadata tests.
- Metadata editor changes: metadata editor and backend tests.
- Lyrics changes: lyrics parsing, synchronization, or online-lyrics tests.
- Playback changes: relevant playback, queue, or shuffle tests.
- UI or CSS changes: relevant renderer tests and static checks, followed by a focused manual inspection.
- Build-system changes: relevant build checks and generated-output verification.

Use the current test scripts defined in `Source/package.json` and follow `Source/tools/tests/README.md`. Do not assume old commands, test counts, or test discovery rules remain current without checking the project configuration.

The last recorded Plan 3 verification reported 452 tests, with 451 passing, none failing, and one skipped. Strict linting checked 136 files with zero warnings or errors. These are historical results, not a guarantee that the current checkout has identical results.

Never change a test merely to conceal a legitimate implementation failure.

### Build verification

Run `Source/build/music_player.py` when the change affects build assembly, generated output, packaging, source-to-output copying, or build-time data injection.

For ordinary source, documentation, test, or renderer changes that do not depend on generated output, do not rebuild automatically.

When a build is required, verify the relevant generated files under `App/MusicPlayerOutput/`. Do not edit generated output as a substitute for changing the source.

### Manual verification

For changes that affect behavior visible in the application, provide a short, specific manual checklist with expected results.

Do not claim full verification when a required manual check has not been performed.

## 5. UI Redesign

The goal is to improve the existing Xplayer interface, not create a separate application or replace working functionality with a mockup.

Read `.agent/ui-redesign/USER_PREFERENCES.md` when available. Follow `.claude/skills/xplayer-ui-redesign/SKILL.md` when using that Claude skill. Consult more specific design notes when they exist.

These documents serve different purposes:

- `USER_PREFERENCES.md` records the user's evolving ideas, preferences, and dislikes.
- The skill defines the workflow and implementation guardrails.
- Specific design notes can document individual areas such as the sidebar, tooltips, song list, or notifications.

Treat brainstorms as guidance, not immutable specifications. Use design judgment and explain important trade-offs.

For a major redesign, first inspect the actual UI and existing functionality, then propose a cohesive design system and obtain approval before substantial restructuring. Once approved, implement the design in the real source files.

Priorities:

1. Reliable playback and performance.
2. Clear navigation and practical library management.
3. A cohesive visual system across views, panels, dialogs, tooltips, and notifications.
4. Responsive layouts and consistent interaction states.
5. Maintainability without unnecessary architectural complexity.

Preserve the existing application behavior unless a change is approved. Avoid adding a new framework or redesign-specific architecture without a clear justification.

When redesign work is performed in another environment, deliver a Git patch whenever practical. Provide an updated project archive only when explicitly requested. Include actual source changes and relevant verification evidence, not just screenshots or a standalone prototype.

## 6. Git and Patch Handling

The user normally handles Git operations, commits, pushes, and patch application. Do not perform or prescribe a Git workflow unless explicitly requested.

When Git inspection or patch creation is part of the requested task:

- Inspect the working-tree status and relevant diff first.
- Protect unrelated user changes.
- Do not stage or commit unrelated files.
- Inspect patches against the current repository state before applying them.
- Do not force a patch through conflicts without understanding the differences.
- After applying a patch, inspect the resulting file changes and diff.
- Run relevant tests and `git diff --check` when appropriate.

When asked to create a patch, generate it from the actual repository changes. Include only the intended changes and use a descriptive filename, such as `0001-fix-cover-art.patch`. Keep independent changes separate when practical.

Do not create commits containing unrelated work. If a commit is explicitly requested, report its hash and summary. If a push is explicitly requested, report the actual outcome rather than assuming it succeeded.

## 7. Reporting

Keep responses concise and factual. Prefer:

**Changed:** Files and behavior modified.

**Reason:** Why the change was necessary.

**Automated tests:** Exact relevant tests run and their results.

**Build:** Mention only when a build was required or performed.

**Manual testing:** Specific steps and expected outcomes.

**Deliverable:** Patch or other requested artifact, plus any limitations.

Do not paste entire files or repeat unchanged code when a patch or focused diff is sufficient. Distinguish verified facts from assumptions and clearly identify skipped or unrun checks.

## 8. Core Constraints

- Keep the application free.
- Preserve existing functionality unless a change requires otherwise and is approved.
- Preserve Electron security boundaries.
- Follow renderer module load order and existing architecture.
- Avoid unnecessary dependencies and unrelated refactors.
- Take performance regressions seriously, particularly in scanning, cover processing, rendering, virtual scrolling, and playback.
- Protect unrelated work.
- Prefer incremental, reversible changes.
- If a major architectural decision is uncertain, inspect the implementation and explain the trade-off before proceeding.

## Ready State

The project context above is the baseline. When the user provides code and asks for a change, inspect the relevant implementation and begin working. Do not ask the user to repeat information already provided, run the entire test suite before changing anything, or spend the opening response restating this document.