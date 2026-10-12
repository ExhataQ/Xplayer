# Agent A report 0011: core and library as modules

Steps: A-15 (staged). Applies on top of: report 0010 (A-14 patch applied).

## What changed
- 24 files moved from `"js"` to `"modules"` in `src/manifest.json`, keeping their relative order: core/utils, core/state-queue, state-now-playing, state-navigation, state-ghost-list, state-folders, state-ui, library/songs, 03c, 03d, 03e, 03f, 03g, 03h, 03i, 03k, 03l, 03m, 09-folders-playlists, playback/session, ui/filters, ui/layout, ui/window-controls, library/import-dropped.
- Each file exports its functions and registers them with a guarded `registerLegacyGlobals` (library/songs also registers `deletedSongIds`).
- Tests: recents, storage and setters tests read the module files through `stripExports`; converted-modules gets a check that every exported function and every function called from an inline handler is on `window` (06i-theme-switcher is skipped: its exports are used inside it).

## Left classic, and why
`00-state`, `01-sizes`, `02-ghost-list`, `core/state-playback-modes`, `03j`: top-level `let`/`const` used by bare name from classic files. They flip together in A-16 after B-10, C-07 and D-09.
`core/storage.js`, `core/legacy.js`, `api/desktop-api.js`, `ui/player-bar.js`, `99-player.js`: loaded before or alongside the modules by design.

## Behavior notes
- Modules run after every classic script (before DOMContentLoaded). Anything a main-process message can reach must use `whenAppReady` or `desktopApi` (which gates event callbacks). B's `15e` window-maximize / thumbar callbacks still call `window.electronAPI.onX` directly.
- Pinned call-sequence tests: spies on `updateRecentCount` and `closeFolder` were removed (calls made inside the same module cannot be seen); sequences for all other names are unchanged. Comments in the tests say so.

## Verification
Full suite 211 tests pass, `event-audit --strict` exit 0, dep-map runs.
