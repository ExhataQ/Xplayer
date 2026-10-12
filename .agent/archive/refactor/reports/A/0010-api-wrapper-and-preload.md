# Agent A report 0010: api wrapper and preload groups

Steps: A-14. Applies on top of: report 0009 (A-13 plus the start-up gate).
Archive (.agent/AGENTS.md section 1): not done, nothing archived.

## Changes

- src/js/api/desktop-api.js (new, classic, second in the manifest): `desktopApi.available()`, `desktopApi.supports('group.name')`, and `desktopApi.<group>.<name>(...)` for 40 calls in the groups `window`, `library`, `metadata`, `files`, `lyrics`. It calls the flat `window.electronAPI.<name>`, so the test stub (a Proxy) and an older preload still work. A missing call rejects (calls that return a promise) or returns undefined (fire-and-forget and event subscriptions). Guards that showed "not available in browser mode" are kept, as `desktopApi.supports(...)`.
- electron/preload.js: calls are defined once in five groups and exposed both as `electronAPI.<group>.<name>` and as the old flat `electronAPI.<name>`. New call `welcomeSelectFolder` (channel `welcome-select-folder`). Generic `invoke` kept.
- 03f, 03j, 03k, 03m, 99-player.js, ui/window-controls.js, library/import-dropped.js, playback/session.js: every `window.electronAPI` use replaced.
- src/manifest.json: `api/desktop-api.js` after `core/storage.js`.
- tools/tests/desktop-api.test.js (new, 9 tests): old names all still exist; each old name still makes the same ipc call (kind and channel); groups cover every old name exactly once; the wrapper's list equals the preload's groups; wrapper behaviour with and without electronAPI; a check that no file outside the other agents' list uses `window.electronAPI`; a page test with a recording electronAPI.
- .agent/PLAN.md, BOARD.md, tools/change.log.txt updated.

## Numbers

`node tools/event-audit.js --strict`: exit 0, A/B/C 0, 68 allowed by fileExceptions.
Deliberate break: changing the `delete-file` channel in the preload makes the channel test fail; removing the `closeApp` call in `ui/window-controls.js` makes the page test fail; both restored.

## Tests actually run

- See the final count in my reply (all files in tools/tests).
- Not run: Electron itself (the preload was tested against a fake `electron` module).

## Needs from other agents

- B (B-09): `15e-controls-audio-events.js`, `16-context-menu-actions.js`.
- C (C-06): `08e-panel-settings.js`, `11d`, `11f`, `19`, `20`.
- D (D-06, D-08): `06b-modals.js` (also replace `invoke('welcome-select-folder')` with `desktopApi.library.welcomeSelectFolder()`), `06k-keyboard-shortcuts.js`.
- Each: swap `window.electronAPI.x` for `desktopApi.<group>.x` (group names in `desktop-api.js`) and `window.electronAPI && window.electronAPI.x` guards for `desktopApi.supports('<group>.x')`; then remove your file from the list in `desktop-api.test.js`.

## Not done

- The generic `invoke` is still in the preload; it goes in A-16 once D's `06b` swap lands.
- The renderer calls the flat names. Switching the wrapper to the grouped names is part of A-16 (the test stub would need grouped names first).

## For you (manual checks)

1. Start the app and close, minimise and maximise from the title bar -> all three work.
2. Settings > music folders: add and remove a folder, then apply -> the library rebuilds as before.
3. Drag an audio file onto the window -> it imports.
4. Thumbnail buttons in the Windows taskbar (previous, play/pause, next) still work (15e is not changed, this checks the preload).

## Event subscriptions and start-up

`desktopApi` wraps every `on` callback in `whenAppReady`, so messages from the main process that arrive before the deferred modules and `SONGS_DATA` exist are held until start-up finishes. Code still calling `window.electronAPI.onX` directly (B: 15e window maximize / thumbar) should move to `desktopApi` or wrap its callback in `whenAppReady`.
